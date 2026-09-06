"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMember, requireHousehold } from "@/lib/auth/household";
import { normalizeHebrew, parseQuantity, splitBulkInput } from "@/lib/hebrew";
import { bulkAddLimiter } from "@/lib/ratelimit";
import {
  AddItemSchema,
  BulkAddSchema,
  DeleteItemSchema,
  RestoreItemSchema,
  ToggleItemSchema,
  UpdateItemSchema,
} from "@/lib/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const UNIQUE_VIOLATION = "23505";

export type AddItemResult =
  | { status: "added"; itemId: string; name: string }
  | { status: "merged"; itemId: string; name: string; quantity: number }
  | { status: "duplicate" };

export type BulkAddResult = {
  added: number;
  merged: number;
  failed: number;
};

type Client = SupabaseClient<Database>;

async function assertListBelongsToHousehold(
  supabase: Client,
  householdId: string,
  listId: string,
): Promise<void> {
  const { data } = await supabase
    .from("lists")
    .select("id")
    .eq("household_id", householdId)
    .eq("id", listId)
    .maybeSingle();

  if (!data) throw new Error("הרשימה לא נמצאה");
}

/**
 * Resolves the category for a new item: an explicit choice wins, otherwise the
 * best catalog match decides, and anything unknown falls back to "other".
 */
async function resolveCategoryId(
  supabase: Client,
  householdId: string,
  name: string,
  explicitCategoryId: string | null,
): Promise<{ categoryId: string | null; defaultUnit: string | null }> {
  if (explicitCategoryId) {
    const { data } = await supabase
      .from("categories")
      .select("id")
      .eq("household_id", householdId)
      .eq("id", explicitCategoryId)
      .maybeSingle();
    if (data) return { categoryId: data.id, defaultUnit: null };
  }

  const { data: matches } = await supabase.rpc("match_catalog", {
    p_household_id: householdId,
    p_query: name,
    p_limit: 1,
  });

  const best = matches?.[0];
  const categoryKey = best?.category_key ?? "other";

  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("household_id", householdId)
    .eq("key", categoryKey)
    .maybeSingle();

  return {
    categoryId: category?.id ?? null,
    defaultUnit: best?.default_unit ?? null,
  };
}

/**
 * Duplicate prevention lives here, not in a unique index. A unique index on open
 * items would break Undo and make any bulk add fail wholesale on one repeat.
 */
