import { expect, type BrowserContext, type Page } from "@playwright/test";

export const adminCredentials = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};

export const nonAdminCredentials = {
  email: process.env.E2E_NON_ADMIN_EMAIL,
  password: process.env.E2E_NON_ADMIN_PASSWORD,
};

export function hasCredentials(credentials: { email?: string; password?: string }) {
  return Boolean(credentials.email && credentials.password);
}

export async function useAnonymousBrowserState(context: BrowserContext) {
  await context.clearCookies();
  await context.clearPermissions();
  await context.addInitScript(() => {
    const clearedMarker = "__nexus_e2e_anonymous_state_cleared__";
    if (window.name.includes(clearedMarker)) return;

    window.localStorage.clear();
    window.sessionStorage.clear();
    window.name = window.name ? `${window.name} ${clearedMarker}` : clearedMarker;
  });
}

export async function login(page: Page, credentials: { email?: string; password?: string }) {
  if (!hasCredentials(credentials)) {
    throw new Error("E2E credentials are not configured.");
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email!);
  await page.getByLabel("Password").fill(credentials.password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/)?$/);
}

export async function findFirstThreadId(page: Page) {
  const links = await page.locator('a[href^="/app/"]').evaluateAll((anchors) =>
    anchors
      .map((anchor) => anchor.getAttribute("href"))
      .filter((href): href is string => Boolean(href))
      .map((href) => href.match(/^\/app\/([0-9a-f-]{36})$/i)?.[1])
      .find(Boolean),
  );
  return links ?? null;
}

export async function getAccessToken(page: Page) {
  return page.evaluate(() => {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      const raw = key ? window.localStorage.getItem(key) : null;
      if (!raw || !raw.includes("access_token")) continue;

      try {
        const parsed = JSON.parse(raw) as {
          access_token?: string;
          currentSession?: { access_token?: string };
          session?: { access_token?: string };
        };
        const token =
          parsed.access_token ??
          parsed.currentSession?.access_token ??
          parsed.session?.access_token;
        if (typeof token === "string" && token.length > 20) return token;
      } catch {
        // Ignore unrelated localStorage values.
      }
    }
    return null;
  });
}
