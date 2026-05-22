# Nexus Core v2.1 Project Memory Implementation Plan and Ticket Breakdown

This document converts the approved Project Memory planning documents into implementation sequencing and engineering work packages. It is documentation-only and does not authorize code changes, migrations, schema changes, dependency changes, or auth behavior changes.

## 1. Scope Summary

Project Memory v2.1 should allow Nexus Core to remember safe, approved, project-scoped knowledge across threads and sessions.

Reference documents:

- Architecture: `docs/V2_PROJECT_MEMORY_ARCHITECTURE.md`
- Data model: `docs/V2_PROJECT_MEMORY_DATA_MODEL.md`
- UX and QA: `docs/V2_PROJECT_MEMORY_UX_QA.md`
- Migration and RLS plan: `docs/V2_PROJECT_MEMORY_RLS_PLAN.md`
- API contracts: `docs/V2_PROJECT_MEMORY_API_CONTRACTS.md`

Implementation boundaries:

- Build only project-scoped, authenticated memory.
- Preserve auth isolation, admin isolation, route protection, safe logging, and correlation IDs.
- Start with manual memory and read/search flows before automatic retrieval.
- Treat automatic retrieval as a late-stage gated capability.
- Keep memory summaries safe and user-visible.
- Do not store secrets, raw uploaded contents, full source files, full transcripts, raw logs, or auth material.
- Do not add team workspace sharing, embeddings, autonomous execution memory, or cross-project semantic recall in v2.1.

## 2. Engineering Workstreams

### WS1 Database and RLS

Owns proposed memory tables, indexes, RLS policies, rollback scripts, and database review.

Primary outputs:

- Migration proposal.
- RLS policies.
- Rollback plan.
- RLS test fixtures.

### WS2 API Layer

Owns protected memory endpoints and request/response contracts.

Primary outputs:

- Search, remember, approve, archive, reject, categories, and events routes.
- Safe error responses.
- Project/admin authorization checks.

### WS3 Retrieval Engine

Owns filtering, ranking, explicit search, citation selection, and automatic retrieval gating.

Primary outputs:

- Retrieval boundaries.
- Ranking algorithm.
- Citation candidate selection.
- Archive/rejected exclusion logic.

### WS4 Memory Safety Pipeline

Owns redaction, secret scanning, duplicate detection, hallucination controls, and poisoning controls.

Primary outputs:

- Safety scanner.
- Redaction results.
- Blocked memory behavior.
- Duplicate candidate detection.

### WS5 UI Surfaces

Owns user-facing memory surfaces and flows.

Primary outputs:

- Project Memory panel.
- Memory summary card.
- Remember Decision flow.
- Memory citations.
- Memory search.
- Archive/reject controls.

### WS6 Observability and Audit

Owns correlation propagation, retrieval events, audit events, redacted diagnostics, and operator visibility.

Primary outputs:

- Correlation integration.
- Memory audit events.
- Retrieval events.
- Safe operator diagnostics.

### WS7 QA and E2E

Owns unit, integration, RLS, E2E, security QA, and production smoke coverage.

Primary outputs:

- Test fixtures.
- Non-credentialed E2E.
- Credentialed E2E.
- Admin/non-admin QA.
- Production smoke checklist.

## 3. Ticket Breakdown

### PM-001 Memory Schema Migration

Goal: Create the proposed Project Memory tables and indexes after schema review approval.

Dependencies:

- Approved data model.
- Approved RLS plan.
- Rollback strategy.

Acceptance criteria:

- Tables align with approved data model.
- Project/user linkage exists for project-specific rows.
- Archive/rejected states are represented.
- No raw secret or raw uploaded content fields are introduced.
- Migration includes a rollback path.

Rollback requirement:

- Migration can be rolled back after writes are disabled and data preservation decision is made.

Risk level: High.

### PM-002 Memory RLS Policies

Goal: Add restrictive RLS policies for memory tables.

Dependencies:

- PM-001.
- Existing project ownership/auth checks.
- Admin validation path.

Acceptance criteria:

- Users cannot read/write another user's project memory.
- Non-admins cannot read admin-only memory or diagnostics.
- Archived memory is hidden from automatic retrieval paths.
- Rejected memory is hidden from normal retrieval.
- RLS tests prove denial cases.

Rollback requirement:

- Disable memory feature gates and remove/replace policies only through reviewed migration rollback.

