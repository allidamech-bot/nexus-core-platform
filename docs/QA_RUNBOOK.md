# Nexus Core QA Runbook

This runbook defines the safe credentialed E2E QA process for Nexus Core Platform. It must never contain real passwords, tokens, cookies, JWTs, API keys, refresh tokens, or service-role keys.

Nexus Core remains pre-execution. These tests validate auth, routing, governance, upload boundaries, project-aware planning, and UI stability. They do not validate code execution, sandboxing, GitHub import, Stripe billing, organizations, embeddings, or autonomous code changes.

## Required QA Accounts

Admin account:

- `allidamech@gmail.com`
- Must have admin access through the database-backed admin role/allowlist model.
- Used for `/app/admin`, database health, audit, usage, and privileged dashboard visibility checks.

Non-admin test account:

- Must be created manually.
- Must not have an admin role or admin allowlist entry.
- Used to verify that `/app/admin` redirects or blocks access without exposing admin dashboard data.

High-quota upload test account or plan:

- Required for full ZIP ingestion E2E when Starter quota is exhausted.
- The current Starter plan can block upload tests with `1 used / 1 limit`.
- Use a Pro, Business, Enterprise, or dedicated QA plan when validating valid ZIP ingestion repeatedly.

Do not create accounts automatically from test code unless a future task explicitly approves a safe seed process.

## Environment Variables

Set these only in a local shell, CI secret store, or private environment file that is ignored by Git.

```bash
E2E_BASE_URL=http://127.0.0.1:8080
E2E_ADMIN_EMAIL=admin@example.com
E2E_ADMIN_PASSWORD=replace-with-secret
E2E_NON_ADMIN_EMAIL=user@example.com
E2E_NON_ADMIN_PASSWORD=replace-with-secret
E2E_BROWSER_CHANNEL=chrome
LOVABLE_API_KEY=replace-with-secret
```

Notes:

- `E2E_BASE_URL` is optional. If omitted, Playwright starts `pnpm dev -- --host 127.0.0.1`.
- `E2E_BROWSER_CHANNEL` is optional. On Windows the harness defaults to the installed Chrome channel. Set another channel only when needed.
- `LOVABLE_API_KEY` is required only for successful chat streaming QA. Without it, chat tests should assert the expected setup boundary.
- Never commit environment files containing real values.

Project Memory database/RLS probes must use a verified non-production Supabase target only. Before applying any Project Memory migration outside local app tests, follow [STAGING_SUPABASE_SETUP.md](D:/nexus-core-platform-main/docs/STAGING_SUPABASE_SETUP.md).

## Running E2E QA

Install dependencies:

```bash
pnpm install
```

Install Playwright-managed Chromium if you are not using an installed Chrome channel:

```bash
pnpm exec playwright install chromium
```

Run the default non-credentialed suite:

```bash
pnpm test:e2e
```

Run with Playwright UI:

```bash
pnpm test:e2e:ui
```

Run against an already-running local server:

```bash
E2E_BASE_URL=http://127.0.0.1:8080 pnpm test:e2e
```

Run credentialed tests from PowerShell:

```powershell
$env:E2E_ADMIN_EMAIL="admin@example.com"
$env:E2E_ADMIN_PASSWORD="replace-with-secret"
$env:E2E_NON_ADMIN_EMAIL="user@example.com"
$env:E2E_NON_ADMIN_PASSWORD="replace-with-secret"
$env:E2E_BASE_URL="http://127.0.0.1:8080"
$env:E2E_BROWSER_CHANNEL="chrome"
pnpm test:e2e
```

Expected skip behavior:

- Without admin credentials, admin, chat, upload, and logout credentialed tests skip.
- Without non-admin credentials, non-admin admin-denial tests skip.
- Without available project quota, ZIP upload fixture tests skip.
- Without `LOVABLE_API_KEY`, chat tests validate the friendly setup boundary instead of streaming.

## QA Checklist

Account and auth:

- Admin account can log in.
- Admin account can access `/app/admin`.
- Non-admin account cannot access `/app/admin`.
- Session restores after browser refresh.
- Logout redirects to login.
- Logout clears private user, project, and admin UI from the page.
- No stale admin data appears after logout/login cycle.

Routes:

- `/` loads.
- `/login` loads.
- `/signup` loads.
- `/app` redirects unauthenticated users to `/login`.
- `/app/settings` redirects unauthenticated users to `/login`.
- `/app/admin` redirects unauthenticated users to `/login`.
- `/app/$threadId` redirects unauthenticated users to `/login`.

API boundaries:

- Unauthenticated `/api/chat` returns `401`.
- Unauthenticated `/api/projects/process-zip` returns `401`.
- Authenticated `/api/chat` reaches the trusted auth/thread boundary.
- Missing `LOVABLE_API_KEY` produces a friendly setup error.
- Successful chat streaming works when `LOVABLE_API_KEY` exists.
- Chat usage events are recorded when governance tables/RPCs are available.

ZIP ingestion:

- `small-valid-project.zip` uploads successfully when quota allows.
- Valid upload creates/updates project and ingestion job state.
- Project file inventory renders after ingestion.
- Safe text preview availability is visible.
- `invalid-not-zip.txt` is rejected with a readable error.
- `suspicious-paths.zip` is rejected or fails safely when path traversal is detected.
- Quota exceeded states are readable and do not create misleading success states.

Governance and admin:

- Supabase table/RPC health checklist shows required items.
- Usage metering updates for chat, context, uploads, and failures where applicable.
- Audit/security events are queryable in admin.
- Admin dashboard does not render privileged data before admin validation completes.

Arabic and RTL:

- Switching to Arabic updates `html lang="ar"` and `dir="rtl"`.
- Arabic preference persists after refresh.
- `/app`, `/app/settings`, and `/app/admin` remain usable in RTL.
- English can be restored and returns `dir="ltr"`.

Browser and network safety:

- No secrets appear in browser console logs.
- No service-role key is exposed client-side.
- No JWT, refresh token, cookie, or API key is printed by tests.
- Network failures produce readable states instead of console floods.
- Production diagnostics use area-labeled, redacted logs only.
- Tests must not print full prompts, chat messages, uploaded file contents, raw previews, Authorization headers, cookies, or session values.

## Controlled Fixtures

The E2E harness generates fixtures at runtime in `.e2e-fixtures/`:

- `small-valid-project.zip`
- `invalid-not-zip.txt`
- `suspicious-paths.zip`

The fixture directory is ignored by Git and should not be committed.

## Known Blockers

- Manual production non-admin admin-denial QA passed with a dedicated non-admin account. Automated credentialed non-admin E2E still skips unless protected credentials are configured.
- No local `LOVABLE_API_KEY` is configured yet.
- Starter quota may block ZIP upload validation.
- Credentialed tests intentionally skip when E2E environment variables are missing.
- Playwright-managed Chromium may need `pnpm exec playwright install chromium`; on Windows, the harness defaults to installed Chrome.
- Large Vite chunk warning remains a performance follow-up.
- Fast refresh lint warnings remain in shared UI component files and are currently non-blocking warnings.
- Node `punycode` deprecation warning remains a dependency/tooling warning during build.

## Release Gate

Before starting a new feature phase, run:

```bash
pnpm exec tsc -p tsconfig.json --noEmit
pnpm build
pnpm test:e2e
```

For a full credentialed gate, configure admin, non-admin, upload quota, and `LOVABLE_API_KEY`, then rerun `pnpm test:e2e`.

## CI Policy

Normal pushes and pull requests run the safe non-credentialed gate:

- install dependencies with `pnpm install --frozen-lockfile`
- TypeScript check
- lint
- production build
- Playwright Chromium install
- `pnpm test:e2e`

Credentialed tests intentionally skip in normal CI because E2E secrets are not provided. This protects admin credentials, non-admin credentials, AI gateway keys, cookies, JWTs, and Supabase tokens from untrusted pull request contexts.

Protected credentialed E2E should run only in a trusted environment such as a protected branch workflow, manual `workflow_dispatch`, deployment preview with restricted secrets, or a private CI runner. Required protected secrets:

- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_NON_ADMIN_EMAIL`
- `E2E_NON_ADMIN_PASSWORD`
- `LOVABLE_API_KEY`

Optional protected configuration:

- `E2E_BASE_URL`
- `E2E_BROWSER_CHANNEL`

Do not expose these secrets to forks, public PRs, debug logs, screenshots, traces, or committed files.

## Trusted Production Credentialed QA Plan

This section defines the safe plan for executing credentialed production QA against the official production URL (`https://nexus-core-ai-os.lovable.app`) without exposing secrets, changing product behavior, or running destructive tests.

### Required Trusted QA Accounts

- **Admin account:** `allidamech@gmail.com`
- **Non-admin account:** manually created production test account
- **Optional upload/quota account:** manually assigned safe test quota/plan

### Protected Secrets & Environment Variables

When running against production, the following environment variables must be securely provided:

- `E2E_BASE_URL=https://nexus-core-ai-os.lovable.app`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_NON_ADMIN_EMAIL`
- `E2E_NON_ADMIN_PASSWORD`
- `E2E_BROWSER_CHANNEL`
- `LOVABLE_API_KEY` (only if needed by the environment)

### GitHub Protected Environment Policy

- Credentialed tests must run only through a protected/manual workflow.
- Do not run credentialed tests on untrusted PRs or forks.
- Secrets must be scoped to a protected GitHub Environment.
- At least one manual approval should be required before credentialed production QA.

### Safe Production QA Boundaries

- No large ZIP uploads.
- No destructive data mutation.
- No service-role key in browser/client.
- No real customer data fixtures.
- No secrets in logs, screenshots, console, or network captures.

### Manual Production QA Checklist

- Admin login
- Non-admin `/app/admin` denial
- Session restore
- Logout/private data clearing
- Arabic/RTL persistence
- Authenticated chat smoke
- `x-correlation-id` visible on authenticated `/api/chat`
- `x-correlation-id` visible on unauthenticated `/api/chat` `401`
- `x-correlation-id` visible on unauthenticated `/api/projects/process-zip` `401`
- Valid tiny ZIP upload (only if quota allows)
- Invalid ZIP rejection
- Suspicious path traversal ZIP rejection
- Usage metering check
- Admin dashboard does not leak after logout

### Post-Deploy Lovable Smoke

Use this checklist after each Lovable publish:

- Load `https://nexus-core-ai-os.lovable.app` with cache disabled and a cache-bust query.
- Confirm production serves the expected asset generation and no stale pre-publish hashes are active.
- Confirm split vendor chunks are present for React, Supabase, AI, icons, and route chunks.
- Open `/login` and sign in manually with the admin account.
- Verify `/app`, `/app/settings`, `/app/admin`, and one existing `/app/$threadId` route.
- Send one safe chat smoke prompt and confirm `/api/chat` returns `200`.
- Inspect only safe network response metadata:
  - response status
  - presence of `x-correlation-id`
  - route/chunk names
- Do not print or copy cookies, Authorization headers, JWTs, API keys, auth headers, request bodies, or environment values.
- Check unauthenticated `/api/chat` and `/api/projects/process-zip` with valid JSON request bodies; both should return `401` and include `x-correlation-id`.
- Open the upload dialog only unless a safe quota/test account is explicitly available.
- Log out and confirm `/app/admin` redirects to `/login`.
- Confirm no browser console runtime errors, hydration errors, chunk load errors, or visible secrets.

### Safe Error Review

When reviewing production logs or browser output:

- Expected safe fields: area label, status code, database error code, short redacted message, event type, route, and `correlationId`.
- Never capture or share passwords, tokens, cookies, JWTs, Authorization headers, API keys, service-role keys, raw prompts, uploaded source content, or full request bodies.
- Root runtime failures should show generic UI and a trace ID only.
- Chat/upload/admin failures should be traced by `correlationId` across usage events, audit/security events, and redacted server logs.

### Running Playwright Against Production

If the existing Playwright credentialed tests support these environment variables, they can be run against Lovable from a local shell:

```powershell
$env:E2E_BASE_URL="https://nexus-core-ai-os.lovable.app"
$env:E2E_ADMIN_EMAIL="allidamech@gmail.com"
$env:E2E_ADMIN_PASSWORD="replace-with-secret"
$env:E2E_NON_ADMIN_EMAIL="nonadmin@example.com"
$env:E2E_NON_ADMIN_PASSWORD="replace-with-secret"
pnpm test:e2e
```
