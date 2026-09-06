"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireHousehold } from "@/lib/auth/household";
import { ReorderCategoriesSchema, UpdateCategorySchema } from "@/lib/schemas";

/**
 * Persists the aisle order the family dragged into place. Only ids that actually
 * belong to this household are written, so a tampered payload changes nothing.
 */
export async function reorderCategories(raw: unknown): Promise<void> {
  const householdId = await requireHousehold();
  const { orderedIds } = ReorderCategoriesSchema.parse(raw);
  const supabase = supabaseAdmin();

  const { data: owned } = await supabase
    .from("categories")
    .select("id")
    .eq("household_id", householdId);

  const ownedIds = new Set((owned ?? []).map((row) => row.id));

  await Promise.all(
    orderedIds
      .filter((id) => ownedIds.has(id))
      .map((id, index) =>
        supabase
          .from("categories")
          .update({ position: index + 1 })
          .eq("household_id", householdId)
          .eq("id", id),
      ),
  );

  revalidatePath("/");
  revalidatePath("/settings");
}

export async function updateCategory(raw: unknown): Promise<void> {
  const householdId = await requireHousehold();
  const input = UpdateCategorySchema.parse(raw);

  const { error } = await supabaseAdmin()
    .from("categories")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.emoji !== undefined ? { emoji: input.emoji } : {}),
    })
    .eq("household_id", householdId)
    .eq("id", input.categoryId);

  if (error) throw new Error("לא הצלחנו לעדכן את הקטגוריה");

  revalidatePath("/");
  revalidatePath("/settings");
}
