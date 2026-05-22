# Nexus Core Release Notes

This document summarizes the current production-ready release state. It must not contain secrets, tokens, cookies, JWTs, API keys, refresh tokens, service-role keys, or private environment values.

## Release Ready - 2026-05-21

Production URL: https://nexus-core-ai-os.lovable.app

Release tags:

- `production-baseline-2026-05-21`
- `release-ready-2026-05-21`

Official deployment target:

- Lovable.
- Vercel is not the official production target for this phase.

Verified production capabilities:

- Public routes load: `/`, `/login`, `/signup`.
- Authenticated workspace loads: `/app`, `/app/settings`, and existing `/app/$threadId`.
- Admin account `allidamech@gmail.com` can access `/app/admin`.
- True non-admin account is denied admin access and sees no admin dashboard, checklist, metrics, or admin nav.
- Logout clears private/admin UI and redirects `/app/admin` to `/login`.
- Authenticated chat returns a safe production response.
- Arabic/RTL preference persists after refresh.
- Production serves split bundles, including vendor chunks for React, Supabase, AI, icons, and route-level app chunks.
- `x-correlation-id` is visible on authenticated `/api/chat` `200` responses.
- `x-correlation-id` is visible on unauthenticated `/api/chat` and `/api/projects/process-zip` `401` responses.
- Browser smoke checks found no runtime errors, hydration errors, chunk load errors, or visible secrets.

Known warnings and non-blockers:

- Fast refresh lint warnings remain in shared UI component modules.
- Node `punycode` deprecation warning remains a dependency/tooling warning during build.
- Credentialed E2E tests skip unless protected credentials and optional chat/upload prerequisites are configured.
- Full production ZIP upload E2E requires a safe quota/test account and must avoid destructive or large data.

Operator release checklist:

- Confirm GitHub CI is green.
- Confirm Lovable production serves the latest expected asset generation with cache disabled.
- Confirm stale asset hashes are no longer active after publish.
- Run the manual Lovable smoke in `docs/QA_RUNBOOK.md`.
- Inspect only safe response metadata such as status and `x-correlation-id`.
- Never print or copy cookies, auth headers, JWTs, API keys, Supabase sessions, request bodies, prompts, or uploaded source content.

Recommended next product milestone:

- Phase 26 should move from release readiness into the next product milestone planning pass. Recommended focus: scoped product roadmap confirmation for the next approved capability, while keeping real code execution, sandboxing, GitHub import, billing, organizations, embeddings, and autonomous actions out of scope until explicitly authorized.
