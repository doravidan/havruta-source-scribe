import { test, expect } from "@playwright/test";
import { expectNoHorizontalOverflow, routes, waitForAppReady, waitForPageShell } from "./helpers";

const publicRoutes = [
  { path: routes.home, name: "home", needsHeader: true },
  { path: routes.library, name: "library", needsHeader: true },
  { path: routes.auth, name: "auth", needsHeader: false },
  { path: routes.chavruta, name: "chavruta", needsHeader: true },
  { path: routes.beitMidrash, name: "beit-midrash", needsHeader: true },
] as const;

async function gotoReady(page: import("@playwright/test").Page, route: (typeof publicRoutes)[number]) {
  await page.goto(route.path);
  if (route.needsHeader) await waitForAppReady(page);
  else await waitForPageShell(page);
}

test.describe("Cross-page UX quality", () => {
  for (const route of publicRoutes) {
    test(`${route.name} has no uncaught page errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));

      await gotoReady(page, route);
      await page.waitForTimeout(1000);

      // Ignore benign third-party / hydration noise if any appears later.
      expect(errors.filter((e) => !/ResizeObserver|hydration/i.test(e)), errors.join("\n")).toEqual([]);
    });
  }

  test("all public routes render primary heading", async ({ page }) => {
    for (const route of publicRoutes) {
      await gotoReady(page, route);
      await expect(page.getByRole("heading").first()).toBeVisible();
    }
  });
});

test.describe("Responsive layout audit", () => {
  const viewports = [
    { width: 1440, height: 900, label: "desktop" },
    { width: 820, height: 1180, label: "tablet" },
    { width: 390, height: 844, label: "mobile" },
  ] as const;

  for (const vp of viewports) {
    test(`home @ ${vp.label} (${vp.width}px) — no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(routes.home);
      await waitForAppReady(page);
      await expectNoHorizontalOverflow(page);
    });
  }
});

test.describe("Accessibility basics", () => {
  test("home has lang and dir on html element", async ({ page }) => {
    await page.goto(routes.home);
    await waitForAppReady(page);
    await expect(page.locator("html")).toHaveAttribute("lang", /he|en/);
    await expect(page.locator("html")).toHaveAttribute("dir", /rtl|ltr/);
  });

  test("interactive controls meet minimum touch target on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(routes.home);
    await waitForAppReady(page);

    const buttons = page.locator("header button, header a");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 6); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (!box) continue;
      expect(box.height).toBeGreaterThanOrEqual(36);
    }
  });

  test("ask textarea is keyboard focusable", async ({ page }) => {
    await page.goto(routes.home);
    await waitForAppReady(page);
    await page.locator("#ask-question").focus();
    await expect(page.locator("#ask-question")).toBeFocused();
  });
});
