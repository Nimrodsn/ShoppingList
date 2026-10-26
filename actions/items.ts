"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMember, requireHousehold } from "@/lib/auth/household";
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
import type { Database, Json } from "@/types/database";

export type AddItemResult =
  | { status: "added"; itemId: string; name: string }
  | { status: "merged"; itemId: string; name: string; quantity: number }
  | { status: "duplicate" };

export type BulkAddItemOutcome = {
  clientId: string;
  name: string;
  status: "added" | "merged" | "failed";
};

export type BulkAddResult = {
  added: number;
  merged: number;
  failed: number;
  /** Names the server could not add, so the client can hand them back for a retry. */
  failedNames: string[];
  outcomes: BulkAddItemOutcome[];
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

/** The jsonb outcome of public.apply_add_item, validated field by field. */
function parseAddOutcome(outcome: Json): AddItemResult {
  if (typeof outcome !== "object" || outcome === null || Array.isArray(outcome)) {
    throw new Error("לא הצלחנו להוסיף את הפריט");
  }

  const status = outcome.status;

  if (status === "duplicate") return { status: "duplicate" };

  if (status === "added" || status === "merged") {
    const itemId = outcome.itemId;
    const name = outcome.name;
    if (typeof itemId !== "string" || typeof name !== "string") {
      throw new Error("לא הצלחנו להוסיף את הפריט");
    }
    if (status === "added") return { status, itemId, name };

    const quantity = outcome.quantity;
    if (typeof quantity !== "number") {
      throw new Error("לא הצלחנו להוסיף את הפריט");
    }
    return { status, itemId, name, quantity };
  }

  throw new Error("לא הצלחנו להוסיף את הפריט");
}

/**
 * Duplicate prevention and the quantity merge live in SQL (public.apply_add_item),
 * where one locked statement replaces what used to be a read-then-write pair: a
 * replayed clientId is a no-op, and two simultaneous adds of the same product add
 * up instead of losing each other. A unique index on open items stays wrong for
 * the same reason as before: it would break Undo and fail whole bulk adds.
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
  const { categoryId, defaultUnit } = await resolveCategoryId(
    supabase,
    householdId,
    input.name,
    input.categoryId,
  );

  const { data, error } = await supabase.rpc("apply_add_item", {
    p_client_id: input.clientId,
    p_household_id: householdId,
    p_list_id: input.listId,
    p_category_id: categoryId,
    p_name: input.name,
    p_quantity: input.quantity,
    p_unit: input.unit ?? defaultUnit,
    p_note: input.note,
    p_is_urgent: input.isUrgent,
    p_added_by: memberName,
  });

  if (error) throw new Error("לא הצלחנו להוסיף את הפריט");

  return parseAddOutcome(data);
}

/**
 * Turns an ItemRef into a real row id. `itemClientId` belongs to an add that only
 * existed in the offline log when the mutation was queued; once the add replayed,
 * its row carries that clientId.
 */
async function resolveItemId(
  supabase: Client,
  householdId: string,
  ref: { itemId?: string; itemClientId?: string },
): Promise<string> {
  if (ref.itemId) return ref.itemId;
  if (!ref.itemClientId) throw new Error("חסר מזהה פריט");

  const { data } = await supabase
    .from("items")
    .select("id")
    .eq("household_id", householdId)
    .eq("client_id", ref.itemClientId)
    .maybeSingle();

  if (!data) throw new Error("הפריט לא נמצא");
  return data.id;
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

/**
 * Processed item by item, so one bad line never fails the whole paste. Every line
 * arrives with the clientId the client chose for it, which is what makes a retry of
 * the whole batch safe: lines that already landed come back as duplicates.
 */
export async function bulkAdd(raw: unknown): Promise<BulkAddResult> {
  const householdId = await requireHousehold();
  const input = BulkAddSchema.parse(raw);

  const { success } = await bulkAddLimiter().limit(householdId);
  if (!success) throw new Error("יותר מדי הוספות בבת אחת. נסו שוב בעוד דקה.");

  const supabase = supabaseAdmin();
  await assertListBelongsToHousehold(supabase, householdId, input.listId);
  const member = await getMember();

  const summary: BulkAddResult = {
    added: 0,
    merged: 0,
    failed: 0,
    failedNames: [],
    outcomes: [],
  };

  for (const line of input.items) {
    const name = line.name.trim();
    if (name.length === 0 || name.length > 80) {
      summary.failed += 1;
      summary.failedNames.push(line.name);
      summary.outcomes.push({ clientId: line.clientId, name: line.name, status: "failed" });
      continue;
    }

    try {
      const result = await addOne(supabase, householdId, member?.name ?? null, {
        clientId: line.clientId,
        listId: input.listId,
        name,
        quantity: line.quantity,
        unit: line.unit,
        note: null,
        isUrgent: false,
        categoryId: null,
      });

      if (result.status === "merged") {
        summary.merged += 1;
        summary.outcomes.push({ clientId: line.clientId, name, status: "merged" });
      } else if (result.status === "added") {
        summary.added += 1;
        summary.outcomes.push({ clientId: line.clientId, name, status: "added" });
      }
      // "duplicate" is a replay of an already-applied line: nothing to count.
    } catch {
      summary.failed += 1;
      summary.failedNames.push(name);
      summary.outcomes.push({ clientId: line.clientId, name, status: "failed" });
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

  const itemId = await resolveItemId(supabase, householdId, input);

  const { error } = await supabase
    .from("items")
    .update({
      is_checked: input.isChecked,
      checked_by: input.isChecked ? (member?.name ?? null) : null,
      checked_at: input.isChecked ? new Date().toISOString() : null,
    })
    .eq("household_id", householdId)
    .eq("id", itemId);

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

  const itemId = await resolveItemId(supabase, householdId, input);

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
    .eq("id", itemId);

  if (error) throw new Error("לא הצלחנו לשמור את השינויים");

  revalidatePath("/");
}

export async function deleteItem(raw: unknown): Promise<void> {
  const householdId = await requireHousehold();
  const input = DeleteItemSchema.parse(raw);
  const supabase = supabaseAdmin();

  const itemId = await resolveItemId(supabase, householdId, input);

  const { error } = await supabase
    .from("items")
    .delete()
    .eq("household_id", householdId)
    .eq("id", itemId);

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
