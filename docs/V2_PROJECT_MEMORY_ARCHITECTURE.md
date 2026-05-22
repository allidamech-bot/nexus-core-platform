# Nexus Core v2.1 Project Memory Layer Architecture

This document designs the v2.1 Project Memory Layer. It is documentation-only and does not approve migrations, schema changes, dependency changes, auth changes, or implementation work.

## 1. Memory Goals

Project Memory should let Nexus Core remember safe, useful project knowledge across threads and sessions. The goal is to reduce repeated context setup while preserving trust, privacy, and explicit user control.

Project Memory should remember:

- Repository understanding, such as detected frameworks, important directories, package boundaries, and likely ownership areas.
- Approved decisions, such as accepted architecture direction, scope decisions, tradeoffs, and rejected alternatives.
- Approved implementation plans, including task breakdowns, risk notes, verification plans, and rollout notes.
- Project summaries, including current status, known constraints, and major open questions.
- Verified findings, such as production QA outcomes, admin/non-admin checks, bundle findings, and release observations.
- User-approved architecture facts, such as "the official production target is Lovable" or "this project is pre-execution."

Project Memory must not remember:

- Secrets, API keys, service-role keys, passwords, JWTs, refresh tokens, Supabase sessions, cookies, or auth headers.
- Uploaded private contents beyond the approved preview/indexing policy.
- Raw sensitive logs, raw request bodies, raw provider payloads, or raw browser network captures.
- Full chat transcripts by default.
- Full source files or full uploaded archives.
- Private data from another user, project, workspace, or organization boundary.
- Unverified AI guesses presented as facts.

## 2. Memory Categories

### Project Facts

Stable facts about the project and operating environment.

Examples:

- Official production URL.
- Official deployment target.
- Current release tags.
- Supported routes and API boundaries.
- Explicitly approved product scope.

### Repository Knowledge

Summaries inferred from manifests, safe previews, and approved user input.

Examples:

- Frameworks and runtime.
- Notable route files.
- Major feature modules.
- Existing governance/auth/admin surfaces.

### Architecture Decisions

Approved decisions with rationale, tradeoffs, and status.

Examples:

- "Lovable is the official deployment target for now."
- "Do not optimize for Vercel in this phase."
- "Correlation IDs are stored in existing JSON metadata/payload fields."

### Approved Plans

User-approved implementation or release plans.

Examples:

- Phase plans.
- Safe test strategy.
- Verification commands.
- Deployment smoke steps.

### AI Findings

AI-generated observations that were validated by tooling, tests, production smoke, or user confirmation.

Examples:

- Bundle split is live.
- `x-correlation-id` is visible on chat and unauthenticated API boundaries.
- Non-admin admin-denial passed.

### Operator Notes

Operational knowledge useful for future QA and debugging.

Examples:

- Known warnings.
- Manual browser login requirements.
- Production smoke caveats.
- Safe account usage instructions.

## 3. Memory Retention Rules

### Short-Term Memory

Purpose: support the active thread/session.

Retention:

- Last active conversation context.
- Current plan.
- Recent tool/test outcomes.
- Temporary observations not yet approved.

Policy:

- Automatically expires or is superseded.
- May be used in the current session only.
- Must not be promoted to durable memory without approval or a trusted validation signal.

### Mid-Term Memory

Purpose: support ongoing phase work across related threads.

Retention:

- Current phase status.
- Recent production QA outcomes.
- Active known warnings.
- Current release/deployment assumptions.

Policy:

- May persist across sessions for the same project.
- Should include timestamp, source, and confidence.
- Should be reviewed before promotion to long-term memory.

### Long-Term Memory

Purpose: preserve stable project knowledge.

Retention:

- Approved project facts.
- Architecture decisions.
- Release baselines.
- Verified production capabilities.
- Durable operator runbook facts.

Policy:

- Requires explicit user approval or a high-confidence verified event.
- Must include category, source, timestamp, project scope, confidence, and optional correlation ID.
- Must be editable and deletable.

### Archive

Purpose: preserve historical context without loading it by default.

Retention:

- Superseded plans.
- Historical release notes.
- Past QA findings.
- Deprecated decisions.

Policy:

- Searchable by explicit user action.
- Not auto-loaded into AI context.
- Must show archived status clearly.

### Deletion Policy

Users must be able to delete memory items. Deletion should:

- Remove the memory item from future retrieval.
- Preserve only required audit metadata when needed for operational integrity.
- Avoid retaining deleted content in summaries.
- Never require schema or auth weakening.

## 4. Retrieval Boundaries

### May Retrieve Automatically

The AI may automatically retrieve small, safe memory summaries when all are true:

- The memory belongs to the current authenticated user and current project.
- The memory is not archived.
- The memory is approved or verified.
- The memory category is safe for automatic use.
- The memory does not contain secrets, raw content, or sensitive logs.

Examples:

- Current project facts.
- Approved architecture decisions.
- Recent verified production status.
- Short memory summary cards.

### Requires Explicit User Action

The AI should require explicit user action before loading:

- Archived memory.
- Larger implementation plans.
- Detailed repository knowledge.
- Historical QA reports.
- Memory from a different project.
- Unapproved AI findings.
- Sensitive operational notes that may contain project-specific risk details.

### Never Auto-Loads

The AI must never auto-load:

- Secrets or auth material.
- Raw uploaded file contents.
- Full source files.
- Full chat transcripts.
- Raw logs or browser network captures.
- Another user's memory.
- Admin-only memory into a non-admin session.
- Cross-project memory without explicit project switch and permission validation.

## 5. Privacy Model

