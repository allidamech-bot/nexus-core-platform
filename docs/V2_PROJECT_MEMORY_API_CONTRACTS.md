# Nexus Core v2.1 Project Memory API and Service Contracts

This document defines proposed Project Memory API and service contracts before implementation begins. It is documentation-only and does not authorize code changes, migrations, schema changes, dependency changes, or auth behavior changes.

## 1. API Surface Overview

The Project Memory API should be protected, project-scoped, redacted, and correlation-aware.

Proposed endpoints:

- `GET /api/memory/search`: Search active or explicitly requested archived memory for the current project.
- `POST /api/memory/remember`: Create a draft or approved memory from a user-confirmed action.
- `POST /api/memory/approve`: Promote draft or verified memory to approved memory.
- `POST /api/memory/archive`: Move memory out of automatic retrieval.
- `POST /api/memory/reject`: Reject unsafe, incorrect, obsolete, or duplicate memory.
- `GET /api/memory/categories`: Return allowed product memory categories and retrieval rules.
- `GET /api/memory/events`: Return safe retrieval/audit event metadata where permitted.

These endpoints are contract proposals only. They must not be implemented until schema, RLS, API authorization, UX, QA, and rollback plans are approved.

## 2. Shared Request Rules

### Auth Required

- All memory endpoints require an authenticated user.
- Logged-out requests should return a safe `unauthorized` error.
- No endpoint should rely on client-provided user identity.

### projectId Required Where Applicable

- Project-specific endpoints must require `projectId`.
- The server must validate the authenticated user's access to the project.
- Cross-project search or mutation is denied by default.

### correlationId Propagation

- Each request should receive or generate a safe `correlationId`.
- The same `correlationId` should flow through service calls, memory events, audit records, and safe logs.
- Responses may include a safe `correlationId` for support/debugging.

### Safe Error Response Shape

Standard error responses should use this shape:

```json
{
  "error": {
    "code": "validation_failed",
    "message": "The request could not be processed.",
    "correlationId": "safe-trace-id"
  }
}
```

Rules:

- `message` must be generic and user-safe.
- `code` must be stable enough for tests.
- Sensitive values must not be echoed.
- Internal stack traces must not be returned.

### Pagination Limits

- Search and events endpoints should paginate.
- Default page size should be conservative.
- Maximum page size should prevent large context or data exposure.
- Cursor values should be opaque and not expose internal sensitive data.

### Response Redaction

Responses may return:

- Safe memory summaries.
- Category, approval state, confidence, timestamps, and source type.
- Safe citation metadata.
- Safe correlation IDs.

Responses must not return:

- Secrets, API keys, service-role keys, passwords, JWTs, refresh tokens, cookies, sessions, or auth headers.
- Raw uploaded contents.
- Full source files.
- Full transcripts by default.
- Raw logs, raw request bodies, provider payloads, or browser network captures.

### No Secrets in Payloads

Requests containing secret-like values should be blocked or redacted by the safety pipeline. The original secret-like value must not be stored, logged, returned, cited, or preserved in rejected memory.

## 3. Endpoint Contracts

### GET /api/memory/search

Purpose:

- Search safe memory for a project.
- Support explicit archive search when requested and authorized.
- Support future citation selection and AI retrieval.

Request query:

- `projectId`: Required.
- `query`: Optional search text.
- `category`: Optional category filter.
- `approvalState`: Optional approval-state filter.
- `includeArchived`: Optional, defaults to false.
- `includeDrafts`: Optional, defaults to false and requires review context.
- `limit`: Optional bounded page size.
- `cursor`: Optional opaque pagination cursor.

Response body:

```json
{
  "items": [
    {
      "id": "memory-id",
      "projectId": "project-id",
      "category": "architecture_decision",
      "title": "Safe memory title",
      "summary": "Safe memory summary",
      "approvalState": "approved",
      "confidenceScore": 0.94,
      "sourceType": "chat_decision",
      "updatedAt": "timestamp",
      "citationLabel": "Decision: Safe memory title"
    }
  ],
  "nextCursor": null,
  "correlationId": "safe-trace-id"
}
```

Auth boundary:

- Requires authenticated user.
- Requires project access.
- Admin-only memory requires admin validation.

RLS dependency:

