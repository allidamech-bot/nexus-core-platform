# Nexus Core v2.1 Project Memory UX and Security QA Specification

This document defines the user experience and security QA expectations for the Nexus Core Project Memory Layer before implementation begins. It is documentation-only and does not authorize code changes, migrations, schema changes, dependency changes, or auth changes.

## 1. UX Principles

Project Memory must be user-visible.

- Users should be able to see what the system remembers about a project.
- Durable memory should not exist only as hidden AI context.
- Memory used in an AI response should be inspectable through citations or a memory panel.

Project Memory must be explainable.

- Every durable memory item should show category, source, confidence, approval state, timestamp, and project scope.
- AI responses should distinguish remembered facts from fresh inference.
- Retrieval should be explainable enough to answer "why was this memory used?"

Project Memory must be reversible.

- Users should be able to edit, archive, reject, or delete memory items as permissions allow.
- Archive should remove memory from automatic recall without deleting history.
- Rejected memory should not return to automatic recall.

Project Memory must not silently store sensitive data.

- Remembering requires user-visible confirmation or trusted verified workflow.
- Secret-like content should be blocked or redacted before storage.
- User-facing messages should explain blocked memory without echoing the sensitive value.

## 2. Main UI Surfaces

### Project Memory Panel

The Project Memory panel is the primary project-scoped surface for browsing, searching, editing, approving, archiving, rejecting, and deleting memory.

Expected behavior:

- Shows memory grouped by category.
- Shows approval state and confidence.
- Supports filtering and search.
- Hides archived memory by default.
- Enforces auth, project ownership, and admin visibility.

### Memory Summary Card

The Memory Summary Card gives a compact view of the most important active memory for a project.

Expected behavior:

- Appears in the project workspace where it supports orientation.
- Shows recent approved decisions, project facts, active plans, and verified findings.
- Links to the full Project Memory panel.
- Does not show raw private content, secrets, hidden admin notes, or rejected memory.

### Remember Decision Action

The Remember Decision action lets users explicitly promote useful project knowledge from chat, plans, QA results, or operator notes.

Expected behavior:

- Opens a preview before storage.
- Requires confirmation before creating durable approved memory.
- Allows saving as draft when the user wants later review.
- Allows cancellation or rejection.

### Memory Citations

Memory citations show when an AI response used durable project memory.

Expected behavior:

- Citations appear as short memory labels, not raw hidden payloads.
- Users can open the cited memory if they have permission.
- Citations show safe metadata such as category, approval state, source type, confidence, and timestamp.

### Memory Search

Memory Search lets users intentionally retrieve memory.

Expected behavior:

- Searches within the current project by default.
- Supports category, approval state, date, confidence, source, and archive filters.
- Requires explicit action to include archived memory.
- Does not search across projects unless future permissions allow it.

### Archive and Reject Controls

Archive and reject controls keep memory reversible and correctable.

Expected behavior:

- Archive removes memory from automatic recall.
- Reject removes incorrect, unsafe, duplicate, or obsolete memory from retrieval.
- Rejected memory should retain only safe metadata needed for duplicate suppression or abuse prevention.
- Restore from archive requires the same permission level as approval.

## 3. Remember Decision Flow

### Entry Points

The Remember Decision button may appear on:

- AI responses containing an implementation plan or architecture decision.
- Production QA findings.
- Operator notes.
- Project summary cards.
- Verified repository understanding summaries.

It should not appear on:

- Raw logs.
- Raw network captures.
- Raw uploaded file contents.
- Auth/session details.
- Messages that appear to contain secrets.

### Preview

Before storing memory, the user sees:

- Proposed title.
- Proposed category.
- Safe summary.
- Optional detailed context.
- Source type and safe source link.
- Confidence score or confidence label.
- Approval state to be created.
- Retention expectation.
- Any redaction or duplicate warning.

The preview must not expose values blocked by the safety pipeline.

### Approval Requirement

Durable long-term memory requires one of:

- Explicit user approval.
- Trusted verified event approved by product policy.
- Admin/operator approval for admin-only operational memory.

AI-generated draft memory must not silently become approved memory.

### Confirmation State

After confirmation:

- The UI shows that memory was saved.
- The saved item is visible in the Project Memory panel.
- The response or source item may show a saved-memory indicator.
- A safe audit/retrieval event may include the active `correlationId`.

### Rejection State

If the user rejects memory:

- The draft is not eligible for retrieval.
- The UI may show a short "not remembered" state.
- Safe rejection metadata may be retained to prevent repeated suggestions.
- Rejected sensitive content must not be retained.

### Audit and Correlation Behavior

