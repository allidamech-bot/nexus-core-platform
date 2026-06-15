import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredPersistedEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL,
  E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
  E2E_NON_ADMIN_EMAIL: process.env.E2E_NON_ADMIN_EMAIL,
  E2E_NON_ADMIN_PASSWORD: process.env.E2E_NON_ADMIN_PASSWORD,
};

const missingPersistedEnv = Object.entries(requiredPersistedEnv)
  .filter(([, value]) => !value)
  .map(([name]) => name);

const persistedRlsRouteBlocker =
  "BLOCKED_RLS_PERSISTED_ROUTE_REQUIRED: existing authenticated routes can seed safe previews via /api/projects/seed-demo, but there is no deterministic RLS-respecting route/API that creates the patch preview, patch snapshot, and writeback request artifacts needed by writeback-review, writeback-execute, and working-copy-export without AI-provider dependency or privileged table seeding.";

async function expectJsonStatus(responsePromise: Promise<{ status(): number }>, status: number) {
  const response = await responsePromise;
  expect(response.status()).toBe(status);
  return response;
}

test.describe("H.1.1 API-backed governed workflow route validation", () => {
  test("keeps governed API routes and health endpoint available while unauthenticated users are blocked", async ({
    request,
  }) => {
    const health = await request.get("/api/health");
    await expect(health).toBeOK();
    await expect(health.json()).resolves.toEqual({
      ok: true,
      app: "nexus-core",
      commitAware: true,
    });

    await expectJsonStatus(
      request.post("/api/chat", {
        data: { id: crypto.randomUUID(), messages: [] },
      }),
      401,
    );
    await expectJsonStatus(
      request.post("/api/projects/process-zip", {
        data: { projectId: crypto.randomUUID() },
      }),
      401,
    );
    await expectJsonStatus(
      request.post("/api/projects/seed-demo", {
        data: {},
      }),
      401,
    );
    await expectJsonStatus(
      request.post("/api/projects/ai-patch-preview", {
        data: { projectId: crypto.randomUUID(), fileIds: [], instruction: "No-op" },
      }),
      401,
    );
    await expectJsonStatus(
      request.post("/api/projects/writeback-review", {
        data: { requestId: crypto.randomUUID(), action: "approve" },
      }),
      401,
    );
    await expectJsonStatus(
      request.post("/api/projects/writeback-execute", {
        data: { requestId: crypto.randomUUID() },
      }),
      401,
    );

    const exportResponse = await request.get(
      `/api/projects/working-copy-export?workingCopyId=${crypto.randomUUID()}`,
    );
    expect(exportResponse.status()).toBe(401);
  });

  test("keeps routeTree registration and Worker runtime guards intact", () => {
    const routeTree = readFileSync(resolve(process.cwd(), "src/routeTree.gen.ts"), "utf8");
    for (const routeImport of [
      "ApiHealthRouteImport",
      "ApiChatRouteImport",
      "ApiProjectsProcessZipRouteImport",
      "ApiProjectsSeedDemoRouteImport",
      "ApiProjectsAiPatchPreviewRouteImport",
      "ApiProjectsWritebackReviewRouteImport",
      "ApiProjectsWritebackExecuteRouteImport",
      "ApiProjectsWorkingCopyExportRouteImport",
    ]) {
      expect(routeTree).toContain(routeImport);
    }

    const writebackExecute = readFileSync(
      resolve(process.cwd(), "src/routes/api/projects.writeback-execute.ts"),
      "utf8",
    );
    const githubService = readFileSync(
      resolve(process.cwd(), "src/features/github/githubService.ts"),
      "utf8",
    );
    expect(writebackExecute).toContain("project_working_copies");
    expect(writebackExecute).toContain("project_working_copy_files");
    expect(writebackExecute).not.toContain('ref: "refs/heads/main"');
    expect(writebackExecute).not.toContain("/contents/");
    expect(githubService).toContain("refs/heads/${branchName}");
    expect(githubService).toContain("base: baseBranch");
    expect(githubService).not.toContain("PATCH");
    expect(githubService).not.toContain("PUT");
    expect(githubService).not.toContain("/contents/");
  });

  if (process.env.PERSISTED_GOVERNED_E2E !== "1" || missingPersistedEnv.length > 0) {
    test("BLOCKED_RLS_PERSISTED_ENV_REQUIRED: persisted governed route chain needs authenticated Supabase E2E users", async () => {
      const missing =
        process.env.PERSISTED_GOVERNED_E2E === "1"
          ? missingPersistedEnv.join(", ")
          : "PERSISTED_GOVERNED_E2E";
      test.skip(true, `BLOCKED_RLS_PERSISTED_ENV_REQUIRED: missing ${missing}`);
    });
  } else {
    test("BLOCKED_RLS_PERSISTED_ROUTE_REQUIRED: full persisted route chain needs a product-safe fixture path", async () => {
      test.skip(true, persistedRlsRouteBlocker);
    });
  }
});