- RLS must restrict memory rows to permitted project scope.
- Archived rows must be excluded unless `includeArchived` is explicitly allowed.
- Rejected rows must remain excluded from normal search.

Validation rules:

- `projectId` is required.
- `limit` must stay within the configured maximum.
- Search text is redacted in logs.

Safe errors:

- `unauthorized`
- `forbidden`
- `project_not_found`
- `validation_failed`
- `governance_unavailable`

Audit/correlation behavior:

- Record safe retrieval event with result count, filters, excluded reason where useful, and `correlationId`.
- Do not log raw query text if it may contain sensitive content.

Test expectations:

- Logged-out search returns safe `401`.
- User cannot search another project.
- Non-admin cannot retrieve admin-only memory.
- Archived memory appears only with explicit archive search.
- Rejected memory does not appear.

### POST /api/memory/remember

Purpose:

- Create draft, verified, or approved memory from an explicit user-visible flow.

Request body:

```json
{
  "projectId": "project-id",
  "category": "architecture_decision",
  "title": "Safe memory title",
  "summary": "Safe memory summary",
  "detailedContext": "Optional safe detail",
  "sourceType": "chat_decision",
  "sourceRef": "safe-source-ref",
  "approvalState": "draft"
}
```

Response body:

```json
{
  "memory": {
    "id": "memory-id",
    "projectId": "project-id",
    "category": "architecture_decision",
    "title": "Safe memory title",
    "summary": "Safe memory summary",
    "approvalState": "draft",
    "redactionState": "clean",
    "createdAt": "timestamp"
  },
  "duplicates": [],
  "correlationId": "safe-trace-id"
}
```

Auth boundary:

- Requires authenticated user.
- Requires project access.
- Admin-only category requires admin validation.

RLS dependency:

- Insert must be limited to permitted project scope.
- Linked sources must belong to the same project unless future permission rules allow more.

Validation rules:

- `projectId`, `category`, `title`, and `summary` are required.
- Content must pass memory safety checks.
- Durable `approved` state requires explicit user approval or trusted verified workflow.
- Duplicate detection should return safe duplicate candidates instead of silently creating repeated memory.

Safe errors:

- `unauthorized`
- `forbidden`
- `project_not_found`
- `secret_detected`
- `unsafe_content`
- `quota_or_limit_exceeded`
- `validation_failed`

Audit/correlation behavior:

- Record memory creation attempt, safety result, duplicate result, created memory ID, and `correlationId`.
- Never log raw rejected secret-like content.

Test expectations:

- Safe memory can be created as draft.
- Secret-like memory is blocked without echoing the secret.
- Cross-project source refs are rejected.
- Admin-only category is denied for non-admin users.

### POST /api/memory/approve

Purpose:

- Promote draft or verified memory to approved memory.

Request body:

```json
{
  "projectId": "project-id",
  "memoryId": "memory-id"
}
```

Response body:

```json
{
  "memory": {
    "id": "memory-id",
    "approvalState": "approved",
    "approvedAt": "timestamp",
    "correlationId": "safe-trace-id"
  }
}
```

Auth boundary:

- Requires authenticated user.
- Requires permission to manage memory in the project.
- Admin-only memory requires admin validation.

RLS dependency:

- Update must be limited to permitted project memory.
- Rejected memory should not be approvable without a separate review process.

Validation rules:

- Memory must exist in the current project.
- Memory must not be archived or deleted.
- Memory must not have blocked redaction state.

Safe errors:

- `unauthorized`
- `forbidden`
- `project_not_found`
- `memory_not_found`
- `memory_rejected`
- `unsafe_content`
- `validation_failed`

Audit/correlation behavior:

- Record approval action, memory ID, actor, project ID, and `correlationId`.

Test expectations:

- Draft can be approved by authorized user.
- Non-owner cannot approve another project memory.
- Non-admin cannot approve admin-only memory.
- Blocked memory cannot be approved.

### POST /api/memory/archive

Purpose:

- Remove memory from automatic retrieval while preserving safe historical context.

Request body:

```json
{
  "projectId": "project-id",
  "memoryId": "memory-id",
  "reason": "superseded"
}
```

Response body:

