# Nexus Core v2.1 Project Memory Data Model and Retrieval Contracts

This document defines the proposed implementation contract for the Nexus Core Project Memory Layer before any migration or coding work begins. It is documentation-only and does not authorize migrations, schema changes, auth changes, dependency changes, or application code changes.

## 1. Memory Entity Model

### memory_entries

Purpose: Store safe, project-scoped memory items such as approved decisions, repository summaries, verified findings, and operator notes.

Ownership scope:

- Owned by a project.
- Created by an authenticated user.
- Visible only inside the user's permitted project boundary.
- Admin-only entries require admin validation before display.

Lifecycle:

- Starts as draft, verified, or approved depending on source and workflow.
- Can be edited, approved, archived, rejected, or deleted.
- Archived entries move out of automatic retrieval.

Retention expectations:

- Short-term entries expire or are superseded.
- Mid-term entries are reviewed before promotion.
- Long-term entries require approval or trusted verification.
- Deleted content must not remain retrievable.

### memory_categories

Purpose: Define allowed memory types and retrieval behavior for each category.

Ownership scope:

- Global system categories may be shared as product defaults.
- Project-specific category settings may be introduced later only with explicit permission checks.

Lifecycle:

- Categories are stable product configuration.
- Unsafe or deprecated categories should be disabled rather than silently reused.

Retention expectations:

- Category metadata is durable.
- Category changes must preserve old entries' meaning through versioning or labels.

### memory_links

Purpose: Connect memory entries to safe source references such as threads, messages, plans, audit events, usage events, project files, or release notes.

Ownership scope:

- Links inherit the stricter permission boundary of the memory entry and linked source.
- Cross-project links require explicit future permission design.

Lifecycle:

- Created when memory is derived from a source.
- Updated when source labels or memory status changes.
- Removed or hidden when the source is deleted or no longer accessible.

Retention expectations:

- Links may retain non-sensitive source metadata.
- Links must not preserve raw sensitive source content after deletion.

### memory_feedback

Purpose: Capture user corrections, helpfulness signals, stale markers, and rejection reasons.

Ownership scope:

- Scoped to the memory entry, project, and acting user.
- Admin feedback is not visible to non-admin users unless explicitly summarized into safe memory.

Lifecycle:

- Created when users confirm, correct, reject, or rate a memory.
- Used to adjust ranking and confidence.
- Preserved as audit-friendly metadata when content is deleted, where allowed.

Retention expectations:

- Feedback metadata may outlive the visible memory item if needed for abuse prevention.
- Feedback must not include secrets or raw private content.

### memory_retrieval_events

Purpose: Record safe metadata about memory retrieval for auditability, ranking quality, and debugging.

Ownership scope:

- Scoped to project, user, route/API area, and correlation ID.
- Admin-only retrieval events require admin visibility.

Lifecycle:

- Created when memory is searched, auto-loaded, cited, or excluded.
- Used for ranking tuning and operator debugging.

Retention expectations:

- Stores metadata only, not raw retrieved content.
- Should be retained according to usage/audit retention policy.

### memory_archives

Purpose: Preserve historical memory state when an item is archived, superseded, or moved out of active retrieval.

Ownership scope:

- Same project and permission scope as the original memory entry.
- Admin-only archive content remains admin-only.

Lifecycle:

- Created when memory is archived or superseded.
- Searchable only through explicit archive retrieval.
- Can be deleted according to user deletion policy.

Retention expectations:

- Archived items are excluded from automatic retrieval.
- Archives preserve enough context to explain historical decisions without exposing unsafe raw content.

## 2. Proposed Field Structure

These fields are a contract proposal only. They are not SQL and must not be treated as a migration.

### memory_entries

- `id`: Stable memory identifier.
- `project_id`: Project ownership boundary.
- `created_by`: Authenticated user who created or approved the item.
- `category`: Category key such as project_fact, repository_knowledge, architecture_decision, approved_plan, ai_finding, or operator_note.
- `title`: Short display label.
- `summary`: Safe memory summary intended for UI and retrieval.
- `detailed_context`: Optional longer safe context; never raw secrets, auth material, full source files, full transcripts, or raw uploaded content.
- `source_type`: Origin such as user_action, chat_decision, qa_result, repository_scan_summary, audit_event, or operator_note.
- `source_ref`: Safe source pointer or opaque reference.
- `confidence_score`: Numeric confidence estimate.
- `approval_state`: draft, verified, approved, archived, or rejected.
- `retrieval_priority`: Manual or computed priority for recall.
- `scope_visibility`: user, project, admin, or future team.
- `redaction_state`: clean, redacted, blocked, or needs_review.
- `created_at`: Creation timestamp.
- `updated_at`: Last update timestamp.
- `approved_at`: Approval timestamp when applicable.
- `archived_at`: Archive timestamp when applicable.
- `expires_at`: Optional expiration for short-term or mid-term memories.
- `correlation_id`: Safe trace ID associated with the creation/update event.

