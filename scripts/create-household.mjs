/**
 * Creates a household with its categories and default lists, then prints the
 * secret join link. Run after the first deploy: `pnpm create-household`.
 */
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL ?? "http://localhost:3000";
const householdName = process.argv[2] ?? "הבית שלנו";

if (!url || !serviceRoleKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.rpc("create_household", {
  p_name: householdName,
});

if (error) {
  console.error("Failed to create household:", error.message);
  process.exit(1);
}

const household = Array.isArray(data) ? data[0] : data;

if (!household) {
  console.error("create_household returned no row.");
  process.exit(1);
}

console.log(`Household created: ${household.id}`);
console.log(`Join link: ${appUrl.replace(/\/$/, "")}/j/${household.secret_slug}`);
console.log("Share this link only with the family. It is the only credential.");
