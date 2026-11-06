import { describe, expect, it } from "vitest";
import { normalizeHebrew } from "@/lib/hebrew";
import {
  effectiveCatalog,
  matchCatalogLocal,
  trigramSimilarity,
  type CatalogEntry,
} from "@/lib/catalog-match";

function entry(overrides: Partial<CatalogEntry> & { name: string }): CatalogEntry {
  return {
    id: overrides.id ?? overrides.name,
    // The DB stores nameNorm already normalized by normalize_he.
    nameNorm: overrides.nameNorm ?? normalizeHebrew(overrides.name),
    aliasesNorm: [],
    categoryKey: "other",
    defaultUnit: "יחידה",
    emoji: null,
    isStaple: false,
    useCount: 0,
    lastUsedAt: null,
    isHousehold: false,
    ...overrides,
  };
}

describe("trigramSimilarity", () => {
  it("is 1 for identical strings and 0 for unrelated ones", () => {
    expect(trigramSimilarity("חלב", "חלב")).toBe(1);
    expect(trigramSimilarity("חלב", "דג")).toBe(0);
  });

  it("scores close words above the 0.35 threshold", () => {
    expect(trigramSimilarity("עגבניות", "עגבניה")).toBeGreaterThan(0.35);
  });
});

describe("matchCatalogLocal", () => {
  const catalog = [
    entry({ name: "חלב", useCount: 5 }),
    entry({ name: "חלב שקדים", useCount: 1 }),
    entry({ name: "חלווה" }),
    entry({ name: "לחם", aliasesNorm: ["חלה"] }),
    entry({ name: "מלפפונים" }),
  ];

  it("ranks a prefix match first", () => {
    const results = matchCatalogLocal(catalog, "חל");
    expect(results.map((r) => r.name)).toContain("חלב");
    expect(results[0].score).toBe(100);
    expect(results.every((r) => r.nameNorm.startsWith("חל"))).toBe(true);
  });

  it("orders prefix matches by use count", () => {
    const results = matchCatalogLocal(catalog, "חל");
    expect(results[0].name).toBe("חלב");
  });

  it("matches an exact alias", () => {
    const results = matchCatalogLocal(catalog, "חלה");
    expect(results.some((r) => r.name === "לחם" && r.score === 80)).toBe(true);
  });

  it("finds fuzzy matches for typos", () => {
    const results = matchCatalogLocal(catalog, "מלפפון");
    expect(results.some((r) => r.name === "מלפפונים")).toBe(true);
  });

  it("returns nothing for an empty or unknown query", () => {
    expect(matchCatalogLocal(catalog, "")).toEqual([]);
    expect(matchCatalogLocal(catalog, "xyz")).toEqual([]);
  });

  it("normalizes final letters like the SQL normalize_he", () => {
    // ם (final mem) folds to מ, so "לחם" matches the "לחמ" prefix too.
    const results = matchCatalogLocal(catalog, "לחמ");
    expect(results.some((r) => r.name === "לחם")).toBe(true);
  });

  it("lets a household row override the global row with the same name", () => {
    const rows = [
      entry({ name: "חלב", categoryKey: "dairy" }),
      entry({ name: "חלב", categoryKey: "other", isHousehold: true }),
    ];
    const effective = effectiveCatalog(rows);
    expect(effective).toHaveLength(1);
    expect(effective[0].categoryKey).toBe("other");
  });
});
