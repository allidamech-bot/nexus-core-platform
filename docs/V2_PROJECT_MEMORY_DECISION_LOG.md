# Nexus Core v2.1 Project Memory Pre-Implementation Decision Log

This document is the final approval gate before Project Memory implementation begins. It is documentation-only and does not authorize code changes, migrations, schema changes, dependency changes, or auth behavior changes by itself.

## 1. Approved Implementation Scope

First implementation wave scope is intentionally narrow. It may prepare the database and authorization foundation only after explicit implementation approval.

| Ticket | Status | Decision |
| --- | --- | --- |
| PM-001 Memory Schema Migration | APPROVED | Approved for first implementation wave after final migration review. |
| PM-002 Memory RLS Policies | APPROVED | Approved for first implementation wave; must ship with PM-001 or block PM-001 from release. |
| PM-003 Memory Category Contract | APPROVED | Approved for first implementation wave as product-managed category metadata only. |
| PM-004 Memory Create API | BLOCKED | Blocked until PM-001 through PM-003 are merged, RLS tests pass, and safety scanner plan is implementation-ready. |
| PM-005 Memory Search API | BLOCKED | Blocked until PM-001 through PM-003 are merged and RLS denial tests pass. |
| PM-006 Memory Approval, Archive, and Reject APIs | BLOCKED | Blocked until create/search APIs and safety scanner are complete. |
| PM-007 Memory Safety Scanner | DEFERRED | Deferred to a dedicated security-focused PR before writes are enabled. |
| PM-008 Retrieval Ranking Engine | DEFERRED | Deferred until manual memory, safety, and search are stable. |
| PM-009 Project Memory Panel | DEFERRED | Deferred until read/write API contracts are implemented behind feature flags. |
| PM-010 Remember Decision Flow | DEFERRED | Deferred until panel, create API, and safety scanner pass QA. |
| PM-011 Correlation and Memory Audit Integration | DEFERRED | Deferred to observability PR before production rollout. |
| PM-012 Memory Citations | DEFERRED | Deferred until retrieval ranking is approved. |
| PM-013 Automatic Retrieval in Chat | BLOCKED | Blocked until security verification, archive/reject exclusion, RLS, and production smoke pass. |
| PM-014 Memory Events API and Diagnostics | DEFERRED | Deferred until audit event shape is proven safe. |
| PM-015 E2E Memory QA | DEFERRED | Deferred as an expanding test suite across all implementation PRs. |
| PM-016 Production Rollout | BLOCKED | Blocked until all release blockers pass. |

Approved first wave:

- PM-001 Memory Schema Migration.
- PM-002 Memory RLS Policies.
- PM-003 Memory Category Contract.

First wave boundaries:

- No memory writes exposed to users.
- No automatic retrieval.
- No chat integration.
- No admin diagnostics UI.
- No cross-project memory behavior.
- Feature flags must keep memory unavailable until later gates pass.

## 2. Blocked Items

### Automatic Retrieval

Status: BLOCKED.

Reason:

- Automatic retrieval can alter AI responses and create leakage risk if RLS, safety scanning, archive exclusion, rejected exclusion, and citation controls are not proven first.

Unblock conditions:

- RLS verified.
- Secret scanning verified.
- Archive and rejected memory never auto-load.
- Admin/non-admin isolation verified.
- Production smoke passed.

### Ranking Optimization

Status: DEFERRED.

Reason:

- Ranking is useful only after safe search and approved memory exist. Premature optimization could mask safety defects or over-rank stale memory.

Unblock conditions:

- Search API is stable.
- Manual memory approval is stable.
- Ranking explainability is testable.

### Advanced Diagnostics

Status: DEFERRED.

Reason:

- Diagnostics can accidentally expose sensitive metadata if implemented before audit boundaries are proven.

Unblock conditions:

- Audit event shape reviewed.
- Admin-only visibility tested.
- Redacted logs verified.

### Collaboration Memory

Status: BLOCKED.

Reason:

- Team/workspace sharing requires a separate permission model. v2.1 preserves single-project/user isolation.

