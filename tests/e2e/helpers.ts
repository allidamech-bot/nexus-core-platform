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

export async function expectProtectedRouteRedirectsToLogin(page: Page, route: string) {
  await page.context().clearCookies();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Sign in to Nexus Core" })).toBeVisible();
}

export async function login(page: Page, credentials: { email?: string; password?: string }) {
  if (!hasCredentials(credentials)) {
    throw new Error("E2E credentials are not configured.");
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(credentials.email!);
  await page.getByLabel("Password").fill(credentials.password!);
  await page.getByRole("button", { name: "Sign in" }).click();

  try {
    await expect(page).toHaveURL(/\/app(?:\/)?$/);
  } catch {
    const url = page.url();
    console.log("[diagnostics] Login remained on /login - capturing failure details");
    console.log(`[diagnostics] Current URL: ${url}`);

    const errorTextRaw = await captureLoginErrorText(page);
    const errorText = redactDiagnosticsText(errorTextRaw);
    console.log(`[diagnostics] Visible error text: ${errorText}`);

    const bodyTextBeforeRedact = await page.locator("body").innerText();
    const bodyText = redactDiagnosticsText(bodyTextBeforeRedact);
    console.log(`[diagnostics] Body text (truncated/redacted): ${bodyText}`);

    throw new Error(
      `Login failed: remained on /login. Error: ${errorText || "No visible error"}. URL: ${url}`,
    );
  }
}

function redactDiagnosticsText(text: string): string {
  const redacted = text
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[JWT_REDACTED]")
    .replace(/access_token[=:]\s*"[^"]*"/gi, 'access_token="[REDACTED]"')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[EMAIL_REDACTED]")
    .replace(/key=[A-Za-z0-9_-]+/gi, "key=[REDACTED]")
    .replace(/(password|passwd|pwd|secret)[=:]\s*[^\s&]+/gi, "$1=[REDACTED]");
  return redacted.length > 200 ? `${redacted.slice(0, 200)}...[truncated]` : redacted;
}

function redactBodyText(text: string): string {
  return redactDiagnosticsText(text);
}

async function captureLoginErrorText(page: Page): Promise<string> {
  const toastError = page.locator('[data-sonner-toast][data-type="error"]');
  const noticeText = page.locator("div.mb-4.rounded-md");

  if (
    await toastError
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false)
  ) {
    return truncateText(await toastError.first().innerText());
  }

  if (await noticeText.isVisible({ timeout: 1000 }).catch(() => false)) {
    return truncateText(await noticeText.innerText());
  }

  const errorSelectors = [
    "text=Invalid login credentials",
    "text=Email or password",
    "[role=alert]",
    ".error-message",
    '[class*="error"]',
  ];

  for (const selector of errorSelectors) {
    const el = page.locator(selector).first();
    if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
      return truncateText(await el.innerText());
    }
  }

  return "";
}

function truncateText(text: string, maxLen = 100): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}...[truncated]` : trimmed;
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
