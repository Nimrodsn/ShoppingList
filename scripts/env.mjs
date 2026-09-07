/**
 * Loads the same files Next.js does, in the same order: `.env.local` wins over `.env`.
 * Plain `dotenv/config` only reads `.env`, which silently misses every local secret.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });
