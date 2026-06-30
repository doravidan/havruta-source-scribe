import { test, expect } from "@playwright/test";
import { headerLink, routes, signInLink, waitForAppReady } from "./helpers";

test.describe("Global navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(routes.home);
    await waitForAppReady(page);
  });

  test("navigates to library and marks link active", async ({ page }) => {
    await headerLink(page, /ספרייה|Library/i).click();
    await expect(page).toHaveURL(/\/library/);
    await expect(headerLink(page, /ספרייה|Library/i)).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/ספריית לימוד|Study library/i);
  });

  test("navigates to chavruta guest gate", async ({ page }) => {
    await headerLink(page, /חברותות|Chavruta/i).click();
    await expect(page).toHaveURL(/\/chavruta/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/מצא חברותא|Find a Chassidus chavruta/i);
  });

  test("navigates to beit midrash guest gate", async ({ page }) => {
    await headerLink(page, /בית מדרש|My room/i).click();
    await expect(page).toHaveURL(/\/beit-midrash/);
    await expect(page.getByRole("heading", { name: /בית המדרש|Beit Midrash/i })).toBeVisible();
  });

  test("brand link returns home", async ({ page }) => {
    await page.goto(routes.library);
    await waitForAppReady(page);
    await page.locator("header").getByRole("link", { name: /חסידותא|Chassiduta/i }).first().click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
  });

  test("sign-in link opens auth page", async ({ page }) => {
    await signInLink(page).click();
    await expect(page).toHaveURL(/\/auth/);
  });
});
