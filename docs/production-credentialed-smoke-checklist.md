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
- Credentialed smoke required for production readiness.
- Direct source writeback intentionally disabled.

## Current Governed Pipeline Result

Governed pipeline smoke is already **PASS**:

- Writeback review: Complete.
- Versioned working copy: Complete.
- Working copy export: Complete.
- Downloaded artifact: `nexus-core-working-copy-034df544.json`.