Remember, approve, archive, reject, edit, delete, and retrieval events should propagate `correlationId` where available.

Safe event metadata may include:

- Memory ID.
- Project ID.
- Category.
- Approval state.
- Action type.
- Redaction state.
- Correlation ID.

Events must not include secrets, raw auth headers, JWTs, cookies, passwords, API keys, full prompts, raw uploads, or full source files.

## 4. Memory Panel Behavior

The Project Memory panel should support focused review without overwhelming the user.

Filters:

- Category: Project Facts, Repository Knowledge, Architecture Decisions, Approved Plans, AI Findings, Operator Notes.
- Approval state: draft, verified, approved, archived, rejected.
- Recency: updated today, last 7 days, last 30 days, older.
- Confidence: high, medium, low, needs review.
- Source type: chat, QA result, repository summary, operator note, audit event, usage event.
- Visibility: user, project, admin where permitted.

Search:

- Searches title and safe summary by default.
- Detailed context search requires explicit user action.
- Search query text must be redacted in logs.

Archived visibility:

- Archived memories are hidden by default.
- A clear archive toggle reveals archived memories.
- Archived memories show reason and date.
- Archived memories are not auto-loaded by AI.

Rejected visibility:

- Rejected memories are hidden by default.
- If surfaced for review, rejected content should be summarized safely.
- Rejected items must never auto-load.

## 5. Citation Display

AI memory citations should make recall trustworthy without exposing hidden data.

Citation format should include:

- Memory title or short label.
- Category.
- Approval state.
- Confidence label.
- Source type.
- Last updated date.

Opening a citation should:

- Validate auth and project ownership.
- Validate admin access for admin-only memory.
- Show the memory card or detail view.
- Show safe source metadata if available.

Citations must never show:

- Secrets, API keys, service-role keys, passwords, JWTs, refresh tokens, cookies, or auth headers.
- Raw uploaded file contents.
- Full source files.
- Full chat transcripts by default.
- Raw logs or browser network captures.
- Another user's memory.
- Admin-only memory to non-admin users.
- Cross-project memory without explicit permission.

If cited memory becomes archived, deleted, or unauthorized:

- The citation should show a safe unavailable state.
- The AI should not continue relying on the unavailable item.
- Logs should include safe metadata and correlation ID only.

## 6. Redaction UX

### Secret Detected State

When secret-like content is detected:

- The UI should show a clear warning that unsafe content cannot be stored.
- The sensitive value must not be echoed.
- The user may be offered a redacted summary if safe.
- The item should be marked blocked or needs review.

### Blocked Memory State

Blocked memory should:

- Not be saved as active memory.
- Not be retrievable.
- Not be available through citations.
- Retain only safe metadata if needed for abuse prevention.

### User-Facing Explanation

Copy should be plain and specific:

- "This memory was not saved because it appears to contain sensitive credentials."
- "Remove secrets or save a high-level summary instead."
- "The blocked value was not stored."

The explanation should not include implementation internals, raw regex results, provider payloads, or the blocked secret value.

### Admin and Operator Safe Notes

Admin/operator views may show:

- Correlation ID.
- Block reason.
- Category.
- Redaction state.
- Timestamp.
- Safe source type.

They must not show:

- Raw secret-like values.
- Raw request bodies.
- Auth headers.
- Cookies or sessions.
- Uploaded source contents.

## 7. Security QA Matrix

| Area                              | Scenario                                                        | Expected Result                                                                                     |
| --------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Secret retention prevention       | User tries to remember text containing credential-like content  | Memory is blocked or redacted; raw secret is not stored, displayed, logged, cited, or retrieved     |
| JWT detection                     | User tries to remember a JWT-like string                        | Memory is blocked; UI explains sensitive credential detection without echoing value                 |
| API key detection                 | User tries to remember an API-key-like string                   | Memory is blocked or redacted; audit logs contain only safe metadata and correlation ID             |
| Password detection                | User tries to remember a password-like field                    | Memory is blocked or requires a redacted summary; raw password is not persisted                     |
| Cross-project leakage             | User searches memory from Project A while scoped to Project B   | Project A memory is not returned unless future explicit permission model allows it                  |
| Admin memory exposed to non-admin | Non-admin opens/searches admin-only memory                      | Access denied or hidden; no admin memory card, citation, metrics, or source metadata appears        |
| Raw uploaded content persistence  | User attempts to remember raw uploaded file contents            | Raw content is not stored as memory; only approved safe summary may be saved                        |
| Hallucinated memory approval      | AI suggests unsupported project fact                            | Memory remains draft or requires explicit user approval; it is not auto-loaded as fact              |
| Poisoning attempt                 | Uploaded or user text instructs the app to ignore memory policy | Instruction is treated as untrusted content; policy is preserved; memory may be blocked             |
| Archived auto-load prevention     | Archived memory matches current query                           | Archived memory is not auto-loaded; appears only when archive search is explicitly enabled          |
| Rejected auto-load prevention     | Rejected memory matches current query                           | Rejected memory is not auto-loaded or cited                                                         |
| Correlation propagation           | Memory creation/retrieval fails                                 | User sees generic error with safe trace ID when appropriate; logs/audit include same correlation ID |
| Logout boundary                   | User logs out after viewing memory panel                        | Private memory UI clears; protected memory routes redirect to `/login`                              |
| Browser/network exposure          | Inspect console and network after memory actions                | No secrets, raw auth headers, cookies, JWTs, API keys, or raw uploaded content are visible          |