```json
{
  "memory": {
    "id": "memory-id",
    "approvalState": "archived",
    "archivedAt": "timestamp"
  },
  "correlationId": "safe-trace-id"
}
```

Auth boundary:

- Requires authenticated user.
- Requires permission to manage the memory.
- Admin-only memory requires admin validation.

RLS dependency:

- Archive action must be limited to current project memory.
- Archive records inherit original memory visibility.

Validation rules:

- Memory must exist and belong to the project.
- Already archived memory should be idempotent or return a safe validation error.
- Reason must be from allowed safe values.

Safe errors:

- `unauthorized`
- `forbidden`
- `project_not_found`
- `memory_not_found`
- `validation_failed`

Audit/correlation behavior:

- Record archive action, reason, memory ID, and `correlationId`.

Test expectations:

- Archived memory no longer auto-loads.
- Archived memory appears only with explicit archive search.
- Non-admin cannot archive admin-only memory.

### POST /api/memory/reject

Purpose:

- Mark memory as incorrect, unsafe, obsolete, duplicate, or otherwise not eligible for retrieval.

Request body:

```json
{
  "projectId": "project-id",
  "memoryId": "memory-id",
  "reason": "incorrect",
  "feedbackSummary": "Optional safe explanation"
}
```

Response body:

```json
{
  "memory": {
    "id": "memory-id",
    "approvalState": "rejected",
    "rejectedAt": "timestamp"
  },
  "correlationId": "safe-trace-id"
}
```

Auth boundary:

- Requires authenticated user.
- Requires permission to manage the memory.
- Admin-only memory requires admin validation.

RLS dependency:

- Reject action must be limited to current project memory.
- Rejected content must not remain visible through normal retrieval.

Validation rules:

- Reason must be from allowed safe values.
- Feedback summary must pass safety checks.
- Rejected sensitive content must not be preserved.

Safe errors:

- `unauthorized`
- `forbidden`
- `project_not_found`
- `memory_not_found`
- `secret_detected`
- `unsafe_content`
- `validation_failed`

Audit/correlation behavior:

- Record rejection reason, safe feedback metadata, memory ID, and `correlationId`.

Test expectations:

- Rejected memory does not appear in normal search.
- Rejected memory is never auto-loaded.
- Feedback containing secrets is blocked or redacted.

### GET /api/memory/categories

Purpose:

- Return safe product-managed memory categories and their retrieval/approval rules.

Request query:

- `projectId`: Optional if categories are global; required for future project-specific category behavior.

Response body:

```json
{
  "categories": [
    {
      "key": "architecture_decision",
      "name": "Architecture Decisions",
      "description": "Approved decisions with rationale and tradeoffs.",
      "autoRetrievable": true,
      "requiresApproval": true,
      "adminOnly": false
    }
  ],
  "correlationId": "safe-trace-id"
}
```

Auth boundary:

- Requires authenticated user for private app context.
- Admin-only categories should appear only after admin validation.

RLS dependency:

- Global categories may not require project RLS.
- Future project categories must enforce project scope.

Validation rules:

- Unknown category keys must not be accepted by write endpoints.

Safe errors:

- `unauthorized`
- `forbidden`
- `project_not_found`
- `governance_unavailable`

Audit/correlation behavior:

- Category reads usually need minimal logging.
- Admin-only category reads may record safe diagnostic metadata.

Test expectations:

- Authenticated user receives non-admin categories.
- Non-admin does not receive admin-only categories.
- Category keys match accepted write rules.

### GET /api/memory/events

Purpose:

- Return safe memory event metadata for user-visible history or admin diagnostics.

Request query:

- `projectId`: Required.
- `memoryId`: Optional.
- `eventType`: Optional.
- `limit`: Optional bounded page size.
- `cursor`: Optional opaque pagination cursor.

Response body:

```json
{
  "events": [
    {
      "id": "event-id",
      "memoryId": "memory-id",
      "eventType": "retrieved",
      "area": "chat",
      "createdAt": "timestamp",
      "correlationId": "safe-trace-id"
    }
  ],
  "nextCursor": null,
  "correlationId": "safe-trace-id"
}
```

Auth boundary:

- Requires authenticated user.
- Requires project access.
- Admin diagnostics require admin validation.

RLS dependency:

- Events must be scoped to permitted project and visibility.
- Admin-only events must not appear to non-admin users.

