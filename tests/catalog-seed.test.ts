import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { normalizeHebrew } from "@/lib/hebrew";

const SEED_PATH = "supabase/migrations/0002_seed_catalog.sql";

async function catalogNames(): Promise<string[]> {
  const sql = await readFile(SEED_PATH, "utf8");
  return [...sql.matchAll(/^ {2}\(null, '([^']+)',/gm)].map((match) => match[1]);
}

describe("global catalog seed", () => {
  it("ships at least 300 products", async () => {
    const names = await catalogNames();
    expect(names.length).toBeGreaterThanOrEqual(300);
  });

  it("has no name_norm collisions, which the catalog_glb_name index would reject", async () => {
    const names = await catalogNames();
    const byNorm = new Map<string, string>();
    const collisions: string[] = [];

    for (const name of names) {
      const norm = normalizeHebrew(name);
      const previous = byNorm.get(norm);
      if (previous) {
        collisions.push(`"${previous}" / "${name}" -> "${norm}"`);
      } else {
        byNorm.set(norm, name);
      }
    }

    expect(collisions).toEqual([]);
  });

  it("only references the 17 known category keys", async () => {
    const sql = await readFile(SEED_PATH, "utf8");
    const known = new Set([
      "produce",
      "bakery",
      "dairy",
      "meat",
      "frozen",
      "canned",
      "grains",
      "condiments",
      "coffee",
      "snacks",
      "drinks",
      "baby",
      "cleaning",
      "pharma",
      "household",
      "pets",
      "other",
    ]);

    const used = [...sql.matchAll(/,\s*'([a-z]+)',\s*'[^']*',\s*'[^']*',\s*(?:true|false)\)/g)].map(
      (match) => match[1],
    );

    expect(used.length).toBeGreaterThan(0);
    expect(used.filter((key) => !known.has(key))).toEqual([]);
  });
});
