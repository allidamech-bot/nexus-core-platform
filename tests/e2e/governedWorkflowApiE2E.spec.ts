import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Database } from "../../src/integrations/supabase/types";

type AdminClient = SupabaseClient<Database>;

const requiredApiEnv = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  adminEmail: process.env.E2E_ADMIN_EMAIL,
  adminPassword: process.env.E2E_ADMIN_PASSWORD,
  nonAdminEmail: process.env.E2E_NON_ADMIN_EMAIL,
  nonAdminPassword: process.env.E2E_NON_ADMIN_PASSWORD,
};

const missingApiEnv = Object.entries(requiredApiEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);
const canRunPersistedApiFlow = missingApiEnv.length === 0;

const originalPreviewText = "export const label = 'old governed value';\n";
const patchedPreviewText = "export const label = 'new governed value';\n";
const originalChecksum = "h1-1-original-checksum";

interface SeededWorkflow {
  runId: string;
  adminToken: string;
  nonAdminToken: string;
  adminUserId: string;
  nonAdminUserId: string;
  projectId: string;
  fileId: string;
  previewId: string;
  seededPatchPreviewId: string;
  snapshotId: string;
  reviewRequestId: string;
  executableRequestId: string;
}

function jsonHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function expectJsonStatus(
  responsePromise: Promise<ReturnType<APIRequestContext["post"]>>,
  status: number,
) {
  const response = await responsePromise;
  expect(response.status()).toBe(status);
  return response;
}

