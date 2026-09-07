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
  // #region agent log
  fetch('http://127.0.0.1:7819/ingest/ddb11756-cca7-49a3-abc9-419b9db515a5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc4700'},body:JSON.stringify({sessionId:'bc4700',runId:'run1',hypothesisId:'A,B',location:'lib/env.ts:25',message:'serverEnv called: presence and length only, never values',data:{cached:cached!==null,supabaseUrlLength:(process.env.NEXT_PUBLIC_SUPABASE_URL??'').length,anonKeyLength:(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??'').length,serviceKeyLength:(process.env.SUPABASE_SERVICE_ROLE_KEY??'').length,serviceKeyPrefix:(process.env.SUPABASE_SERVICE_ROLE_KEY??'').slice(0,3),appSecretLength:(process.env.APP_SECRET??'').length,upstashUrlLength:(process.env.UPSTASH_REDIS_REST_URL??'').length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!cached) {
    try {
      cached = ServerEnv.parse({
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        APP_SECRET: process.env.APP_SECRET,
        UPSTASH_REDIS_REST_URL: unset(process.env.UPSTASH_REDIS_REST_URL),
        UPSTASH_REDIS_REST_TOKEN: unset(process.env.UPSTASH_REDIS_REST_TOKEN),
      });
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7819/ingest/ddb11756-cca7-49a3-abc9-419b9db515a5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bc4700'},body:JSON.stringify({sessionId:'bc4700',runId:'run1',hypothesisId:'A,B',location:'lib/env.ts:38',message:'serverEnv parse threw; field names only',data:{issues:error instanceof z.ZodError?error.issues.map((i)=>({path:i.path.join('.'),code:i.code,message:i.message})):String(error)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw error;
    }
  }
  return cached;
}

