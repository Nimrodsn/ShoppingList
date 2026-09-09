import "server-only";
import { z } from "zod";

const ServerEnv = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 bytes"),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

let cached: z.infer<typeof ServerEnv> | null = null;

/**
 * A declared-but-empty variable means "not set". `.env` files and the Vercel dashboard
 * both hand those over as `""`, which `.optional()` rejects, and an unconfigured
 * Upstash would take the whole app down instead of falling back to the local counter.
 */
function unset(value: string | undefined): string | undefined {
  return value === "" ? undefined : value;
}

/** Parsed lazily so a missing key fails on first use with a readable message, not at import time. */
export function serverEnv(): z.infer<typeof ServerEnv> {
  if (!cached) {
    cached = ServerEnv.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      APP_SECRET: process.env.APP_SECRET,
      UPSTASH_REDIS_REST_URL: unset(process.env.UPSTASH_REDIS_REST_URL),
      UPSTASH_REDIS_REST_TOKEN: unset(process.env.UPSTASH_REDIS_REST_TOKEN),
    });
  }
  return cached;
}