## 8. Role-Based QA

### Owner/Admin Behavior

Admin or owner users should be able to:

- View project memory they are authorized to access.
- View admin-only operational memory only after admin validation.
- Approve, archive, reject, or delete memory according to permissions.
- See safe correlation IDs for relevant memory failures.

Admin or owner users must not be able to:

- View another user's private project memory without a future permission model.
- Store secrets in memory.
- Bypass redaction or policy blocks.

### Normal User Behavior

Normal authenticated users should be able to:

- View their own project memory.
- Remember decisions in their permitted project.
- Search active memory in their permitted project.
- Archive or reject memory they are allowed to manage.

Normal authenticated users must not see:

- Admin-only memory.
- Another user's memory.
- Cross-project memory.
- Raw sensitive content.

### Logged-Out Behavior

Logged-out users should:

- Be redirected to `/login` from protected memory routes.
- Receive safe `401` responses from memory APIs.
- See no private memory cards, citations, summaries, or source metadata.

### Non-Admin Admin Boundary

Non-admin users attempting admin-only memory access should receive:

- Access denied boundary, redirect, or hidden state.
- No admin dashboard memory, checklist memory, metrics memory, or audit memory.
- No admin retrieval events exposed in UI.

## 9. E2E Test Plan

### Non-Credentialed Tests

These should run without secrets or real accounts:

- `/memory` or future memory route redirects to `/login`.
- Unauthenticated memory APIs return safe `401`.
- Public pages do not render memory UI.
- Arabic/RTL preference does not expose memory while logged out.
- Browser storage starts anonymous for public memory boundary tests.

### Credentialed Tests

These require configured test accounts:

- Authenticated user can open Project Memory panel.
- User can create draft memory from a safe Remember Decision flow.
- User can approve memory and see it in the panel.
- Approved memory appears as a citation in a later AI response when relevant.
- Archived memory does not auto-load.
- Rejected memory does not auto-load.
- Logout clears memory UI and protected routes redirect.

### Production Smoke Tests

Production smoke should remain minimal and non-destructive:

- Login manually.
- Open Project Memory panel.
- Create or use a tiny safe test memory item only in a dedicated QA project.
- Verify citation display using safe text.
- Archive or reject the QA memory.
- Confirm no console/runtime errors.
- Confirm no visible secrets in console/network.
- Confirm `x-correlation-id` or equivalent trace ID appears where expected.

### Blocked or Skipped Tests

These should be skipped unless a safe fixture and explicit approval exist:

- Real secret payload attempts in production.
- Large uploaded archive memory tests.
- Cross-user or team workspace tests before collaboration exists.
- Admin-only memory tests without a dedicated non-admin QA account.
- Destructive deletion tests against production data.

## 10. Implementation Readiness Checklist

Before coding Project Memory, all gates should be satisfied:

- Architecture doc exists: `docs/V2_PROJECT_MEMORY_ARCHITECTURE.md`.
- Data model and retrieval contract doc exists: `docs/V2_PROJECT_MEMORY_DATA_MODEL.md`.
- UX and security QA doc exists: `docs/V2_PROJECT_MEMORY_UX_QA.md`.
- Migration plan reviewed separately.
- RLS plan reviewed separately.
- API authorization plan reviewed.
- Safe logging and correlation ID plan reviewed.
- Redaction/secret scanning test plan reviewed.
- Admin/non-admin QA plan reviewed.
- Rollback plan ready.
- Production smoke checklist ready.
- No implementation begins until schema, RLS, API, UX, security, and rollback plans are approved.

## Recommended Phase 30 Preparation

Phase 30 should produce a migration and RLS design review document only. It should propose policies, rollback strategy, and QA gates without applying migrations or changing code.
