# Nexus Safe Pipeline Smoke Checklist

## 1. Purpose

This document provides a comprehensive smoke test checklist for the Nexus Core Platform's governed writeback pipeline. It outlines the exact sequence of actions, expected diagnostic states, and safety invariants to ensure that the AI workspace can safely propose, verify, review, and export code changes without mutating original source files or object storage.

Current governed working-copy export smoke: **PASS**. The latest confirmed export downloaded `nexus-core-working-copy-034df544.json` after writeback review, versioned working copy creation, and working copy export all reached **Complete**.

## 2. Current Safe Pipeline Stages

The safe pipeline consists of the following sequential stages:

1. ZIP upload
2. ZIP processing
3. Safe preview
4. Grounded patch preview
5. Sandbox verification
6. Patch snapshot
7. Snapshot export
8. Writeback request
9. Submit review
10. Approve/reject review
11. Versioned working copy
12. Working copy export

## 3. Exact Expected Diagnostics State After Each Stage

| Stage                          | Action                                | Expected Diagnostics State                                                              |
| :----------------------------- | :------------------------------------ | :-------------------------------------------------------------------------------------- |
| **1. ZIP upload**              | Upload source code ZIP                | Context Staged / Processing                                                             |
| **2. ZIP processing**          | Automatic server ingestion            | Context Staged / Processing                                                             |
| **3. Safe preview**            | Index source into DB                  | Context Ready                                                                           |
| **4. Grounded patch preview**  | `Generate grounded patch preview`     | Patch preview: Complete <br> Sandbox verification: Blocked                              |
| **5. Sandbox verification**    | `Run sandbox verification`            | Sandbox verification: Complete <br> Patch snapshot: Ready to continue                   |
| **6. Patch snapshot**          | `Create patch snapshot`               | Patch snapshot: Complete <br> Snapshot export: Complete/Ready                           |
| **7. Snapshot export**         | Internal automated process            | Snapshot export: Complete <br> Writeback request: Ready to continue                     |
| **8. Writeback request**       | `Request source writeback review`     | Writeback request: Complete <br> Writeback review: Request is draft                     |
| **9. Submit review**           | `Submit writeback request for review` | Writeback review: Ready to continue <br> Versioned working copy: Blocked until approval |
| **10. Approve review**         | `Approve writeback request`           | Writeback review: Complete <br> Versioned working copy: Ready to continue               |
| **10. Reject review**          | `Reject writeback request`            | Writeback review: Rejected/Complete <br> Versioned working copy: Blocked                |
| **11. Versioned working copy** | `Create versioned working copy`       | Versioned working copy: Complete <br> Working copy export: Ready to continue            |
| **12. Working copy export**    | `Download working copy export`        | Working copy export: Complete                                                           |

## 4. Manual Live Smoke Test Steps

1. Navigate to the **Agent Workspace**.
2. Select a project or upload a new one via the **Upload Project** dialog.
3. Ensure the project ingests successfully and the status is "Context Ready".
4. Scroll to the **Pipeline actions** section.
5. Click **Generate grounded patch preview** and wait for completion.
6. Click **Run sandbox verification** and wait for completion.
7. Click **Create patch snapshot** and wait for completion.
8. Click **Request source writeback review** and wait for the draft request to be created.
9. Click **Submit writeback request for review**.
10. Verify the state changes and click **Approve writeback request**.
11. Click **Create versioned working copy**.
12. Click **Download working copy export**. Verify that the downloaded JSON file contains the expected files and metadata.

## 5. Supabase Tables Involved

- `public.projects`
- `public.project_safe_previews`
- `public.project_patch_previews`
- `public.project_patch_snapshots`
- `public.project_patch_snapshot_files`
- `public.project_writeback_requests`
- `public.project_working_copies`
- `public.project_working_copy_files`

## 6. Safety Invariants

- **Original Project Files Unchanged:** No physical `.ts`, `.tsx`, `.js`, or other source files are modified during any of these stages.
- **Object Storage Unchanged:** Supabase Storage (e.g., source ZIP buckets) are not overwritten or modified by patch operations.
- **Source ZIP Unchanged:** The originally uploaded ZIP remains pristine and immutable.
- **Direct Source Writeback Disabled:** Direct source writeback is intentionally disabled. Use working copy export as the safe review handoff.
- **No GitHub Writeback:** Changes are isolated within governed database tables and are not pushed to any Git remote.

## 7. Known Limitations

- AI provider configuration may still display a warning if credentials are not fully set.
- Production release gates remain blocked until `docs/production-credentialed-smoke-checklist.md` is run with trusted `NEXUS_SMOKE_*` credentials.
- Direct source writeback is intentionally disabled. Use working copy export as the safe review handoff.
- AI provider configuration is required for AI patch preview smoke.
- Credentialed smoke is required for admin/reviewer and authenticated upload/export validation.

## 8. Rollback Notes

If a pipeline stage fails or needs to be restarted, the user must currently create a new grounded patch preview or upload a fresh project context, as in-place resets are not fully implemented.

## 9. Future Phase

The next major capability phase will introduce optional GitHub PR writeback _only after_ a writeback request has been formally approved and a versioned working copy is validated.
