import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow, routes, waitForAppReady } from "./helpers";

test.describe("Library", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(routes.library);
    await waitForAppReady(page);
  });

  test("loads browse UI with breadcrumb and content area", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/ספריית לימוד|Study library/i);
    await expect(page.getByRole("navigation").first()).toBeVisible();
    await expect(page.locator(".scholar-card").first()).toBeVisible();
  });

  test("can drill into a folder when children exist", async ({ page }) => {
    const folder = page.locator("button").filter({ has: page.locator("svg") }).filter({ hasText: /./ }).first();
    const folderCount = await page.getByRole("heading", { name: /ספרים|Books/i }).count();

    if (folderCount === 0) {
      test.skip(true, "No library folders in corpus yet");
    }

    const folderButtons = page.locator("section button").filter({ hasText: /מקורות|source/i });
    if ((await folderButtons.count()) === 0) {
      const anyFolder = page.locator("section button.rounded-2xl").first();
      if ((await anyFolder.count()) === 0) test.skip(true, "Empty library corpus");
      await anyFolder.click();
    } else {
      await folderButtons.first().click();
    }

    await expect(page.locator("nav button, nav span").filter({ hasText: /./ }).nth(1)).toBeVisible();
  });

  test("mobile library has no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
  });
});
