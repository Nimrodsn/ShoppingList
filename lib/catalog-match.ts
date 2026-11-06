/**
 * Client-side catalog matching. Mirrors the scoring of `public.match_catalog` in
 * `supabase/migrations/0005_match_catalog_ranking.sql`, so typing a product name
 * answers instantly from the already-loaded catalog instead of paying a server
 * round trip per keystroke.
 *
 * Pure and framework-free so it can be unit tested. If the SQL scoring changes,
 * change this file to match.
 */
import { normalizeHebrew } from "@/lib/hebrew";

export type CatalogEntry = {
  id: string;
  name: string;
  nameNorm: string;
  aliasesNorm: string[];
  categoryKey: string;
  defaultUnit: string;
  emoji: string | null;
  isStaple: boolean;
  useCount: number;
  lastUsedAt: string | null;
  /** A household's own row overrides the shared global row with the same name. */
  isHousehold: boolean;
};

/** pg_trgm pads each word with two spaces before and one after, then takes 3-char shingles. */
function trigrams(value: string): Set<string> {
  const grams = new Set<string>();
  for (const word of value.split(" ")) {
    if (word.length === 0) continue;
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i += 1) {
      grams.add(padded.slice(i, i + 3));
    }
  }
  return grams;
}

/** Same formula as pg_trgm's `similarity`: shared / (|a| + |b| - shared). */
export function trigramSimilarity(a: string, b: string): number {
  const left = trigrams(a);
  const right = trigrams(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const gram of left) {
    if (right.has(gram)) shared += 1;
  }
  return shared / (left.size + right.size - shared);
}

/** The SQL `distinct on (name_norm) ... household_id nulls last`: household rows win. */
export function effectiveCatalog(entries: CatalogEntry[]): CatalogEntry[] {
  const byNorm = new Map<string, CatalogEntry>();
  for (const entry of entries) {
    const current = byNorm.get(entry.nameNorm);
    if (!current || (!current.isHousehold && entry.isHousehold)) {
      byNorm.set(entry.nameNorm, entry);
    }
  }
  return [...byNorm.values()];
}

export type ScoredCatalogEntry = CatalogEntry & { score: number };

/**
 * Scoring parity with the SQL function:
 *   prefix match on nameNorm      -> 100
 *   exact match on an alias       ->  80
 *   trigram similarity >= 0.35    ->  60 * similarity
 * Ties break on useCount, then lastUsedAt.
 */
export function matchCatalogLocal(
  entries: CatalogEntry[],
  rawQuery: string,
  limit = 8,
): ScoredCatalogEntry[] {
  const norm = normalizeHebrew(rawQuery);
  if (norm.length === 0) return [];

  const scored: ScoredCatalogEntry[] = [];
  for (const entry of effectiveCatalog(entries)) {
    let score = 0;
    if (entry.nameNorm.startsWith(norm)) {
      score = 100;
    } else if (entry.aliasesNorm.includes(norm)) {
      score = 80;
    } else {
      const sim = trigramSimilarity(entry.nameNorm, norm);
      if (sim >= 0.35) score = 60 * sim;
    }
    if (score > 0) scored.push({ ...entry, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    return (b.lastUsedAt ?? "").localeCompare(a.lastUsedAt ?? "");
  });

  return scored.slice(0, limit);
}
