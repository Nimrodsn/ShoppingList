import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | null = null;

/**
 * The only way into Postgres. Uses the service role key, so importing this from a
 * client component fails the build on purpose (`server-only`).
 * RLS is enabled with zero policies, which means nothing else can read or write.
 */
export function supabaseAdmin(): SupabaseClient<Database> {
  if (!client) {
    const env = serverEnv();
    client = createClient<Database>(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { "x-application-name": "our-basket" } },
      },
    );
  }
  return client;
}
