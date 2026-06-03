# Phase 94 Production Readiness

This checklist is for deployment readiness and smoke validation only. It does not authorize source ZIP overwrite, object storage writeback, deployment/apply automation, or code execution.

## Required Environment Variables

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `LOVABLE_API_KEY` for successful chat and AI patch preview smoke

Do not commit or print secrets, tokens, cookies, JWTs, service-role keys, auth headers, or private environment values.

## Optional Environment Variables

- `VITE_SUPABASE_PROJECT_ID` for client-side project metadata when Lovable wiring provides it
- `E2E_BASE_URL` for running Playwright against a deployed URL
- `E2E_BROWSER_CHANNEL` when a specific browser channel is required
- `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` for trusted admin smoke
- `E2E_NON_ADMIN_EMAIL` and `E2E_NON_ADMIN_PASSWORD` for trusted non-admin smoke
- `NEXUS_SMOKE_BASE_URL` for production credentialed smoke
- `NEXUS_SMOKE_ADMIN_EMAIL` and `NEXUS_SMOKE_ADMIN_PASSWORD` for production admin smoke
- `NEXUS_SMOKE_USER_EMAIL` and `NEXUS_SMOKE_USER_PASSWORD` for production non-admin smoke

## Supabase Migration Checklist

- Confirm migrations through `20260525200000_versioned_working_copies.sql` are applied.
- Confirm storage bucket `project-uploads` exists and remains private.
- Confirm RLS policies remain enabled for project, preview, snapshot, request, and working-copy tables.
- Confirm `is_admin`, usage quota RPCs, audit tables, and plan limit tables exist.
- Do not manually mutate production project, file, preview, request, snapshot, or working-copy rows during smoke.

## Lovable Deployment Checklist

- Confirm Lovable is publishing commit `b09ec61` or newer plus the folder import quota RLS blocker fix.
- Confirm Phase 96D project-context hydration behavior: the thread header, inspector, safe preview, diagnostics, and patch preview agree on the attached project.
- Confirm required environment variables are configured in Lovable without exposing values in logs.
- Confirm `/`, `/login`, `/signup`, `/app`, `/app/admin`, and project API routes return expected authenticated or unauthenticated boundaries.
- Confirm production URL: `https://nexus-core-ai-os.lovable.app`.

## AI Gateway Readiness

- Confirm `LOVABLE_API_KEY` is present in the production runtime.
- Run a credentialed chat smoke or AI patch preview smoke from a trusted account.
- If `LOVABLE_API_KEY` is absent, the app should show a setup boundary rather than a stack trace.

## Upload Quota Smoke

- Use a trusted QA account with available project and upload quota.
- Confirm over-quota upload attempts fail safely.
- Confirm successful ZIP uploads are counted only after real storage-backed processing.
- Confirm the monthly successful ZIP quota is not freed by archiving projects.
- If the existing admin account is over quota, use a fresh QA account or wait for the next monthly window.

## ZIP Upload Smoke

- Upload a small ZIP containing allowlisted text files.
- Confirm unsafe paths are rejected.
- Confirm safe file tree and `project_text_previews` are created.
- Confirm uploaded code is not executed.

## AI Patch Preview Smoke

- Select previewable files only.
- Generate an AI patch preview with a small instruction.
- Confirm output is grounded in selected safe text, bounded, and preview-only.
- Confirm no package scripts or generated code are run.

## Admin Review Smoke

- Submit a writeback request from a requester account.
- Review it from an admin account.
- Confirm blockers prevent approval.
- Confirm approval says it is for future writeback consideration only.

## Export Smoke

- Download a patch snapshot export.
- Create a versioned working copy from an approved request.
- Download a working-copy export.
- Confirm exported JSON includes README, manifest, metadata, sanitized paths, and bounded text only.
- Confirm exports are JSON bundles, not ZIP archives.

## Credentialed Tests

Local e2e runs skip credentialed tests unless trusted E2E credentials are configured. For production smoke, run the credentialed suite only from a private trusted environment with protected secrets and no public logs.

Run:

```bash
pnpm smoke:production:credentialed
```

If `NEXUS_SMOKE_*` credentials are absent, report **BLOCKED_CREDENTIALS_REQUIRED**. Do not report missing credentials as PASS.

The production credentialed gate must confirm public app load, admin login, non-admin login, Admin Control visibility for admin only, non-admin denial from `/app/admin`, project-owner access, cross-user access blocking, safe working-copy export download, unchanged source project files, unchanged object storage, and intentionally disabled direct source writeback.

## Intentionally Unavailable

- Source ZIP overwrite
- Object storage writeback
- Deployment/apply automation
- Uploaded/generated code execution
- Dependency installation
- Package script execution

## Current RC-1 Decision

RC-1 is **ACCEPT_WITH_LIMITATIONS**. The remaining production first-use blocker is quota availability for real ZIP upload smoke on the current admin account; full pipeline smoke requires a fresh QA account or monthly quota availability.
