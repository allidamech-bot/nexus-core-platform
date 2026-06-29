# Nexus Core Phase 0 — Full Product, UX, Code, and Agent Architecture Audit

**Date:** 2026-06-29  
**Branch:** `phase-7-provider-readiness`  
**HEAD:** `f7fc952af16573aab30fabaa3794c6ffb55ef7ac` (plus unstaged Phase 11C fix)  
**Mode:** Diagnostic audit only — no code was changed during this audit.

---

## 1. Executive Summary

Nexus Core has accumulated significant technical debt across multiple hotfix phases (11A, 11B, 11C). The core problem is that the **chat/session architecture was designed as a state machine with two parallel state systems** (`useChat.messages` + `agentResult`), and the **agent response generation is almost entirely hardcoded templates rather than actual AI inference**. The app currently:

- Maintains **two separate chat APIs** (`/api/chat` and `/api/chat/agent`) 
- Maintains **two parallel workspace panels** (`AgentResultBlock` + `AgentArtifactsPanel` while `AgentWorkspacePanel` exists as legacy)
- Uses **template-based natural responses** for greetings, general chat, and even project reviews
- Has **unsaved assistant responses** that disappear on page refresh (partially fixed in Phase 11C)
- Suffers from **patchwork syndrome** — multiple small fixes layered on top of architectural issues

The product goal (Codex/Antigravity-style governed AI workspace) is achievable but requires a focused architectural consolidation phase, not incremental hotfixes.

---

## 2. Product Goal vs Current Reality

| Product Goal | Current Reality |
|---|---|
| One unified chat | Two chat APIs, two state systems, two render paths |
| Agent responds naturally | Template responses; no actual AI inference for conversation |
| Artifacts only when relevant | Artifacts panel exists but artfacts can leak between render cycles |
| Arabic/English support | Language detection works; responses are template-based in both languages |
| Read-only proposals | Correctly read-only; no source writeback active |
| Premium clean UI | Multiple overlapping panels, unused legacy components, confusing session flow |

---

## 3. Confirmed Critical Issues

### P0 — Must Fix Before Any Feature Work

1. **No AI inference for conversational responses** — `generateNaturalResponse()` is entirely hardcoded templates. The user writes "الو" and gets a templated greeting string. The user asks "what is Nexus Core?" and gets a templated `general_chat` string. The AI provider is only called for `generatePlan()`, `generateProposedChanges()`, `generateValidationPlan()`, and `generateFinalReport()` — all of which assume the user wants code changes. **This is why the agent sounds robotic and illogical.**

2. **Two parallel chat APIs** — `/api/chat` (used by `useChat` for non-project conversations) and `/api/chat/agent` (used by `handleSend` for project-aware sessions). These have different system prompts, different context building, different response shapes. The frontend treats them as completely separate systems.

3. **Duplicate message transcript** — User messages are saved to DB manually in `handleSend` (Path A), but never appended to `useChat.messages` until Phase 11C fix (which addressed it). Assistant responses were not persisted at all until Phase 11C. The fix is correct but untested.

4. **`agentResult` vs `useChat.messages` duplication** — `agentResult` is still a separate state variable used for the right artifacts panel. The center chat now correctly renders only `messages.map()`, but the architecture has two sources of truth for the "latest agent response."

### P1 — Should Fix Before Next Release

5. **`agent-classifier.ts` intent detection is naive** — It checks if the instruction `includes()` any greeting word. A message like "hello world I want a react app" would match "hello" and become a greeting. The name-asking patterns are also simple `includes()` checks.

6. **Template responses expose provider names** — The `friendlyChatError()` function in `app.$threadId.tsx` explicitly lists `GEMINI_API_KEY`, `OPENROUTER_FREE_API_KEY`, `GROQ_API_KEY` in error messages shown to end users.

7. **`AgentResultBlock` still exists outside `messages.map()`** — After Phase 11C, the `<AgentResultBlock>` rendering was removed from the JSX for the center chat, but the import remains. The component is unused in the center transcript now.

