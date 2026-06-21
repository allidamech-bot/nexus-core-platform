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
    test("runs a full persisted governed route chain through RLS-owned artifacts", async ({
      browser,
      request,
    }) => {
      const ownerContext = await browser.newContext();
      const adminContext = await browser.newContext();
      const ownerPage = await ownerContext.newPage();
      const adminPage = await adminContext.newPage();

      const { adminCredentials, getAccessToken, login, nonAdminCredentials } =
        await import("./helpers");

      try {
        await login(ownerPage, nonAdminCredentials);
        const ownerToken = await getAccessToken(ownerPage);
        expect(ownerToken).toBeTruthy();

        await login(adminPage, adminCredentials);
        const adminToken = await getAccessToken(adminPage);
        expect(adminToken).toBeTruthy();

        const ownerHeaders = { Authorization: `Bearer ${ownerToken}` };
        const adminHeaders = { Authorization: `Bearer ${adminToken}` };

        const seed = await request.post("/api/projects/seed-demo", {
          headers: adminHeaders,
          data: {},
        });
        await expect(seed).toBeOK();
        const seedPayload = (await seed.json()) as { projectId: string };
        expect(seedPayload.projectId).toBeTruthy();

        const chain = await request.post("/api/projects/governed-demo-chain", {
          headers: ownerHeaders,
          data: { projectId: seedPayload.projectId },
        });
        await expect(chain).toBeOK();
        const chainPayload = (await chain.json()) as {
          previewId: string;
          snapshotId: string;
          requestId: string;
          status: string;
          routeArtifactMap: Record<string, string[]>;
        };
        expect(chainPayload.status).toBe("draft");
        expect(chainPayload.routeArtifactMap["/api/projects/governed-demo-chain"]).toEqual([
          "project_patch_previews",
          "project_patch_snapshots",
          "project_patch_snapshot_files",
          "project_writeback_requests",
        ]);

        const submitted = await request.post("/api/projects/writeback-review", {
          headers: ownerHeaders,
          data: { requestId: chainPayload.requestId, action: "submit" },
        });
        await expect(submitted).toBeOK();
        await expect(submitted.json()).resolves.toMatchObject({ status: "submitted" });

        const ownerApproval = await request.post("/api/projects/writeback-review", {
          headers: ownerHeaders,
          data: {
            requestId: chainPayload.requestId,
            action: "approve",
            reviewerNote: "Owner approval for persisted governed E2E.",
          },
        });
        await expect(ownerApproval).toBeOK();

        const adminApproval = await request.post("/api/projects/writeback-review", {
          headers: adminHeaders,
          data: {
            requestId: chainPayload.requestId,
            action: "approve",
            reviewerNote: "Admin approval for persisted governed E2E.",
          },
        });
        await expect(adminApproval).toBeOK();
        await expect(adminApproval.json()).resolves.toMatchObject({ status: "approved" });

        const executed = await request.post("/api/projects/writeback-execute", {
          headers: ownerHeaders,
          data: { requestId: chainPayload.requestId },
        });
        await expect(executed).toBeOK();
        const executePayload = (await executed.json()) as {
          workingCopyId: string;
          alreadyExists: boolean;
          workingCopy: { metadata: Record<string, unknown> };
        };
        expect(executePayload.workingCopyId).toBeTruthy();
        expect(executePayload.workingCopy.metadata).toMatchObject({
          originalProjectFilesModified: false,
          originalTextPreviewsModified: false,
          objectStorageModified: false,
        });

        const exported = await request.get(
          `/api/projects/working-copy-export?workingCopyId=${executePayload.workingCopyId}`,
          { headers: ownerHeaders },
        );
        await expect(exported).toBeOK();
        const exportPayload = await exported.json();
        expect(exportPayload.manifest).toMatchObject({
          originalProjectFilesModified: false,
          sourceZipOverwritten: false,
          objectStorageModified: false,
          productionWritebackIncluded: false,
          exportLimitedToWorkingCopyText: true,
        });
      } finally {
        await ownerContext.close();
        await adminContext.close();
      }
    });
  }
});