Risk level: High.

### PM-003 Memory Category Contract

Goal: Implement product-managed memory categories.

Dependencies:

- PM-001.
- PM-002.

Acceptance criteria:

- Category keys match API contract.
- Admin-only categories are hidden from non-admin users.
- Unknown categories are rejected by write APIs.
- Category behavior is covered by tests.

Rollback requirement:

- Feature flag can hide category-driven UI and reject writes.

Risk level: Medium.

### PM-004 Memory Create API

Goal: Implement `POST /api/memory/remember`.

Dependencies:

- PM-001.
- PM-002.
- PM-003.
- PM-007 safety scanner.

Acceptance criteria:

- Authenticated users can create draft memory in permitted projects.
- Requests require `projectId`.
- Cross-project source refs are rejected.
- Secret-like content is blocked/redacted.
- Safe error shape and correlation ID are returned.

Rollback requirement:

- Disable memory write gate while preserving read/search protection.

Risk level: High.

### PM-005 Memory Search API

Goal: Implement `GET /api/memory/search`.

Dependencies:

- PM-001.
- PM-002.
- PM-003.

Acceptance criteria:

- Search defaults to current project.
- Results return safe summaries only.
- Archived memory is excluded unless explicitly requested.
- Rejected memory is excluded.
- Admin-only memory is denied to non-admins.
- Pagination limit is enforced.

Rollback requirement:

- Disable memory read/search gate and automatic retrieval.

Risk level: High.

### PM-006 Memory Approval, Archive, and Reject APIs

Goal: Implement `POST /api/memory/approve`, `POST /api/memory/archive`, and `POST /api/memory/reject`.

Dependencies:

- PM-001.
- PM-002.
- PM-004.
- PM-007.

Acceptance criteria:

- Draft/verified memory can be approved by authorized users.
- Archived memory no longer auto-loads.
- Rejected memory never appears in normal retrieval.
- Invalid state transitions return safe errors.
- Admin-only transitions require admin validation.

Rollback requirement:

- Disable approval/archive/reject gate and keep memory read-only.

Risk level: High.

### PM-007 Memory Safety Scanner

Goal: Implement secret scanning, redaction, unsafe content detection, duplicate detection, hallucination labeling, and poisoning checks.

Dependencies:

- Approved safety pipeline spec.

Acceptance criteria:

- JWT/API key/password/auth-header-like content is blocked or redacted.
- Blocked values are not stored, logged, returned, cited, or retained.
- Duplicate suggestions are surfaced safely.
- AI-only factual claims default to draft/needs review.
- Poisoning instructions in uploaded/user text cannot override policy.

Rollback requirement:

- Disable memory writes if safety scanner is unavailable or noisy.

Risk level: High.

### PM-008 Retrieval Ranking Engine

Goal: Implement retrieval filtering and ranking.

Dependencies:

- PM-005.
- PM-007.
- PM-011 audit events.

Acceptance criteria:

- Ranking uses project relevance, approval state, confidence, recency, usage, category, and archive status.
- Draft/rejected/unauthorized memory is excluded.
- Archived memory appears only through explicit archive search.
- Ranking can explain why a memory was selected.

Rollback requirement:

- Disable automatic retrieval while preserving manual search.

Risk level: Medium-high.

### PM-009 Project Memory Panel

Goal: Implement the primary UI for browsing and managing memory.

Dependencies:

- PM-003.
- PM-004.
- PM-005.
- PM-006.

Acceptance criteria:

- Panel shows memory grouped by category.
- Filters work for category, approval state, recency, confidence, source, and archive visibility.
- Edit/approve/archive/reject/delete controls follow permissions.
- No admin-only memory appears to non-admin users.
- Logout clears private memory UI.

Rollback requirement:

- Hide memory UI gate.

Risk level: Medium.

### PM-010 Remember Decision Flow

Goal: Add explicit user-confirmed memory creation from chat/plans/QA/operator notes.

Dependencies:

- PM-004.
- PM-007.
- PM-009.

Acceptance criteria:

- Button appears only on safe eligible content.
- Preview shows title, category, summary, source, confidence, retention, and safety warnings.
- User can approve, save draft, edit, cancel, or reject.
- Secret-like content is blocked without echoing values.

Rollback requirement:

- Disable Remember Decision action while keeping panel read-only.

Risk level: Medium-high.