### memory_categories

- `id`: Stable category identifier.
- `key`: Category key used by APIs.
- `name`: Human-readable display name.
- `description`: Category purpose and boundaries.
- `auto_retrievable`: Whether approved memories in the category may auto-load.
- `requires_approval`: Whether durable entries require user approval.
- `default_retention`: short_term, mid_term, long_term, or archive.
- `admin_only`: Whether category is limited to admin contexts.
- `created_at`: Creation timestamp.
- `updated_at`: Last update timestamp.

### memory_links

- `id`: Stable link identifier.
- `memory_entry_id`: Linked memory entry.
- `project_id`: Project boundary for authorization checks.
- `linked_type`: thread, message, plan, file_summary, audit_event, usage_event, release_note, or operator_note.
- `linked_ref`: Opaque or safe source reference.
- `link_summary`: Safe explanation of why the link exists.
- `created_by`: User or system actor that created the link.
- `created_at`: Creation timestamp.
- `correlation_id`: Safe trace ID for link creation.

### memory_feedback

- `id`: Stable feedback identifier.
- `memory_entry_id`: Target memory entry.
- `project_id`: Project boundary.
- `user_id`: Acting user.
- `feedback_type`: helpful, stale, incorrect, unsafe, duplicate, approved, rejected, or edited.
- `feedback_summary`: Safe short explanation.
- `created_at`: Feedback timestamp.
- `correlation_id`: Safe trace ID for the feedback event.

### memory_retrieval_events

- `id`: Stable retrieval event identifier.
- `project_id`: Project boundary.
- `user_id`: Requesting user.
- `route_area`: UI or API area such as chat, memory_panel, admin, search, or planning.
- `query_summary`: Redacted search/query summary, never raw prompts or secrets.
- `result_count`: Number of candidate memories returned.
- `used_memory_ids`: List of memory IDs used or cited, where safe.
- `excluded_reason`: Optional safe reason when memory was excluded.
- `latency_ms`: Retrieval latency for performance debugging.
- `created_at`: Event timestamp.
- `correlation_id`: Safe trace ID shared with the request.

### memory_archives

- `id`: Stable archive identifier.
- `memory_entry_id`: Original memory entry.
- `project_id`: Project boundary.
- `archive_reason`: superseded, stale, rejected, user_archived, policy_blocked, or deleted_by_user.
- `archived_summary`: Safe historical summary.
- `archived_by`: Acting user or system actor.
- `archived_at`: Archive timestamp.
- `correlation_id`: Safe trace ID for the archive event.

## 3. Approval Workflow

### Draft Memory

Draft memory is proposed but not durable truth. It may be created from AI suggestions, chat context, repository summaries, or operator notes.

Rules:

- Not auto-loaded by default.
- Must show source and confidence.
- Must be editable, approvable, rejectable, or discardable.

### Verified Memory

Verified memory is supported by tooling, tests, production smoke, or a trusted system event.

Rules:

- May be retrieved automatically if category and visibility allow it.
- Still should show source and timestamp.
- Can be promoted to approved memory by user action.

### Approved Memory

Approved memory is user-confirmed or operator-confirmed durable project knowledge.

Rules:

- Eligible for automatic retrieval if safe.
- Preferred by ranking.
- Must remain editable, archivable, and deletable.

### Archived Memory

Archived memory is historical and no longer active.

Rules:

- Never auto-loaded.
- Searchable only with explicit archive action.
- Clearly labeled as archived in UI and citations.

### Rejected Memory

Rejected memory is a proposed or existing item the user marked incorrect, unsafe, duplicate, or obsolete.

Rules:

- Not retrievable.
- May retain safe metadata for abuse prevention and duplicate suppression.
- Must not preserve rejected sensitive content.

## 4. Retrieval API Contract Proposal

These endpoint shapes are proposals only. Final route names can change during implementation review.

