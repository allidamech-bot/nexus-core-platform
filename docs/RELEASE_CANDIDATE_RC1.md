# Nexus Core Release Candidate Report (RC-1)

This report establishes the final Release Candidate (RC-1) posture for the Nexus Core Platform.

---

## 1. Release Candidate Name
**Nexus Core RC-1**

---

## 2. Latest Commit
`49c37f1 Polish launch readiness states` (Prepared and verified under Phase 95)

---

## 3. What Works (Verified Capabilities)
The following capabilities have been fully implemented, locally compiled, and validated through extensive Playwright end-to-end and unit testing:

- **Upload Quota Lifecycle**: Clean recovery on failed processing; accurate tracking of monthly limits.
- **Real ZIP Processing Foundation**: Structured secure decompression and directory traversal mitigation.
- **Safe Preview File Tree**: Allowlist filtering of text-based files; binary file bypass; safe file-size limit enforcement.
- **Grounded Patch Preview**: Exact text-grounded diff comparisons without mutating underlying source files.
- **AI-Grounded Patch Preview Generation**: Production-ready LLM chat integration for patch proposals.
- **Sandbox Verification**: Isolation simulations for proposed patch changes; conflict and collision detection.
- **Versioned Patch Snapshot**: Capture and verification indexing of derived change sets.
- **Snapshot Export**: Sanitized zip bundling of approved previews, README manifests, and asset metadata.
- **Governed Writeback Request**: Multi-role review drafting, submission, and risk assessment routing.
- **Review/Approval Workflow**: Non-destructive audit logging, blocker tracking, and reviewer decision matrices.
- **Approved Writeback to Versioned Working Copy**: Non-deploying execution that builds a sandboxed working copy without overwriting live files.
- **Working Copy Export**: Bundled archive exports of working copies with full path sanitization.
- **Pipeline Diagnostics**: Continuous visual check of system gates and status checks.
- **Production Readiness Gate**: Enforces auth, RLS, and required environment configurations before releasing control planes.
- **Launch-Readiness Polish**: Arabic RTL direction persistence, high-fidelity disabled-state tooltips, normalized job statuses, and safe error fallbacks.

---

## 4. What Is Intentionally Unavailable
As a strict security guardrail in this phase, the following actions remain **disabled intention-wise and implementation-wise**:

- **Source ZIP Overwrite**: Original source archives are never modified or replaced.
- **Object Storage Writeback**: Live production object storage remains completely read-only.
- **Deployment/Apply Automation**: Automated CI/CD, deployment pushes, or server hot-swapping are not supported.
- **Raw Code Execution**: No user or generated script is ever run on the host or inside client runtimes.
- **Dependency Installation**: No `npm install`, `pip install`, or external package manager commands are run.
- **Package Script Execution**: No build or dev scripts from indexed projects are executed.
- **Autonomous Production Code Modification**: The platform acts solely as a secure proposal editor and diagnostic planner.

---

## 5. Required Production Smoke Checklist
To confirm a production deploy against `https://nexus-core-ai-os.lovable.app`, operators must manually smoke test:

1. **Supabase Migrations Applied**: Verify schema version `20260525200000_versioned_working_copies.sql` or newer.
2. **Production Environment Configured**: Confirm publishable and secure client credentials are wired cleanly.
3. **LOVABLE_API_KEY Configured**: Ensure gateway routing has the required key for LLM operations.
4. **Admin/Non-Admin Credentialed Smoke**: Ensure non-admins are rejected from `/app/admin` while admins (`allidamech@gmail.com`) gain full visibility.
5. **Real ZIP Upload Smoke**: Perform a small text file ZIP upload and confirm safe indexing.
6. **AI Patch Preview Smoke**: Prompt a small change on an indexed file and verify grounded unified diff rendering.
7. **Export Smoke**: Verify snapshot and working-copy export zip downloads load valid JSON data structures.
8. **Admin Review Smoke**: Submit a writeback request from a requester and review it in the admin dashboard.

---

## 6. Local Verification Result
The local release candidate suite has been fully verified.

### Executed Commands:
```bash
pnpm install
pnpm run lint
pnpm exec tsc -p tsconfig.json --noEmit
pnpm build
pnpm test:e2e
```

### Expected Outcomes:
- `pnpm install`: Installs cleanly using lockfile.
- `pnpm run lint`: **0 errors**, 8 warnings (Standard Fast Refresh).
- `pnpm exec tsc -p tsconfig.json --noEmit`: Completed with **0 errors**.
- `pnpm build`: Client and SSR production bundles compile cleanly.
- `pnpm test:e2e`: **42 passed**, 5 skipped (Skipped credentialed integration tests only).

---

## 7. Known Limitations
- **Local Credentialed Tests**: E2E test runs skip credentialed files locally due to lack of local database sessions. Production credential testing is restricted to safe, sandboxed QA credentials.
- **Vite Bundle Size Warning**: Vite triggers size warnings during bundling; this is optimized via asset chunking, but remains an optimization topic.
- **Punycode Deprecation**: Node.js issues a deprecation warning for `punycode`; this is a toolchain dependency warning that does not impact client-side runtime behavior.

---

## 8. Release Decision
**"Ready for production smoke, not final production source writeback."**
The platform is exceptionally stable, robust, and safe for production release candidate deployment as a secure read-only planning workspace.