8. **Legacy `AgentWorkspacePanel` exists** — This is a separate workspace UI component with its own instruction input, its own mutation state, and its own API endpoint (`/api/projects/agent-workspace`). It is unused in the main chat flow but still imported and available.

### P2 — Should Fix When Convenient

9. **Hydration race in `useChat`** — The `hydratedThreadRef` guard exists but the effect depends on `busy` which includes `agentLoading`. If the auto-process effect fires and sets `agentLoading=true`, the hydration effect might skip, then never re-fire for subsequent messages.

10. **Auto-process effect depends on `agentResult`** — The effect dependency array `[..., agentResult]` means any change to `agentResult` could re-evaluate the effect. The `autoProcessRef` guard prevents actual re-execution, but it's fragile.

11. **No query invalidation after saving assistant messages** — When `handleSend` saves the assistant message to DB, it doesn't invalidate the `["messages", threadId]` query key.

---

## 4. UX/UI Issues

### 4.1 Session Flow

The `/app` → `/app/$threadId` flow still feels like two conversations because:
- The `/app` page has its own composer with separate copy ("Ask Nexus Agent..." vs "Describe your idea...")
- The thread page has a second composer
- The initial message is saved to DB before navigation, then re-fetched — the user sees a flash of "Loading session..." then their message appears

### 4.2 Naming Inconsistency

- "Nexus Core" (used in `MessageBlock` for non-project assistant messages)
- "Nexus Agent" (used for project-aware agent responses)
- "Nexus Core AI" (used in `AgentWorkspacePanel`)

Three names for essentially the same AI assistant.

### 4.3 Layout Issues

- Mobile responsiveness — the composer is `hidden md:block` on the index page (line 200 of `app.index.tsx`), meaning mobile users don't see the main input at all
- The stepper component ("AI Session → Safe Preview → Review Gate → Working Copy Export") is confusing for first-time users — it implies a linear workflow that doesn't fully exist yet
- The "GOVERNED REVIEW PIPELINE" badge is visually prominent but doesn't explain what it means

### 4.4 Language Issues

- Arabic text in the error state (line 189 of `app.index.tsx`) is hardcoded, not using i18n
- The welcome text uses `dir="ltr"` even when the interface language is Arabic

### 4.5 Empty States

- When there are no messages and no project: shows `ProductBuilderWorkspace` component (which has its own prompt system)
- When there are no messages and a project: shows "Ask Nexus Core" with description text
- This creates confusion about where to start

---

## 5. Chat/Session Architecture Issues

### 5.1 Two Chat APIs

| Feature | `/api/chat` | `/api/chat/agent` |
|---|---|---|
| Route | `src/routes/api/chat.ts` (1161 lines) | `src/routes/api/chat.agent.ts` (303 lines) |
| Used by | `useChat.sendMessage()` (non-project path) | `handleSend` / autoProcess (project path) |
| System prompt | Full product/project-building prompt | None (delegates to `agent-runtime.ts`) |
| Context building | Built-in (files, previews, manifest, rankings) | Done in `agent-runtime.ts` via `buildContextBundle` |
| Response | Streamed via `streamText` | Static JSON response |
| Persistence | `useChat.onFinish` saves to DB | Manual save after fetch |
| AI model | Dynamic provider | `generateWithNexusCore` |

**Why this is a problem:**
- The user experience is completely different depending on whether a project is attached
- `/api/chat` provides rich project-aware streaming conversations
- `/api/chat/agent` provides artifact-heavy structured responses
- Phases 11B/11C tried to merge them but the merge is fragile

### 5.2 `useChat` — Is It Still Needed?

`useChat` is currently used for:
- Non-project conversations (user types in thread without a project)
- Managing `messages` state
- Handling streaming responses from `/api/chat`
- The `onFinish` callback (saves assistant messages to DB)

If the project decides to route **all** conversations through the agent (which is the product goal), then `useChat` becomes an unnecessary abstraction. The project-aware path already bypasses it entirely.

**Recommendation:** Keep `useChat` for now but only as a state container for `messages`. The actual API call should always go through `/api/chat/agent` regardless of project context. The `/api/chat` route can be deprecated.