async function addOne(
  supabase: Client,
  householdId: string,
  memberName: string | null,
  input: {
    clientId: string;
    listId: string;
    name: string;
    quantity: number | null;
    unit: string | null;
    note: string | null;
    isUrgent: boolean;
    categoryId: string | null;
  },
): Promise<AddItemResult> {
  const alreadyApplied = await supabase
    .from("items")
    .select("id")
    .eq("client_id", input.clientId)
    .maybeSingle();

  if (alreadyApplied.data) return { status: "duplicate" };

  const nameNorm = normalizeHebrew(input.name);

  const { data: open } = await supabase
    .from("items")
    .select("id, name, quantity")
    .eq("household_id", householdId)
    .eq("list_id", input.listId)
    .eq("name_norm", nameNorm)
    .eq("is_checked", false)
    .limit(1)
    .maybeSingle();

  if (open) {
    const nextQuantity = (open.quantity ?? 1) + (input.quantity ?? 1);
    const { error } = await supabase
      .from("items")
      .update({ quantity: nextQuantity, is_urgent: input.isUrgent || undefined })
      .eq("household_id", householdId)
      .eq("id", open.id);

    if (error) throw new Error("לא הצלחנו לעדכן את הכמות");

    return {
      status: "merged",
      itemId: open.id,
      name: open.name,
      quantity: nextQuantity,
    };
  }

  const { categoryId, defaultUnit } = await resolveCategoryId(
    supabase,
    householdId,
    input.name,
    input.categoryId,
  );

  const { data: inserted, error } = await supabase
    .from("items")
    .insert({
      client_id: input.clientId,
      household_id: householdId,
      list_id: input.listId,
      category_id: categoryId,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit ?? defaultUnit,
      note: input.note,
      is_urgent: input.isUrgent,
      added_by: memberName,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { status: "duplicate" };
    throw new Error("לא הצלחנו להוסיף את הפריט");
  }

  return { status: "added", itemId: inserted.id, name: input.name };
}

export async function addItem(raw: unknown): Promise<AddItemResult> {
  const householdId = await requireHousehold();
  const input = AddItemSchema.parse(raw);
  const supabase = supabaseAdmin();

  await assertListBelongsToHousehold(supabase, householdId, input.listId);
  const member = await getMember();

  const result = await addOne(supabase, householdId, member?.name ?? null, input);
  revalidatePath("/");
  return result;
}

/** Processed item by item, so one repeated product never fails the whole paste. */
export async function bulkAdd(raw: unknown): Promise<BulkAddResult> {
  const householdId = await requireHousehold();
  const input = BulkAddSchema.parse(raw);

  const { success } = await bulkAddLimiter().limit(householdId);
  if (!success) throw new Error("יותר מדי הוספות בבת אחת. נסו שוב בעוד דקה.");

  const supabase = supabaseAdmin();
  await assertListBelongsToHousehold(supabase, householdId, input.listId);
  const member = await getMember();

  const summary: BulkAddResult = { added: 0, merged: 0, failed: 0 };

  for (const chunk of splitBulkInput(input.raw)) {
    const { name, quantity, unit } = parseQuantity(chunk);
    if (name.length === 0 || name.length > 80) {
      summary.failed += 1;
      continue;
    }

    try {
      const result = await addOne(supabase, householdId, member?.name ?? null, {
        clientId: crypto.randomUUID(),
        listId: input.listId,
        name,
        quantity,
        unit,
        note: null,
        isUrgent: false,
        categoryId: null,
      });

      if (result.status === "merged") summary.merged += 1;
      else if (result.status === "added") summary.added += 1;
    } catch {
      summary.failed += 1;
    }
  }

  revalidatePath("/");
  return summary;
}

export async function toggleItem(raw: unknown): Promise<void> {
  const householdId = await requireHousehold();
  const input = ToggleItemSchema.parse(raw);
  const supabase = supabaseAdmin();
  const member = await getMember();

  const { error } = await supabase
    .from("items")
    .update({
      is_checked: input.isChecked,
      checked_by: input.isChecked ? (member?.name ?? null) : null,
      checked_at: input.isChecked ? new Date().toISOString() : null,
    })
    .eq("household_id", householdId)
    .eq("id", input.itemId);

  if (error) throw new Error("לא הצלחנו לעדכן את הפריט");

  revalidatePath("/");
}

export async function updateItem(raw: unknown): Promise<void> {
  const householdId = await requireHousehold();
  const input = UpdateItemSchema.parse(raw);
  const supabase = supabaseAdmin();

  if (input.categoryId) {
    const { data } = await supabase
      .from("categories")
      .select("id")
      .eq("household_id", householdId)
      .eq("id", input.categoryId)
      .maybeSingle();
    if (!data) throw new Error("הקטגוריה לא נמצאה");
  }

  const { error } = await supabase
    .from("items")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.isUrgent !== undefined ? { is_urgent: input.isUrgent } : {}),
      ...(input.categoryId !== undefined ? { category_id: input.categoryId } : {}),
    })
    .eq("household_id", householdId)
    .eq("id", input.itemId);

  if (error) throw new Error("לא הצלחנו לשמור את השינויים");

  revalidatePath("/");
}

export async function deleteItem(raw: unknown): Promise<void> {
  const householdId = await requireHousehold();
  const input = DeleteItemSchema.parse(raw);

  const { error } = await supabaseAdmin()
    .from("items")
    .delete()
    .eq("household_id", householdId)
    .eq("id", input.itemId);

  if (error) throw new Error("לא הצלחנו למחוק את הפריט");

  revalidatePath("/");
}

/** Backs the Undo toast after a delete. A fresh clientId keeps the offline queue honest. */
export async function restoreItem(raw: unknown): Promise<void> {
  const householdId = await requireHousehold();
  const input = RestoreItemSchema.parse(raw);
  const supabase = supabaseAdmin();

  await assertListBelongsToHousehold(supabase, householdId, input.listId);
  const member = await getMember();

  await addOne(supabase, householdId, member?.name ?? null, input);
  revalidatePath("/");
}
