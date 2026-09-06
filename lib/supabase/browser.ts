"use client";

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;

/**
 * Realtime only. The anon key can neither read nor write, because RLS is enabled on
 * every table with zero policies. Never call `.from()` from the browser: all data
 * access goes through Server Actions.
 */
function realtimeClient() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error("Supabase public environment variables are missing");
    }

    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}

/**
 * The household channel. `realtimeKey` arrives as a prop from a Server Component,
 * never from a readable cookie. Messages carry `{op, table}` and no row content.
 */
export function householdChannel(
  realtimeKey: string,
  presenceKey: string,
): RealtimeChannel {
  return realtimeClient().channel(`hh:${realtimeKey}`, {
    config: { presence: { key: presenceKey } },
  });
}

export function removeChannel(channel: RealtimeChannel): void {
  void realtimeClient().removeChannel(channel);
}
