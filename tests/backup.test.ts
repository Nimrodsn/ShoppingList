import { describe, expect, it } from "vitest";
import {
  BackupFileSchema,
  backupToCsv,
  buildBackup,
  planRestore,
  type BackupFile,
} from "@/lib/backup";
import { normalizeHebrew } from "@/lib/hebrew";

function backup(overrides: Partial<BackupFile> = {}): BackupFile {
  return {
    version: 1,
    exportedAt: "2026-10-26T09:00:00.000Z",
    householdName: "בית",
    lists: [
      { name: "סופר", emoji: "🛒" },
      { name: "פארם", emoji: "💊" },
    ],
    items: [
      {
        listName: "סופר",
        name: "חלב תנובה 3%",
        quantity: 2,
        unit: null,
        note: null,
        isChecked: false,
        isUrgent: false,
        categoryKey: "dairy",
      },
      {
        listName: "סופר",
        name: "לחם",
        quantity: null,
        unit: null,
        note: "טרי",
        isChecked: true,
        isUrgent: false,
        categoryKey: "bakery",
      },
      {
        listName: "פארם",
        name: "אקמול",
        quantity: 1,
        unit: null,
        note: null,
        isChecked: false,
        isUrgent: true,
        categoryKey: null,
      },
    ],
    history: [],
    ...overrides,
  };
}

describe("BackupFileSchema", () => {
  it("accepts a well-formed backup and rejects garbage", () => {
    expect(BackupFileSchema.safeParse(backup()).success).toBe(true);
    expect(BackupFileSchema.safeParse({ hello: "world" }).success).toBe(false);
    expect(BackupFileSchema.safeParse(backup({ version: 2 as 1 })).success).toBe(false);
  });

  it("rejects items with empty names", () => {
    const bad = backup();
    bad.items[0].name = "   ";
    expect(BackupFileSchema.safeParse(bad).success).toBe(false);
  });
});

describe("buildBackup", () => {
  it("maps list and category ids back to portable names and keys", () => {
    const result = buildBackup(
      {
        householdName: "בית",
        lists: [{ name: "סופר", emoji: "🛒" }],
        categories: [{ id: "cat-1", key: "dairy" }],
        items: [
          {
            listId: "list-1",
            categoryId: "cat-1",
            name: "חלב",
            quantity: 1,
            unit: null,
            note: null,
            isChecked: false,
            isUrgent: false,
          },
        ],
        history: [],
        listNamesById: new Map([["list-1", "סופר"]]),
        categoryKeysById: new Map([["cat-1", "dairy"]]),
      },
      "2026-10-26T09:00:00.000Z",
    );

    expect(result.items[0].listName).toBe("סופר");
    expect(result.items[0].categoryKey).toBe("dairy");
    // A backup must round-trip through its own schema.
    expect(BackupFileSchema.safeParse(result).success).toBe(true);
  });
});

describe("planRestore", () => {
  it("creates only missing lists and adds only missing products", () => {
    const plan = planRestore(backup(), {
      lists: [{ id: "list-existing", name: "סופר" }],
      items: [
        { listId: "list-existing", nameNorm: normalizeHebrew("חלב תנובה 3%") },
      ],
    });

    expect(plan.listsToCreate).toEqual([{ name: "פארם", emoji: "💊" }]);
    expect(plan.itemsToAdd.map((item) => item.name)).toEqual(["לחם", "אקמול"]);
    expect(plan.skipped).toBe(1);
  });

  it("skips products the list already has even when the existing one is checked", () => {
    // checked items are not in the open-name index, so this guards against
    // re-adding something that was bought and never deleted.
    const plan = planRestore(backup(), {
      lists: [{ id: "l1", name: "סופר" }],
      items: [{ listId: "l1", nameNorm: normalizeHebrew("לחם") }],
    });
    expect(plan.itemsToAdd.map((item) => item.name)).not.toContain("לחם");
  });

  it("dedupes repeated names inside the backup itself", () => {
    const doubled = backup();
    doubled.items.push({ ...doubled.items[0] });
    const plan = planRestore(doubled, { lists: [], items: [] });
    expect(plan.itemsToAdd).toHaveLength(3);
    expect(plan.skipped).toBe(1);
  });

  it("restores everything into an empty household without touching anything", () => {
    const plan = planRestore(backup(), { lists: [], items: [] });
    expect(plan.listsToCreate).toHaveLength(2);
    expect(plan.itemsToAdd).toHaveLength(3);
    expect(plan.skipped).toBe(0);
  });
});

describe("backupToCsv", () => {
  it("has Hebrew headers, a BOM, and escapes commas and quotes", () => {
    const csv = backupToCsv(backup());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("רשימה,פריט,כמות,יחידה,הערה,קטגוריה,נלקח");

    const tricky = backup();
    tricky.items[0].note = 'אמר "כן", בבקשה';
    const out = backupToCsv(tricky);
    expect(out).toContain('"אמר ""כן"", בבקשה"');
  });

  it("marks checked items in Hebrew", () => {
    const csv = backupToCsv(backup());
    const breadRow = csv.split("\n").find((line) => line.includes("לחם"));
    expect(breadRow).toMatch(/,כן$/);
  });
});
