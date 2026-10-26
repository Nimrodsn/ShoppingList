import { config } from "dotenv";
import { Client } from "pg";
import { afterAll, describe, expect, it } from "vitest";

config({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.SUPABASE_DB_URL;

/** Reachability, not correctness: a blocked port or a missing host is not a failure. */
const UNREACHABLE = /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|timeout/i;

const client = connectionString ? new Client({ connectionString }) : null;

const connected = await (async () => {
  if (!client) return false;

  try {
    await client.connect();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (UNREACHABLE.test(message)) {
      console.warn(`Skipping the database tests: ${message}`);
      return false;
    }
    throw error;
  }
})();

type AddOutcome =
  | { status: "added"; itemId: string; name: string }
  | { status: "merged"; itemId: string; name: string; quantity: number }
  | { status: "duplicate" };

/**
 * Guards the fixes from the security/data-safety review: function EXECUTE privileges,
 * the idempotent atomic add, and the transactional trip close. Needs a database with
 * all migrations applied (SUPABASE_DB_URL), otherwise the suite skips itself.
 */
describe.skipIf(!connected)("SQL hardening", () => {
  const db = (): Client => client as Client;

  let householdId = "";
  let listId = "";

  afterAll(async () => {
    if (householdId) {
      await db().query("delete from public.households where id = $1", [householdId]);
    }
    await client?.end();
  });

  it("SECURITY DEFINER functions are executable only by their owner and service_role", async () => {
    const { rows } = await db().query<{ proname: string; proacl: string[] | null }>(
      `select p.proname, p.proacl::text[]
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef`,
    );

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      // proacl NULL is the Postgres default: PUBLIC can execute. It must never be
      // NULL here, and no acl may hand EXECUTE to PUBLIC (empty grantee), anon or
      // authenticated.
      expect(row.proacl, `${row.proname} must not keep default PUBLIC execute`).not.toBeNull();
      for (const acl of row.proacl ?? []) {
        const grantee = acl.split("=")[0];
        expect(
          ["anon", "authenticated", ""].includes(grantee),
          `${row.proname} grants EXECUTE to ${grantee === "" ? "PUBLIC" : grantee}`,
        ).toBe(false);
      }
    }
  });

  it("apply_add_item replays as a no-op and merges atomically", async () => {
    const setup = await db().query<{ id: string; secret_slug: string; realtime_key: string }>(
      "select * from public.create_household('בדיקת קשיחות')",
    );
    householdId = setup.rows[0].id;

    const lists = await db().query<{ id: string }>(
      "select id from public.lists where household_id = $1 order by position limit 1",
      [householdId],
    );
    listId = lists.rows[0].id;

    const add = (clientId: string, quantity: number) =>
      db().query<{ apply_add_item: AddOutcome }>(
        `select public.apply_add_item($1, $2, $3, null, 'חלב בדיקה', $4, null, null, false, 'בדיקה')`,
        [clientId, householdId, listId, quantity],
      );

    const first = await add("aaaaaaaa-0000-0000-0000-000000000001", 1);
    expect(first.rows[0].apply_add_item.status).toBe("added");

    const replay = await add("aaaaaaaa-0000-0000-0000-000000000001", 1);
    expect(replay.rows[0].apply_add_item.status).toBe("duplicate");

    // Two simultaneous adds of the same product both merge into the open row and
    // must add up, not lose one another.
    const [left, right] = await Promise.all([
      add("aaaaaaaa-0000-0000-0000-000000000002", 2),
      add("aaaaaaaa-0000-0000-0000-000000000003", 3),
    ]);
    expect(
      [left.rows[0].apply_add_item.status, right.rows[0].apply_add_item.status],
    ).toEqual(["merged", "merged"]);

    const item = await db().query<{ count: string; quantity: string }>(
      `select count(*)::text, min(quantity)::text as quantity from public.items
        where household_id = $1 and name_norm = public.normalize_he('חלב בדיקה')`,
      [householdId],
    );
    expect(item.rows[0].count).toBe("1");
    expect(Number(item.rows[0].quantity)).toBe(6);
  });

  it("close_trip archives exactly the checked rows and heals on retry", async () => {
    const add = (clientId: string, name: string) =>
      db().query(`select public.apply_add_item($1, $2, $3, null, $4, 1, null, null, false, 'בדיקה')`, [
        clientId,
        householdId,
        listId,
        name,
      ]);

    await add("bbbbbbbb-0000-0000-0000-000000000001", "לחם בדיקה");
    await add("bbbbbbbb-0000-0000-0000-000000000002", "ביצים בדיקה");
    await add("bbbbbbbb-0000-0000-0000-000000000003", "אורז בדיקה"); // stays open

    await db().query(
      `update public.items set is_checked = true, checked_by = 'בדיקה'
        where household_id = $1 and name_norm in
          (public.normalize_he('לחם בדיקה'), public.normalize_he('ביצים בדיקה'))`,
      [householdId],
    );

    const first = await db().query<{ close_trip: { archived: number; remaining: number } }>(
      "select public.close_trip($1, $2, 'בדיקה')",
      [householdId, listId],
    );
    expect(first.rows[0].close_trip).toEqual({ archived: 2, remaining: 2 });

    // A retry after a lost response must not duplicate history.
    const retry = await db().query<{ close_trip: { archived: number; remaining: number } }>(
      "select public.close_trip($1, $2, 'בדיקה')",
      [householdId, listId],
    );
    expect(retry.rows[0].close_trip).toEqual({ archived: 0, remaining: 2 });

    const history = await db().query<{ count: string }>(
      "select count(*)::text from public.purchase_history where household_id = $1",
      [householdId],
    );
    expect(history.rows[0].count).toBe("2");

    // The open item was never touched.
    const open = await db().query<{ count: string }>(
      "select count(*)::text from public.items where household_id = $1 and is_checked = false",
      [householdId],
    );
    expect(open.rows[0].count).toBe("2");
  });
});
