# Nexus Core UX / Product Alignment Audit

**Phase 11A Report**  
*Codex / Google Antigravity-style AI Coding Agent Platform Assessment*

---

## 1. Current UX Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        HEADER (Top Nav)                         │
│  Menu (mobile) | Logo | ProjectIdentityBar | Admin/Quota Badge   │
│  Theme/Language | Settings | Inspector (mobile) | Sign Out       │
├─────────────────────────────────────────────────────────────────┤
│  LEFT SIDEBAR    │    CENTER MAIN           │   RIGHT SIDEBAR  │
│                  │                           │                  │
│ - Project list   │ - App Index (home):       │ - ProjectInspector│
│ - Upload ZIP     │   • Welcome banner        │   OR Chat view:  │
│ - Folder import  │   • Composer/input        │   • Thread view: │
│ - Filter tabs    │   • Recent threads        │   • Messages     │
│                  │   • Examples              │   • Input box    │
│                  │   • ProjectControlCenter  │   • Mode tabs    │
│                  │   • ProjectActionCard     │                  │
│                  │                           │                  │
│                  │ - Thread View:            │                  │
│                  │   • LEFT: File tree /    │                  │
│                  │     Safe Preview / Project  │                  │
│                  │     Context Status        │                  │
│                  │   • CENTER:               │                  │
│                  │     Safe Preview Tabs     │                  │
│                  │     Patch Preview         │                  │
│                  │     Workstation           │                  │
│                  │   • GOVERNANCE LOG (bottom)│                  │
│                  │                           │                  │
│                  │ - Agent Workspace (/agent-workspace):           │
│                  │   • Composer              │                  │
│                  │   • AgentPlanSection        │                  │
│                  │   • PatchProposals          │                  │
│                  │   • ValidationSuggestions   │                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Screens / Routes

| Route | Purpose | Primary UI Elements |
|-------|---------|-------------------|
| `/app` | Homepage / Project Launchpad | Composer, Project cards, Stepper, Examples, ProjectActionCard |
| `/app/$threadId` | Chat + Project Workspace | Left file tree, Center preview, Right chat, Governance log |
| `/app/agent-workspace` | Dedicated agent workspace | Single-pane agent interface |
| `/app/settings` | User preferences | Language, Theme, Profile placeholders |
| `/app/admin` | Admin dashboard | Governance metrics |

---

## 2. Current Architecture Map

### Data Flow

```
User → Chat Input (/app or /app/$threadId)
      ↓
Project Context Resolution
      ↓
If project attached: /api/chat/agent (agent-runtime.ts)
   → task_classification → context_gathering → planning → proposed_changes → validation_plan → final_report
      ↓
If no project: /api/chat (standard chat with prompts)
      ↓
AI Provider (via nexus-core-ai, supabase ai_provider_keys)
      ↓
Assistant Response (structured sections parsed by StructuredAssistant)
      ↓
PatchProposalCard / AgentPlanSection / ValidationSuggestions rendered
```

### Core Components

- **App Layout**: Three-panel responsive layout (left sidebar, center, right sidebar)
- **ProjectSidebar**: Project list, upload controls, filtering
- **ProjectInspector**: File inventory, pipeline diagnostics, action buttons
- **Thread Chat**: AI SDK chat with project-aware mode switching
- **ProductBuilderWorkspace**: No-project conversation flow (build plan creator)
- **AgentWorkspacePanel**: Dedicated agent runtime interface

---

## 3. Top 15 Visual / Product Problems

### Layout Issues

1. **Chat is NOT visually central** (app.$threadId.tsx:522) — Chat is in the RIGHT sidebar, while center shows "Safe Preview Tabs" and "Patch Preview Workstation" which confuses the primary interaction model.

2. **Three-panel layout on thread view** (app.$threadId.tsx:486-573) — Left (files), Center (previews), Right (chat) is inconsistent. Codex uses a cleaner center-chat approach.

3. **Governance Handoff Log at bottom** (app.$threadId.tsx:564-572) — Takes 30vh permanently. This governance text is noise in the primary workflow area.

4. **Patch Preview Workstation title** (app.$threadId.tsx:543) — "Patch Preview Workstation" is internal jargon; should be user-facing language like "Proposed Changes".

5. **Left sidebar hidden on mobile** (app.tsx:265) — Mobile users lose persistent project context; must use menu sheet.

### Navigation / Flow Issues

6. **Agent Workspace is a separate route** (app.agent-workspace.tsx) — Creates duplicate interaction model. Should integrate into thread view or be clearly differentiated.

