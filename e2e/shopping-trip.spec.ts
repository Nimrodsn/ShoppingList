import { expect, test } from "@playwright/test";
import { JOIN_PATH, MISSING_JOIN_PATH, addItem, joinHousehold } from "./household";

test.describe("מצב קנייה עד סגירה", () => {
  test.skip(!JOIN_PATH, MISSING_JOIN_PATH);

  test("קונים את כל הרשימה, סוגרים, והפריטים עוברים להיסטוריה", async ({ page }) => {
    await joinHousehold(page, "בודק");

    const stamp = Date.now();
    const names = [`חלב ${stamp}`, `לחם ${stamp}`];
    for (const name of names) await addItem(page, name);

    await page.getByRole("link", { name: "מצב קנייה" }).click();
    await expect(page.getByRole("heading", { name: "מצב קנייה" })).toBeVisible();

    for (const name of names) {
      await page.getByLabel(`סמן ${name} כנלקח`).click();
    }
    await expect(page.getByText("לקחתם הכל!")).toBeVisible();

    await page.getByRole("button", { name: "סיימתי לקנות" }).click();

    await expect(page).toHaveURL(/\/$/);
    for (const name of names) {
      await expect(page.getByRole("button", { name: `עריכת ${name}` })).toHaveCount(0);
    }

    await page.goto("/history");
    await expect(page.getByRole("heading", { name: "היסטוריה" })).toBeVisible();
    for (const name of names) {
      await expect(page.getByText(name)).toBeVisible();
    }
  });

  test("אי אפשר לסגור קנייה בלי שסימנו משהו", async ({ page }) => {
    await joinHousehold(page, "בודק");
    await addItem(page, `קוטג ${Date.now()}`);

    await page.getByRole("link", { name: "מצב קנייה" }).click();
    await expect(page.getByRole("button", { name: "סיימתי לקנות" })).toBeDisabled();
  });
});
