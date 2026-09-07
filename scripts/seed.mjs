/**
 * Runs supabase/seed.sql against SUPABASE_DB_URL for local development.
 * Remote projects get their defaults from the numbered migrations instead.
 */
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import "./env.mjs";

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set. Add it to .env.local.");
  process.exit(1);
}

const sql = await readFile("supabase/seed.sql", "utf8");
const client = new Client({ connectionString });

try {
  await client.connect();
  client.on("notice", (notice) => console.log(notice.message));
  const result = await client.query(sql);
  const rows = Array.isArray(result) ? result.at(-1)?.rows : result.rows;
  if (rows?.length) {
    console.table(rows);
  }
  console.log("Seed complete.");
} catch (error) {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
