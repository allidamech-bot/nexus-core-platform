import { expect, test, type Page } from "@playwright/test";
import { getAccessToken } from "./helpers";

const smokeBaseURL = (
  process.env.NEXUS_AI_SMOKE_BASE_URL ?? process.env.NEXUS_SMOKE_BASE_URL
)?.replace(/\/+$/, "");

const smokeCredentials = {
  email: process.env.NEXUS_AI_SMOKE_EMAIL ?? process.env.NEXUS_SMOKE_USER_EMAIL,
  password: process.env.NEXUS_AI_SMOKE_PASSWORD ?? process.env.NEXUS_SMOKE_USER_PASSWORD,
};

const smokeProjectId = process.env.NEXUS_AI_SMOKE_PROJECT_ID;
const smokeFileIds = (process.env.NEXUS_AI_SMOKE_FILE_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const requiredEnv = [
  ["NEXUS_AI_SMOKE_BASE_URL or NEXUS_SMOKE_BASE_URL", smokeBaseURL],
  ["NEXUS_AI_SMOKE_EMAIL or NEXUS_SMOKE_USER_EMAIL", smokeCredentials.email],
  ["NEXUS_AI_SMOKE_PASSWORD or NEXUS_SMOKE_USER_PASSWORD", smokeCredentials.password],
  ["NEXUS_AI_SMOKE_PROJECT_ID", smokeProjectId],
  ["NEXUS_AI_SMOKE_FILE_IDS", smokeFileIds.length > 0 ? smokeFileIds.join(",") : undefined],
  ["LOVABLE_API_KEY", process.env.LOVABLE_API_KEY],
] as const;

const missingEnv = requiredEnv.filter(([, value]) => !value).map(([name]) => name);
const hasAiSmokeCredentials = missingEnv.length === 0;

async function loginForAiSmoke(page: Page) {
  if (!smokeBaseURL || !smokeCredentials.email || !smokeCredentials.password) {
    throw new Error("BLOCKED_CREDENTIALS_REQUIRED");
  }

  await page.goto(`${smokeBaseURL}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email").fill(smokeCredentials.email);
  await page.getByLabel("Password").fill(smokeCredentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app(?:\/)?$/, { timeout: 20_000 });
}

if (!hasAiSmokeCredentials) {
  test("BLOCKED_AI_PROVIDER_REQUIRED: AI patch preview smoke needs AI and fixture env vars", async () => {
    test.skip(true, `BLOCKED_AI_PROVIDER_REQUIRED: missing ${missingEnv.join(", ")}`);
  });
} else {
  test.describe("AI patch preview credentialed smoke", () => {
    test("creates a governed AI patch preview artifact without source writeback", async ({
      page,
    }) => {
      await loginForAiSmoke(page);
      const token = await getAccessToken(page);
      expect(token, "authenticated smoke session exposes an access token").toBeTruthy();

      const readinessResponse = await page.request.get(
        `${smokeBaseURL}/api/projects/ai-provider-readiness`,
      );
      const readiness = (await readinessResponse.json().catch(() => ({}))) as {
        configured?: boolean;
        code?: string;
        message?: string;
      };

      expect(readinessResponse.ok(), readiness.message ?? "AI readiness check failed").toBe(true);
      expect(readiness.configured, readiness.code ?? "AI provider must be configured").toBe(true);

      const response = await page.request.post(`${smokeBaseURL}/api/projects/ai-patch-preview`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          projectId: smokeProjectId,
          fileIds: smokeFileIds.slice(0, 2),
          title: "AI credentialed smoke preview",
          instruction:
            "Create one minimal, safe wording-only replacement in the selected preview text. Return valid JSON only.",
        },
      });
      const payload = (await response.json().catch(() => ({}))) as {
        previewId?: string;
        status?: string;
        changes?: unknown[];
        error?: string;
        message?: string;
        warnings?: { code?: string; message?: string }[];
      };

      expect(
        response.ok(),
        payload.message ?? payload.error ?? payload.warnings?.[0]?.message ?? "AI smoke failed",
      ).toBe(true);
      expect(payload.previewId).toBeTruthy();
      expect(payload.status).toBe("ready");
      expect(Array.isArray(payload.changes)).toBe(true);
      expect(payload.error).toBeUndefined();
    });
  });
}
