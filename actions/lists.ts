"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireHousehold } from "@/lib/auth/household";
import {
  CreateListSchema,
  ListSnapshotSchema,
  RenameListSchema,
  UuidSchema,
  type ListSnapshot,
} from "@/lib/schemas";

export type { ListSnapshot };

export async function createList(raw: unknown): Promise<{ listId: string }> {
  const householdId = await requireHousehold();
  const input = CreateListSchema.parse(raw);
  const supabase = supabaseAdmin();

  const { count } = await supabase
    .from("lists")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId);

  const { data, error } = await supabase
    .from("lists")
    .insert({
      household_id: householdId,
      name: input.name,
      emoji: input.emoji,
      position: count ?? 0,
    })
    .select("id")
    .single();

  if (error) throw new Error("לא הצלחנו ליצור את הרשימה");

  revalidatePath("/");
  revalidatePath("/settings");
  return { listId: data.id };
}

export async function renameList(raw: unknown): Promise<void> {
  const householdId = await requireHousehold();
  const input = RenameListSchema.parse(raw);

  const { error } = await supabaseAdmin()
    .from("lists")
    .update({
      name: input.name,
      ...(input.emoji ? { emoji: input.emoji } : {}),
    })
    .eq("household_id", householdId)
    .eq("id", input.listId);

  if (error) throw new Error("לא הצלחנו לשנות את שם הרשימה");

  revalidatePath("/");
  revalidatePath("/settings");
}

/**
 * Returns everything needed to put the list back, so the Undo toast can restore it
 * with its items. Deleting the last remaining list is refused.
 */
export async function deleteList(raw: unknown): Promise<ListSnapshot> {
  const householdId = await requireHousehold();
  const listId = UuidSchema.parse(raw);
  const supabase = supabaseAdmin();

  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, emoji, position")
    .eq("household_id", householdId);

  if (!lists || lists.length <= 1) {
    throw new Error("צריך להשאיר לפחות רשימה אחת");
  }

  const list = lists.find((entry) => entry.id === listId);
  if (!list) throw new Error("הרשימה לא נמצאה");

  const { data: items } = await supabase
    .from("items")
    .select("name, quantity, unit, note, is_checked, is_urgent, category_id, added_by")
    .eq("household_id", householdId)
    .eq("list_id", listId);

  const { error } = await supabase
    .from("lists")
    .delete()
    .eq("household_id", householdId)
    .eq("id", listId);

  if (error) throw new Error("לא הצלחנו למחוק את הרשימה");

  revalidatePath("/");
  revalidatePath("/settings");

  return {
    name: list.name,
    emoji: list.emoji,
    position: list.position,
    items: (items ?? []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      note: item.note,
      isChecked: item.is_checked,
      isUrgent: item.is_urgent,
      categoryId: item.category_id,
      addedBy: item.added_by,
    })),
  };
}

export async function restoreList(raw: unknown): Promise<void> {
  const householdId = await requireHousehold();
  const snapshot = ListSnapshotSchema.parse(raw);
  const supabase = supabaseAdmin();

  const { data: list, error } = await supabase
    .from("lists")
    .insert({
      household_id: householdId,
      name: snapshot.name,
      emoji: snapshot.emoji,
      position: snapshot.position,
    })
    .select("id")
    .single();

  if (error) throw new Error("לא הצלחנו לשחזר את הרשימה");

  if (snapshot.items.length > 0) {
    await supabase.from("items").insert(
      snapshot.items.map((item) => ({
        client_id: crypto.randomUUID(),
        household_id: householdId,
        list_id: list.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        note: item.note,
        is_checked: item.isChecked,
        is_urgent: item.isUrgent,
        category_id: item.categoryId,
        added_by: item.addedBy,
      })),
    );
  }

  revalidatePath("/");
  revalidatePath("/settings");
}
