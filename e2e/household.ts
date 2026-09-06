import { expect, type Page } from "@playwright/test";

/**
 * The secret join path of a throwaway household, e.g. `/j/AbCdEfGhIjKlMnOpQrStUv`.
 * Create one with `pnpm create-household` and export it before running the suite;
 * without it every spec skips, because there is nothing to sign in to.
 */
export const JOIN_PATH = process.env.E2E_JOIN_PATH ?? "";

export const MISSING_JOIN_PATH =
  "צריך E2E_JOIN_PATH של משק בית לבדיקות (pnpm create-household)";

/** Joins through the secret link and picks a member name, landing on the list. */
export async function joinHousehold(page: Page, memberName: string): Promise<void> {
  await page.goto(JOIN_PATH);

  // A first visit always asks who you are; a returning cookie skips straight in.
  if (page.url().includes("/welcome")) {
    await page.getByRole("button", { name: "שם אחר" }).click();
    await page.getByLabel("שם חדש").fill(memberName);
    await page.getByRole("button", { name: "אישור" }).click();
  }

  await expect(page.getByLabel("הוספת פריט")).toBeVisible();
}

/** Types into the add bar and waits for the row to show up. */
export async function addItem(page: Page, name: string): Promise<void> {
  await page.getByLabel("הוספת פריט").fill(name);
  await page.getByRole("button", { name: "הוספה", exact: true }).click();
  await expect(page.getByRole("button", { name: `עריכת ${name}` })).toBeVisible();
}