### GET /memory/search

Purpose: Search safe memory items within the current project.

Auth expectations:

- Requires authenticated user.
- Validates project ownership before search.
- Admin-only memories require admin validation.

Project isolation expectations:

- Defaults to current project only.
- Cross-project search is disabled unless a future permission model explicitly allows it.

Response boundaries:

- Returns safe summaries and metadata, not raw source content.
- Includes approval state, category, confidence, archive status, and citations.
- Does not return secrets, auth material, raw logs, full uploaded files, or full transcripts.

Pagination/search expectations:

- Supports cursor or page-based pagination.
- Supports category, approval state, archive toggle, and date filters.
- Search terms are redacted in logs.

### POST /memory/remember

Purpose: Create a draft or approved memory from a user-confirmed action.

Auth expectations:

- Requires authenticated user.
- Requires current project permission.
- Admin-only category creation requires admin validation.

Project isolation expectations:

- Memory is written only to the current project.
- Linked sources must belong to the same project unless future permissions allow more.

Response boundaries:

- Returns created memory metadata and safe summary.
- Returns generic validation errors for blocked unsafe content.
- Does not echo raw rejected secret-like input.

Pagination/search expectations:

- Not paginated.
- May return duplicate candidates if the pipeline detects similar memory.

### POST /memory/archive

Purpose: Move active memory out of automatic retrieval.

Auth expectations:

- Requires authenticated user.
- Requires permission to update the target memory.
- Admin-only memory changes require admin validation.

Project isolation expectations:

- Archive action is limited to current project memory.

Response boundaries:

- Returns archive status and safe metadata.
- Does not return archived raw details beyond allowed summary.

Pagination/search expectations:

- Not paginated.

### POST /memory/approve

Purpose: Promote draft or verified memory to approved memory.

Auth expectations:

- Requires authenticated user.
- Requires project permission.
- Admin-only approval requires admin validation.

Project isolation expectations:

- Approval applies only inside the current project.

Response boundaries:

- Returns approved memory safe summary, approval timestamp, and confidence.
- Does not expose hidden sources or admin-only metadata to non-admins.

Pagination/search expectations:

- Not paginated.

## 5. Retrieval Ranking Contract

Ranking should be deterministic enough to debug and explain, while flexible enough to improve later.

Ranking inputs:

- Confidence weighting: Tool-verified and user-confirmed memories outrank inferred drafts.
- Approval weighting: Approved memories outrank verified memories; drafts and rejected memories are excluded from automatic retrieval.
- Recency weighting: Recent memories are favored unless an older memory is marked canonical.
- Project relevance: Current project memories outrank global, archived, or historical items.
- User interaction weighting: Memories repeatedly cited, corrected, or marked helpful can rank higher.
- Category weighting: Project facts, architecture decisions, and approved plans rank higher for planning; operator notes rank higher for debugging.
- Archive weighting: Archived memories rank only in explicit archive search.

Ranking outputs:

- Ordered candidate list.
- Safe explanation for why each memory was selected.
- Exclusion reasons for blocked, archived, unauthorized, or low-confidence candidates.
- Correlation ID for retrieval traceability.

## 6. Memory Safety Pipeline

### Secret Scanning

The pipeline should block or redact content resembling:

- API keys or service-role keys.
- JWTs, refresh tokens, cookies, sessions, auth headers, or bearer tokens.
- Passwords or private credential fields.
- Private env values.
- Raw provider request/response payloads.

### Redaction

Redaction should:

- Replace sensitive values with stable labels such as `[REDACTED_SECRET]`.
- Avoid logging the original content.
- Preserve enough surrounding safe context for user correction.
- Mark redaction state on the memory entry.

### Duplication Detection

Duplicate detection should:

- Compare title, summary, category, linked sources, and project scope.
- Suggest updating an existing memory instead of creating a duplicate.
- Avoid reinforcing incorrect memory through repeated AI suggestions.

### Hallucination Detection

Hallucination detection should:

- Require source metadata for factual claims.
- Mark AI-only claims as draft until verified.
- Prefer "inferred" language for repository or architecture observations that were not tool-confirmed.
- Block promotion of unsupported claims without user approval.

### Poisoning Detection

Poisoning detection should:

- Treat user-submitted or uploaded content as untrusted until summarized safely.
- Prevent instructions inside uploaded content from changing memory policy.
- Flag attempts to store secrets, cross-project claims, or unauthorized admin facts.
- Keep rejected unsafe memory out of future retrieval.

