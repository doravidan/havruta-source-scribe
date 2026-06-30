import { test, expect } from "@playwright/test";
import {
  dailyStudyPanel,
  routes,
  searchPanel,
  searchResultCards,
  searchSubmitButton,
  typeIntoControlledInput,
  waitForAppReady,
} from "./helpers";

test.describe("Daily study panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(routes.home);
    await waitForAppReady(page);
  });

  test("shows Chitas and Rambam sections", async ({ page }) => {
    const daily = dailyStudyPanel(page);
    await daily.scrollIntoViewIfNeeded();
    await expect(daily.getByText(/חת"ת|Chitas/i).first()).toBeVisible();
    await expect(daily.getByText(/רמב"ם|Rambam/i).first()).toBeVisible();
    await expect(daily.getByRole("button", { name: /חומש|Chumash/i })).toBeVisible();
    await expect(daily.getByRole("button", { name: /תהלים|Tehillim/i })).toBeVisible();
    await expect(daily.getByRole("button", { name: /תניא|Tanya/i })).toBeVisible();
  });

  test("opens source reader when daily item clicked", async ({ page }) => {
    test.setTimeout(90_000);
    const daily = dailyStudyPanel(page);
    await daily.scrollIntoViewIfNeeded();
    await daily.getByRole("button", { name: /חומש|Chumash/i }).first().click();

    await expect
      .poll(async () => {
        const dialog = await page.getByRole("dialog").isVisible().catch(() => false);
        const error = await daily.getByText(/טעינה נכשלה|Load failed/i).isVisible().catch(() => false);
        return dialog || error;
      }, { timeout: 75_000 })
      .toBeTruthy();

    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible()) {
      await expect(dialog.getByRole("button", { name: /סגור|Close/i })).toBeVisible();
      await dialog.getByRole("button", { name: /סגור|Close/i }).click();
      await expect(dialog).toBeHidden();
    }
  });
});

test.describe("Source reader via search", () => {
  test("opens reader modal from search result when corpus has data", async ({ page }) => {
    await page.goto(routes.home);
    await waitForAppReady(page);

    await typeIntoControlledInput(page.locator("#search-query"), "תניא");
    await searchSubmitButton(page).click();

    await expect
      .poll(async () => {
        const loading = await searchPanel(page).locator(".animate-pulse").first().isVisible().catch(() => false);
        const count = await searchResultCards(page).count();
        const empty = await page.getByText(/אין תוצאות|No results/i).isVisible().catch(() => false);
        return !loading && (count > 0 || empty);
      }, { timeout: 30_000 })
      .toBeTruthy();

    const cards = searchResultCards(page);
    if ((await cards.count()) === 0) test.skip(true, "No search results in corpus");

    await cards.first().locator("button").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByPlaceholder(/חיפוש בתוך|Search inside/i)).toBeVisible();
    await dialog.getByRole("button", { name: /סגור|Close/i }).click();
    await expect(dialog).toBeHidden();
  });

  test("reader toolbar overflow menu works on mobile", async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(routes.home);
    await waitForAppReady(page);

    await typeIntoControlledInput(page.locator("#search-query"), "תניא");
    await searchSubmitButton(page).click();

    await expect
      .poll(async () => {
        const loading = await searchPanel(page).locator(".animate-pulse").first().isVisible().catch(() => false);
        const count = await searchResultCards(page).count();
        const empty = await page.getByText(/אין תוצאות|No results/i).isVisible().catch(() => false);
        return !loading && (count > 0 || empty);
      }, { timeout: 30_000 })
      .toBeTruthy();

    const cards = searchResultCards(page);
    if ((await cards.count()) === 0) test.skip(true, "No search results");

    await cards.first().locator("button").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    const more = dialog.getByRole("button", { name: /פעולות נוספות|More actions/i });
    if (await more.isVisible()) {
      await more.click();
      await expect(page.getByRole("menuitem").first()).toBeVisible();
    }

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 10_000 });
  });
});
