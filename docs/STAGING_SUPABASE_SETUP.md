# Safe Supabase Staging Setup

This document defines how to create and verify a non-production Supabase staging environment for Project Memory RLS probes. It must not contain secrets, tokens, JWTs, cookies, auth headers, API keys, database passwords, or service-role keys.

## Current Configuration Findings

Current repository path:

- `D:\nexus-core-platform-main`

Current Supabase configuration:

- `supabase/config.toml` contains one project id: `ameeoxvdeaiuaadcbxno`
- No staging Supabase environment variables were present in the local shell during Phase 37 review.
- `.env` currently uses production-style variable names only:
  - `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_URL`
  - `VITE_SUPABASE_PROJECT_ID`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_URL`

Current assumption:

- The configured Supabase project must be treated as production or production-adjacent until proven otherwise.
- It must not be used for Project Memory staging probes.
- Phase 36 remains blocked until a verified safe staging environment exists.

## Required Staging Environment Variables

Use names only in documentation and scripts. Do not commit values.

- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_PUBLISHABLE_KEY`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_SUPABASE_DB_URL`
- `STAGING_SUPABASE_PROJECT_ID`

Never print these values in logs or terminal output.

## Option A - Local Supabase Staging

Use this option when:

- The goal is fast RLS validation without hosted staging infrastructure.
- Local Docker/Supabase CLI is available.
- Test data can be created and destroyed locally.
- Production-like hosted auth behavior is not required.

Setup requirements:

- Supabase CLI installed.
- Docker available.
- Local database can be reset.
- No production env variables loaded into the shell.
- Project baseline migrations can run locally in timestamp order.

Safety requirements:

- Do not link local Supabase to the production project.
- Do not use production service-role keys.
- Do not import production data.
- Use only fake-safe tokens for secret-retention probes.
- Keep memory feature gates false unless a specific local RLS probe requires testing denial/allow behavior.

Expected environment variables:

- Local runs may use Supabase CLI defaults.
- If explicit variables are needed, use the `STAGING_SUPABASE_*` names above.
- Do not reuse `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, or `VITE_SUPABASE_*` for staging probes.

How to verify it is not production:

- Confirm `STAGING_SUPABASE_PROJECT_ID` is absent or clearly marked local.
- Confirm URL points to localhost or Supabase local gateway.
- Confirm local database can be reset.
- Confirm no production Lovable URL or production project id appears in the staging probe command.

How to reset or destroy it:

- Stop local Supabase.
- Reset local database through Supabase CLI.
- Remove local containers/volumes only when intentionally clearing staging data.

How to run migrations safely:

- Run baseline migrations locally in timestamp order.
- Apply `supabase/migrations/20260522090000_project_memory_foundation.sql` only after the baseline schema exists.
- Do not run hosted `db push` commands from a shell that contains production credentials.

How to run RLS probes safely:

- Create local test users only.
- Create project A for owner A and project B for owner B.
- Probe anonymous, owner, non-owner, non-admin, and admin paths.
- Use fake strings only for secret-retention tests.
- Capture pass/fail results without printing secrets.

## Option B - Hosted Supabase Staging Project

Use this option when:

- Hosted Supabase auth behavior must match production more closely.
- Lovable-like cloud environment validation is needed before production.
- A separate disposable Supabase project can be created.

Setup requirements:

- A separate Supabase project created only for staging.
- Staging project id different from `ameeoxvdeaiuaadcbxno`.
- Staging URL different from any production URL.
- Staging DB URL different from production DB URL.
- Staging service-role key stored only in a secure local secret manager or protected CI secret.
- Baseline Nexus Core migrations applied to staging before Project Memory migration.

Safety requirements:

- Do not link staging commands to the production Supabase project.
- Do not copy production users, messages, uploads, logs, or project data.
- Do not use production service-role keys.
- Do not expose staging service-role key to the browser.
- Staging must be resettable or disposable.

Expected environment variables:

