import { test, expect } from "@playwright/test";
import { authFormCard, routes, signInLink, typeIntoControlledInput, waitForAppReady, waitForPageShell } from "./helpers";

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

  test("loads with redirect search param", async ({ page }) => {
    await page.goto(`${routes.auth}?redirect=${encodeURIComponent("/chavruta")}`);
    await waitForPageShell(page);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test("shows email confirmation when sign-up requires verification", async ({ page }) => {
    await page.route("**/auth/v1/signup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "00000000-0000-4000-8000-000000000001", email: "new@example.com" },
          session: null,
        }),
      });
    });

    const card = authFormCard(page);
    await card.getByRole("button", { name: /No account\?|אין לך חשבון\?/i }).click();
    await typeIntoControlledInput(card.locator('input[type="email"]'), "new@example.com");
    await typeIntoControlledInput(card.locator('input[type="password"]'), "secret123");
    await card.getByRole("button", { name: /^הרשמה$|^Sign up$/i }).click();

    const confirmation = page.getByTestId("auth-email-confirmation");
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole("heading", { level: 1 })).toContainText(
      /Check your email|בדוק את האימייל/i,
    );
    await expect(confirmation).toContainText("new@example.com");
  });
});

test.describe("Study room (guest)", () => {
  test("shows sign-in gate for anonymous users", async ({ page }) => {
    await page.goto("/study/00000000-0000-4000-8000-000000000099");
    await waitForAppReady(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Sign in required|צריך להתחבר/i);
    await expect(page.locator('#main-content a[href="/auth"]')).toBeVisible();
  });
});
