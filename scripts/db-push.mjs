/**
 * Applies `supabase/migrations` in order and records each one in
 * `supabase_migrations.schema_migrations`, the same table the Supabase CLI reads, so
 * a later `supabase db push` sees them as already applied.
 *
 * Two transports, because networks differ:
 *   - `SUPABASE_DB_URL`        → direct Postgres over 5432 (fastest, needs the port open)
 *   - `SUPABASE_ACCESS_TOKEN`  → the Management API over 443, for networks that block
 *                                Postgres ports entirely. Token: Supabase Dashboard →
 *                                Account → Access Tokens.
 * The API transport wins when both are set, since it is the one that always works.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import "./env.mjs";

const MIGRATIONS_DIR = "supabase/migrations";

const BOOKKEEPING = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version    text primary key,
    statements text[],
    name       text
  );
`;

function projectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return new URL(url).hostname.split(".")[0];
}

/** Runs SQL through the Management API. Each call is one implicit transaction. */
function apiRunner(token) {
  const endpoint = `https://api.supabase.com/v1/projects/${projectRef()}/database/query`;

  return {
    label: "Management API",
    async run(sql) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      });

      const body = await response.text();

      if (!response.ok) {
        const detail = (() => {
          try {
            const parsed = JSON.parse(body);
            return parsed.message ?? parsed.error ?? body;
          } catch {
            return body;
          }
        })();
        throw new Error(`${response.status}: ${detail}`);
      }

      return body ? JSON.parse(body) : [];
    },
    async close() {},
  };
}

/** Runs SQL over a direct Postgres connection. */
async function pgRunner(connectionString) {
  const client = new Client({ connectionString });
  client.on("notice", (notice) => console.log(`  ${notice.message?.trim()}`));
  await client.connect();

  return {
    label: "direct connection",
    async run(sql) {
      const result = await client.query(sql);
      return Array.isArray(result) ? (result.at(-1)?.rows ?? []) : result.rows;
    },
    async close() {
      await client.end();
    },
  };
}

async function pickRunner() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (token) return apiRunner(token);

  const connectionString = process.env.SUPABASE_DB_URL;
  if (connectionString && !connectionString.includes("PASTE_DB_PASSWORD")) {
    return pgRunner(connectionString);
  }

  console.error(
    "Set SUPABASE_ACCESS_TOKEN (Management API) or SUPABASE_DB_URL (direct) in .env.local.",
  );
  process.exit(1);
}

const runner = await pickRunner();
console.log(`Pushing migrations over the ${runner.label}.`);

const files = (await readdir(MIGRATIONS_DIR))
  .filter((file) => file.endsWith(".sql"))
  .sort();

let count = 0;

try {
  await runner.run(BOOKKEEPING);

  const rows = await runner.run(
    "select version from supabase_migrations.schema_migrations",
  );
  const applied = new Set(rows.map((row) => row.version));

  for (const file of files) {
    const version = file.split("_")[0];

    if (applied.has(version)) {
      console.log(`skipped  ${file}`);
      continue;
    }

    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    const name = file.replace(/^\d+_/, "").replace(/\.sql$/, "");

    await runner.run(sql);
    // Version and name come from the filename, so no quoting hazard. `statements` stays
    // null: the CLI only looks at `version` to decide what is already applied.
    await runner.run(
      `insert into supabase_migrations.schema_migrations (version, name)
       values ('${version}', '${name}')`,
    );

    console.log(`applied  ${file}`);
    count += 1;
  }

  console.log(
    count === 0 ? "Database already up to date." : `Applied ${count} migration(s).`,
  );
} catch (error) {
  console.error(`failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await runner.close();
}
