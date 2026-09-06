import { expect, test } from "@playwright/test";
import { JOIN_PATH, MISSING_JOIN_PATH, addItem, joinHousehold } from "./household";

test.describe("הוספה, סימון וביטול", () => {
  test.skip(!JOIN_PATH, MISSING_JOIN_PATH);

  test.beforeEach(async ({ page }) => {
    await joinHousehold(page, "בודק");
  });

  test("מוסיפים פריט, מסמנים אותו ומבטלים", async ({ page }) => {
    const name = `אבוקדו ${Date.now()}`;

    await addItem(page, name);

    await page.getByLabel(`סמן ${name} כנלקח`).click();
    await expect(page.getByText(`${name} נלקח`)).toBeVisible();

    await page.getByRole("button", { name: "בטל" }).click();
    await expect(page.getByLabel(`סמן ${name} כנלקח`)).toBeVisible();

    // The undo has to survive the round trip to the server, not just the toast.
    await page.reload();
    await expect(page.getByLabel(`סמן ${name} כנלקח`)).toBeVisible();
  });

  test("הוספה חוזרת מאחדת כמויות במקום לשכפל שורה", async ({ page }) => {
    const name = `במבה ${Date.now()}`;

    await addItem(page, name);
    await page.getByLabel("הוספת פריט").fill(`2 ${name}`);
    await page.getByRole("button", { name: "הוספה", exact: true }).click();

    await expect(page.getByRole("button", { name: `עריכת ${name}` })).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole("button", { name: `עריכת ${name}` })).toHaveCount(1);
  });

  test("הדבקה של כמה שורות מוסיפה פריט לכל שורה", async ({ page }) => {
    const stamp = Date.now();
    const names = [`תפוזים ${stamp}`, `בננות ${stamp}`, `לימון ${stamp}`];

    await page.getByLabel("הוספת פריט").fill(names.join("\n"));
    await page.getByRole("button", { name: "הוספה", exact: true }).click();

    for (const name of names) {
      await expect(page.getByRole("button", { name: `עריכת ${name}` })).toBeVisible();
    }
  });

  test("מחיקה מציגה Undo ומחזירה את הפריט", async ({ page }) => {
    const name = `שמנת ${Date.now()}`;

    await addItem(page, name);
    await page.getByRole("button", { name: `עריכת ${name}` }).click();
    await page.getByRole("button", { name: "מחיקת הפריט" }).click();

    await expect(page.getByRole("button", { name: `עריכת ${name}` })).toHaveCount(0);
    await page.getByRole("button", { name: "בטל" }).click();
    await expect(page.getByRole("button", { name: `עריכת ${name}` })).toBeVisible();
  });
});
