# Nexus Core v2.1 Project Memory Migration and RLS Design Review

This document defines the proposed database authorization and rollout strategy for the Nexus Core Project Memory Layer before implementation begins. It is documentation-only and does not authorize SQL migrations, schema application, code changes, dependency changes, or auth behavior changes.

## 1. Proposed Table Strategy

The Project Memory tables should follow the existing production baseline: authenticated access, project ownership, admin isolation, safe logging, and correlation traceability.

### memory_entries

Responsibility:

- Store safe memory summaries, approval state, confidence, category, visibility, retention state, and source metadata.
- Serve as the canonical active memory table for retrieval.

Ownership model:

- Each entry belongs to one project.
- Each entry has a creator user.
- Entries may have user, project, admin, or future team visibility.

Project linkage:

- Required project linkage for every memory entry.
- Retrieval should default to the current project only.

User linkage:

- `created_by` records the authenticated user who created or approved the memory.
- Future ownership transfer or team sharing requires separate permission design.

Archival behavior:

- Active entries with `archived_at` are excluded from automatic retrieval.
- Rejected entries are excluded from all normal retrieval.
- Deleted content must not remain retrievable through active or archive paths.

### memory_categories

Responsibility:

- Define allowed memory categories and default retrieval/approval behavior.
- Provide stable product-level category configuration.

Ownership model:

- Categories should be product-managed by default.
- Project-level custom categories should not ship until permission behavior is reviewed.

Project linkage:

- Global categories do not require project linkage.
- Future project-specific categories must include project ownership checks.

User linkage:

- Product-managed categories do not belong to a user.
- User-created categories are a future non-goal until collaboration and permissions are designed.

Archival behavior:

- Categories should be disabled or deprecated rather than deleted while entries still reference them.

### memory_links

Responsibility:

- Link memory entries to safe source references such as threads, messages, QA findings, release notes, audit events, or file summaries.

Ownership model:

- Links inherit the stricter permission boundary of the memory entry and linked source.

Project linkage:

- Every link should include the same project boundary as the memory entry.
- Linked sources must belong to the same project unless a future permission model explicitly allows cross-project links.

User linkage:

- `created_by` records the user or trusted system actor that created the link.

Archival behavior:

- Links to archived memory remain hidden from automatic retrieval.
- Links to deleted or inaccessible sources should be hidden or reduced to safe metadata.

### memory_feedback

Responsibility:

- Store safe user feedback such as helpful, stale, incorrect, unsafe, duplicate, approved, rejected, or edited.

Ownership model:

- Feedback belongs to a memory entry and acting user.
- Feedback visibility follows memory visibility.

Project linkage:

- Feedback should include project linkage for RLS and audit filtering.

User linkage:

- Feedback must record the acting authenticated user.

Archival behavior:

- Feedback can remain as safe metadata for ranking quality and abuse prevention.
- Feedback must not preserve rejected sensitive content.

### memory_retrieval_events

Responsibility:

- Record safe metadata for memory search, auto-load, citation, exclusion, and retrieval errors.

Ownership model:

- Retrieval events are scoped to the requesting user, project, route/API area, and correlation ID.

Project linkage:

- Required for all project memory retrieval events.

User linkage:

- Required for authenticated memory retrieval.
- Unauthenticated memory attempts should store only safe boundary metadata if logged at all.

Archival behavior:

- Retrieval events do not archive memory content.
- They may reference archived memory IDs only when explicit archive search occurred.

### memory_archives

Responsibility:

- Preserve safe historical state when memory is archived, superseded, rejected, or policy-blocked.

Ownership model:

- Archive rows inherit the original memory entry's project and visibility boundaries.

Project linkage:

- Required for every archive record.

User linkage:

- `archived_by` records the acting user or trusted system actor.

Archival behavior:

- Archive rows are excluded from automatic retrieval.
- Archive search requires explicit user action and authorization.
- Archive rows must not retain unsafe raw content.

## 2. RLS Policy Design

### Authenticated Owner Access

Intended behavior:

- Authenticated users may access memory for projects they own or are permitted to access.
- Access must be checked through project ownership or future approved membership rules.
- Users cannot read, write, update, archive, approve, or reject memory outside their project boundary.

### Project-Scoped Access

Intended behavior:

- All memory tables with project-specific data must enforce project linkage.
- Queries must filter by current project.
- Project scope must apply to active memory, links, feedback, retrieval events, and archives.

### Admin and Operator Access

Intended behavior:

