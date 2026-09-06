import "server-only";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireHousehold } from "@/lib/auth/household";

export type ListSummary = {
  id: string;
  name: string;
  emoji: string;
  position: number;
  openCount: number;
};

export type CategoryRef = {
  id: string;
  key: string;
  name: string;
  emoji: string;
  color: string;
  position: number;
};

export type BoardItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  isChecked: boolean;
  isUrgent: boolean;
  position: number;
  categoryId: string | null;
  addedBy: string | null;
  checkedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CategoryGroup = CategoryRef & { items: BoardItem[] };

export type Board = {
  activeListId: string;
  lists: ListSummary[];
  categories: CategoryRef[];
  urgent: BoardItem[];
  groups: CategoryGroup[];
  checked: BoardItem[];
  openCount: number;
  checkedCount: number;
};

const ITEM_COLUMNS =
  "id, name, quantity, unit, note, is_checked, is_urgent, position, category_id, added_by, checked_by, created_at, updated_at";

type ItemRow = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  is_checked: boolean;
  is_urgent: boolean;
  position: number;
  category_id: string | null;
  added_by: string | null;
  checked_by: string | null;
  created_at: string;
  updated_at: string;
};

function toBoardItem(row: ItemRow): BoardItem {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    unit: row.unit,
    note: row.note,
    isChecked: row.is_checked,
    isUrgent: row.is_urgent,
    position: row.position,
    categoryId: row.category_id,
    addedBy: row.added_by,
    checkedBy: row.checked_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getCategories = cache(async (): Promise<CategoryRef[]> => {
  const householdId = await requireHousehold();

  const { data, error } = await supabaseAdmin()
    .from("categories")
    .select("id, key, name, emoji, color, position")
    .eq("household_id", householdId)
    .eq("is_archived", false)
    .order("position");

  if (error) throw new Error("לא הצלחנו לטעון את הקטגוריות");
  return data;
});

/**
 * Everything the list screen needs, in one round trip.
 * Ownership is filtered in code on every query, not only by the composite FKs.
 */
export const getBoard = cache(async (listId?: string): Promise<Board | null> => {
  const householdId = await requireHousehold();
  const supabase = supabaseAdmin();

  const [listsResult, categories] = await Promise.all([
    supabase
      .from("lists")
      .select("id, name, emoji, position")
      .eq("household_id", householdId)
      .order("position"),
    getCategories(),
  ]);

  if (listsResult.error) throw new Error("לא הצלחנו לטעון את הרשימות");
  const lists = listsResult.data;
  if (lists.length === 0) return null;

  const activeListId = lists.some((list) => list.id === listId)
    ? (listId as string)
    : lists[0].id;

  const [itemsResult, countsResult] = await Promise.all([
    supabase
      .from("items")
      .select(ITEM_COLUMNS)
      .eq("household_id", householdId)
      .eq("list_id", activeListId)
      .order("position")
      .order("created_at"),
    supabase
      .from("items")
      .select("list_id")
      .eq("household_id", householdId)
      .eq("is_checked", false),
  ]);

  if (itemsResult.error) throw new Error("לא הצלחנו לטעון את הפריטים");

  const openPerList = new Map<string, number>();
  for (const row of countsResult.data ?? []) {
    openPerList.set(row.list_id, (openPerList.get(row.list_id) ?? 0) + 1);
  }

  const items = itemsResult.data.map(toBoardItem);
  const open = items.filter((item) => !item.isChecked);
  const checked = items
    .filter((item) => item.isChecked)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  // Urgent items are lifted out of their category and shown at the very top.
  const urgent = open.filter((item) => item.isUrgent);
  const byCategory = new Map<string, BoardItem[]>();
  for (const item of open) {
    if (item.isUrgent) continue;
    const key = item.categoryId ?? "uncategorized";
    const bucket = byCategory.get(key);
    if (bucket) bucket.push(item);
    else byCategory.set(key, [item]);
  }

  const groups: CategoryGroup[] = categories
    .map((category) => ({
      ...category,
      items: byCategory.get(category.id) ?? [],
    }))
    .filter((group) => group.items.length > 0);

  const uncategorized = byCategory.get("uncategorized") ?? [];
  if (uncategorized.length > 0) {
    const other = categories.find((category) => category.key === "other");
    groups.push({
      id: other?.id ?? "uncategorized",
      key: "other",
      name: other?.name ?? "אחר",
      emoji: other?.emoji ?? "🛒",
      color: other?.color ?? "zinc",
      position: other?.position ?? 999,
      items: uncategorized,
    });
  }

  return {
    activeListId,
    lists: lists.map((list) => ({
      id: list.id,
      name: list.name,
      emoji: list.emoji,
      position: list.position,
      openCount: openPerList.get(list.id) ?? 0,
    })),
    categories,
    urgent,
    groups,
    checked,
    openCount: open.length,
    checkedCount: checked.length,
  };
});