function createAdminClient() {
  if (
    !requiredApiEnv.supabaseUrl ||
    !requiredApiEnv.supabaseServiceRoleKey ||
    !requiredApiEnv.supabasePublishableKey
  ) {
    throw new Error(`Missing API E2E env: ${missingApiEnv.join(", ")}`);
  }

  return createClient<Database>(requiredApiEnv.supabaseUrl, requiredApiEnv.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function signIn(email: string, password: string) {
  if (!requiredApiEnv.supabaseUrl || !requiredApiEnv.supabasePublishableKey) {
    throw new Error("Supabase public env is required.");
  }

  const client = createClient<Database>(
    requiredApiEnv.supabaseUrl,
    requiredApiEnv.supabasePublishableKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token || !data.user?.id) {
    throw new Error(error?.message ?? `Unable to sign in ${email}`);
  }
  return { token: data.session.access_token, userId: data.user.id };
}

async function insertOrThrow<T>(query: PromiseLike<{ data: T; error: unknown }>) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function cleanupSeed(admin: AdminClient, seed?: Partial<SeededWorkflow>) {
  if (!seed?.runId) return;

  await admin
    .from("project_working_copy_files")
    .delete()
    .eq("project_id", seed.projectId ?? "");
  await admin
    .from("project_working_copies")
    .delete()
    .eq("project_id", seed.projectId ?? "");
  await admin
    .from("writeback_approvals" as never)
    .delete()
    .in("request_id", [seed.reviewRequestId, seed.executableRequestId].filter(Boolean) as string[]);
  await admin
    .from("project_writeback_requests")
    .delete()
    .eq("project_id", seed.projectId ?? "");
  await admin
    .from("project_patch_snapshot_files")
    .delete()
    .eq("project_id", seed.projectId ?? "");
  await admin
    .from("project_patch_snapshots")
    .delete()
    .eq("project_id", seed.projectId ?? "");
  await admin
    .from("project_patch_previews")
    .delete()
    .eq("project_id", seed.projectId ?? "");
  await admin
    .from("project_text_previews")
    .delete()
    .eq("project_id", seed.projectId ?? "");
  await admin
    .from("project_files")
    .delete()
    .eq("project_id", seed.projectId ?? "");
  await admin
    .from("project_ingestion_jobs")
    .delete()
    .eq("project_id", seed.projectId ?? "");
  await admin
    .from("usage_events")
    .delete()
    .eq("project_id", seed.projectId ?? "");
  await admin
    .from("audit_events")
    .delete()
    .eq("project_id", seed.projectId ?? "");
  await admin
    .from("projects")
    .delete()
    .eq("id", seed.projectId ?? "");
}

async function seedPersistedWorkflow(admin: AdminClient): Promise<SeededWorkflow> {
  const runId = crypto.randomUUID();
  const adminSession = await signIn(requiredApiEnv.adminEmail!, requiredApiEnv.adminPassword!);
  const nonAdminSession = await signIn(
    requiredApiEnv.nonAdminEmail!,
    requiredApiEnv.nonAdminPassword!,
  );

  const projectId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  const previewId = crypto.randomUUID();
  const seededPatchPreviewId = crypto.randomUUID();
  const snapshotId = crypto.randomUUID();
  const reviewRequestId = crypto.randomUUID();
  const executableRequestId = crypto.randomUUID();

  await insertOrThrow(
    admin.from("projects").insert({
      id: projectId,
      user_id: adminSession.userId,
      name: `H.1.1 governed API ${runId}`,
      description: "API-backed governed workflow E2E fixture",
      source_type: "upload",
      status: "indexed_manifest",
    } as never),
  );
  await insertOrThrow(
    admin.from("project_ingestion_jobs").insert({
      id: jobId,
      project_id: projectId,
      user_id: adminSession.userId,
      status: "completed",
      stage: "completed",
      metadata: { h1_1_run_id: runId },
    }),
  );
  await insertOrThrow(
    admin.from("project_files").insert({
      id: fileId,
      project_id: projectId,
      user_id: adminSession.userId,
      ingestion_job_id: jobId,
      path: "src/governed.ts",
      name: "governed.ts",
      extension: "ts",
      mime_type: "text/typescript",
      size_bytes: originalPreviewText.length,
      checksum: originalChecksum,
      content_sha256: originalChecksum,
      is_text: true,
      is_previewable: true,
      skipped: false,
      indexed_at: new Date().toISOString(),
    }),
  );
  await insertOrThrow(
    admin.from("project_text_previews").insert({
      id: previewId,
      project_id: projectId,
      file_id: fileId,
      user_id: adminSession.userId,
      preview_text: originalPreviewText,
      summary: "H.1.1 safe preview fixture",
      detected_language: "typescript",
      line_count: 1,
      token_estimate: 12,
      truncated: false,
      metadata: { h1_1_run_id: runId, safe_preview: true },
    }),
  );
  await insertOrThrow(
    admin.from("project_patch_previews").insert({
      id: seededPatchPreviewId,
      project_id: projectId,
      ingestion_job_id: jobId,
      created_by: nonAdminSession.userId,
      title: "H.1.1 seeded patch preview",
      status: "ready",
      source: "api_e2e_seed",
      summary: "Reviewable handoff patch preview",
      grounded_files: [
        {
          fileId,
          path: "src/governed.ts",
          contentSha256: originalChecksum,
          sourcePreviewAvailable: true,
        },
      ],
      diff: [
        {
          filePath: "src/governed.ts",
          changeType: "modify",
          oldText: "old governed value",
          newText: "new governed value",
          warnings: [{ code: "api_e2e", message: "Seeded review-only patch." }],
        },
      ],
      warnings: [],
      metadata: {
        h1_1_run_id: runId,
        applied: false,
        source_writeback_performed: false,
      },
    }),
  );
  await insertOrThrow(
    admin.from("project_patch_snapshots").insert({
      id: snapshotId,
      project_id: projectId,
      patch_preview_id: seededPatchPreviewId,
      created_by: nonAdminSession.userId,
      status: "created",
      title: "H.1.1 patch snapshot",
      summary: "Snapshot derived from preview only",
      source: "patch_preview_sandbox",
      verification_status: "verified",
      changed_files_count: 1,
      warnings: [],
      blockers: [],
      metadata: {
        h1_1_run_id: runId,
        derived_snapshot_only: true,
        source_writeback: false,
        original_project_files_modified: false,
        original_text_previews_modified: false,
      },
    }),
  );
  await insertOrThrow(
    admin.from("project_patch_snapshot_files").insert({
      project_id: projectId,
      snapshot_id: snapshotId,
      patch_preview_id: seededPatchPreviewId,
      file_path: "src/governed.ts",
      original_content_sha256: originalChecksum,
      patched_content_sha256: "h1-1-patched-checksum",
      original_preview_text: originalPreviewText,
      patched_preview_text: patchedPreviewText,
      changed: true,
      preview_limited: true,
      truncated: false,
      warnings: [],
      blockers: [],
    }),
  );
  await insertOrThrow(
    admin.from("project_writeback_requests").insert([
      {
        id: reviewRequestId,
        project_id: projectId,
        patch_preview_id: seededPatchPreviewId,
        snapshot_id: snapshotId,
        requested_by: nonAdminSession.userId,
        status: "submitted",
        title: "H.1.1 submitted review request",
        requester_note: "Review only; do not apply directly.",
        risk_level: "medium",
        changed_files_count: 1,
        required_approvals: 2,
        current_approvals: 0,
        warnings: [],
        blockers: [],
        snapshot_summary: {
          h1_1_run_id: runId,
          source_writeback: false,
          original_project_files_modified: false,
        },
        metadata: {
          h1_1_run_id: runId,
          governance_request_only: true,
          source_writeback_performed: false,
          original_project_files_modified: false,
          original_text_previews_modified: false,
        },
        review_metadata: {},
        submitted_at: new Date().toISOString(),
      },
      {
        id: executableRequestId,
        project_id: projectId,
        patch_preview_id: seededPatchPreviewId,
        snapshot_id: snapshotId,
        requested_by: nonAdminSession.userId,
        reviewed_by: adminSession.userId,
        status: "approved",
        title: "H.1.1 approved executable request",
        requester_note: "Approved request fixture for working-copy creation.",
        reviewer_note: "Approved for working-copy export only.",
        review_decision: "approved",
        risk_level: "medium",
        changed_files_count: 1,
        required_approvals: 1,
        current_approvals: 1,
        warnings: [],
        blockers: [],
        snapshot_summary: {
          h1_1_run_id: runId,
          source_writeback: false,
          original_project_files_modified: false,
        },
        metadata: {
          h1_1_run_id: runId,
          governance_request_only: true,
          source_writeback_performed: false,
          original_project_files_modified: false,
          original_text_previews_modified: false,
        },
        review_metadata: {},
        submitted_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
      },
    ] as never),
  );

  return {
    runId,
    adminToken: adminSession.token,
    nonAdminToken: nonAdminSession.token,
    adminUserId: adminSession.userId,
    nonAdminUserId: nonAdminSession.userId,
    projectId,
    fileId,
    previewId,
    seededPatchPreviewId,
    snapshotId,
    reviewRequestId,
    executableRequestId,
  };
}

async function loadCanonicalSource(admin: AdminClient, seed: SeededWorkflow) {
  const { data: file, error: fileError } = await admin
    .from("project_files")
    .select("id,checksum,content_sha256,size_bytes,path")
    .eq("id", seed.fileId)
    .single();
  if (fileError) throw fileError;

  const { data: preview, error: previewError } = await admin
    .from("project_text_previews")
    .select("id,preview_text,summary,metadata")
    .eq("id", seed.previewId)
    .single();
  if (previewError) throw previewError;

  const { data: project, error: projectError } = await admin
    .from("projects")
    .select("id,source_type,status,github_installation_id,github_repo_full_name")
    .eq("id", seed.projectId)
    .single();
  if (projectError) throw projectError;

  return { file, preview, project };
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

  if (!canRunPersistedApiFlow) {
    test("BLOCKED_API_PERSISTENCE_ENV_REQUIRED: persisted governed route chain needs Supabase service role and two test users", async () => {
      test.skip(true, `BLOCKED_API_PERSISTENCE_ENV_REQUIRED: missing ${missingApiEnv.join(", ")}`);
    });
  } else {
    test("persists the governed API handoff without mutating canonical source", async ({
      request,
    }) => {
      test.setTimeout(120_000);
      const admin = createAdminClient();
      let seed: SeededWorkflow | undefined;

      try {
        seed = await seedPersistedWorkflow(admin);
        const before = await loadCanonicalSource(admin, seed);

        const rejectedPreview = await request.post("/api/projects/ai-patch-preview", {
          headers: jsonHeaders(seed.adminToken),
          data: {
            projectId: seed.projectId,
            fileIds: [],
            title: "H.1.1 rejected API preview",
            instruction: "No direct source writeback.",
          },
        });
        expect(rejectedPreview.status()).toBe(422);
        const rejectedPreviewPayload = (await rejectedPreview.json()) as {
          previewId?: string;
          status?: string;
        };
        expect(rejectedPreviewPayload.previewId).toBeTruthy();
        expect(rejectedPreviewPayload.status).toBe("rejected");

        const nonReviewerApproval = await request.post("/api/projects/writeback-review", {
          headers: jsonHeaders(seed.nonAdminToken),
          data: {
            requestId: seed.reviewRequestId,
            action: "approve",
            note: "Requester must not self-approve this admin-owned request.",
          },
        });
        expect(nonReviewerApproval.status()).toBe(403);

        const adminApproval = await request.post("/api/projects/writeback-review", {
          headers: jsonHeaders(seed.adminToken),
          data: {
            requestId: seed.reviewRequestId,
            action: "approve",
            note: "Approved as review evidence only.",
          },
        });
        expect(adminApproval.ok(), await adminApproval.text()).toBe(true);
        const adminApprovalPayload = (await adminApproval.json()) as {
          status?: string;
          requestId?: string;
        };
        expect(adminApprovalPayload.requestId).toBe(seed.reviewRequestId);
        expect(["submitted", "pending_quorum", "approved"]).toContain(adminApprovalPayload.status);

        const unauthorizedExecute = await request.post("/api/projects/writeback-execute", {
          headers: jsonHeaders(seed.nonAdminToken),
          data: { requestId: seed.executableRequestId },
        });
        expect(unauthorizedExecute.status()).toBe(403);

        const execute = await request.post("/api/projects/writeback-execute", {
          headers: jsonHeaders(seed.adminToken),
          data: { requestId: seed.executableRequestId },
        });
        expect(execute.ok(), await execute.text()).toBe(true);
        const executePayload = (await execute.json()) as {
          workingCopyId?: string;
          status?: string;
          githubPrUrl?: string;
          workingCopy?: { metadata?: Record<string, unknown> };
        };
        expect(executePayload.workingCopyId).toBeTruthy();
        expect(executePayload.status).toBe("created");
        expect(executePayload.githubPrUrl).toBeUndefined();
        expect(executePayload.workingCopy?.metadata).toMatchObject({
          originalProjectFilesModified: false,
          originalTextPreviewsModified: false,
          objectStorageModified: false,
          sourceZipOverwritten: false,
          codeExecuted: false,
          deploymentPerformed: false,
        });

        const exportResponse = await request.get(
          `/api/projects/working-copy-export?workingCopyId=${executePayload.workingCopyId}`,
          { headers: jsonHeaders(seed.adminToken) },
        );
        expect(exportResponse.ok(), await exportResponse.text()).toBe(true);
        const exportBundle = (await exportResponse.json()) as {
          manifest?: Record<string, unknown>;
          files?: Array<Record<string, unknown>>;
          readme?: string;
        };
        expect(exportBundle.manifest).toMatchObject({
          originalProjectFilesModified: false,
          originalTextPreviewsModified: false,
          sourceZipOverwritten: false,
          objectStorageModified: false,
          productionWritebackIncluded: false,
        });
        expect(exportBundle.files?.[0]).toMatchObject({
          path: "src/governed.ts",
          changed: true,
        });
        expect(exportBundle.readme).toContain("Production/source writeback is not available yet");

        const after = await loadCanonicalSource(admin, seed);
        expect(after.file).toEqual(before.file);
        expect(after.preview).toEqual(before.preview);
        expect(after.project).toEqual(before.project);

        const [{ count: patchPreviewCount }, { count: snapshotCount }, { count: requestCount }] =
          await Promise.all([
            admin
              .from("project_patch_previews")
              .select("id", { count: "exact", head: true })
              .eq("project_id", seed.projectId),
            admin
              .from("project_patch_snapshots")
              .select("id", { count: "exact", head: true })
              .eq("project_id", seed.projectId),
            admin
              .from("project_writeback_requests")
              .select("id", { count: "exact", head: true })
              .eq("project_id", seed.projectId),
          ]);
        expect(patchPreviewCount).toBeGreaterThanOrEqual(2);
        expect(snapshotCount).toBe(1);
        expect(requestCount).toBe(2);

        const { count: approvalCount } = await admin
          .from("writeback_approvals" as never)
          .select("id", { count: "exact", head: true })
          .eq("request_id", seed.reviewRequestId);
        expect(approvalCount).toBeGreaterThanOrEqual(1);

        const { count: workingCopyCount } = await admin
          .from("project_working_copies")
          .select("id", { count: "exact", head: true })
          .eq("request_id", seed.executableRequestId);
        expect(workingCopyCount).toBe(1);

        const { count: workingCopyFileCount } = await admin
          .from("project_working_copy_files")
          .select("id", { count: "exact", head: true })
          .eq("project_id", seed.projectId);
        expect(workingCopyFileCount).toBe(1);

        const { count: auditCount } = await admin
          .from("audit_events")
          .select("id", { count: "exact", head: true })
          .eq("project_id", seed.projectId)
          .in("event_type", ["writeback_request_approved", "writeback_working_copy_created"]);
        expect(auditCount).toBeGreaterThanOrEqual(2);

        const { data: workingCopy } = await admin
          .from("project_working_copies")
          .select("metadata")
          .eq("request_id", seed.executableRequestId)
          .single();
        expect(workingCopy?.metadata).toMatchObject({
          originalProjectFilesModified: false,
          originalTextPreviewsModified: false,
          objectStorageModified: false,
          sourceZipOverwritten: false,
        });
      } finally {
        await cleanupSeed(admin, seed);
      }
    });
  }
});
