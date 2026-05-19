import { expect, test } from "@playwright/test";
import { cleanupE2eFixtures, ensureE2eFixtures } from "./fixtures";
import {
  adminCredentials,
  findFirstThreadId,
  getAccessToken,
  hasCredentials,
  login,
  nonAdminCredentials,
} from "./helpers";

const adminTest = hasCredentials(adminCredentials) ? test : test.skip;
const nonAdminTest = hasCredentials(nonAdminCredentials) ? test : test.skip;

test.describe("credentialed E2E boundaries", () => {
  test.afterAll(async () => {
    await cleanupE2eFixtures();
  });

  adminTest("admin can access the control plane", async ({ page }) => {
    await login(page, adminCredentials);
    await page.goto("/app/admin");
    await expect(page).toHaveURL(/\/app\/admin$/);
    await expect(page.getByText(/Migration checklist|قائمة التحقق من الترحيل/)).toBeVisible();
    await expect(page.getByText("is_admin")).toBeVisible();
  });

  nonAdminTest("non-admin is denied admin control plane access", async ({ page }) => {
    await login(page, nonAdminCredentials);
    await page.goto("/app/admin");
    await expect(page).toHaveURL(/\/app(?:\/)?$/);
    await expect(page.getByText(/Control plane|مركز التحكم/)).toHaveCount(0);
  });

  adminTest("authenticated chat reaches the configured AI boundary", async ({ page, request }) => {
    await login(page, adminCredentials);
    const threadId = await findFirstThreadId(page);
    test.skip(!threadId, "No existing thread is available for credentialed chat QA.");

    const token = await getAccessToken(page);
    expect(token).toBeTruthy();

    const response = await request.post("/api/chat", {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        id: threadId,
        mode: "engineering",
        selectedPreviewIds: [],
        messages: [
          {
            id: crypto.randomUUID(),
            role: "user",
            parts: [{ type: "text", text: "E2E QA boundary smoke." }],
          },
        ],
      },
    });

    if (!process.env.LOVABLE_API_KEY) {
      expect(response.status()).toBe(503);
      await expect(response).toContainText("LOVABLE_API_KEY");
      return;
    }

    expect([200, 402, 503]).toContain(response.status());
    expect(await response.text()).not.toContain(process.env.LOVABLE_API_KEY);
  });

  adminTest("ZIP upload fixtures are available and guarded by auth/quota", async ({ page }) => {
    const fixtures = await ensureE2eFixtures();
    await login(page, adminCredentials);

    const pageText = await page.locator("body").innerText();
    test.skip(
      /Projects\s+1 used \/ 1 limit|المشاريع\s+المستخدم ١ من أصل ١/.test(pageText),
      "Project quota is already exhausted for this account.",
    );

    await page.getByRole("button", { name: /Upload ZIP|رفع ملف ZIP/ }).click();
    await page.locator('input[type="file"][accept*=".zip"]').setInputFiles(fixtures.invalidText);
    await page.getByRole("button", { name: /Create project|إنشاء المشروع/ }).click();
    await expect(page.getByText(/Only \.zip|ZIP/)).toBeVisible();

    await page.locator('input[type="file"][accept*=".zip"]').setInputFiles(fixtures.validZip);
    await expect(page.getByText(/small-valid-project/i)).toBeVisible();

    await page.locator('input[type="file"][accept*=".zip"]').setInputFiles(fixtures.suspiciousZip);
    await expect(page.getByText(/suspicious-paths/i)).toBeVisible();
  });

  adminTest("logout clears private/admin UI", async ({ page }) => {
    await login(page, adminCredentials);
    await page.getByRole("button", { name: /Sign out|تسجيل الخروج/ }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(adminCredentials.email!)).toHaveCount(0);

    await page.goto("/app/admin");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(/Control plane|مركز التحكم/)).toHaveCount(0);
  });
});
