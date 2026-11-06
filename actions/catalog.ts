"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireHousehold } from "@/lib/auth/household";
import { ItemNameSchema, UuidSchema } from "@/lib/schemas";
import { getCatalog } from "@/actions/catalog-data";
import { effectiveCatalog } from "@/lib/catalog-match";

export type CatalogSuggestion = {
  id: string;
  name: string;
  categoryKey: string;
  defaultUnit: string;
  emoji: string | null;
  isStaple: boolean;
};

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

/**
 * The weekly basket. A household row always overrides the shared global row with the
 * same normalized name, which is how "remove from weekly" works without ever editing
 * the global catalog.
 */
export async function listStaples(): Promise<CatalogSuggestion[]> {
  // Shares the per-request catalog fetch with the rest of the page.
  return effectiveCatalog(await getCatalog())
    .filter((row) => row.isStaple)
    .sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name))
    .map((row) => ({
      id: row.id,
      name: row.name,
      categoryKey: row.categoryKey,
      defaultUnit: row.defaultUnit,
      emoji: row.emoji,
      isStaple: row.isStaple,
    }));
}
