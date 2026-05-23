import { expect, test } from "@playwright/test";
import { expectProtectedRouteRedirectsToLogin, useAnonymousBrowserState } from "./helpers";

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
