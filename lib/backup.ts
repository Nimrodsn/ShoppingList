import { z } from "zod";
import { normalizeHebrew } from "@/lib/hebrew";

export const BACKUP_VERSION = 1;

const BackupListSchema = z.object({
  name: z.string().trim().min(1).max(60),
  emoji: z.string().max(8).default("🛒"),
});

const BackupItemSchema = z.object({
  listName: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(9999).nullable().default(null),
  unit: z.string().max(20).nullable().default(null),
  note: z.string().max(280).nullable().default(null),
  isChecked: z.boolean().default(false),
  isUrgent: z.boolean().default(false),
  categoryKey: z.string().max(40).nullable().default(null),
});

const BackupHistoryEntrySchema = z.object({
  name: z.string(),
  quantity: z.number().nullable().default(null),
  unit: z.string().nullable().default(null),
  categoryKey: z.string().nullable().default(null),
  purchasedAt: z.string(),
});

export const BackupFileSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  householdName: z.string().max(60),
  lists: z.array(BackupListSchema).max(50),
  items: z.array(BackupItemSchema).max(5000),
  history: z.array(BackupHistoryEntrySchema).max(20000).default([]),
});

export type BackupFile = z.infer<typeof BackupFileSchema>;
export type BackupItem = z.infer<typeof BackupItemSchema>;
export type BackupList = z.infer<typeof BackupListSchema>;

export type BackupSource = {
  householdName: string;
  lists: { name: string; emoji: string }[];
  categories: { id: string; key: string }[];
  items: {
    listId: string;
    categoryId: string | null;
    name: string;
    quantity: number | null;
    unit: string | null;
    note: string | null;
    isChecked: boolean;
    isUrgent: boolean;
  }[];
  history: {
    name: string;
    quantity: number | null;
    unit: string | null;
    categoryKey: string | null;
    purchasedAt: string;
  }[];
  listNamesById: Map<string, string>;
  categoryKeysById: Map<string, string>;
};

/** Serializes the household's current data into the portable backup shape. */
export function buildBackup(source: BackupSource, exportedAt: string): BackupFile {
  return {
    version: BACKUP_VERSION,
    exportedAt,
    householdName: source.householdName,
    lists: source.lists.map((list) => ({ name: list.name, emoji: list.emoji })),
    items: source.items.map((item) => ({
      listName: source.listNamesById.get(item.listId) ?? "",
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      note: item.note,
      isChecked: item.isChecked,
      isUrgent: item.isUrgent,
      categoryKey: item.categoryId
        ? (source.categoryKeysById.get(item.categoryId) ?? null)
        : null,
    })),
    history: source.history.map((entry) => ({
      name: entry.name,
      quantity: entry.quantity,
      unit: entry.unit,
      categoryKey: entry.categoryKey,
      purchasedAt: entry.purchasedAt,
    })),
  };
}

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A flat spreadsheet of the items, with a BOM so Excel reads the Hebrew. */
export function backupToCsv(backup: BackupFile): string {
  const header = ["רשימה", "פריט", "כמות", "יחידה", "הערה", "קטגוריה", "נלקח"];
  const rows = backup.items.map((item) =>
    [
      csvCell(item.listName),
      csvCell(item.name),
      csvCell(item.quantity),
      csvCell(item.unit),
      csvCell(item.note),
      csvCell(item.categoryKey),
      csvCell(item.isChecked ? "כן" : "לא"),
    ].join(","),
  );
  return "﻿" + [header.join(","), ...rows].join("\n") + "\n";
}

export type ExistingState = {
  lists: { id: string; name: string }[];
  /** Every item in those lists, checked or not - restores never duplicate a name. */
  items: { listId: string; nameNorm: string }[];
};

export type RestorePlan = {
  /** Backup lists that do not exist yet, in backup order. */
  listsToCreate: BackupList[];
  /** Items safe to insert: targetList is the backup list name. */
  itemsToAdd: BackupItem[];
  /** Items not added because the list already has that product. */
  skipped: number;
};

/**
 * Plans an additive-only restore. Existing lists and items are matched by name and
 * left untouched; only missing lists and missing products are inserted. Nothing in
 * the plan updates or deletes existing data, so a restore can never lose anything.
 */
export function planRestore(backup: BackupFile, existing: ExistingState): RestorePlan {
  const listIdByName = new Map(existing.lists.map((list) => [list.name.trim(), list.id]));
  const takenByList = new Map<string, Set<string>>();
  for (const item of existing.items) {
    const set = takenByList.get(item.listId) ?? new Set<string>();
    set.add(item.nameNorm);
    takenByList.set(item.listId, set);
  }

  const listsToCreate: BackupList[] = [];
  for (const list of backup.lists) {
    if (!listIdByName.has(list.name)) listsToCreate.push(list);
  }

  const itemsToAdd: BackupItem[] = [];
  let skipped = 0;
  const seenInBackup = new Set<string>();

  for (const item of backup.items) {
    const norm = normalizeHebrew(item.name);
    const existingId = listIdByName.get(item.listName);
    const backupKey = `${item.listName}${norm}`;

    if (seenInBackup.has(backupKey)) {
      skipped += 1;
      continue;
    }
    if (existingId && takenByList.get(existingId)?.has(norm)) {
      skipped += 1;
      continue;
    }

    seenInBackup.add(backupKey);
    itemsToAdd.push(item);
  }

  return { listsToCreate, itemsToAdd, skipped };
}
