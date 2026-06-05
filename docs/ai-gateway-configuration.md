# AI Gateway Configuration

Nexus Core uses the Lovable AI Gateway for chat and AI patch preview generation.

## Required Provider Environment

Configure this server-side secret in the deployment environment:

- `LOVABLE_API_KEY`

Do not expose this value in browser code, logs, screenshots, docs, commits, or Playwright output.

The current AI patch preview route uses the Lovable gateway model `google/gemini-3-flash-preview`.

The safe readiness endpoint is:

```text
GET /api/projects/ai-provider-readiness
```

It returns only provider name, model, configured status, safe blocker code, and required env names.
It never returns API keys or provider payloads.

## Readiness States

- `Ready`: `LOVABLE_API_KEY` is configured and safe text previews exist, so AI patch preview can be attempted.
- `Complete`: an AI patch preview was generated as a governed review artifact.
- `BLOCKED_AI_PROVIDER_REQUIRED`: AI provider configuration is missing or has not been verified.
- `AI_GATEWAY_ERROR`: provider credentials are present but the gateway request failed. Check deployment environment and safe server logs.

Missing credentials must never be reported as PASS.

## Credentialed AI Smoke

Run the AI smoke only from a private operator shell or trusted runner:

```bash
pnpm smoke:ai -- --reporter=list
```

Required smoke environment:

- `LOVABLE_API_KEY`
- `NEXUS_AI_SMOKE_BASE_URL` or `NEXUS_SMOKE_BASE_URL`
- `NEXUS_AI_SMOKE_EMAIL` or `NEXUS_SMOKE_USER_EMAIL`
- `NEXUS_AI_SMOKE_PASSWORD` or `NEXUS_SMOKE_USER_PASSWORD`
- `NEXUS_AI_SMOKE_PROJECT_ID`
- `NEXUS_AI_SMOKE_FILE_IDS` as a comma-separated list of safe previewable file ids

If any value is missing, the smoke skips with:

```text
BLOCKED_AI_PROVIDER_REQUIRED
```

## Safety Invariants

- AI output is a read-only patch preview artifact.
- Original `project_files` rows remain unchanged.
- Original `project_text_previews` rows remain unchanged.
- Object storage remains unchanged.
- Direct source writeback remains intentionally disabled.
- Working copy export remains the safe review handoff.