### 5.3 Message Persistence

| Message type | Saved to DB by | Survives refresh? |
|---|---|---|
| User message (Path A — project) | Manual `supabase.insert` in `handleSend` | ✅ Yes |
| User message (Path B — no project) | `useChat` transport | ✅ Yes |
| Assistant message (Path A — project) | Manual `supabase.insert` (Phase 11C fix) | ✅ Yes (after Phase 11C) |
| Assistant message (Path B — no project) | `useChat.onFinish` | ✅ Yes |
| Auto-process assistant | Manual `supabase.insert` (Phase 11C fix) | ✅ Yes (after Phase 11C) |
| Artifacts | Never persisted to DB | ❌ No (local state only) |

### 5.4 Duplicate Message Risk

- `messageExists()` helper was added in Phase 11C to prevent duplicate user messages in `useChat.messages`
- `autoProcessRef` prevents duplicate auto-processing
- `hydratedThreadRef` prevents duplicate hydration
- These guards are correct in principle but have not been tested together

---

## 6. Agent Intelligence/Response Quality Issues

### 6.1 Hardcoded Template Responses

The `generateNaturalResponse()` function in `agent-runtime.ts` (lines 405-473) is 100% hardcoded templates:

```typescript
if (intent === "greeting") {
  return `Hello! I'm ready ${projectInfo}${filesInfo}What would you like me to examine first?`;
}
if (intent === "general_chat") {
  return projectName 
    ? `I understand. I'm here to help with the ${projectName} project.`
    : "I'm ready to help. How can I assist you today?";
}
```

**This means:**
- The user never gets an actual AI-generated conversational response
- The user's specific question is ignored; only the *intent category* matters
- There is no context-aware conversation
- "what is your name" returns the same template as "how does authentication work"

### 6.2 AI Provider Is Only Used For Artifact Generation

The `generateWithNexusCore` function is called for:
- `generatePlan()` — AI generates a structured plan
- `generateProposedChanges()` — AI generates file change proposals
- `generateValidationPlan()` — AI suggests validation commands
- `generateFinalReport()` — AI summarizes the session

For **all conversational responses** (greetings, general chat, project review summaries), the response is a hardcoded string.

### 6.3 Intent Classification Is Naive

The `classifyIntent()` function checks:
```typescript
for (const pattern of GREETING_PATTERNS) {
  if (instructionTrimmed.includes(pattern.toLowerCase())) {
    return "greeting";
  }
}
```

Problems:
- "hello world I want a react app" → classified as "greeting" ❌
- "say hello to the team" → classified as "greeting" ❌
- The `NAME_ASKING_PATTERNS` also use `includes()`, not exact matching
- The short non-Latin fallback (`< 10 chars && no Latin letters`) is a heuristic that could miscategorize

### 6.4 Arabic Support

- Arabic input detection works via Unicode range regex
- Template responses include Arabic variants
- **However**, the Arabic templates are just translations of the English templates — they don't reflect the actual user query
- "شو اسمك" is caught by `NAME_ASKING_PATTERNS` → `general_chat`, but the response is still a template

### 6.5 Provider Error Handling

- `friendlyChatError()` in `app.$threadId.tsx` lists provider names in user-facing error messages
- The API route (`chat.agent.ts`) includes `providerUsed` and `modelUsed` in the response (masked as `"nexus-core-ai"` when not in dev mode)
- However, the `sanitized` object includes `provider: devMode ? result.providerUsed : "nexus-core-ai"` — this should be fine

---

## 7. Artifacts/Proposals Issues

### 7.1 Artifact Lifecycle

- Artifacts are stored in `agentResult` (local React state)
- Artifacts are **never persisted to the database**
- On page refresh, artifacts are lost
- The right panel shows "No review artifacts yet" when `agentResult` is null — correct behavior
- But if the user has sent a project task and navigates away/back, the artifacts are gone

### 7.2 Artifact Leak Protection

- `useEffect` on `threadId` resets `agentResult` to null — ✅ correct
- `handleSend` resets `agentResult` to null before each send — ✅ correct
- Auto-process effect checks `agentResult` before proceeding — ✅ correct

### 7.3 Artifact Meaningfulness

- Plan generation, proposed changes, validation plan, and final report **all use AI generation**
- However, the prompts are generic and the results are likely generic
- The plan generation prompt mentions "Return a JSON plan" but doesn't guide the AI to use the actual project files
- The proposed changes prompt is better but still generic

### 7.4 Read-Only Boundaries

- All proposal components (`PatchProposalCard`, `DiffPreview`, `AgentPlanSection`) are correctly read-only
- No patch apply UI exists in the chat flow
- The `AgentWorkspacePanel` footer explicitly states: "All proposals are read-only and ready for human review"
- ✅ Correct behavior

---

## 8. Code Architecture Issues

### 8.1 Oversized Files

| File | Lines | Issues |
|---|---|---|
| `src/routes/api/chat.ts` | 1161 | Too large; mixes context building, auth, quota, streaming, response formatting |
| `src/routes/app.$threadId.tsx` | 928 | Contains component, helpers, state, effects, rendering — should be split |
| `src/lib/agent-runtime.ts` | 562 | Contains runtime logic + inline prompt templates — prompts should be in separate files |

### 8.2 Mixed Responsibilities

`src/routes/app.$threadId.tsx` currently handles:
- Route definition
- Thread loading (query)
- Message loading (query)
- `useChat` setup
- Project context resolution
- Handle functions (send, archive, attach, toggle preview)
- Agent result state management
- Auto-process initial message
- Artifact state
- Rendering (full layout)
- `MessageBlock` component
- `AssistantMessage` component
- `SectionBlock` component
- `VerificationFromText` component

### 8.3 Duplicate/Unused State

- `hasArtifacts` (computed from `agentResult`) — used only for the right panel, fine
- `AgentResultBlock` component is imported but no longer used in the render tree (Phase 11C removed it from JSX) — dead import
- `AgentWorkspacePanel` component is a legacy parallel workspace — unused in main chat flow

### 8.4 Error Handling

- The auto-process effect Phase 11C fix added toast for errors — ✅
- `handleSend` catches errors and shows toast — ✅
- `useChat.onError` shows toast — ✅
- However, the auto-process error handling only returns early without setting `agentResult` — the user sees an error toast but the `agentLoading` indicator stops. This is acceptable UX.

### 8.5 i18n Coverage

- All user-facing text in `app.index.tsx` uses `t()` except the Arabic hardcoded error (line 189)
- `app.$threadId.tsx` has hardcoded strings: "Loading session...", "Ask Nexus Core", "Describe the changes...", "Reading project context...", "Nexus Agent", "Nexus Core", "Ask Nexus Core...", "Cmd/Ctrl + Enter to send"

---

## 9. Security/Safety Issues

### 9.1 Provider Privacy ✅

- Provider names are masked in non-dev mode
- `chat.agent.ts` sends `provider: "nexus-core-ai"` instead of actual provider name

### 9.2 Provider Name Exposure ❌

- `friendlyChatError()` in `app.$threadId.tsx` (lines 69-84) lists `GEMINI_API_KEY`, `OPENROUTER_FREE_API_KEY`, `GROQ_API_KEY` in user-facing error toasts
- These should be replaced with generic text like "AI provider is not configured yet. Contact your administrator."

### 9.3 Source Writeback ✅

- No source writeback implementation exists in the chat flow
- The `writeback-execute.ts` route exists but is not wired into any UI
- ✅ Safe

### 9.4 Git Commands ✅

- No git commands are executed by the application code
- ✅ Safe

### 9.5 Env Key Handling ✅

- All Supabase keys are server-side only
- Auth tokens are Bearer tokens from user sessions
- ✅ Safe

---

## 10. Validation Gaps

| Validation Type | Status | Notes |
|---|---|---|
| `npm run typecheck` | Available | Run before any commit |
| `npm run lint` | Available | 12 warnings (pre-existing react-refresh), 0 errors after Phase 11B |
| `npm run build` | Available | Must pass before deployment |
| `npm run test:e2e` | Available via playwright | Not run during this audit |
| Unit tests | Available in `tests/unit/` | Not run during this audit |
| Manual QA checklist | Not present | Should be created |
| E2E tests for chat flow | Not present | Critical gap |

### Recommended E2E Tests

1. **User sends message from /app** → thread created, message appears in center chat, agent responds
2. **User sends greeting** → assistant responds with natural greeting, no artifacts in right panel
3. **User sends project review** → assistant responds, artifacts appear in right panel
4. **Page refresh** → messages and assistant responses are preserved
5. **New thread** → no stale artifacts from previous thread
6. **Arabic message** → response in Arabic
7. **Session archive** → thread archived, cannot send new messages

---

## 11. Root-Cause Map

```
User says "Agent sounds robotic"
  └─ generateNaturalResponse() is hardcoded templates
  │   └─ No AI inference for conversational responses
  │       └─ Architectural decision to separate chat vs agent

