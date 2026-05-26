# Phase 93 Pipeline Smoke Checklist

## Local verification

Run from `D:\nexus-core-platform-main`:

```powershell
pnpm install
pnpm run lint
pnpm exec tsc -p tsconfig.json --noEmit
pnpm build
pnpm test:e2e
```

Credentialed upload and AI smoke checks require Supabase and AI gateway environment variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `LOVABLE_API_KEY`
- test account credentials used by the credentialed Playwright suite

Credentialed smoke tests are skipped locally when those values are not present.

## Expected full pipeline

1. Upload a ZIP and confirm quota/auth blocks are respected.
2. Process ZIP into `project_files` and `project_text_previews`.
3. Review the safe preview file tree.
4. Create a grounded patch preview from indexed text.
5. Create an AI-grounded patch preview when the AI gateway is configured.
6. Run sandbox verification without executing code.
7. Create a versioned patch snapshot.
8. Download the snapshot export bundle.
9. Create and submit a governed writeback request.
10. Approve or reject the request from the admin review workflow.
11. Create a versioned working copy from an approved request.
12. Download the working copy export bundle.

## Production-like manual smoke

- Use a small ZIP containing allowlisted text files.
- Confirm blocked, warning, and complete states appear in pipeline diagnostics.
- Confirm release gate still says production/source writeback is unavailable.
- Confirm exported JSON contains README, manifest, metadata, bounded text, and sanitized paths.

## Must remain unavailable

- Source ZIP overwrite
- Object storage writeback
- Deployment
- Uploaded/generated code execution
- Dependency installation
- Package script execution