Project Memory must respect the existing production safety baseline:

- Auth isolation: memory is scoped to the authenticated user and project ownership boundary.
- Admin isolation: admin-only memories, governance notes, audit findings, and operator data must not appear for non-admin users.
- Project ownership boundaries: memory for one project must not leak into another project unless explicitly linked by a future approved permission model.
- Safe logging: memory creation, retrieval, ranking, and errors must log only redacted metadata and correlation IDs.
- Route protection: memory UI/API surfaces must follow existing protected route and authenticated API behavior.
- Correlation IDs: memory write/retrieval failures should include `correlationId` in safe logs and audit/usage metadata where relevant.

Privacy defaults:

- Prefer summaries over raw content.
- Prefer user-approved memories over AI-generated memories.
- Prefer project-scoped memories over global user memories.
- Prefer omission over unsafe recall.

## 6. UI Surfaces

### Project Memory Panel

A project-scoped panel showing approved memories grouped by category.

Expected controls:

- View memory item.
- Edit title/summary.
- Archive.
- Delete.
- Filter by category.
- Filter by confidence/status.

### Remember Decision Action

An explicit action from a chat response or operator note.

Expected flow:

- User selects "Remember decision."
- UI shows a proposed memory summary.
- User confirms, edits, or cancels.
- Memory is stored only after confirmation.

### Memory Summary Card

A compact card on the project workspace.

Contents:

- Current project facts.
- Recent approved decisions.
- Active plans.
- Last verified production status.

### Memory Search

Search interface for explicit retrieval.

Expected behavior:

- Search within current project by default.
- Archived results hidden unless toggled.
- Admin-only memories visible only to admins.
- No raw sensitive content surfaced.

## 7. Retrieval Ranking Proposal

Memory retrieval should rank candidates using:

1. Project scope relevance.
   Current project memories outrank global or historical memories.

2. Approval status.
   User-approved and verified memories outrank AI-generated drafts.

3. Confidence.
   Tool-verified or user-confirmed memories outrank inferred memories.

4. Recency.
   Recent active decisions outrank older items unless older items are long-term canonical facts.

5. Usage frequency.
   Frequently referenced memories gain weight, with safeguards against accidental reinforcement.

6. Category priority.
   Project facts and architecture decisions outrank general operator notes for planning responses.

7. Archive status.
   Archived memory is excluded from automatic retrieval.

Ranking must include explainability: the UI should be able to show why a memory was used.

## 8. Abuse Prevention

### Memory Poisoning

Prevention:

- Require user approval for durable long-term memories.
- Store AI findings as unapproved until verified.
- Track source and confidence.
- Allow users to edit/archive/delete incorrect memories.

### Secret Persistence

Prevention:

- Run redaction checks before memory creation.
- Block memory items that resemble tokens, JWTs, keys, cookies, passwords, or auth headers.
- Never create memory from raw request bodies or raw logs.
- Prefer safe summaries over raw copied content.

### Cross-Project Leakage

Prevention:

- Scope all memories to project and user ownership.
- Require explicit user action for cross-project retrieval.
- Never retrieve admin memory in non-admin context.
- Treat future organization/team sharing as a separate permission model.

### Hallucinated Memory

Prevention:

- Distinguish "remembered" from "inferred."
- Require source metadata.
- Show confidence and approval status.
- Never let AI silently create canonical facts.

### Operational Abuse

Prevention:

- Rate-limit future memory creation if needed.
- Audit memory creation/update/delete events.
- Include correlation IDs for memory failures and operator triage.
- Keep memory APIs protected and ownership-checked.

## 9. Testing Strategy

### Unit Tests

- Redaction rejects secret-like content.
- Ranking orders by project scope, approval, confidence, recency, and archive status.
- Retention policies classify short/mid/long/archive correctly.
- Memory category validation rejects unsafe categories.

### Integration Tests

- Authenticated user can create and retrieve own project memory.
- User cannot retrieve another user's project memory.
- Non-admin cannot retrieve admin-only memory.
- Archived memory is not auto-loaded.
- Deletion removes item from retrieval.

### E2E Tests

- User approves a decision from chat and sees it in the Project Memory panel.
- New thread recalls an approved project fact.
- Archived memory does not appear unless explicitly searched.
- Logout clears memory UI.
- Unauthenticated memory routes redirect to `/login`.

### Security QA

- Attempt to remember JWT-like, API-key-like, cookie-like, and password-like content.
- Attempt cross-project recall.
- Attempt non-admin access to admin memory.
- Verify logs contain correlation IDs but no secrets.
- Verify browser console/network captures do not expose memory payloads beyond intended UI.

## 10. Future Compatibility

### Context Recall

Project Memory should become the source for safe recall. Context Recall can retrieve approved facts, decisions, and summaries without repeatedly scanning threads.

### Project Intelligence

Project Intelligence can use memory to produce higher-quality project health summaries, risk summaries, and next-action recommendations.

### Repository Understanding

Repository understanding can promote stable, approved repository facts into memory after safe manifest/preview analysis.

### Future Embeddings

If embeddings are approved later, memory should already have:

- Clear categories.
- Project/user scope.
- Redaction state.
- Approval status.
- Retention status.
- Source metadata.

This makes future semantic retrieval safer and easier to govern.

## Recommended v2.1 Build Order

1. Memory data model proposal, still documentation-only until approved.
2. Redaction and safety policy for memory creation.
3. Project Memory panel UX spec.
4. Remember Decision action spec.
5. Retrieval/ranking algorithm spec.
6. Test plan and security QA checklist.
7. Migration proposal only after architecture approval.