7. **"detached" vs "attached" project terminology** (app.$threadId.tsx:731-789) — Users see "projectContextNotAttached" even when they HAVE an active project selected in sidebar. State logic flawed.

8. **No clear task lifecycle indicator** — Missing progress states showing: pending → analyzing → proposing → reviewing → export-ready.

9. **Archive project terminology** — "Archive" is confusing; users may think files are deleted.

### Terminology / Clarity Issues

10. **"Governed Review Pipeline" badge** (app.index.tsx:166-168) — Internal jargon, not user-facing value proposition.

11. **"Safe Preview" vs "Indexed Manifest"** — Users don't understand what "safe" means or why previews matter.

12. **"Writeback" and "Working Copy" terms** — Found in translations but unclear to users; too technical.

13. **Multiple "preview" terms** — Safe Preview, Patch Preview, Working Copy Preview all overlap confusingly.

14. **Grounded/Illustrative/Inferred confidence labels** — Too technical; users want simple "file available" indicators.

15. **Stepper on home (app.index.tsx:244-275)** — Shows "AI Session", "Safe Preview", "Review Gate", "Working Copy Export" but doesn't reflect actual user journey.

---

## 4. Top 10 Agent Behavior Problems

1. **Two parallel agent interfaces** (app.$threadId.tsx uses /api/chat/agent, app.agent-workspace.tsx uses AgentWorkspacePanel) — Users confused which to use.

2. **Agent doesn't auto-run on send** — When project is attached, user sends message, then agent runs separately via fetch to /api/chat/agent. No feedback that this happens automatically.

3. **No explicit task lifecycle visualization** — Agent runs 6 stages (user_instruction → final_report) but users see no step-by-step progress.

4. **Plan/Proposal/Diff/Validation not clearly separated** — All rendered in same chat stream; no dedicated artifacts panel.

5. **"do not apply" vs "do not propose" confusion** — Governance messaging says changes aren't applied, but users expect proposals.

6. **No diff preview in chat stream** — Diff is rendered in PatchProposalCard but users may want inline diff view.

7. **Agent only works with project context** — No clear guidance on what happens when no project selected vs project available but not indexed.

8. **No multi-agent/session manager** — Single thread model; no parallel task handling.

9. **No terminal/test/sandbox readiness state** — Sandbox verification exists but is buried in Inspector, not in chat flow.

10. **No clear "apply" separation** — All preview/generate actions are in Inspector; no "Review → Apply" distinction in thread view.

---

## 5. Codex / Antigravity Gap Analysis

| Expectation | Nexus Core State | Gap |
|-------------|------------------|-----|
| Chat-first agent experience | Chat exists but not central | Chat should be primary focus; preview/workstation as artifacts |
| Project-first workspace | Project sidebar exists, but context state confusing | Clear "project attached" indicator when project selected |
| Task lifecycle (Understand → Plan → Act → Verify → Complete) | 6 lifecycle stages in code | No user-facing lifecycle visualization |
| Agent progress states | AgentResults show loading spinner | Missing stage-by-stage progress |
| Artifacts: plan, diff, validation, report | All rendered inline | Need dedicated artifact panels |
| Review/apply separation | All actions in Inspector | No clear Apply button/UX flow |
| File context awareness | Safe previews, file tree | Good, but not visually prioritized |
| Multi-agent/session manager | Single thread | Not implemented |
| Terminal/test/sandbox readiness | Sandbox verification in Inspector | Not integrated into main flow |
| Trust and safety boundaries | Blocked/Not-Applied messaging | Overly technical; needs user-friendly framing |

---

## 6. Recommended Target Layout

### Option A: Chat-Centric (Codex-style)

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Logo | Project Selector | Status | User Menu           │
├─────────────────────────────────────────────────────────────────┤
│  LEFT PANEL (240px)   │  CENTER (flex)       │ RIGHT PANEL (280px) │
│                        │                      │                     │
│ - Projects             │ - Chat Conversation  │ - Artifacts         │
│ - Active Project Card  │   (main focus)       │   • Plan            │
│                        │ - File Preview       │   • Diff            │
│                        │   (below chat)       │   • Validation      │
│                        │                      │   • Report          │
│                        │                      │ - Quick Actions     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Changes

1. **Chat becomes central column** — Primary interaction surface
2. **File preview becomes secondary/bottom** — Contextual, not competing
3. **Right panel = Artifact Review** — Dedicated to plan/validation/diff
4. **Remove permanent governance log** — Move to artifact-level indicators
5. **Simplify status badges** — Show "Ready for Review" vs internal states

---

## 7. Recommended Phased Roadmap

### Phase 1: Immediate UX Fixes (No code changes)

