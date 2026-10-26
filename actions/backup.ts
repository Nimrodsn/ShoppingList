"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMember, requireHousehold } from "@/lib/auth/household";
import {
  BackupFileSchema,
  backupToCsv,
  buildBackup,
  planRestore,
} from "@/lib/backup";

export type BackupDownload = {
  filename: string;
  json: string;
  csv: string;
};

export async function exportBackup(): Promise<BackupDownload> {
  const householdId = await requireHousehold();
  const supabase = supabaseAdmin();

  const [householdResult, listsResult, categoriesResult, itemsResult, historyResult] =
    await Promise.all([
      supabase.from("households").select("name").eq("id", householdId).single(),
      supabase
        .from("lists")
        .select("id, name, emoji")
        .eq("household_id", householdId)
        .order("position"),
      supabase
        .from("categories")
        .select("id, key")
        .eq("household_id", householdId)
        .eq("is_archived", false),
      supabase
        .from("items")
        .select(
          "list_id, category_id, name, quantity, unit, note, is_checked, is_urgent",
        )
        .eq("household_id", householdId)
        .order("position")
        .order("created_at"),
      supabase
        .from("purchase_history")
        .select("name, quantity, unit, category_key, purchased_at")
        .eq("household_id", householdId)
        .order("purchased_at", { ascending: false })
        .limit(20000),
    ]);

  if (householdResult.error || listsResult.error || categoriesResult.error ||
      itemsResult.error || historyResult.error) {
    throw new Error("לא הצלחנו להכין את הגיבוי");
  }

  const listNamesById = new Map(listsResult.data.map((list) => [list.id, list.name]));
  const categoryKeysById = new Map(
    categoriesResult.data.map((category) => [category.id, category.key]),
  );

  const backup = buildBackup(
    {
      householdName: householdResult.data.name,
      lists: listsResult.data,
      categories: categoriesResult.data,
      items: itemsResult.data.map((item) => ({
        listId: item.list_id,
        categoryId: item.category_id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        note: item.note,
        isChecked: item.is_checked,
        isUrgent: item.is_urgent,
      })),
      history: historyResult.data.map((entry) => ({
        name: entry.name,
        quantity: entry.quantity,
        unit: entry.unit,
        categoryKey: entry.category_key,
        purchasedAt: entry.purchased_at,
      })),
      listNamesById,
      categoryKeysById,
    },
    new Date().toISOString(),
  );

  const date = backup.exportedAt.slice(0, 10);
  return {
    filename: `shoppinglist-backup-${date}`,
    json: JSON.stringify(backup, null, 2),
    csv: backupToCsv(backup),
  };
}

export type RestoreResult = {
  listsCreated: number;
  itemsAdded: number;
  itemsSkipped: number;
};

/**
 * Additive-only restore: creates missing lists and inserts missing products.
 * Existing lists and items are matched by name and never modified or deleted.
 */
export async function restoreBackup(payload: unknown): Promise<RestoreResult> {
  const householdId = await requireHousehold();
  const member = await getMember();
  const parsed = BackupFileSchema.safeParse(payload);
  if (!parsed.success) throw new Error("קובץ הגיבוי לא תקין");

  const backup = parsed.data;
  const supabase = supabaseAdmin();

  const [listsResult, categoriesResult, itemsResult] = await Promise.all([
    supabase.from("lists").select("id, name, position").eq("household_id", householdId),
    supabase
      .from("categories")
      .select("id, key")
      .eq("household_id", householdId)
      .eq("is_archived", false),
    supabase
      .from("items")
      .select("list_id, name_norm, position")
      .eq("household_id", householdId),
  ]);

  if (listsResult.error || categoriesResult.error || itemsResult.error) {
    throw new Error("לא הצלחנו לקרוא את הרשימה הקיימת");
  }

  const plan = planRestore(backup, {
    lists: listsResult.data,
    items: itemsResult.data.map((item) => ({
      listId: item.list_id,
      nameNorm: item.name_norm,
    })),
  });

  // Create the missing lists first so item inserts can reference them by name.
  const listIdByName = new Map(listsResult.data.map((list) => [list.name, list.id]));
  let nextListPosition =
    listsResult.data.reduce((max, list) => Math.max(max, list.position), -1) + 1;

  for (const list of plan.listsToCreate) {
    const { data, error } = await supabase
      .from("lists")
      .insert({
        household_id: householdId,
        name: list.name,
        emoji: list.emoji,
        position: nextListPosition,
      })
      .select("id")
      .single();
    if (error) throw new Error("לא הצלחנו לשחזר את הרשימות");
    listIdByName.set(list.name, data.id);
    nextListPosition += 1;
  }

  const categoryIdByKey = new Map(
    categoriesResult.data.map((category) => [category.key, category.id]),
  );
  const maxPositionByList = new Map<string, number>();
  for (const item of itemsResult.data) {
    maxPositionByList.set(
      item.list_id,
      Math.max(maxPositionByList.get(item.list_id) ?? -1, item.position),
    );
  }

  const rows = plan.itemsToAdd.map((item) => {
    const listId = listIdByName.get(item.listName);
    if (!listId) throw new Error("לא הצלחנו לשחזר את הפריטים");
    const position = (maxPositionByList.get(listId) ?? -1) + 1;
    maxPositionByList.set(listId, position);
    return {
      household_id: householdId,
      list_id: listId,
      category_id: item.categoryKey
        ? (categoryIdByKey.get(item.categoryKey) ?? null)
        : null,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      note: item.note,
      is_checked: item.isChecked,
      is_urgent: item.isUrgent,
      checked_at: item.isChecked ? new Date().toISOString() : null,
      position,
      added_by: member?.name ?? null,
      checked_by: item.isChecked ? (member?.name ?? null) : null,
    };
  });

  for (let start = 0; start < rows.length; start += 500) {
    const { error } = await supabase.from("items").insert(rows.slice(start, start + 500));
    if (error) throw new Error("לא הצלחנו לשחזר את הפריטים");
  }

  revalidatePath("/");
  revalidatePath("/settings");
  return {
    listsCreated: plan.listsToCreate.length,
    itemsAdded: rows.length,
    itemsSkipped: plan.skipped,
  };
}
