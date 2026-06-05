# Production Credentialed Smoke Gate

Status: **BLOCKED_CREDENTIALS_REQUIRED** until trusted production admin and non-admin credentials are supplied in a private smoke environment.

This gate does not enable direct source writeback, does not weaken RLS, and does not authorize any schema changes. It validates production access boundaries around the already-passing governed pipeline smoke.

## Required Environment

Set these only in a private runner or trusted operator shell:

- `NEXUS_SMOKE_BASE_URL`
- `NEXUS_SMOKE_ADMIN_EMAIL`
- `NEXUS_SMOKE_ADMIN_PASSWORD`
- `NEXUS_SMOKE_USER_EMAIL`
- `NEXUS_SMOKE_USER_PASSWORD`

Optional for AI boundary validation:

- `LOVABLE_API_KEY`
- `NEXUS_AI_SMOKE_BASE_URL` or `NEXUS_SMOKE_BASE_URL`
- `NEXUS_AI_SMOKE_EMAIL` or `NEXUS_SMOKE_USER_EMAIL`
- `NEXUS_AI_SMOKE_PASSWORD` or `NEXUS_SMOKE_USER_PASSWORD`
- `NEXUS_AI_SMOKE_PROJECT_ID`
- `NEXUS_AI_SMOKE_FILE_IDS`

Never commit or print secrets, cookies, JWTs, service-role keys, auth headers, or private environment values.

## Automated Runner

Run:

```bash
pnpm smoke:production:credentialed
```

If any required `NEXUS_SMOKE_*` value is missing, the Playwright spec skips with:

```text
BLOCKED_CREDENTIALS_REQUIRED
```

Missing credentials must not be reported as PASS.

## AI Patch Preview Smoke

Run:

```bash
pnpm smoke:ai
```

The AI smoke validates that a configured Lovable AI Gateway can create a governed AI patch preview
artifact for a known safe preview fixture. It does not modify source files, does not write object
storage, does not push to GitHub, and does not enable direct source writeback.

If any required AI provider or fixture variable is missing, the Playwright spec skips with:

```text
BLOCKED_AI_PROVIDER_REQUIRED
```

If provider credentials are present but the gateway request fails, record:

```text
AI_GATEWAY_ERROR
```

and inspect safe deployment logs without printing secrets.

## Credentialed Checklist

- [ ] Public production app loads at `NEXUS_SMOKE_BASE_URL`.
- [ ] Authenticated admin session loads `/app`.
- [ ] Authenticated non-admin session loads `/app`.
- [ ] Admin can see **Admin Control** and load `/app/admin`.
- [ ] Non-admin cannot see **Admin Control** and is redirected away from `/app/admin`.
- [ ] Admin can run the governed review flow or confirm existing PASS artifacts:
  - Writeback review: Complete.
  - Versioned working copy: Complete.
  - Working copy export: Complete.
  - Downloaded artifact: `nexus-core-working-copy-034df544.json`.
- [ ] Non-admin cannot approve/reject writeback requests unless existing owner authorization allows it for their own project.
- [ ] Project owner path works for their own project workspace, pipeline state, and export access.
- [ ] Cross-user project access is blocked by RLS and authenticated route checks.
- [ ] Working copy export downloads a bounded JSON bundle with README, manifest, metadata, files, and sanitized paths.
- [ ] Source project files remain unchanged.
- [ ] Object storage remains unchanged.
- [ ] Direct source writeback is intentionally disabled. Use working copy export as the safe review handoff.

## Release Gate Limitations

- AI provider configuration required for successful AI/chat production smoke.
- AI patch preview smoke requires `LOVABLE_API_KEY` plus `NEXUS_AI_SMOKE_*` fixture variables.
- Credentialed smoke required for production readiness.
- Direct source writeback intentionally disabled.

## Current Governed Pipeline Result

Governed pipeline smoke is already **PASS**:

- Writeback review: Complete.
- Versioned working copy: Complete.
- Working copy export: Complete.
- Downloaded artifact: `nexus-core-working-copy-034df544.json`.