## 7. UX Contract Proposal

### Remember Decision Action

Expected behavior:

- Available on suitable chat answers, plans, QA findings, and operator notes.
- Opens a confirmation surface before storing memory.
- Shows proposed category, title, summary, source, confidence, and retention.
- Lets the user approve, edit, save as draft, or cancel.

### Memory Cards

Expected behavior:

- Show title, category, approval state, confidence, source, and last updated time.
- Clearly label draft, verified, approved, archived, and rejected states.
- Provide edit, approve, archive, delete, and view-source actions as permissions allow.

### Memory Citations

Expected behavior:

- AI responses that use durable memory should cite memory items by safe title or short label.
- Citations should show category, approval state, source type, and timestamp.
- Citations must not expose hidden admin data or raw sensitive source content.

### Memory Search UX

Expected behavior:

- Searches current project by default.
- Filters by category, approval state, archive status, date, and source.
- Hides archived memory unless the user enables archive search.
- Requires permission checks before displaying admin-only results.

### Archive UX

Expected behavior:

- Archive removes memory from active recall without deleting it.
- Archived items are visually distinct.
- Restore should require the same permission level as approval.
- Delete remains separate from archive and should explain retrieval impact.

## 8. Correlation and Observability Integration

### correlationId Propagation

Memory creation, approval, archive, retrieval, and error paths should receive and propagate the active `correlationId`.

Expected propagation points:

- Incoming memory API request.
- Memory safety pipeline.
- Memory write/update operation.
- Retrieval ranking operation.
- Retrieval audit event.
- Safe server log on failure.

### Retrieval Auditability

Retrieval events should record:

- Correlation ID.
- User and project identifiers where safe.
- Route/API area.
- Number of candidate memories.
- Number of memories used.
- Safe exclusion reasons.
- Latency.

They should not record raw prompts, full memory bodies, secrets, auth headers, or cookies.

### Memory Access Logging

Logs may include:

- `correlationId`
- `area`
- `projectId`
- safe memory IDs
- category
- approval state
- result counts
- safe error labels

Logs must never include:

- JWTs, cookies, passwords, API keys, auth headers, service-role keys, or private env values.
- Full user messages.
- Uploaded source contents.
- Full memory detailed context.
- Raw network captures.

### Safe Redacted Traces

Operator debugging should use redacted trace metadata:

- Search or write failed.
- Safety policy blocked memory.
- Unauthorized access attempt.
- Archive or approval conflict.
- Ranking returned no candidates.

User-facing errors should stay generic and include only a safe trace ID when appropriate.

## 9. Future Compatibility

### Context Recall

The contract prepares for Context Recall by separating approved summaries from raw sources, preserving retrieval events, and ranking by scope, approval, and confidence.

### Repository Intelligence

Repository Intelligence can promote safe repository summaries into memory after user approval or trusted verification, without storing full source files by default.

### AI Planning Improvements

Planning can use approved decisions, active plans, and verified findings as citations, while keeping draft AI observations separate from durable truth.

### Collaborative Memory

Future collaboration requires explicit team/workspace permissions. The current contract should not assume cross-user memory sharing.

### Team Workspaces

Team workspaces should add permission layers without weakening current project/user isolation. Shared memories must include visibility, ownership, source, and audit metadata.

## 10. Explicit Non-Goals

Project Memory v2.1 should not include:

- Autonomous execution memory.
- Unrestricted raw transcript persistence.
- Secret retention.
- Cross-project automatic recall.
- Raw uploaded archive retention beyond approved policy.
- Full repository source persistence.
- Admin memory visible to non-admin users.
- Organization/team sharing before a permission model exists.
- Embeddings or vector infrastructure unless separately approved.
- External monitoring vendors.
- Any behavior that weakens auth isolation, admin isolation, route protection, safe logging, or correlation traceability.

## Recommended Implementation Readiness Order

1. Approve this data model and retrieval contract.
2. Review proposed fields against existing project/thread/message ownership rules.
3. Draft a migration proposal separately, without applying it.
4. Draft API route specifications and authorization checks.
5. Draft UI wire contracts for Memory Panel, Remember Decision, citations, search, and archive.
6. Draft unit, integration, E2E, and security QA tests.
7. Implement only after migration, API, UX, and security plans are approved.
