import { config } from "dotenv";
import { Client } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { normalizeHebrew } from "@/lib/hebrew";
import { HEBREW_INPUTS } from "@/tests/fixtures/hebrew-inputs";

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

/**
 * Runs against a database with the migrations applied (`supabase db push`,
 * `pnpm db:push` or the bundle from `pnpm db:bundle`). Skipped when there is no
 * `SUPABASE_DB_URL`, and skipped again when the host cannot be reached, so the suite
 * stays green on a laptop with no database and on a network that blocks port 5432.
 */
describe.skipIf(!connected)("SQL and TypeScript agree", () => {
  if (!client) throw new Error("unreachable: the suite is skipped without a client");

  afterAll(async () => {
    await client.end();
  });

  it("normalize_he matches normalizeHebrew across the corpus", async () => {
    const { rows } = await client.query<{ input: string; normalized: string }>(
      "select input, public.normalize_he(input) as normalized from unnest($1::text[]) as input",
      [[...HEBREW_INPUTS]],
    );

    expect(rows).toHaveLength(HEBREW_INPUTS.length);

    for (const row of rows) {
      expect(row.normalized, `normalize_he(${JSON.stringify(row.input)})`).toBe(
        normalizeHebrew(row.input),
      );
    }
  });

  it("catalog name_norm columns match the TypeScript normalizer", async () => {
    const { rows } = await client.query<{ name: string; name_norm: string }>(
      "select name, name_norm from public.catalog_items where household_id is null limit 500",
    );

    expect(rows.length).toBeGreaterThan(300);

    for (const row of rows) {
      expect(row.name_norm).toBe(normalizeHebrew(row.name));
    }
  });

  it("match_catalog returns the best matches first", async () => {
    const { rows } = await client.query<{ name: string; score: number }>(
      "select name, score from public.match_catalog($1, $2, 8)",
      [crypto.randomUUID(), "חלב"],
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].name).toBe("חלב");
    expect([...rows].sort((a, b) => b.score - a.score)).toEqual(rows);
  });

  it("match_catalog finds a product through an alias", async () => {
    const { rows } = await client.query<{ name: string }>(
      "select name from public.match_catalog($1, $2, 3)",
      [crypto.randomUUID(), "קוטג"],
    );

    expect(rows.map((row) => row.name)).toContain("קוטג׳");
  });

  it("match_catalog ignores an empty query", async () => {
    const { rows } = await client.query(
      "select * from public.match_catalog($1, $2, 8)",
      [crypto.randomUUID(), "   "],
    );

    expect(rows).toHaveLength(0);
  });
});
