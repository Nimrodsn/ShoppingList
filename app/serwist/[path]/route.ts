import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// Turbopack has no plugin API yet, so Serwist builds the service worker from
// this Route Handler instead. The revision versions the precached offline page,
// so a deploy can never keep serving the previous shell.
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
    additionalPrecacheEntries: [{ url: "/~offline", revision }],
    useNativeEsbuild: true,
  });