User says "Two conversations feeling"
  └─ Two separate chat APIs (/api/chat vs /api/chat/agent)
  │   └─ Two state systems (useChat.messages vs agentResult)
  │       └─ Two render paths (MessageBlock vs AgentResultBlock)
  │           └─ Phase 11C partially merged them

User says "Artifacts appear for greetings"
  └─ Intent classification uses includes() 
  │   └─ "hello world I want to review my code" → greeting
  │   └─ No guard in handleSend for greeting intents

User says "Messages disappear on refresh"
  └─ Assistant responses not persisted (Phase 11C fix addresses this)
  │   └─ agentResult is local state only
  │       └─ Artifacts never persisted

User says "App feels like multiple patches"
  └─ Correct — Phases 11A, 11B, 11C layered fixes
  │   └─ Original architecture designed for different product vision
  │       └─ Multiple hotfixes without architectural consolidation
```

---

## 12. Prioritized Remediation Roadmap

### Phase 1: Unify Chat/Session Architecture (High Priority)

**Goal:** Single chat state, single API, single render path

- [ ] Route all conversations through `/api/chat/agent` (deprecate `/api/chat`)
- [ ] Remove `agentResult` as a separate state; store everything in `useChat.messages`
- [ ] Persist artifacts to DB as part of the assistant message metadata
- [ ] Remove unused imports (`AgentResultBlock`, `AgentWorkspacePanel`)
- [ ] Fix hydration race conditions in `useChat` setup

### Phase 2: Fix Conversational Intelligence (High Priority)

**Goal:** Agent responds intelligently to conversation, not templates

- [ ] Replace hardcoded `generateNaturalResponse()` with actual AI inference call for conversational responses
- [ ] Fix intent classification: use exact matching for short patterns, reject false positives
- [ ] Add a dedicated conversational system prompt to `/api/chat/agent`
- [ ] Preserve conversation history in the agent prompt for context-aware replies
- [ ] Test "what is your name" → agent introduces itself conversationally
- [ ] Test Arabic greetings → conversational Arabic response

### Phase 3: Fix Artifacts Lifecycle (Medium Priority)

**Goal:** Artifacts appear only when relevant, survive refresh

- [ ] Persist artifacts to the database as part of thread metadata
- [ ] Load artifacts on thread mount
- [ ] Reset artifacts on new message (not on new thread)
- [ ] Only show artifacts panel when artifacts exist

### Phase 4: UI/RTL/Layout Cleanup (Medium Priority)

**Goal:** Clean, professional, consistent UI

- [ ] Remove "GOVERNED REVIEW PIPELINE" badge or make it contextual
- [ ] Fix mobile composer visibility
- [ ] Unify naming: use "Nexus Core" everywhere
- [ ] Replace hardcoded Arabic text with i18n
- [ ] Fix `dir="ltr"` on Arabic pages
- [ ] Remove the stepper component or make it meaningful
- [ ] Hide provider names from error messages

### Phase 5: Validation/E2E Hardening (High Priority)

**Goal:** Prevent regressions

- [ ] Write E2E tests for the full chat flow
- [ ] Add E2E tests for session archive
- [ ] Add E2E tests for artifact persistence
- [ ] Add manual QA checklist
- [ ] Run full validation before each release

### Phase 6: Product Backlog After Stabilization

- [ ] Writeback review UI
- [ ] Export/working copy
- [ ] Team collaboration
- [ ] API access
- [ ] Provider configuration UI

---

## 13. Proposed Phases Summary

| Phase | Focus | Effort | Risk | User Impact |
|---|---|---|---|---|
| 1 | Unify chat architecture | 2-3 days | Medium | Immediate — fixes session flow |
| 2 | Conversational AI | 1-2 days | Medium | Immediate — fixes robotic responses |
| 3 | Artifact persistence | 1 day | Low | Medium — fixes refresh loss |
| 4 | UI/RTL cleanup | 2-3 days | Low | High — visible polish |
| 5 | E2E validation | 2-3 days | Low | Indirect — prevents regressions |
| 6 | Backlog features | Variable | High | Future |

---

## 14. "Do Not Fix Yet" Checklist

- [ ] Do not implement patch apply UI
- [ ] Do not implement source writeback
- [ ] Do not change auth, database schema, RLS/permissions
- [ ] Do not change billing/payment
- [ ] Do not change exports/PDF
- [ ] Do not provider keys or env handling
- [ ] Do not remove `/api/chat` until Phase 1 is complete and tested
- [ ] Do not delete unused components until all consumers are verified
- [ ] Do not run migrations
- [ ] Do not format files across the project

---

## 15. Files Inspected

| File | Lines | Role |
|---|---|---|
| `src/routes/app.index.tsx` | 377 | Session composer, landing page |
| `src/routes/app.$threadId.tsx` | 928 | Chat workspace (main file) |
| `src/routes/api/chat.ts` | 1161 | Chat API (non-project conversations) |
| `src/routes/api/chat.agent.ts` | 303 | Agent API (project-aware sessions) |
| `src/lib/agent-runtime.ts` | 562 | Agent session execution engine |
| `src/lib/agent-classifier.ts` | 94 | Intent/task classification |
| `src/lib/agent-types.ts` | 141 | Type definitions |
| `src/components/agent-workspace/AgentResultBlock.tsx` | 151 | Agent result renderer (unused after Phase 11C) |
| `src/components/agent-workspace/AgentArtifactsPanel.tsx` | 238 | Right panel artifact tabs |
| `src/components/agent-workspace/AgentWorkspacePanel.tsx` | 338 | Legacy workspace panel (unused in main flow) |
| `src/components/agent-workspace/AgentPlanSection.tsx` | — | Plan artifact display |
| `src/components/agent-workspace/AgentFinalReportSection.tsx` | — | Report artifact display |
| `src/components/agent-workspace/DiffPreview.tsx` | — | Diff viewer |
| `src/components/agent-workspace/PatchProposalCard.tsx` | — | Proposal display card |
| `src/components/agent-workspace/RiskBadge.tsx` | — | Risk level badge |
| `src/components/agent-workspace/ApprovalStatusBadge.tsx` | — | Approval status badge |
| `src/components/agent-workspace/ValidationSuggestions.tsx` | — | Validation command suggestions |
| `src/features/i18n/translations.ts` | 1322 | Translation keys |

---

## 16. Final Audit Summary

| Metric | Value |
|---|---|
| Branch | `phase-7-provider-readiness` |
| HEAD | `f7fc952af16573aab30fabaa3794c6ffb55ef7ac` |
| Code changed during audit | **No** |
| Files inspected | 18 |
| Critical issues (P0) | 4 |
| High issues (P1) | 4 |
| Medium issues (P2) | 3 |
| Confirmed working correctly | Intent classification (basic), read-only boundaries, provider privacy, artifact reset on thread change |
| Needs immediate attention | Conversational AI (templates → AI), chat state unification, E2E tests |
| Git status | Unstaged Phase 11C fix in `src/routes/app.$threadId.tsx` |