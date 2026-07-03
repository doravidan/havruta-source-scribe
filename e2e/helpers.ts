import { expect, type Locator, type Page } from "@playwright/test";

/** Horizontal overflow in px (allow 1px subpixel slack). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const vw = window.innerWidth;
    return Math.max(doc.scrollWidth, body.scrollWidth) - vw;
  });
}

export async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => horizontalOverflow(page), { timeout: 5000 }).toBeLessThanOrEqual(1);
}

export async function getHtmlLangDir(page: Page) {
  return page.evaluate(() => ({
    lang: document.documentElement.lang,
    dir: document.documentElement.dir,
  }));
}

export function headerNav(page: Page) {
  return page.locator("header nav").first();
}

export async function resetLanguageStorage(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("havruta_lang");
    } catch {
      /* ignore */
    }
  });
}

export async function toggleLanguage(page: Page) {
  const btn = page.locator("header").getByRole("button", {
    name: /Toggle language|החלפת שפה/,
  });
  await btn.click();
  await expect(page.locator("#ask-panel-title")).toContainText(/Ask your chavruta/i, {
    timeout: 10_000,
  });
}

/** React controlled inputs: fill() alone may not update state. */
export async function typeIntoControlledInput(locator: Locator, text: string) {
  await locator.click();
  await locator.fill("");
  await locator.pressSequentially(text, { delay: 15 });
}

export async function waitForHydration(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(
    () => {
      const root = document.querySelector("#main-content, form");
      if (!root) return false;
      // TanStack Start / React 19: hydrated roots respond to input events.
      const textarea = document.querySelector<HTMLTextAreaElement>("#ask-question");
      if (textarea) {
        textarea.focus();
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
      return true;
    },
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(250);
}

export async function waitForAppReady(page: Page) {
  await waitForHydration(page);
  const header = page.locator("header");
  if (await header.count()) {
    await expect(header.first()).toBeVisible();
  } else {
    await expect(page.locator("#main-content, main, body").first()).toBeVisible();
  }
}

export async function waitForPageShell(page: Page) {
  await waitForHydration(page);
  await expect(page.locator("body")).toBeVisible();
}

export const routes = {
  home: "/",
  library: "/library",
  auth: "/auth",
  chavruta: "/chavruta",
  beitMidrash: "/beit-midrash",
} as const;

/** Primary CTA in the ask panel (avoids footer/nav collisions). */
export function askSubmitButton(page: Page) {
  return page.locator("#ask").getByRole("button").filter({ hasText: /^שאל$|^Ask$/ });
}

export function searchPanel(page: Page) {
  return page.locator('section[aria-labelledby="search-panel-title"]');
}

/** Primary CTA in the search panel. */
export function searchSubmitButton(page: Page) {
  return searchPanel(page).getByRole("button").filter({ hasText: /^חפש$|^Search$/i });
}

export function dailyStudyPanel(page: Page) {
  return page.locator("#main-content section.scholar-card").filter({
    has: page.getByRole("heading", { name: /לימוד יומי|Daily Study/i }),
  });
}

/** Header nav link by label (avoids footer duplicates). */
export function headerLink(page: Page, name: RegExp) {
  return headerNav(page).getByRole("link", { name });
}

export function signInLink(page: Page) {
  return page.locator("header nav").locator('a[href="/auth"]').first();
}

export function mainSignInLink(page: Page) {
  return page.locator("#main-content").getByRole("link", { name: /^התחברות$|^Sign in$/i });
}

export function searchResultCards(page: Page) {
  return searchPanel(page).locator(".mt-5 .scholar-card");
}

export function yiddishHelper(page: Page) {
  return page.getByRole("complementary").filter({
    has: page.getByRole("heading", { name: /מילון|Yiddish/i }),
  });
}

export function authFormCard(page: Page) {
  return page.locator("section.scholar-card").filter({ has: page.locator("form") });
}
