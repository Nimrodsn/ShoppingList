import { expect, test } from "@playwright/test";
import { JOIN_PATH, MISSING_JOIN_PATH } from "./household";

test.describe("הצטרפות דרך הקישור", () => {
  test.skip(!JOIN_PATH, MISSING_JOIN_PATH);

  test("בלי cookie מקבלים מסך נחיתה, ועם קישור נכנסים לרשימה", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "הסל שלנו" }),
    ).toBeVisible();
    await expect(page.getByLabel("הדביקו כאן את הקישור שקיבלתם")).toBeVisible();

    await page.goto(JOIN_PATH);
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole("heading", { name: "איך קוראים לך?" })).toBeVisible();

    await page.getByRole("button", { name: "שם אחר" }).click();
    await page.getByLabel("שם חדש").fill("בודק");
    await page.getByRole("button", { name: "אישור" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel("הוספת פריט")).toBeVisible();

    // The identity survives a reload, which is the whole point of the signed cookie.
    await page.reload();
    await expect(page.getByLabel("הוספת פריט")).toBeVisible();
  });

  test("קישור פגום מחזיר להצטרפות עם הסבר", async ({ page }) => {
    await page.goto("/j/notarealsecretlink12");
    await expect(page.getByRole("alert")).toContainText("הקישור");
  });

  test("מסך מוגן בלי cookie מפנה לדף הבית", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel("הדביקו כאן את הקישור שקיבלתם")).toBeVisible();
  });
});
