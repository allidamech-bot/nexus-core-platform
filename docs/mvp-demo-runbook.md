# Nexus Core MVP Demo Runbook

## What Works Today

### Core Flow (Ready for Demo)

1. **Authentication**: Email/password sign-in via Supabase (`/login`, `/signup`)
2. **ZIP Upload**: Upload project archives with safe preview indexing (`/app` → upload button)
3. **Safe Previews**: Limited text previews indexed from uploaded files
4. **AI Chat**: Project-aware AI planning sessions (`/app/$threadId`)
5. **Patch Preview**: Create and verify patch proposals
6. **Writeback Review**: Submit/approve/reject review requests
7. **Working Copy**: Create from approved writeback requests
8. **Working Copy Export**: Download JSON handoff bundles

### Admin Features

- `/app/admin` — Review submitted writeback requests
- Approve/reject with reviewer notes
- Working copies created automatically for approved requests
- Metrics: projects, uploads, AI requests, previews, failures

## Required Environment Variables

| Variable                        | Purpose                  | Required       |
| ------------------------------- | ------------------------ | -------------- |
| `SUPABASE_URL`                  | Supabase project URL     | Yes            |
| `SUPABASE_PUBLISHABLE_KEY`      | Supabase anon key        | Yes            |
| `LOVABLE_API_KEY`               | AI provider key          | Yes (for chat) |
| `VITE_SUPABASE_URL`             | Client-side Supabase URL | Yes            |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client-side anon key     | Yes            |

## Known External Blockers

### PR #19 Supabase E2E DB Schema Drift

- Tests in `tests/e2e/governedWorkflowApiE2E.spec.ts` require persisted Supabase credentials
- Branch `validation/h3-full-persisted-governed-e2e` has schema drift requiring merge into test DB
- Non-persisted E2E route validation (`governedWorkflowE2E.spec.ts`) passes

### Production Smoke Credentials

- `NEXUS_SMOKE_ADMIN_EMAIL/PASSWORD` and `NEXUS_SMOKE_USER_EMAIL/PASSWORD` not configured
- Smoke tests in `tests/e2e/productionCredentialedSmoke.spec.ts` will skip without these

## Demo Path

```
1. Sign up / Sign in → /app
2. Upload ZIP → Project ingested, previews available
3. Create session → /app/$threadId with project context
4. AI Chat → Get structured plan with implementation steps
5. Create Patch Preview → Proposed file changes
6. Submit Review Request → Request goes to admin queue
7. Admin Approve → Working copy created automatically
8. Export → Download JSON bundle of proposed changes
```

## What Not to Claim

- **Billing**: Stripe integration is a placeholder; no real checkout flow
- **Teams UI**: Feature is disabled; no team management visible
- **Sandbox Execution**: Disabled; no terminal/shell access
- **Direct Source Writeback**: Intentionally disabled; changes not applied to source
- **GitHub PRs**: Only created for GitHub-linked projects; code-push not yet enabled

## Safety Invariants (Verified)

- `originalProjectFilesModified: false` — Source files never changed
- `sourceZipOverwritten: false` — Original ZIP preserved
- `objectStorageModified: false` — Object storage unchanged
- `productionWritebackIncluded: false` — No production deployments
- RLS enforced on all data queries
- Quotas enforced on uploads, AI requests, threads, previews