1. Rename "Governed Review Pipeline" to "AI Coding Assistant"
2. Improve project context messaging — show "Selected" when project exists
3. Move Governance Handoff Log to collapsible section
4. Clarify "Archive" → "Free up slot" or "Deactivate project"

### Phase 2: Layout Refactor

1. Make chat the central focusable area
2. Introduce Artifacts panel (Plan / Diff / Validation / Report tabs)
3. Consolidate Agent Workspace INTO thread view
4. Add task lifecycle stepper to chat header

### Phase 3: Codex Alignment

1. Implement "Review" → "Apply" flow
2. Add sandbox readiness to artifact view
3. Multi-session task tracking
4. Inline diff preview in chat

---

## 8. What Must Not Be Changed Yet

Per constraints:

- Auth, database schema, permissions/RLS
- Exports/PDF functionality
- Billing / usage limit flows
- Source writeback / patch application logic
- Migration files

---

## 9. Acceptance Criteria for Next UI Refactor Phase

1. **Chat Focus**: Chat input/area is visually dominant (center or right with clear hierarchy)
2. **Project Context Clarity**: When active project exists, UI shows "Project attached and ready" not "detached"
3. **Artifact Separation**: Plan, Diff, Validation, Report are visually distinct sections
4. **Governance Visibility**: Safety indicators visible but not overwhelming
5. **Arabic/English Consistency**: Layout direction properly handled, labels translated
6. **Mobile Usability**: Core workflow works on mobile (chat, send, view results)
7. **"Apply" Separation**: Clear distinction between "Propose" and "Apply" actions
8. **Task State**: Users can see "Planning → Proposed → Review → Export Ready" states

---

## Phase 11B Implementation Report - Layout Refactor

### Changes Made

| File | Change |
|------|--------|
| `src/routes/app.$threadId.tsx` | Complete layout refactor: Chat moved to center, artifacts panel on right, governance status compact at bottom |
| `src/components/agent-workspace/AgentArtifactsPanel.tsx` | New component for tabbed artifact view (Plan, Changes, Validation, Report) |
| `src/components/agent-workspace/GovernanceStatusCompact.tsx` | New component: Replaces 30vh Governance Handoff Log with inline status strip |
| `src/components/agent-workspace/ProjectExplorerPanel.tsx` | New component: Compact project explorer for left panel |

### Old Layout Summary

```
LEFT: File tree / Project Context Status / Safe Previews (240px)
CENTER: Safe Preview Tabs + Patch Preview Workstation (main content area)
RIGHT: Chat (sidebar, 28rem)
BOTTOM: Governance Handoff Log (30vh fixed, noisy)
```

### New Layout Summary

```
LEFT: Project Explorer (compact, collapsible, 64px -> 240px on expand)
CENTER: Nexus Agent Chat (primary focus, full width when no artifacts)
RIGHT: Artifacts Panel (tabs for Plan, Changes, Validation, Report)
BOTTOM: Governance Status Compact (inline strip, unobtrusive)
```

### Chat Centrality Changes

- Chat is now the **primary center column**, not a sidebar
- Input area has prominent placement at bottom with clear visual hierarchy
- Agent results render inline in chat stream via `AssistantMessage` component
- Dedicated artifacts panel separates detailed proposals from conversation

### Artifacts Panel Behavior

- Appears when `agentResult` contains plan, patchProposals, validationPlan, or finalReport
- Tabbed interface for different artifact types
- Risk summary and file counts visible at top of Changes tab
- Diff preview expandable inline within each proposal
- Clean empty state when no artifacts exist

### Governance Noise Reduction

- Removed permanent 30vh "Governance Handoff Log" section
- Replaced with `GovernanceStatusCompact` inline strip showing:
  - Files Indexed status
  - Safe Preview Ready status
  - Analysis Complete status
  - Read-only proposals indicator

### Project Context UX Fix

- Left explorer shows project name when selected
- Status indicator changes from "Ready" to "Processing..." or "Pending"
- No misleading "detached" messaging in main chat area

### Responsive Behavior

- Desktop (xl+): 3-panel layout with collapsible sidebars
- Tablet/mobile: Left/right panels hidden, chat takes full width
- Panels can be toggled open on larger screens

### What Remains Read-Only

- No patch apply functionality
- No source writeback/writeback request creation in main chat
- No working copy export from artifacts panel
- All governed-flow actions remain in ProjectInspector

### What's Not Codex/Antigravity-Level Yet

- Multi-agent/session manager not implemented
- Inline diff preview in chat stream (artifacts panel only)
- Task lifecycle stepper visualization missing
- Terminal/test/sandbox readiness not integrated into main flow
- Multi-session parallel task handling not implemented