# Nexus Core Release Candidate Report (RC-1)

This report captures the current RC-1 posture for Nexus Core after Phase 96D stabilization and the RC quota RLS unblock.

## 1. Release Candidate Name

**Nexus Core RC-1**

## 2. Latest Known RC Commits

- `d6fb1b6 Prepare Nexus Core release candidate`
- `4302767 Fix project context hydration for RC smoke`
- `b09ec61 Stabilize RC smoke diagnostics`
- `Fix folder import quota RLS blocker` (this stabilization commit)

Production should deploy `b09ec61` or newer plus the folder import quota RLS blocker fix for RC smoke.

## 3. Current Decision

**ACCEPT_WITH_LIMITATIONS**

Local verification is strong, production route deployment is current, the Phase 96D project-context hydration blocker is fixed, and folder/local imports are intended to be exempt from monthly successful ZIP quota while preserving ZIP quota enforcement. Full first-use ZIP pipeline smoke still requires a fresh QA account or available monthly successful ZIP upload quota.

## 4. Verified Capabilities

- Upload quota lifecycle for successful storage-backed ZIP processing.
- Real ZIP processing foundation with secure ZIP inventory and traversal rejection.
- Safe preview file tree for allowlisted text files.
- Grounded manual and AI patch previews that do not apply changes.
- Sandbox verification against indexed preview text only.
- Versioned patch snapshots.
- Snapshot export as a bounded JSON review bundle.
- Governed writeback requests and admin review.
- Approved request conversion into separate versioned working copies.
- Working copy export as a bounded JSON review bundle.
- Pipeline diagnostics and production readiness gate.
- Phase 96D project context hydration: header, inspector, diagnostics, safe preview, and patch preview share the attached thread project context.
- Folder/local import quota RLS unblock: folder imports do not require or consume monthly successful ZIP upload quota.

## 5. What Is Intentionally Unavailable

- Source ZIP Overwrite.
- Object Storage Writeback.
- Deployment/apply automation.
- Uploaded or generated code execution.
- Dependency installation from uploaded projects.
- Uploaded package script execution.
- Autonomous production code modification.

## 6. Production Smoke Status

- Public app load: passing.
- Admin dashboard: passing for admin session.
- API route 404 blocker: resolved.
- Project context hydration: passing after Phase 96D.
- Real browser upload smoke: currently blocked on the existing admin account by monthly successful ZIP upload quota.
- Full patch/snapshot/writeback pipeline smoke: can use a processed ZIP project with available quota, or a folder/local import when ZIP quota is exhausted.

## 7. Required Production Smoke Checklist

1. Confirm Lovable is publishing `b09ec61` or newer plus the folder import quota RLS blocker fix.
2. Confirm Supabase migrations through versioned working copies and successful ZIP upload usage semantics are applied.
3. Confirm environment variables are configured without exposing secret values.
4. Confirm admin and non-admin credentialed boundaries.
5. Use a fresh QA account or account with available monthly successful ZIP upload quota for ZIP smoke, or use folder/local import to continue first-use smoke when ZIP quota is exhausted.
6. Upload a small safe ZIP or import a small safe folder and confirm processing, safe previews, and diagnostics.
7. Generate grounded manual and AI patch previews when provider configuration is available.
8. Verify sandbox, snapshot, JSON snapshot export, writeback request, admin review, working copy, and JSON working copy export.

## 8. Local Verification Commands

```bash
pnpm install
pnpm run lint
pnpm exec tsc -p tsconfig.json --noEmit
pnpm build
pnpm test:e2e
```

Expected result: lint has no errors, TypeScript passes, build passes, and non-credentialed e2e tests pass. Credentialed e2e tests may skip unless trusted private credentials are configured.

## 9. Known Limitations

- Existing admin account may be blocked by monthly successful ZIP upload quota.
- Full production ZIP smoke needs a fresh QA account or quota availability.
- `LOVABLE_API_KEY` is required for AI patch preview smoke.
- Vite large chunk warnings remain a non-blocking optimization topic.
- Node may emit a non-blocking `punycode` deprecation warning from tooling.