### PM-011 Correlation and Memory Audit Integration

Goal: Add correlation ID propagation and safe audit/retrieval events.

Dependencies:

- PM-004.
- PM-005.
- PM-006.
- Existing correlation ID baseline.

Acceptance criteria:

- Memory create/search/approve/archive/reject events share request correlation ID.
- Retrieval events store safe metadata only.
- Error logs include area labels and correlation IDs.
- No raw prompts, auth headers, cookies, JWTs, API keys, or uploaded content are logged.

Rollback requirement:

- Reduce memory diagnostics verbosity while keeping correlation IDs.

Risk level: Medium.

### PM-012 Memory Citations

Goal: Show safe citations when AI uses approved memory.

Dependencies:

- PM-005.
- PM-008.
- PM-009.
- PM-011.

Acceptance criteria:

- AI responses cite memory by safe title/label.
- Opening a citation validates auth, project ownership, and admin status.
- Citation metadata shows category, approval state, confidence, source type, and timestamp.
- Hidden/admin/archived/deleted memory shows safe unavailable state.

Rollback requirement:

- Disable citations and automatic retrieval while preserving manual search.

Risk level: Medium.

### PM-013 Automatic Retrieval in Chat

Goal: Enable approved memory recall inside chat after manual memory flows are stable.

Dependencies:

- PM-005.
- PM-008.
- PM-011.
- PM-012.
- Full security QA pass.

Acceptance criteria:

- Only approved/verified, non-archived, non-rejected, current-project memory auto-loads.
- Admin-only memory loads only in admin-validated contexts.
- Prompt/context assembly uses safe summaries only.
- Retrieval event records result count and correlation ID.
- Feature flag can disable automatic retrieval instantly.

Rollback requirement:

- Disable automatic retrieval first on any suspected memory safety issue.

Risk level: High.

### PM-014 Memory Events API and Diagnostics

Goal: Implement safe event visibility for users/admins.

Dependencies:

- PM-011.
- PM-002.

Acceptance criteria:

- Users can see permitted project event metadata where UX exposes it.
- Admin diagnostics require admin validation.
- Events contain safe metadata only.
- Pagination and filters are bounded.

Rollback requirement:

- Disable diagnostics gate without affecting core memory data.

Risk level: Medium.

### PM-015 E2E Memory QA

Goal: Add complete test coverage for memory boundaries and user flows.

Dependencies:

- PM-004 through PM-014 as relevant.

Acceptance criteria:

- Non-credentialed tests cover auth redirects and safe `401`.
- Credentialed tests cover create, approve, archive, reject, search, and logout.
- Admin/non-admin tests prove isolation.
- Redaction tests prove secret-like content is not persisted.
- Production smoke checklist is ready.

Rollback requirement:

- Feature remains gated until tests pass.

Risk level: High.

### PM-016 Production Rollout

Goal: Roll out Project Memory safely by stage.

Dependencies:

- PM-001 through PM-015.
- Release approval.

Acceptance criteria:

- Stage 1 read-only/disabled checks pass.
- Stage 2 manual memory checks pass.
- Stage 3 retrieval checks pass.
- Stage 4 production smoke passes.
- Rollback gates are verified.

Rollback requirement:

- Disable retrieval, then writes, then UI as severity requires.

Risk level: High.

## 4. Acceptance Gates

Release blockers:

- RLS verified for owner, project, admin, archive, rejected, and event visibility.
- Secret scanning verified for JWT/API key/password/auth-header-like content.
- Cross-project isolation verified.
- Cross-user isolation verified.
- Admin isolation verified.
- Retrieval ranking verified.
- Archived and rejected memory exclusion verified.
- Memory poisoning prevention verified.
- Hallucinated memory approval controls verified.
- Observability verified with correlation IDs and redacted logs.
- E2E auth/logout/protected-route behavior verified.
- Production smoke checklist approved.
- Rollback gates tested before production retrieval is enabled.

## 5. Rollout Stages

### Stage 1 - Write Disabled

Goal: Deploy infrastructure and read-only category/search scaffolding with writes and automatic retrieval disabled.

Allowed:

- Feature flags present.
- Categories visible where permitted.
- Disabled state UI verified.
- Safe `401`/`403` boundaries verified.

Blocked:

- New memory writes.
- Approval/archive/reject mutations.
- Automatic retrieval.

### Stage 2 - Manual Memory Only

