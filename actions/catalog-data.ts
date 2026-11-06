import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireHousehold } from "@/lib/auth/household";
import type { CatalogEntry } from "@/lib/catalog-match";

/**
 * The whole catalog this household can see: the shared global rows plus its own
 * overrides. Small enough (hundreds of rows) to ship to the client once, which is
 * what makes autocomplete instant instead of a server round trip per keystroke.
 * Cached per request, so the homepage and the staples list share one fetch.
 */
export const getCatalog = cache(async (): Promise<CatalogEntry[]> => {
  const householdId = await requireHousehold();

  const { data, error } = await supabaseAdmin()
    .from("catalog_items")
    .select(
      "id, name, name_norm, aliases_norm, category_key, default_unit, emoji, is_staple, use_count, last_used_at, household_id",
    )
    .or(`household_id.is.null,household_id.eq.${householdId}`);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    nameNorm: row.name_norm,
    aliasesNorm: row.aliases_norm ?? [],
    categoryKey: row.category_key,
    defaultUnit: row.default_unit,
    emoji: row.emoji,
    isStaple: row.is_staple,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
    isHousehold: row.household_id !== null,
  }));
});