- Admin/operator access must require the existing admin validation path.
- Admin-only memory, admin feedback, admin retrieval events, governance notes, and operator diagnostics must not render before validation.
- Admin access should remain read-focused unless an admin action is explicitly part of the approved workflow.

### Archived Memory Restrictions

Intended behavior:

- Archived memory is not eligible for automatic retrieval.
- Archive search requires explicit UI/API intent.
- Archived memory follows the same project and role boundaries as active memory.
- Restore from archive should require approval-level permission.

### Rejected Memory Restrictions

Intended behavior:

- Rejected memory is excluded from automatic retrieval and normal search.
- Rejected memory can retain only safe metadata for duplicate suppression and abuse prevention.
- Rejected sensitive content must not be recoverable.

### Retrieval Event Visibility

Intended behavior:

- Users may see only their permitted project retrieval events where exposed by UI.
- Admins may see safe retrieval diagnostics only after admin validation.
- Retrieval events must not expose raw prompts, full memory bodies, raw uploaded content, cookies, auth headers, JWTs, or API keys.

## 3. Authorization Boundaries

### Who Can Create Memory

- Authenticated users may create draft memory inside projects they can access.
- Trusted verified workflows may create verified memory only when source and project ownership are known.
- Admin-only memory creation requires admin validation.

### Who Can Approve Memory

- Project owners or authorized users may approve normal project memory.
- Admin-only memory approval requires admin validation.
- AI-generated memory must not approve itself.

### Who Can Archive Memory

- Project owners or authorized users may archive memory they can manage.
- Admin-only memory archival requires admin validation.
- Archive action must not delete audit metadata needed for safety.

### Who Can Reject Memory

- Project owners or authorized users may reject memory in their project.
- Users should be able to reject AI-suggested memory before it becomes durable.
- Rejection must remove the item from retrieval.

### Who Can Retrieve Memory Automatically

- The AI may automatically retrieve only approved or verified, non-archived, non-rejected, safe memory for the current authenticated user and current project.
- Admin-only memory may auto-load only in admin-validated contexts.

### Who Can Search Archive

- Authenticated users may explicitly search archives for projects they can access.
- Admin-only archives require admin validation.
- Archive search must be off by default.

## 4. Cross-Project Isolation Strategy

Project Memory must prevent:

- Cross-project recall.
- Cross-user memory leakage.
- Admin memory leakage to normal users.
- Workspace crossover before team permissions exist.

Strategy:

- Require `project_id` on every project-specific memory table.
- Scope every memory query to the active project.
- Validate user access to the project before memory retrieval or mutation.
- Deny cross-project source links by default.
- Treat future collaboration/team workspace memory as a separate permission model.
- Prevent global semantic recall from bypassing relational project filters.
- Keep admin-only memory invisible until admin validation completes.

## 5. Safe Retrieval Authorization

### Automatic Retrieval Boundaries

Automatic retrieval may include only:

- Current project memory.
- Current authenticated user's permitted project scope.
- Approved or verified memory.
- Non-archived memory.
- Non-rejected memory.
- Safe summaries and metadata.

Automatic retrieval must exclude:

- Draft memory.
- Archived memory.
- Rejected memory.
- Admin-only memory in non-admin contexts.
- Cross-project memory.
- Raw uploaded contents, full source files, full transcripts, raw logs, and secrets.

### Explicit Retrieval Boundaries

Explicit retrieval may include:

- Archived memory when the user enables archive search.
- Draft memory when the user is reviewing memory candidates.
- Detailed safe context when the user opens a memory detail view.

Explicit retrieval still requires:

- Authentication.
- Project authorization.
- Admin validation for admin-only memory.
- Redaction and response boundaries.

### Audit Requirements

Retrieval operations should create safe audit or retrieval metadata for:

- Auto-load.
- Search.
- Citation open.
- Archive search.
- Unauthorized access attempts.
- Safety exclusions.
- Retrieval failures.

Audit metadata must be redacted and include correlation ID where available.

### Approval Requirements

Approval is required before:

- AI-generated draft memory becomes durable approved memory.
- Long-term memory is eligible for high-priority recall.
- Admin/operator memory becomes visible in admin workflows.
- Memory derived from repository summaries is treated as canonical.

## 6. Correlation and Audit Integration

### correlationId Persistence

Memory write, update, approve, archive, reject, retrieve, and failure paths should persist the active `correlationId` where available.

Expected safe locations:

- Memory entry creation/update metadata.
- Memory link creation metadata.
- Feedback metadata.
- Retrieval event metadata.
- Archive metadata.
- Redacted server logs.

### Retrieval Audit Visibility

Normal users may see only safe retrieval metadata for their project where product UX exposes it.

