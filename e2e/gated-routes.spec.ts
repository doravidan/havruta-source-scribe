import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow, mainSignInLink, routes, signInLink, waitForAppReady } from "./helpers";

test.describe("Chavruta (guest)", () => {
  test("shows sign-in gate for anonymous users", async ({ page }) => {
    await page.goto(routes.chavruta);
    await waitForAppReady(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/מצא חברותא|Find a Chassidus chavruta/i);
    await expect(signInLink(page)).toBeVisible();
  });

  test("mobile layout has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(routes.chavruta);
    await waitForAppReady(page);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Beit Midrash (guest)", () => {
  test("shows sign-in gate for anonymous users", async ({ page }) => {
    await page.goto(routes.beitMidrash);
    await waitForAppReady(page);
    await expect(page.getByRole("heading", { name: /בית המדרש|Beit Midrash/i })).toBeVisible();
    await expect(mainSignInLink(page)).toBeVisible();
  });
});
