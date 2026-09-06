import { describe, expect, it } from "vitest";
import {
  applyMutation,
  applyMutations,
  findOpenByNorm,
  groupItems,
  isOptimisticId,
  optimisticId,
} from "@/lib/board";
import { normalizeHebrew } from "@/lib/hebrew";
import type { BoardItem, CategoryRef } from "@/types/board";

const categories: CategoryRef[] = [
  { id: "cat-produce", key: "produce", name: "פירות וירקות", emoji: "🥬", color: "green", position: 0 },
  { id: "cat-dairy", key: "dairy", name: "חלב וגבינות", emoji: "🥛", color: "blue", position: 1 },
  { id: "cat-other", key: "other", name: "אחר", emoji: "🛒", color: "zinc", position: 99 },
];

function item(overrides: Partial<BoardItem> & { id: string; name: string }): BoardItem {
  return {
    quantity: null,
    unit: null,
    note: null,
    isChecked: false,
    isUrgent: false,
    position: 0,
    categoryId: null,
    addedBy: null,
    checkedBy: null,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("groupItems", () => {
  const items = [
    item({ id: "1", name: "עגבניות", categoryId: "cat-produce" }),
    item({ id: "2", name: "חלב", categoryId: "cat-dairy" }),
    item({ id: "3", name: "סוללות" }),
    item({ id: "4", name: "קמח", categoryId: "cat-produce", isUrgent: true }),
    item({
      id: "5",
      name: "לחם",
      categoryId: "cat-dairy",
      isChecked: true,
      updatedAt: "2026-01-01T11:00:00.000Z",
    }),
    item({
      id: "6",
      name: "ביצים",
      categoryId: "cat-dairy",
      isChecked: true,
      updatedAt: "2026-01-01T12:00:00.000Z",
    }),
  ];

  const grouped = groupItems(items, categories);

  it("lifts urgent items out of their category", () => {
    expect(grouped.urgent.map((entry) => entry.id)).toEqual(["4"]);
    const produce = grouped.groups.find((group) => group.id === "cat-produce");
    expect(produce?.items.map((entry) => entry.id)).toEqual(["1"]);
  });

  it("hides empty categories and keeps the aisle order", () => {
    expect(grouped.groups.map((group) => group.key)).toEqual([
      "produce",
      "dairy",
      "other",
    ]);
  });

  it("files items without a category under other", () => {
    const other = grouped.groups.find((group) => group.key === "other");
    expect(other?.items.map((entry) => entry.id)).toEqual(["3"]);
  });

  it("shows checked items newest first and counts both sides", () => {
    expect(grouped.checked.map((entry) => entry.id)).toEqual(["6", "5"]);
    expect(grouped.openCount).toBe(4);
    expect(grouped.checkedCount).toBe(2);
  });

  it("falls back to a synthetic other group when the household has none", () => {
    const withoutOther = groupItems(
      [item({ id: "7", name: "מברג" })],
      categories.filter((category) => category.key !== "other"),
    );

    expect(withoutOther.groups).toHaveLength(1);
    expect(withoutOther.groups[0].name).toBe("אחר");
  });
});

describe("applyMutation", () => {
  const base = [
    item({ id: "1", name: "חלב", quantity: 1 }),
    item({ id: "2", name: "לחם" }),
  ];

  it("adds, deletes and updates", () => {
    const added = applyMutation(base, {
      type: "add",
      item: item({ id: "3", name: "ביצים" }),
    });
    expect(added.map((entry) => entry.id)).toEqual(["1", "2", "3"]);

    expect(
      applyMutation(base, { type: "delete", itemId: "1" }).map((entry) => entry.id),
    ).toEqual(["2"]);

    const updated = applyMutation(base, {
      type: "update",
      itemId: "2",
      patch: { note: "פרוס" },
    });
    expect(updated[1].note).toBe("פרוס");
    expect(updated[0]).toBe(base[0]);
  });

  it("records who checked an item and clears it on undo", () => {
    const checked = applyMutation(base, {
      type: "toggle",
      itemId: "1",
      isChecked: true,
      by: "דני",
    });
    expect(checked[0].isChecked).toBe(true);
    expect(checked[0].checkedBy).toBe("דני");

    const undone = applyMutation(checked, {
      type: "toggle",
      itemId: "1",
      isChecked: false,
      by: null,
    });
    expect(undone[0].isChecked).toBe(false);
    expect(undone[0].checkedBy).toBeNull();
  });

  it("merges a quantity instead of duplicating the row", () => {
    const merged = applyMutation(base, {
      type: "mergeQuantity",
      itemId: "1",
      quantity: 3,
    });
    expect(merged).toHaveLength(2);
    expect(merged[0].quantity).toBe(3);
  });

  it("replays a whole log in order", () => {
    const result = applyMutations(base, [
      { type: "add", item: item({ id: "3", name: "ביצים" }) },
      { type: "toggle", itemId: "3", isChecked: true, by: "אמא" },
      { type: "delete", itemId: "1" },
    ]);

    expect(result.map((entry) => entry.id)).toEqual(["2", "3"]);
    expect(result[1].checkedBy).toBe("אמא");
  });

  it("leaves the source array untouched", () => {
    applyMutation(base, { type: "delete", itemId: "1" });
    expect(base.map((entry) => entry.id)).toEqual(["1", "2"]);
  });
});

describe("findOpenByNorm", () => {
  const items = [
    item({ id: "1", name: "לחם אחיד", isChecked: true }),
    item({ id: "2", name: "לֶחֶם אָחִיד" }),
  ];

  it("matches the open row across spelling differences", () => {
    const found = findOpenByNorm(items, normalizeHebrew("לחם אחיד"), normalizeHebrew);
    expect(found?.id).toBe("2");
  });

  it("returns nothing when every match is already taken", () => {
    const found = findOpenByNorm(
      [items[0]],
      normalizeHebrew("לחם אחיד"),
      normalizeHebrew,
    );
    expect(found).toBeUndefined();
  });
});

describe("optimistic ids", () => {
  it("round-trips through the marker", () => {
    const id = optimisticId();
    expect(isOptimisticId(id)).toBe(true);
    expect(isOptimisticId(crypto.randomUUID())).toBe(false);
  });
});
