// Temporary debug probe. Reads the deployed landing page, fetches every client chunk it
// references and reports which Supabase URL the deployment was built with.
import { execFileSync } from "node:child_process";

const ORIGIN = process.argv[2] ?? "https://shoppinglist-virid.vercel.app";

function get(path) {
  return execFileSync("curl.exe", ["-s", `${ORIGIN}${path}`], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
}

const html = get("/");
const chunks = [
  ...new Set([...html.matchAll(/\/_next\/static\/[^"'\\)]+?\.js/g)].map((m) => m[0])),
];

console.log(`chunks referenced by /: ${chunks.length}`);

const hits = new Set();
for (const chunk of chunks) {
  const body = get(chunk);
  for (const match of body.matchAll(/https:\/\/[a-z0-9-]+\.supabase\.co/g)) {
    hits.add(`${chunk} -> ${match[0]}`);
  }
  if (/NEXT_PUBLIC_SUPABASE_URL/.test(body)) {
    hits.add(`${chunk} -> literal NEXT_PUBLIC_SUPABASE_URL left uninlined`);
  }
}

console.log(hits.size ? [...hits].join("\n") : "no supabase url present in these chunks");
