import type {
  BoardItem,
  CategoryGroup,
  CategoryRef,
  GroupedBoard,
} from "@/types/board";

/**
 * Turns a flat item list into the on-screen shape: urgent items lifted to the top,
 * one section per non-empty category in the household's aisle order, then the
 * collapsible "taken" section. Pure, so it runs identically on the server, on the
 * client over optimistic state, and over the offline mutation log.
 */
export function groupItems(
  items: BoardItem[],
  categories: CategoryRef[],
): GroupedBoard {
  const open = items.filter((item) => !item.isChecked);
  const checked = items
    .filter((item) => item.isChecked)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

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
    .map((category) => ({ ...category, items: byCategory.get(category.id) ?? [] }))
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
    urgent,
    groups,
    checked,
    openCount: open.length,
    checkedCount: checked.length,
  };
}

export type BoardMutation =
  | { type: "add"; item: BoardItem }
  | { type: "toggle"; itemId: string; isChecked: boolean; by: string | null }
  | { type: "delete"; itemId: string }
  | { type: "update"; itemId: string; patch: Partial<BoardItem> }
  | { type: "mergeQuantity"; itemId: string; quantity: number };

/**
 * Applies one mutation on top of server data. Used by `useOptimistic` for the online
 * 0ms path and by the offline queue, which replays its whole log on every render.
 */
export function applyMutation(
  items: BoardItem[],
  mutation: BoardMutation,
): BoardItem[] {
  switch (mutation.type) {
    case "add":
      return [...items, mutation.item];

    case "toggle":
      return items.map((item) =>
        item.id === mutation.itemId
          ? {
              ...item,
              isChecked: mutation.isChecked,
              checkedBy: mutation.isChecked ? mutation.by : null,
              updatedAt: new Date().toISOString(),
            }
          : item,
      );

    case "delete":
      return items.filter((item) => item.id !== mutation.itemId);

    case "update":
      return items.map((item) =>
        item.id === mutation.itemId ? { ...item, ...mutation.patch } : item,
      );

    case "mergeQuantity":
      return items.map((item) =>
        item.id === mutation.itemId
          ? { ...item, quantity: mutation.quantity }
          : item,
      );
  }
}

export function applyMutations(
  items: BoardItem[],
  mutations: readonly BoardMutation[],
): BoardItem[] {
  return mutations.reduce(applyMutation, items);
}

/** Matches the server-side merge rule: same list, same normalized name, still open. */
export function findOpenByNorm(
  items: BoardItem[],
  nameNorm: string,
  normalize: (value: string) => string,
): BoardItem | undefined {
  return items.find(
    (item) => !item.isChecked && normalize(item.name) === nameNorm,
  );
}