Goal: Enable explicit user-confirmed memory creation and manual review.

Allowed:

- Remember Decision creates draft memory.
- Manual approval.
- Manual search.
- Archive/reject controls.

Blocked:

- Automatic chat retrieval.
- Cross-project retrieval.
- Admin diagnostics for non-admin users.

### Stage 3 - Retrieval Enabled

Goal: Enable automatic retrieval in chat after safety and QA pass.

Allowed:

- Approved/verified memory recall.
- Memory citations.
- Retrieval events.

Blocked:

- Draft/rejected/archived automatic recall.
- Raw transcript/source/upload recall.
- Admin-only recall outside admin-validated contexts.

### Stage 4 - Production Rollout

Goal: Turn on Project Memory for production with staged monitoring and rollback readiness.

Required:

- Production smoke pass.
- No visible secrets in console/network.
- Correlation IDs present on relevant memory responses/events.
- Admin/non-admin isolation verified.
- Rollback switch verified.

## 6. Risk Register

### Memory Poisoning

Risk: User or uploaded content attempts to alter memory policy or persist malicious instructions.

Mitigation:

- Treat source content as untrusted.
- Require approval for durable memory.
- Run poisoning checks before storage.
- Keep unsupported AI claims as draft.

### Leakage

Risk: Memory leaks across projects, users, or admin/non-admin boundaries.

Mitigation:

- RLS on every project-specific table.
- Project-scoped API validation.
- Admin validation before admin-only memory.
- RLS and E2E denial tests.

### Ranking Issues

Risk: Retrieval surfaces stale, low-confidence, or irrelevant memory.

Mitigation:

- Weight approval, confidence, recency, project relevance, and category.
- Exclude archived/rejected memory.
- Show citations and explainability.
- Allow users to reject/archive incorrect memory.

### Archive Failures

Risk: Archived memory continues to auto-load or appears without explicit search.

Mitigation:

- Archive exclusion in retrieval layer.
- RLS/query tests for archive filters.
- E2E archive auto-load prevention.

### Hallucinated Memory

Risk: AI-generated guesses become durable facts.

Mitigation:

- Draft-by-default for AI-only claims.
- Source metadata required.
- Explicit user approval for canonical memory.
- Verified state reserved for trusted evidence.

## 7. Rollback Criteria

Immediate rollback triggers:

- Any cross-project memory exposure.
- Any cross-user memory exposure.
- Any admin-only memory visible to non-admin users.
- Any secret-like value stored, logged, returned, cited, or retrievable.
- Archived or rejected memory auto-loads.
- Automatic retrieval uses raw uploaded content, full source files, or full transcripts.
- Correlation/audit logging exposes sensitive data.

Rollback order:

1. Disable automatic retrieval.
2. Disable memory writes.
3. Hide memory UI if exposure is user-facing.
4. Keep data protected behind RLS.
5. Preserve redacted correlation logs for diagnosis.
6. Apply migration rollback only after explicit review.

## 8. Capacity Estimate

Overall effort: Large.

Workstream estimates:

- WS1 Database and RLS: Medium-large.
- WS2 API layer: Medium.
- WS3 Retrieval engine: Medium-large.
- WS4 Memory safety pipeline: Large.
- WS5 UI surfaces: Medium-large.
- WS6 Observability and audit: Medium.
- WS7 QA and E2E: Large.

Recommended delivery shape:

- Split across multiple PRs.
- Keep feature disabled by default until WS1 through WS7 gates pass.
- Do not combine migration, retrieval, and UI rollout into one release.

## 9. Future Compatibility Validation

### Context Recall

Compatible if:

- Approved memory summaries are safe and project-scoped.
- Retrieval events track why memory was used.
- Draft and rejected memory stay out of automatic recall.

### Project Intelligence

Compatible if:

- Repository summaries can become verified or approved memory.
- Project health and risk summaries cite memory sources.
- Inferred facts remain clearly labeled until verified.

### Repository Understanding

Compatible if:

- Repository knowledge stores safe summaries, not full source files.
- Future repository scans link to memory through safe source references.
- Cross-project repository recall remains disabled by default.

## Recommended Phase 33 Preparation

Phase 33 should create a pre-implementation review checklist and decision log, documentation-only. It should confirm which tickets are approved for the first implementation PR, which remain blocked, and which production gates must be met before enabling writes or retrieval.
