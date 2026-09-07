/**
 * Applies `supabase/migrations` to SUPABASE_DB_URL in order, each file in its own
 * transaction, and records it in `supabase_migrations.schema_migrations` the way the
 * Supabase CLI does — so a later `supabase db push` sees them as already applied.
 *
 * Exists because the CLI ships as a 59 MB platform binary that this machine could not
 * download. Prefer `supabase db push` wherever the CLI is installed.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import "./env.mjs";

const MIGRATIONS_DIR = "supabase/migrations";
const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString || connectionString.includes("PASTE_DB_PASSWORD")) {
  console.error(
    "SUPABASE_DB_URL is not set. Add the direct connection string to .env.local.",
  );
  process.exit(1);
}

const files = (await readdir(MIGRATIONS_DIR))
  .filter((file) => file.endsWith(".sql"))
  .sort();

const client = new Client({ connectionString });
client.on("notice", (notice) => console.log(`  ${notice.message?.trim()}`));

await client.connect();

await client.query(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (
    version    text primary key,
    statements text[],
    name       text
  );
`);

const { rows } = await client.query(
  "select version from supabase_migrations.schema_migrations",
);
const applied = new Set(rows.map((row) => row.version));

let count = 0;

for (const file of files) {
  const version = file.split("_")[0];

  if (applied.has(version)) {
    console.log(`skipped  ${file}`);
    continue;
  }

  const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");

  try {
    await client.query("begin");
    await client.query(sql);
    await client.query(
      `insert into supabase_migrations.schema_migrations (version, name, statements)
       values ($1, $2, $3)`,
      [version, file.replace(/^\d+_/, "").replace(/\.sql$/, ""), [sql]],
    );
    await client.query("commit");
    console.log(`applied  ${file}`);
    count += 1;
  } catch (error) {
    await client.query("rollback");
    console.error(
      `failed   ${file}: ${error instanceof Error ? error.message : error}`,
    );
    process.exitCode = 1;
    break;
  }
}

await client.end();

if (process.exitCode !== 1) {
  console.log(
    count === 0 ? "Database already up to date." : `Applied ${count} migration(s).`,
  );
}