Unblock conditions:

- Collaboration and team workspace permission model is designed and approved.

### Memory Citations and Chat Recall

Status: DEFERRED/BLOCKED.

Reason:

- Citations depend on safe retrieval, ranking, and permission-checked detail views.
- Chat recall depends on full security verification.

Unblock conditions:

- Retrieval ranking complete.
- Citation opening validates auth/project/admin state.
- Prompt assembly uses safe summaries only.

## 3. PR Sequencing Plan

### PR1 - Migration and RLS Only

Scope:

- PM-001.
- PM-002.
- PM-003 if category storage is part of the schema foundation.

Requirements:

- Feature disabled by default.
- No user-facing memory UI.
- No public write/search behavior.
- RLS denial tests included.
- Rollback plan included.

### PR2 - API Layer

Scope:

- PM-004.
- PM-005.
- PM-006.
- GET categories endpoint if not included in PR1.

Requirements:

- Protected endpoints only.
- Safe error model.
- Project and admin authorization checks.
- Writes still feature-gated.

### PR3 - Safety Pipeline

Scope:

- PM-007.

Requirements:

- Secret scanning.
- Redaction.
- Duplicate detection.
- Hallucination/poisoning controls.
- Unit and integration tests for blocked sensitive content.

### PR4 - UI Panel

Scope:

- PM-009.
- PM-010.

Requirements:

- Project Memory panel.
- Remember Decision preview.
- Manual approve/archive/reject controls where permitted.
- No automatic retrieval.

### PR5 - Retrieval

Scope:

- PM-008.
- PM-012.
- PM-013 only after explicit approval.

Requirements:

- Manual retrieval first.
- Citation display.
- Automatic retrieval gated separately and disabled by default.
- Archive/rejected/admin boundaries tested.

### PR6 - Observability and QA

Scope:

- PM-011.
- PM-014.
- PM-015.
- PM-016 readiness work.

Requirements:

- Correlation IDs.
- Safe audit/retrieval events.
- Admin diagnostics only after validation.
- E2E/security/production smoke coverage.

## 4. Release Blockers Checklist

Project Memory cannot be released beyond disabled/read-only foundation until all applicable blockers are cleared:

- RLS verified.
- Cross-project isolation verified.
- Cross-user isolation verified.
- Secret scanning verified.
- Admin isolation verified.
- Safe logging verified.
- Correlation IDs verified.
- Archive restrictions verified.
- Rejected memory restrictions verified.
- Memory poisoning prevention verified.
- Hallucinated memory approval controls verified.
- Protected-route behavior verified.
- Logout clears private memory UI.
- Production smoke passed.
- Rollback switches verified.

## 5. Decision Log

### Decision 1 - No Automatic Retrieval Before Security Verification

Automatic retrieval is blocked until RLS, secret scanning, admin isolation, archive/reject exclusion, citation safety, and production smoke pass.

### Decision 2 - Archive Memory Never Auto-Loads

Archived memory is historical context only. It can appear only through explicit archive search and must remain excluded from chat auto-recall.

### Decision 3 - Rejected Memory Is Excluded

Rejected memory must not appear in normal search, citations, or automatic retrieval. Only safe metadata may remain for duplicate suppression or abuse prevention.

### Decision 4 - Secrets Never Persist

Secrets, JWTs, API keys, passwords, auth headers, cookies, sessions, service-role keys, private env values, raw logs, raw uploaded content, full transcripts, and full source files must not be stored as memory.

### Decision 5 - First Wave Is Database/RLS Foundation Only

The first implementation wave may include schema, RLS, and category foundation only. It must not expose memory write, search, retrieval, or UI behavior to users.

### Decision 6 - Feature Flags Are Required

Memory UI, writes, approval, search, automatic retrieval, archive search, and diagnostics must be independently disableable.

### Decision 7 - Admin Memory Requires Admin Validation

Admin-only memory and diagnostics must never render before existing admin validation succeeds.

## 6. First Implementation Approval Matrix

