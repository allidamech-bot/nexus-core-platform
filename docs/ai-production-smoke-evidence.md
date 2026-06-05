# AI Patch Preview Production Smoke Evidence

Date: 2026-06-05

Production URL: `https://nexus-core-ai-os.lovable.app`

## Result

Status: **BLOCKED_CREDENTIALS_REQUIRED**

A real AI patch preview artifact was **not** generated from this shell. The validation did not fake
PASS because trusted production smoke credentials or a pre-confirmed smoke user were not available.

## Evidence

- `LOVABLE_API_KEY` is not present in the current shell environment.
- `LOVABLE_API_KEY` is present in local `.env`, but that only proves local configuration is
  available to this workspace. It does not prove the production deployment secret.
- `GET /api/projects/ai-provider-readiness` on production returned `404 Not Found`, so the latest
  readiness endpoint has not been verified on the deployed production app.
- `POST /api/projects/ai-patch-preview` on production returned `401 Unauthorized` without a bearer
  token, proving the production AI patch preview route exists and remains auth-gated.
- Attempting to create a new anonymous smoke user with the production Supabase anon key was blocked
  by email confirmation:
  - failure stage: `auth_session`
  - code: `email_not_confirmed`
  - message: `Email not confirmed`

## Artifact

- AI patch preview artifact id: **not created**
- Diagnostics transition: **Ready -> not verified**

## Safety Checks

- No production source files were modified.
- No direct source writeback occurred.
- No working copy was created.
- No object storage write was performed by this validation attempt.
- The governed pipeline remains the required path for working-copy creation and export.

## Required Follow-Up

Run the credentialed AI smoke from a trusted production operator shell with:

```bash
LOVABLE_API_KEY=...
NEXUS_AI_SMOKE_BASE_URL=https://nexus-core-ai-os.lovable.app
NEXUS_AI_SMOKE_EMAIL=...
NEXUS_AI_SMOKE_PASSWORD=...
NEXUS_AI_SMOKE_PROJECT_ID=...
NEXUS_AI_SMOKE_FILE_IDS=...
pnpm smoke:ai -- --reporter=list
```

Expected PASS requires:

- production readiness endpoint returns `configured: true`
- AI patch preview request returns HTTP 200
- `previewId` is present
- artifact status is `ready`
- diagnostics move `Ready -> Complete`
- source project files and safe text previews remain unchanged
