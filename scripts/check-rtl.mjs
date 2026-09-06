/**
 * Fails when a physical (direction-aware) Tailwind class appears in our own code.
 * Mirrors the CI grep from the project rules, but runs on Windows too.
 *
 * `components/ui` is excluded: shadcn was initialised with `--rtl`, so its output
 * already uses logical properties (`start-1/2`, `border-e`, `-end-1`) and pairs every
 * transform with an `rtl:` variant. The physical classes still in there are
 * direction-semantic by design — `data-[side=left]:left-0` and `slide-in-from-right-2`
 * describe a physical side, not a reading direction. Any shadcn component added later
 * has to be held to the same bar by hand.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const ROOTS = ["app", "components", "lib", "actions", "hooks"];
const EXCLUDED_DIRS = new Set(["ui", "node_modules", ".next"]);
const EXTENSIONS = /\.(tsx?|jsx?|css|mdx?)$/;

const FORBIDDEN =
  /\b(ml|mr|pl|pr)-|\b(left|right)-|text-(left|right)|border-[lr]\b|rounded-[lr]-|float-(left|right)/;

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (EXTENSIONS.test(entry.name)) {
      yield full;
    }
  }
}

const violations = [];

for (const root of ROOTS) {
  for await (const file of walk(root)) {
    const lines = (await readFile(file, "utf8")).split("\n");
    lines.forEach((line, index) => {
      if (FORBIDDEN.test(line)) {
        violations.push(
          `${relative(process.cwd(), file).split(sep).join("/")}:${index + 1}: ${line.trim()}`,
        );
      }
    });
  }
}

if (violations.length > 0) {
  process.stderr.write(
    `Found ${violations.length} physical direction class(es). Use logical properties (ms/me/ps/pe/start/end/text-start/text-end/border-s/border-e/rounded-s/rounded-e):\n${violations.join("\n")}\n`,
  );
  process.exit(1);
}

process.stdout.write("RTL check passed: no physical direction classes.\n");