| Ticket | Risk | Dependencies | Rollback Ready | Approval Status |
| --- | --- | --- | --- | --- |
| PM-001 | High | Data model, RLS plan, rollback plan | Partial; final migration rollback required | APPROVED |
| PM-002 | High | PM-001, project ownership checks, admin validation | Partial; policy rollback required | APPROVED |
| PM-003 | Medium | PM-001, PM-002, category contract | Yes; feature gate can hide categories | APPROVED |
| PM-004 | High | PM-001, PM-002, PM-003, PM-007 | No; safety scanner not implemented | BLOCKED |
| PM-005 | High | PM-001, PM-002, PM-003 | No; read/search authorization not proven | BLOCKED |
| PM-006 | High | PM-004, PM-007 | No; state transitions not proven | BLOCKED |
| PM-007 | High | Safety spec | Yes for writes; disable write gate | DEFERRED |
| PM-008 | Medium-high | PM-005, PM-007, PM-011 | Yes; disable automatic retrieval | DEFERRED |
| PM-009 | Medium | PM-003 through PM-006 | Yes; hide UI gate | DEFERRED |
| PM-010 | Medium-high | PM-004, PM-007, PM-009 | Yes; disable action gate | DEFERRED |
| PM-011 | Medium | API events, correlation baseline | Partial; reduce diagnostics verbosity | DEFERRED |
| PM-012 | Medium | PM-005, PM-008, PM-009, PM-011 | Yes; disable citations/retrieval | DEFERRED |
| PM-013 | High | Full security QA | Yes; disable retrieval first | BLOCKED |
| PM-014 | Medium | PM-011, PM-002 | Yes; disable diagnostics gate | DEFERRED |
| PM-015 | High | Implementation PRs | Not applicable; gate remains closed | DEFERRED |
| PM-016 | High | All tickets and release approval | Yes; staged rollback required | BLOCKED |

## 7. Rollback Readiness Confirmation

### Feature Flags

Required before any production exposure:

- Memory API enabled.
- Memory UI enabled.
- Memory read/search enabled.
- Memory write enabled.
- Memory approval enabled.
- Automatic retrieval enabled.
- Memory diagnostics enabled.

### Write Disable

Writes must be disableable independently of reads. If safety scanner, RLS, or API validation fails, memory writes should return a safe disabled/forbidden response.

### Retrieval Disable

Automatic retrieval must be disableable instantly. Manual search may remain available only if RLS and response redaction are verified.

### Audit Visibility

Audit and retrieval events must remain redacted. If diagnostics expose too much metadata, diagnostics should be disabled while preserving minimal correlation IDs for server-side debugging.

### Rollback Ownership

Rollback ownership should be assigned before PR1 merges:

- Database/RLS rollback owner.
- API feature flag owner.
- UI feature flag owner.
- Observability owner.
- Production smoke owner.

No production rollout should proceed without named owners.

## 8. Go / No-Go

### Conditions Required Before First Migration PR

GO requires:

- Final review of `docs/V2_PROJECT_MEMORY_DATA_MODEL.md`.
- Final review of `docs/V2_PROJECT_MEMORY_RLS_PLAN.md`.
- Final review of this decision log.
- Explicit approval to implement PM-001 through PM-003 only.
- Rollback owner named.
- Feature flag plan confirmed.
- RLS test plan confirmed.
- No product behavior changes bundled into PR1.

NO-GO if:

- RLS ownership model is uncertain.
- Rollback path is not reviewed.
- Feature flags are missing.
- First PR includes APIs, UI, or retrieval.
- Any schema field would store raw secrets, raw uploads, full transcripts, or full source files.
- Admin validation path is unclear.

Current outcome:

- NO-GO for broad Project Memory implementation.
- CONDITIONAL GO for PR1 only after explicit implementation approval and final migration/RLS review.

## Recommended Phase 34 Preparation

Phase 34 should be the first implementation approval checkpoint. It should either approve PR1 scope only or keep Project Memory fully in planning mode. If approved, PR1 must remain migration/RLS/category foundation only with all memory behavior disabled by default.
