# Nexus Core Platform

Nexus Core is a premium AI-first operating system for project-aware engineering and business operations. The current product is still pre-execution: it can ingest projects, build safe manifests, index limited text previews, govern usage, and provide structured AI planning, but it cannot run code or modify repositories.

## Current Features

- Authenticated workspace with threaded AI sessions
- Secured `/api/chat` route with structured AI responses
- ZIP upload with server-side manifest extraction
- Local folder import foundation with safe file inventory
- Safe text preview indexing for allowlisted small files
- Project-aware chat context with explicit preview selection
- Admin dashboard with roles, usage, audit, quota, and health visibility
- Usage governance, plan limits, and quota enforcement foundation
- English and Arabic locale foundation with RTL support
- Supabase RLS migrations for ownership and admin boundaries

## Setup

Install dependencies:

```bash
npm install --no-package-lock
```

Create local environment:

```bash
cp .env.example .env
```

Required variables:

```bash
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
LOVABLE_API_KEY=
```

Run locally:

```bash
npm run dev
```

Verify:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Supabase Notes

Apply migrations in timestamp order from `supabase/migrations`. The latest phases add project ingestion, RLS hardening, admin roles, subscription foundations, usage events, audit events, and governance RPCs.

Do not expose a Supabase service role key in the client. Client-side data access depends on user auth, RLS, and server routes.

Phase 2E governance migrations are required for full chat metering and quota enforcement. Local development can run chat in a degraded governance mode if those tables/RPCs are missing, but production returns a setup error rather than bypassing quota enforcement.

## Lovable Cloud Notes

Set the same environment variables in Lovable Cloud/Vercel. The app expects the TanStack Start routes to include `/`, `/login`, `/signup`, `/app`, `/app/$threadId`, `/app/admin`, `/app/settings`, `/api/chat`, and `/api/projects/process-zip`.

## E2E QA

The Playwright E2E harness covers public route loading, protected-route redirects, unauthenticated API boundaries, and Arabic/RTL persistence without credentials.

Run the non-credentialed suite:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Open Playwright UI mode:

```bash
pnpm test:e2e:ui
```

Optional credentialed tests skip automatically unless these environment variables are set:

```bash
E2E_ADMIN_EMAIL=
E2E_ADMIN_PASSWORD=
E2E_NON_ADMIN_EMAIL=
E2E_NON_ADMIN_PASSWORD=
E2E_BASE_URL=
E2E_BROWSER_CHANNEL=
```

On Windows the harness uses the installed Chrome channel by default. Set `E2E_BROWSER_CHANNEL` if you need another installed browser channel, or run `pnpm exec playwright install chromium` to use Playwright-managed browsers.

Never commit E2E credentials, cookies, JWTs, API keys, refresh tokens, or service-role keys. Full credentialed QA requires an admin account, a non-admin account, available project quota for upload fixtures, and `LOVABLE_API_KEY` when validating successful chat streaming. Without `LOVABLE_API_KEY`, chat tests assert the expected setup boundary instead of streaming.

## Known Limitations

- No code execution, shell, terminal, sandbox, or dependency installation
- No GitHub OAuth or repository connection
- No Stripe checkout or payment provider
- No embeddings or vector search
- Folder import currently stores safe metadata and inventory only; it does not upload raw folder contents
- Admin user email lookup is intentionally limited until a privileged server admin RPC layer is added

## Roadmap

See [docs/ROADMAP.md](D:/nexus-core-platform-main/docs/ROADMAP.md) and [docs/OPERATIONS.md](D:/nexus-core-platform-main/docs/OPERATIONS.md).
