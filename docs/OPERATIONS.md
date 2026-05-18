# Nexus Core Operations

## Deployment Checklist

- Apply Supabase migrations in order.
- Confirm `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `LOVABLE_API_KEY`.
- Confirm `.env` is not committed.
- Verify `/api/chat` returns `401` without auth.
- Verify `/api/projects/process-zip` returns `401` without auth.
- Confirm admin email exists in the database-backed admin role allowlist.

## Governance Checks

- Usage events should appear after uploads, folder imports, AI requests, preview selection, and ingestion failures.
- Audit events should appear after admin dashboard access, quota hits, uploads, folder imports, and context selection.
- Starter plan limits are intentionally strict.
- Phase 2E governance migrations must be applied before production chat usage metering can enforce quotas.

## Local Governance Degraded Mode

During local development only, `/api/chat` can continue when governance tables or RPCs are missing. In that degraded mode, chat auth is still required, but AI request metering, audit writes, and quota enforcement are skipped with a server warning. Production must not run this way; missing governance tables return a clear setup error instead of silently bypassing limits.

## Product Guardrails

Nexus Core is pre-execution. Operators should see clear messaging that imported projects are inspected safely and no commands, dependencies, or code modifications are performed.

## Known Operational Warnings

- Large chunk warnings remain and should be handled with route-level code splitting later.
- Billing plans are structural until a payment provider is selected.
- Folder import stores safe file metadata; raw folder contents are not uploaded.