Validation rules:

- `projectId` is required.
- `limit` must stay within maximum.
- Event filters must use known safe values.

Safe errors:

- `unauthorized`
- `forbidden`
- `project_not_found`
- `validation_failed`

Audit/correlation behavior:

- Event reads may be logged minimally.
- Returned events must already be redacted.

Test expectations:

- Users see only permitted project events.
- Non-admin cannot see admin-only retrieval diagnostics.
- Events do not include raw prompts, raw memory bodies, secrets, or auth data.

## 4. Service Layer Contracts

### memoryService

Responsibilities:

- Orchestrate memory create, update, archive, reject, and lookup operations.
- Enforce project and category validation before persistence.
- Delegate safety checks and audit writes.

Inputs:

- Authenticated user context.
- Project ID.
- Memory payload or memory ID.
- Correlation ID.

Outputs:

- Safe memory DTOs.
- Stable error codes.
- Correlation ID.

Failure modes:

- Unauthorized or forbidden access.
- Project or memory not found.
- Validation failure.
- RLS/governance unavailable.

Correlation behavior:

- Accepts correlation ID from API layer and passes it to safety, approval, retrieval, and audit services.

### memoryRetrievalService

Responsibilities:

- Search, filter, rank, and return safe memory candidates.
- Enforce automatic and explicit retrieval boundaries.
- Exclude archived/rejected/unauthorized memory.

Inputs:

- Authenticated user context.
- Project ID.
- Search query or retrieval intent.
- Filters.
- Correlation ID.

Outputs:

- Ordered safe memory DTOs.
- Safe ranking/exclusion metadata.
- Pagination cursor.

Failure modes:

- Forbidden project access.
- Invalid filters.
- Governance unavailable.
- Empty result set.

Correlation behavior:

- Records safe retrieval event with same correlation ID.

### memoryApprovalService

Responsibilities:

- Validate approval, archive, reject, and restore-like transitions.
- Prevent AI self-approval.
- Enforce admin-only transition rules.

Inputs:

- Authenticated user context.
- Project ID.
- Memory ID.
- Desired transition.
- Safe reason or feedback.
- Correlation ID.

Outputs:

- Updated safe memory DTO.
- Transition metadata.

Failure modes:

- Memory not found.
- Invalid transition.
- Memory rejected.
- Unsafe content in feedback.
- Forbidden admin-only transition.

Correlation behavior:

- Emits audit metadata for transition with same correlation ID.

### memorySafetyService

Responsibilities:

- Secret scanning.
- Redaction.
- Unsafe content detection.
- Duplicate detection.
- Hallucination/unsupported-claim labeling.
- Poisoning attempt detection.

Inputs:

- Candidate title, summary, detailed context, feedback, or search query.
- Source type.
- Project ID.
- Correlation ID.

Outputs:

- Safety result: clean, redacted, blocked, or needs review.
- Redacted safe content where allowed.
- Duplicate candidate summaries.
- Safe block reason.

Failure modes:

- Secret detected.
- Unsafe content.
- Safety scanner unavailable.
- Payload too large.

Correlation behavior:

- Logs only safe safety outcome labels and correlation ID.
- Never logs raw blocked values.

### memoryAuditService

Responsibilities:

- Write safe memory events, retrieval events, transition events, and failure diagnostics.
- Preserve redaction and project/admin boundaries.

Inputs:

- Event type.
- Project ID.
- User ID.
- Memory ID where safe.
- Safe metadata.
- Correlation ID.

Outputs:

- Audit event ID or safe no-op result.

Failure modes:

- Audit unavailable.
- Validation failure.
- RLS denied.

Correlation behavior:

- Correlation ID is required for write attempts where available.
- Audit failure should not expose sensitive payloads.

## 5. Error Model

Standard error codes:

- `unauthorized`: User is not authenticated.
- `forbidden`: User lacks permission for project, admin-only memory, or action.
- `project_not_found`: Project does not exist or is not visible to the user.
- `memory_not_found`: Memory does not exist or is not visible to the user.
- `memory_rejected`: Memory is rejected and cannot be used for the requested action.
- `secret_detected`: Payload appears to contain credentials or auth material.
- `unsafe_content`: Payload violates memory safety policy.
- `quota_or_limit_exceeded`: Request exceeds configured size, count, or rate limit.
- `governance_unavailable`: Required governance/admin/project validation cannot be completed.
- `validation_failed`: Request shape or transition is invalid.

