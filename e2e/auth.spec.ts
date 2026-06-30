import { test, expect } from "@playwright/test";
import { authFormCard, routes, signInLink, waitForAppReady, waitForPageShell } from "./helpers";

test.describe("Auth page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(routes.auth);
    await waitForPageShell(page);
  });

  test("shows sign-in form with email and password", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /Google|Continue with Google|המשך עם Google/i })).toBeVisible();
  });

  test("toggles between sign-in and sign-up modes", async ({ page }) => {
    const card = authFormCard(page);
    const toggle = card.getByRole("button", {
      name: /אין לך חשבון\?|No account\?|Have an account\?|יש לך חשבון\?/i,
    });
    await toggle.click();
    await expect(card.getByRole("heading", { level: 1 })).toContainText(/הרשמה|Sign up/i);
    await expect(card.locator("form").getByPlaceholder(/^(שם|Name)$/)).toBeVisible();
    await toggle.click();
    await expect(card.getByRole("heading", { level: 1 })).toContainText(/התחברות|Sign in/i);
    await expect(card.locator("form").getByPlaceholder(/^(שם|Name)$/)).toHaveCount(0);
  });

  test("validates required fields on submit", async ({ page }) => {
    await page.getByRole("button", { name: /^התחברות$|^Sign in$/i }).click();
    await expect(page.locator('input[type="email"]:invalid')).toHaveCount(1);
  });

  test("back link returns home on mobile layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("link", { name: /חזרה|Back/i }).first().click();
    await expect(page).toHaveURL(/\/(\?.*)?$/);
    await waitForAppReady(page);
  });
});
