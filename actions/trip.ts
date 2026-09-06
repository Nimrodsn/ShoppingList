"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMember, requireHousehold } from "@/lib/auth/household";
import { AddStaplesSchema, CloseTripSchema, ItemNameSchema } from "@/lib/schemas";
import { addItem } from "@/actions/items";
import { normalizeHebrew } from "@/lib/hebrew";

export type CloseTripResult = {
  archived: number;
  remaining: number;
};

/**
 * Ends a shopping trip: every checked item moves to purchase_history, the catalog
 * learns it was bought, and the rows are removed from the list. Open items stay.
 * The item's own id becomes the history client_id, so a retry is a no-op.
 */
export async function closeTrip(raw: unknown): Promise<CloseTripResult> {
  const householdId = await requireHousehold();
  const { listId } = CloseTripSchema.parse(raw);
  const supabase = supabaseAdmin();
  const member = await getMember();

  const { data: checked, error } = await supabase
    .from("items")
    .select("id, name, quantity, unit, category_id, checked_by")
    .eq("household_id", householdId)
    .eq("list_id", listId)
    .eq("is_checked", true);

  if (error) throw new Error("לא הצלחנו לקרוא את הפריטים המסומנים");
  if (!checked || checked.length === 0) {
    return { archived: 0, remaining: 0 };
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id, key")
    .eq("household_id", householdId);

  const keyById = new Map((categories ?? []).map((row) => [row.id, row.key]));

  const { error: historyError } = await supabase.from("purchase_history").insert(
    checked.map((item) => ({
      client_id: item.id,
      household_id: householdId,
      name: item.name,
      category_key: item.category_id ? (keyById.get(item.category_id) ?? null) : null,
      quantity: item.quantity,
      unit: item.unit,
      purchased_by: item.checked_by ?? member?.name ?? null,
    })),
  );

  if (historyError) throw new Error("לא הצלחנו לשמור את היסטוריית הקנייה");

  await supabase.rpc("bump_catalog_usage", {
    p_household_id: householdId,
    p_names: checked.map((item) => item.name),
  });

  const { error: deleteError } = await supabase
    .from("items")
    .delete()
    .eq("household_id", householdId)
    .eq("list_id", listId)
    .eq("is_checked", true);

  if (deleteError) throw new Error("לא הצלחנו לנקות את הרשימה");

  const { count } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId)
    .eq("list_id", listId)
    .eq("is_checked", false);

  revalidatePath("/");
  revalidatePath("/history");

  return { archived: checked.length, remaining: count ?? 0 };
}

export type AddStaplesResult = { added: number; merged: number };

/** Adds the weekly basket in one tap, item by item so repeats merge instead of failing. */
export async function addStaples(raw: unknown): Promise<AddStaplesResult> {
  const householdId = await requireHousehold();
  const { listId, catalogItemIds } = AddStaplesSchema.parse(raw);
  const supabase = supabaseAdmin();

  const { data: entries } = await supabase
    .from("catalog_items")
    .select("id, name, default_unit")
    .in("id", catalogItemIds)
    .or(`household_id.is.null,household_id.eq.${householdId}`);

  const summary: AddStaplesResult = { added: 0, merged: 0 };

  for (const entry of entries ?? []) {
    const result = await addItem({
      clientId: crypto.randomUUID(),
      listId,
      name: entry.name,
      unit: entry.default_unit,
    });

    if (result.status === "merged") summary.merged += 1;
    else if (result.status === "added") summary.added += 1;
  }

  revalidatePath("/");
  return summary;
}

/**
 * Marks a product as part of the weekly basket. Works from the item sheet, where all we
 * have is a name, and from the weekly screen. The shared global catalog is never edited:
 * the household gets its own row, which overrides the global one for this family only.
 */
export async function setStaple(rawName: string, isStaple: boolean): Promise<void> {
  const householdId = await requireHousehold();
  const name = ItemNameSchema.parse(rawName);
  const supabase = supabaseAdmin();

  const { data: known } = await supabase
    .from("catalog_items")
    .select("category_key, default_unit, emoji")
    .or(`household_id.is.null,household_id.eq.${householdId}`)
    .eq("name_norm", normalizeHebrew(name))
    .order("household_id", { nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("catalog_items").upsert(
    {
      household_id: householdId,
      name,
      category_key: known?.category_key ?? "other",
      default_unit: known?.default_unit ?? "יח׳",
      emoji: known?.emoji ?? null,
      is_staple: isStaple,
    },
    { onConflict: "household_id, name_norm" },
  );

  if (error) throw new Error("לא הצלחנו לעדכן את הקנייה השבועית");

  revalidatePath("/staples");
  revalidatePath("/");
}