Error response requirements:

- Include stable `code`.
- Include generic safe `message`.
- Include `correlationId` when available.
- Do not include stack traces, raw payloads, secrets, or policy internals.

## 6. Security Contract

Project Memory APIs and services must preserve:

- No raw transcript persistence.
- No raw uploaded content persistence.
- No cross-project recall.
- No cross-user memory leakage.
- No admin leakage to normal users.
- No secret retention.
- No hidden AI-created canonical memory.
- Redacted logs only.
- RLS-backed project isolation.
- Admin validation before admin-only data appears.
- Correlation IDs without sensitive payloads.

## 7. Test Contract

### Unit Tests

- Safety service blocks JWT/API key/password/auth-header-like content.
- Redaction removes sensitive values before persistence.
- Approval service rejects invalid state transitions.
- Retrieval ranking excludes archived and rejected memory.
- Error mapper returns stable safe error shapes.

### Integration Tests

- Authenticated user can create draft memory in own project.
- User cannot create/search memory in another project.
- Approved memory appears in search.
- Archived memory appears only with explicit archive search.
- Rejected memory never appears in normal retrieval.
- Correlation ID flows from API to audit event.

### RLS Tests

- User cannot read another user's project memory.
- Non-admin cannot read admin-only memory.
- Non-admin cannot read admin-only events.
- Archive rows follow original memory visibility.
- Retrieval events are project-scoped.

### E2E Tests

- Logged-out memory routes redirect or return safe `401`.
- User remembers a safe decision and sees it in the panel.
- User approves a memory and sees a citation later.
- User archives memory and confirms it no longer auto-loads.
- User rejects memory and confirms it never auto-loads.
- Logout clears private memory UI.

### Production Smoke Tests

- Feature flag disabled state hides memory UI and blocks writes.
- Read-only rollout shows categories/search only where permitted.
- Safe QA memory can be created in a dedicated QA project after write rollout.
- No browser console/network secrets are visible.
- Correlation IDs are visible where expected.
- No destructive production data tests.

## 8. Rollout Contract

### Feature Flag Expectations

Recommended gates:

- Memory API enabled.
- Memory UI enabled.
- Memory read/search enabled.
- Memory write enabled.
- Memory approval enabled.
- Automatic retrieval enabled.
- Memory events/admin diagnostics enabled.

### Disabled State Behavior

When disabled:

- Memory UI is hidden.
- New writes are blocked with safe `forbidden` or feature-disabled response.
- Automatic retrieval returns no candidates.
- Existing memory remains protected and inaccessible to AI recall.
- Audit logging remains safe and low-noise.

### Read-Only Rollout

Read-only phase should allow:

- Category reads.
- Search of pre-approved safe fixtures if present.
- Event visibility testing where permitted.

Read-only phase should block:

- Remember.
- Approve.
- Archive.
- Reject.
- Automatic retrieval into chat responses unless explicitly enabled.

### Write Rollout

Write rollout should enable:

- Remember safe draft memory.
- Safety pipeline.
- Duplicate detection.
- Manual approval only after validation.

Write rollout should not enable:

- Automatic retrieval by default.
- Admin diagnostics for non-admin users.
- Cross-project search.

### Retrieval Rollout

Retrieval rollout should enable automatic recall only after:

- RLS tests pass.
- Admin/non-admin tests pass.
- Archive/reject exclusion tests pass.
- Secret detection tests pass.
- Production smoke passes.

### Rollback Behavior

Rollback should:

- Disable automatic retrieval first.
- Disable writes if safety or RLS concerns appear.
- Keep UI read-only or hidden depending on severity.
- Preserve existing data behind RLS.
- Keep correlation IDs and redacted error reporting.
- Avoid destructive data changes unless required by deletion policy.

## Recommended Phase 32 Preparation

Phase 32 should define the Project Memory implementation plan and issue breakdown, still documentation-only. It should map the approved architecture, data model, UX/QA, RLS plan, and API contracts into sequenced implementation tickets with acceptance criteria and rollback checks.