Admins/operators may see broader diagnostics only after admin validation.

No retrieval audit view should expose:

- Raw prompts.
- Raw memory detailed context.
- Raw uploaded contents.
- Cookies, sessions, JWTs, auth headers, API keys, service-role keys, or private env values.

### Redacted Audit Traces

Safe trace metadata may include:

- `correlationId`
- action type
- project ID
- safe memory ID
- category
- approval state
- redaction state
- result count
- exclusion reason
- latency

### Operator Diagnostics Boundaries

Operator diagnostics should answer:

- Which memory area failed.
- Which project/action was involved.
- Whether the failure was auth, RLS, redaction, ranking, archive, or validation.
- Which correlation ID links logs and events.

Operator diagnostics must not expose protected content or weaken user/admin isolation.

## 7. Rollback Strategy

### Safe Disable Plan

Project Memory should be guarded by a feature flag or equivalent release gate.

Disable behavior:

- Hide memory UI surfaces.
- Stop automatic retrieval.
- Block new memory writes.
- Keep existing memory inaccessible to AI recall.
- Preserve protected data and audit metadata.

### Archive Fallback

If memory quality or safety is questionable:

- Disable automatic retrieval.
- Move affected memory to archived or needs-review state through an approved process.
- Keep archive search explicit and permission-checked.
- Avoid deleting content unless required by deletion policy.

### Feature Flag Strategy

Recommended gates:

- Memory UI enabled.
- Memory write enabled.
- Memory approval enabled.
- Automatic retrieval enabled.
- Archive search enabled.
- Admin diagnostics enabled.

Each gate should be independently disableable for production rollback.

### Migration Rollback Expectations

Because this document does not apply migrations, rollback is conceptual only.

Future migration rollback should define:

- How to stop writes before rollback.
- How to preserve or export safe data if needed.
- How to remove retrieval paths before table removal.
- How to validate RLS remains restrictive during rollback.

### Observability Rollback Expectations

If memory observability causes noise or risk:

- Keep correlation IDs.
- Reduce retrieval event verbosity.
- Preserve redaction.
- Disable nonessential memory diagnostics.
- Ensure logs remain secret-free.

## 8. Security Review Checklist

Before implementation:

- RLS review confirms project ownership checks on every memory table.
- RLS review confirms admin-only memory is inaccessible to non-admin users.
- Secret scanning review confirms JWT/API key/password/auth-header detection.
- Redaction review confirms blocked values are not echoed, logged, stored, cited, or retrievable.
- Admin isolation review confirms admin memory and diagnostics do not render before validation.
- Auth isolation review confirms logged-out users receive redirects or safe `401` responses.
- Poisoning prevention review confirms uploaded/user content cannot override memory policy.
- Archive protection review confirms archived memory does not auto-load.
- Rejected memory review confirms rejected memory does not auto-load or appear in normal search.
- Correlation review confirms safe traceability without sensitive payloads.
- Production smoke plan confirms no destructive data tests.

## 9. Implementation Sequencing

Recommended order:

1. Migrations proposal.
   Draft table shapes separately and review before applying.

2. RLS policy proposal.
   Review ownership, project scope, admin scope, archive scope, and retrieval event visibility.

3. APIs.
   Implement protected memory create, approve, archive, reject, search, and citation lookup endpoints after RLS review.

4. UI.
   Add Memory Panel, Summary Card, Remember Decision, citations, search, archive, and rejection flows behind a feature gate.

5. Retrieval layer.
   Add ranking and automatic retrieval only after create/search/approval paths are stable.

6. Observability.
   Add correlation IDs, retrieval events, redacted logs, and operator diagnostics.

7. E2E.
   Add non-credentialed, credentialed, admin/non-admin, archive, rejection, and redaction boundary tests.

8. Production rollout.
   Roll out with memory UI and writes before automatic retrieval.
   Enable automatic retrieval only after production smoke and security QA pass.

## 10. Explicit Non-Goals

Project Memory v2.1 RLS planning does not include:

- Unrestricted AI memory.
- Autonomous memory mutation.
- Raw transcript retention.
- Cross-project semantic recall.
- Hidden admin memory.
- Team or organization sharing.
- Global semantic memory across projects.
- Embeddings/vector infrastructure.
- External monitoring vendors.
- Weakening route protection, auth isolation, admin isolation, safe logging, or correlation traceability.

## Recommended Phase 31 Preparation

Phase 31 should define Project Memory API and service contracts, still documentation-only. It should describe route responsibilities, request/response boundaries, error shapes, correlation behavior, and test contracts without implementing endpoints.