- `STAGING_SUPABASE_URL`
- `STAGING_SUPABASE_PUBLISHABLE_KEY`
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_SUPABASE_DB_URL`
- `STAGING_SUPABASE_PROJECT_ID`

How to verify it is not production:

- Confirm staging project id differs from `ameeoxvdeaiuaadcbxno`.
- Confirm staging URL differs from Lovable production app URL and production Supabase URL.
- Confirm staging DB URL differs from production DB URL.
- Confirm staging dashboard/project name clearly includes `staging` or `rls-test`.
- Confirm staging contains only test users and test data.
- Confirm the project can be reset or discarded.

How to reset or destroy it:

- Reset the staging database from the Supabase dashboard or CLI.
- Delete the hosted staging project if it is disposable.
- Rotate staging keys after testing if they were exposed to any local script.

How to run migrations safely:

- Export only `STAGING_SUPABASE_*` variables.
- Confirm target project id before every hosted command.
- Apply baseline migrations first.
- Apply only the Project Memory foundation migration for Phase 36.
- Do not run production SQL or production `db push`.

How to run RLS probes safely:

- Use staging-only admin, owner A, owner B, and non-admin accounts.
- Use staging-only projects.
- Use fake-safe strings for token/password/API key probes.
- Verify feature gates remain false after migration.
- Verify no public/anonymous memory access.

## Staging User Requirements

Create or use only staging accounts:

- Staging admin user.
- Staging owner user A.
- Staging owner user B.
- Staging non-admin user.
- Anonymous/logged-out path for unauthenticated probes.

Do not use production admin or production user accounts.

## Staging Data Requirements

Required staging data:

- Project A owned by owner A.
- Project B owned by owner B.
- Test-only memory rows for approved, verified, draft, rejected, archived, and admin-only cases.
- Test-only retrieval events.
- Test-only archive rows.

Forbidden staging data:

- Real customer data.
- Production uploads.
- Production messages.
- Real secrets.
- Real API keys.
- Real JWTs.
- Real auth headers.
- Production logs.

Secret-retention probes must use fake strings only:

- `FAKE_JWT_DO_NOT_USE`
- `FAKE_API_KEY_DO_NOT_USE`
- `FAKE_PASSWORD_DO_NOT_USE`
- `FAKE_AUTH_HEADER_DO_NOT_USE`

## Safety Checklist Before Applying Memory Migration

Every item must be confirmed before rerunning Phase 36:

- Staging project id is different from production project id.
- Staging URL is different from production URL.
- Staging DB URL is different from production DB URL.
- Staging service-role key is not production.
- Staging contains only test data.
- Staging can be reset or discarded.
- Baseline Nexus Core schema exists in staging.
- Migration target is explicitly staging.
- Shell command history does not expose secrets.
- Command output redacts secrets.
- No production Supabase project is linked in the active shell.
- No Lovable production setting is modified.

## Go / No-Go Rules

GO to Phase 36 rerun only if:

- Staging project is confirmed non-production.
- Test accounts exist.
- Baseline schema exists.
- Database can be reset.
- No real customer data exists.
- Migration can be applied safely.
- Target project id and URL are explicitly staging.

NO-GO if:

- Only production Supabase exists.
- Staging cannot be verified.
- Project IDs are ambiguous.
- Service-role target is unknown.
- Environment variables are missing.
- Staging contains real data.
- Migration target cannot be proven safe.
- Any command would print secrets.

## Recommended Path

Preferred first path: Option A, local Supabase staging.

Reason:

- It is disposable.
- It avoids hosted production confusion.
- It can validate most RLS and disabled-gate behavior without touching production.

Use Option B after local probes pass if hosted Supabase auth/RLS behavior needs one more production-like check.

## Phase 36 Rerun Readiness

Do not rerun Phase 36 until:

- This setup checklist is complete.
- Staging environment variables exist with values stored securely outside the repo.
- A human confirms the staging project is not the Lovable production Supabase project.
- Baseline migrations have been applied to staging only.
