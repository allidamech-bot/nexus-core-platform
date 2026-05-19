# Nexus Core Production Readiness

This document captures the current production-ready baseline for Nexus Core Platform. It must not contain secrets, tokens, cookies, JWTs, API keys, refresh tokens, or service-role keys.

Nexus Core is still pre-execution. Production readiness covers authentication, routing, governance, project ingestion boundaries, admin visibility, and structured AI planning. It does not include real code execution, sandboxing, GitHub import, Stripe billing, organizations, embeddings, or autonomous agent actions.

## Deployment Baseline

- Official deployment target: Lovable.
- Production URL: https://nexus-core-ai-os.lovable.app
- GitHub CI must be green before release.
- Vercel is not the official deployment target for this phase.
- Ignore Vercel-specific deployment failures unless they reveal a real app bug.
- Lovable-generated Supabase environment wiring must remain intact.
- Supabase migrations must not be changed during release QA unless a critical mismatch is confirmed and reported first.

## Phase 9 Production QA Result

Phase 9 Lovable production QA passed against https://nexus-core-ai-os.lovable.app.

Verified public routes:

- `/`
- `/login`
- `/signup`

Verified protected/authenticated routes:

- `/app`
- `/app/settings`
- `/app/admin`
- `/app/$threadId`

Verified auth and session behavior:

- Login worked for admin account `allidamech@gmail.com`.
- Session restored after refresh and page reopen.
- Logout redirected protected access back to `/login`.
- Private workspace and admin UI were cleared after logout.
- Unauthenticated protected routes redirected to `/login`.

Verified admin and governance behavior:

- `allidamech@gmail.com` could access `/app/admin`.
- Admin dashboard rendered after admin validation completed.
- Admin dashboard did not expose private/admin UI after logout.
- Supabase table/RPC checklist showed required items as Ready, including admin, project, usage, audit, and plan/limit RPC boundaries.
- RLS/admin checks behaved correctly from the verified UI and route boundaries.

Verified localization:

- Arabic switch updated `html lang="ar"` and `dir="rtl"`.
- Arabic/RTL preference persisted after refresh and page reopen.
- English could be restored.

Verified API boundaries:

- Unauthenticated `/api/chat` returned `401 Unauthorized`.
- Unauthenticated `/api/projects/process-zip` returned `401 Unauthorized`.
- Authenticated chat smoke reached the expected production AI boundary and returned a safe response.

Verified browser safety:

- No browser console errors were observed during the tested public, protected, admin, chat, upload-dialog, RTL, and logout flows.
- No visible secrets appeared in browser UI or console checks.
- No tokens, cookies, JWTs, API keys, or private environment values were printed during QA.

Verified upload boundary:

- Upload dialog opened without console errors.
- No production ZIP upload was performed during Phase 9 because production quota was already constrained and destructive or large-data tests are out of scope.

## Lovable Production Smoke Checklist

Run this checklist before marking a Lovable release ready:

- Confirm GitHub CI is green on the release branch or commit.
- Confirm the production URL loads: https://nexus-core-ai-os.lovable.app
- Confirm `/`, `/login`, and `/signup` render without console errors.
- Confirm unauthenticated `/app`, `/app/settings`, `/app/admin`, and `/app/$threadId` redirect to `/login`.
- Log in with the trusted admin account.
- Confirm `/app` renders private workspace UI only after login.
- Refresh `/app` and confirm the session restores.
- Confirm `/app/settings` renders account and usage information.
- Confirm `/app/admin` renders for `allidamech@gmail.com`.
- Confirm the admin migration checklist shows required tables/RPCs as Ready.
- Confirm the admin dashboard does not render privileged data before validation completes.
- Open an existing `/app/$threadId` and confirm the chat UI renders.
- Send one safe chat smoke prompt only when production quota permits.
- Confirm unauthenticated `/api/chat` returns `401`.
- Confirm unauthenticated `/api/projects/process-zip` returns `401`.
- Open the upload dialog only; do not upload large or destructive fixtures.
- Switch to Arabic and confirm `lang="ar"` and `dir="rtl"`.
- Refresh and confirm Arabic/RTL persists.
- Restore English when useful for handoff.
- Log out.
- Visit `/app/admin` after logout and confirm it redirects to `/login` without private/admin UI.
- Check browser console for errors and visible secret leaks.

## Remaining QA Gaps

- Non-admin admin-denial QA still needs a dedicated non-admin production test account.
- Full ZIP upload E2E needs a safe quota/test account or plan that can tolerate repeated tiny fixture uploads.
- Production upload tests must avoid destructive data, large ZIPs, and quota-consuming loops.
- The Vite bundle-size warning remains a performance follow-up.
- The Node `punycode` warning remains a dependency/tooling warning.
- Credentialed production E2E should run only in a trusted environment with protected credentials and no public logs.

## Release Checklist

Before release:

- Verify the active repository is `D:\nexus-core-platform-main`.
- Confirm no work depends on `C:\Users\alida\dev\nexus-core`.
- Confirm GitHub CI is green.
- Confirm Lovable is the deployment target.
- Confirm Vercel-specific failures are ignored unless they expose real app bugs.
- Confirm no secrets are present in docs, logs, screenshots, traces, or committed files.
- Confirm no Supabase migrations or Lovable-generated environment wiring were changed for release documentation.
- Run the local verification gate:

```bash
pnpm run lint
pnpm exec tsc -p tsconfig.json --noEmit
pnpm build
pnpm test:e2e
```

After release:

- Run the Lovable production smoke checklist above.
- Record any production-only findings before starting new product scope.
- Keep real execution, sandboxing, GitHub import, billing, organizations, embeddings, and autonomous actions out of scope until explicitly approved in a later phase.
