import { expect, test, type Page } from "@playwright/test";

const smokeBaseURL = process.env.NEXUS_SMOKE_BASE_URL?.replace(/\/+$/, "");

const smokeAdminCredentials = {
  email: process.env.NEXUS_SMOKE_ADMIN_EMAIL,
  password: process.env.NEXUS_SMOKE_ADMIN_PASSWORD,
};

const smokeUserCredentials = {
  email: process.env.NEXUS_SMOKE_USER_EMAIL,
  password: process.env.NEXUS_SMOKE_USER_PASSWORD,
};

const requiredEnv = [
  ["NEXUS_SMOKE_BASE_URL", smokeBaseURL],
  ["NEXUS_SMOKE_ADMIN_EMAIL", smokeAdminCredentials.email],
  ["NEXUS_SMOKE_ADMIN_PASSWORD", smokeAdminCredentials.password],
  ["NEXUS_SMOKE_USER_EMAIL", smokeUserCredentials.email],
  ["NEXUS_SMOKE_USER_PASSWORD", smokeUserCredentials.password],
] as const;

const missingEnv = requiredEnv.filter(([, value]) => !value).map(([name]) => name);
const hasProductionSmokeCredentials = missingEnv.length === 0;

async function loginAtProduction(page: Page, credentials: { email?: string; password?: string }) {
  if (!smokeBaseURL || !credentials.email || !credentials.password) {
    throw new Error("BLOCKED_CREDENTIALS_REQUIRED");
  }

  await page.goto(`${smokeBaseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/)?$/, { timeout: 20_000 });
}

if (!hasProductionSmokeCredentials) {
  test("BLOCKED_CREDENTIALS_REQUIRED: production credentialed smoke needs NEXUS_SMOKE_* env vars", async () => {
    test.skip(true, `BLOCKED_CREDENTIALS_REQUIRED: missing ${missingEnv.join(", ")}`);
  });
} else {
  test.describe("production credentialed smoke gate", () => {
    test("public app loads", async ({ page }) => {
      await page.goto(smokeBaseURL!, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(/Nexus Core|Nexus/i).first()).toBeVisible();
    });

    test("admin session loads and exposes Admin Control", async ({ page }) => {
      await loginAtProduction(page, smokeAdminCredentials);
      await expect(page.getByText(/Admin Control|لوحة الإدارة/)).toBeVisible();

      await page.goto(`${smokeBaseURL}/app/admin`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/app\/admin$/);
      await expect(page.getByRole("heading", { name: /Writeback review workflow/i })).toBeVisible();
    });

    test("non-admin session loads and cannot access Admin Control", async ({ page }) => {
      await loginAtProduction(page, smokeUserCredentials);
      await expect(page.getByText(/Admin Control|لوحة الإدارة/)).toHaveCount(0);

      await page.goto(`${smokeBaseURL}/app/admin`, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/app(?:\/)?$/);
      await expect(page.getByRole("link", { name: /Admin Control/i })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: /Writeback review workflow/i })).toHaveCount(
        0,
      );
      await expect(page.getByRole("heading", { name: /Migration checklist/i })).toHaveCount(0);
    });
  });
}
