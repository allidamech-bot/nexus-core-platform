import { expect, test } from "@playwright/test";
import { expectProtectedRouteRedirectsToLogin, useAnonymousBrowserState } from "./helpers";

const AR_LOGIN_TITLE =
  "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0625\u0644\u0649 Nexus Core";
const AR_SIGNUP_TITLE =
  "\u0625\u0646\u0634\u0627\u0621 \u0645\u0633\u0627\u062d\u0629 \u0639\u0645\u0644\u0643";
const AR_EMAIL_LABEL =
  "\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a";
const AR_WORK_EMAIL_LABEL =
  "\u0628\u0631\u064a\u062f \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a";
const AR_PASSWORD_LABEL = "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631";

test.describe("public routes and unauthenticated boundaries", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ context }) => {
    await useAnonymousBrowserState(context);
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to Nexus Core" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("signup page loads", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("login page visible copy follows Arabic preference", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Sign in to Nexus Core" })).toBeVisible();

    const arabicButton = page.getByRole("button", { name: "Switch interface to Arabic" });
    await expect(arabicButton).toBeVisible();
    await arabicButton.click();

    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("nexus-locale")))
      .toBe("ar");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: AR_LOGIN_TITLE })).toBeVisible();
    await expect(page.getByLabel(AR_EMAIL_LABEL)).toBeVisible();
    await expect(page.getByLabel(AR_PASSWORD_LABEL)).toBeVisible();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: AR_LOGIN_TITLE })).toBeVisible();
  });

  test("signup page visible copy follows Arabic preference", async ({ page }) => {
    await page.goto("/signup", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();

    const arabicButton = page.getByRole("button", { name: "Switch interface to Arabic" });
    await expect(arabicButton).toBeVisible();
    await arabicButton.click();

    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem("nexus-locale")))
      .toBe("ar");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: AR_SIGNUP_TITLE })).toBeVisible();
    await expect(page.getByLabel(AR_WORK_EMAIL_LABEL)).toBeVisible();
    await expect(page.getByLabel(AR_PASSWORD_LABEL)).toBeVisible();
  });

  for (const route of ["/app", "/app/settings", "/app/admin", "/app/test-thread-id"]) {
    test(`protects ${route} for unauthenticated users`, async ({ page }) => {
      await expectProtectedRouteRedirectsToLogin(page, route);
    });
  }

  test("rejects unauthenticated API requests", async ({ request }) => {
    const chat = await request.post("/api/chat", {
      data: { id: "00000000-0000-0000-0000-000000000000", messages: [] },
    });
    expect(chat.status()).toBe(401);

    const processZip = await request.post("/api/projects/process-zip", {
      data: { projectId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(processZip.status()).toBe(401);

    const processZipWithoutProjectId = await request.post("/api/projects/process-zip", {
      data: {},
    });
    expect(processZipWithoutProjectId.status()).toBe(401);
  });

  test("persists Arabic RTL preference without credentials", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    const arabicButton = page.getByRole("button", { name: "Switch interface to Arabic" });
    await expect(arabicButton).toBeVisible();
    await arabicButton.click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});
