import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type LimitResult = { success: boolean };

type Limiter = { limit: (identifier: string) => Promise<LimitResult> };

/**
 * Vercel runs many short-lived instances, so an in-process counter is worthless in
 * production. It exists only so local development works without an Upstash database.
 */
function inMemoryLimiter(requests: number, windowMs: number): Limiter {
  const hits = new Map<string, number[]>();
  let warned = false;

  return {
    async limit(identifier: string) {
      if (!warned) {
        console.warn(
          "Upstash is not configured; falling back to an in-memory rate limiter. Do not ship this to production.",
        );
        warned = true;
      }

      const now = Date.now();
      const recent = (hits.get(identifier) ?? []).filter(
        (at) => now - at < windowMs,
      );
      recent.push(now);
      hits.set(identifier, recent);
      return { success: recent.length <= requests };
    },
  };
}

function upstashRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function createLimiter(
  prefix: string,
  requests: number,
  window: `${number} m` | `${number} s`,
  windowMs: number,
): () => Limiter {
  let instance: Limiter | null = null;

  return () => {
    if (!instance) {
      const redis = upstashRedis();
      instance = redis
        ? new Ratelimit({
            redis,
            prefix,
            limiter: Ratelimit.slidingWindow(requests, window),
            analytics: false,
          })
        : inMemoryLimiter(requests, windowMs);
    }
    return instance;
  };
}

/** 10 join attempts per minute per IP, so the 22-character slug cannot be brute forced. */
export const joinLimiter = createLimiter("hh:join", 10, "1 m", 60_000);

/** Bulk add is the only endpoint that can create many rows in one call. */
export const bulkAddLimiter = createLimiter("hh:bulk", 30, "1 m", 60_000);

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}
