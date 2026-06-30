import { test, expect } from "@playwright/test";
import {
  askSubmitButton,
  expectNoHorizontalOverflow,
  getHtmlLangDir,
  headerLink,
  resetLanguageStorage,
  routes,
  searchSubmitButton,
  toggleLanguage,
  typeIntoControlledInput,
  waitForAppReady,
  yiddishHelper,
} from "./helpers";

test.describe("Home page", () => {
  test.beforeEach(async ({ page }) => {
    await resetLanguageStorage(page);
    await page.goto(routes.home);
    await waitForAppReady(page);
  });

  test("loads with Hebrew RTL defaults and primary sections", async ({ page }) => {
    const { lang, dir } = await getHtmlLangDir(page);
    expect(lang).toBe("he");
    expect(dir).toBe("rtl");

    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.locator("#ask")).toBeVisible();
    await expect(page.locator("#ask-panel-title")).toContainText(/שאל את החברותא|Ask your chavruta/i);
    await expect(page.locator("#search-panel-title")).toContainText(/חיפוש|Search/i);
    await expect(page.getByRole("heading", { name: /לימוד יומי|Daily Study/i })).toBeVisible();
    await expect(page.locator("#main-content")).toBeVisible();
  });

  test("skip link targets main content", async ({ page }) => {
    const skip = page.getByRole("link", { name: /Skip to content|דלג לתוכן/i });
    await expect(skip).toBeAttached();
    await skip.focus();
    await expect(skip).toBeVisible();
    await expect(skip).toHaveAttribute("href", "#main-content");
  });

  test("language toggle switches to English LTR", async ({ page }) => {
    await toggleLanguage(page);
    await expect(page.locator("#ask-panel-title")).toContainText(/Ask your chavruta/i);
    await expect(page.locator("header").getByRole("link", { name: /^Library$|^ספרייה$/i })).toBeVisible();
    await expect.poll(async () => (await getHtmlLangDir(page)).dir, { timeout: 10_000 }).toBe("ltr");
  });

  test("hero CTA scrolls to ask panel", async ({ page }) => {
    await page.getByRole("link", { name: /פתח שאלה|Ask a question/i }).click();
    await expect(page.locator("#ask")).toBeInViewport();
  });

  test("ask panel accepts input and shows loading or error for guests", async ({ page }) => {
    test.setTimeout(90_000);
    await page.locator("#ask").getByRole("button", { name: "מה זה בינוני בתניא?" }).click();

    await expect
      .poll(async () => {
        const loading = await page.locator("#ask").getByText(/מעיין במקורות|Studying the sources/i).isVisible().catch(() => false);
        const answer = await page.locator("#ask article").filter({ hasText: /.+/ }).isVisible().catch(() => false);
        const error = await page.locator("#ask [role='alert']").isVisible().catch(() => false);
        const toast = await page.locator("[data-sonner-toast]").isVisible().catch(() => false);
        return loading || answer || error || toast;
      }, { timeout: 60_000 })
      .toBeTruthy();
  });

  test("search panel submits query and shows results or empty state", async ({ page }) => {
    await typeIntoControlledInput(page.locator("#search-query"), "תניא");
    await expect(searchSubmitButton(page)).toBeEnabled();
    await searchSubmitButton(page).click();

    await expect
      .poll(async () => {
        const results = await page.getByText(/תוצאות|result/i).isVisible().catch(() => false);
        const empty = await page.getByText(/אין תוצאות|No results/i).isVisible().catch(() => false);
        const hint = await page.getByText(/חפש לפי|Search by/i).isVisible().catch(() => false);
        return results || empty || !hint;
      }, { timeout: 30_000 })
      .toBeTruthy();
  });

  test("yiddish helper shows dictionary hit", async ({ page }) => {
    const helper = yiddishHelper(page);
    await helper.scrollIntoViewIfNeeded();
    await helper.getByRole("button", { name: "וואס" }).click();
    await expect(helper.getByText(/עברית:/)).toBeVisible({ timeout: 10_000 });
    await expect(helper.getByText(/English:/)).toBeVisible();
  });

  test("footer contains navigation links", async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link", { name: /ספרייה|Library/i })).toBeVisible();
    await expect(footer.getByRole("link", { name: /חברותות|Chavruta/i })).toBeVisible();
  });
});

test.describe("Home mobile RTL", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no horizontal overflow on home", async ({ page }) => {
    await page.goto(routes.home);
    await waitForAppReady(page);
    await expectNoHorizontalOverflow(page);
  });

  test("top bar nav is reachable on mobile", async ({ page }) => {
    await page.goto(routes.home);
    await waitForAppReady(page);
    await expect(page.locator("header nav")).toBeVisible();
    await headerLink(page, /ספרייה|Library/i).click();
    await expect(page).toHaveURL(/\/library/);
  });
});
