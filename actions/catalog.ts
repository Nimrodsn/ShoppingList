"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireHousehold } from "@/lib/auth/household";
import { CatalogQuerySchema, ItemNameSchema, UuidSchema } from "@/lib/schemas";

export type CatalogSuggestion = {
  id: string;
  name: string;
  categoryKey: string;
  defaultUnit: string;
  emoji: string | null;
  isStaple: boolean;
};

export async function matchCatalog(
  rawQuery: string,
  rawLimit?: number,
): Promise<CatalogSuggestion[]> {
  const householdId = await requireHousehold();
  const { query, limit } = CatalogQuerySchema.parse({
    query: rawQuery,
    limit: rawLimit ?? 8,
  });

  if (query.length === 0) return [];

  const { data, error } = await supabaseAdmin().rpc("match_catalog", {
    p_household_id: householdId,
    p_query: query,
    p_limit: limit,
  });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    categoryKey: row.category_key,
    defaultUnit: row.default_unit,
    emoji: row.emoji,
    isStaple: row.is_staple,
  }));
}

/**
 * Called when someone corrects an item's category by hand. Upserts a household-scoped
 * catalog row so the system learns without duplicating the global entry.
 */
export async function teachCategory(
  rawName: string,
  rawCategoryId: string,
): Promise<void> {
  const householdId = await requireHousehold();
  const name = ItemNameSchema.parse(rawName);
  const categoryId = UuidSchema.parse(rawCategoryId);
  const supabase = supabaseAdmin();

  const { data: category } = await supabase
    .from("categories")
    .select("key")
    .eq("household_id", householdId)
    .eq("id", categoryId)
    .maybeSingle();

  if (!category) return;

  await supabase
    .from("catalog_items")
    .upsert(
      { household_id: householdId, name, category_key: category.key },
      { onConflict: "household_id, name_norm" },
    );

  revalidatePath("/");
}

export async function listStaples(): Promise<CatalogSuggestion[]> {
  const householdId = await requireHousehold();

  const { data, error } = await supabaseAdmin()
    .from("catalog_items")
    .select("id, name, category_key, default_unit, emoji, is_staple, household_id")
    .or(`household_id.is.null,household_id.eq.${householdId}`)
    .eq("is_staple", true)
    .order("use_count", { ascending: false })
    .order("name");

  if (error || !data) return [];

  const seen = new Set<string>();
  const staples: CatalogSuggestion[] = [];

  for (const row of data) {
    if (seen.has(row.name)) continue;
    seen.add(row.name);
    staples.push({
      id: row.id,
      name: row.name,
      categoryKey: row.category_key,
      defaultUnit: row.default_unit,
      emoji: row.emoji,
      isStaple: row.is_staple,
    });
  }

  return staples;
}
