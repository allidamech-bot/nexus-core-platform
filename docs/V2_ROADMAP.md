# Nexus Core Platform v2 Roadmap

This roadmap starts from the Production Ready v1 baseline. It is planning-only and must not be treated as approval to build, deploy, migrate, or change product behavior.

## Current Production Baseline

Official production target: Lovable.

Production URL: https://nexus-core-ai-os.lovable.app

Release markers:

- `production-baseline-2026-05-21`
- `release-ready-2026-05-21`

Production Ready v1 includes:

- Public routes, authenticated workspace, settings, admin, and thread routes.
- Protected-route redirects for unauthenticated users.
- Admin access for the known admin account.
- True non-admin admin denial.
- Authenticated chat smoke response.
- Arabic/RTL persistence after refresh.
- Logout clearing private/admin UI.
- Split production bundles.
- Safe logging guardrails.
- `x-correlation-id` on authenticated chat and unauthenticated API boundary responses.
- Production QA and operator runbooks.

Still out of scope in v1:

- Real code execution.
- Sandboxing.
- GitHub import.
- Stripe billing.
- Organization/team permissions.
- Embeddings/vector search.
- Autonomous agent actions.

## Product Vision

Nexus Core becomes an **AI project operating system**.

The product should help a technical or business operator understand a project, preserve its context, plan work, govern usage, and safely coordinate AI-assisted project decisions. v2 should deepen project intelligence and memory before adding risky execution capabilities.

## Candidate Capabilities

### P0 - High Impact

#### 1. Project Memory Layer

- Business value: Gives each project durable memory across sessions, reducing repeated context setup and making Nexus Core feel project-aware over time.
- Technical complexity: Medium-high. Requires memory model design, retention rules, summarization strategy, and safe retrieval boundaries.
- Risk level: Medium. Main risks are stale memory, sensitive content retention, and confusing source-of-truth behavior.
- Dependencies: Existing projects, threads, messages, previews, audit/usage events, safe logging, correlation IDs.
- Recommended order: 1.

#### 2. Context Recall

- Business value: Lets users recall relevant prior decisions, constraints, summaries, and project facts inside a thread without manually re-explaining.
- Technical complexity: Medium. Can begin with relational summaries and scoped retrieval before embeddings.
- Risk level: Medium. Must avoid leaking context across users/projects and avoid overconfident recall.
- Dependencies: Project memory layer, auth isolation, thread ownership, project ownership, redacted logging.
- Recommended order: 2.

#### 3. Project Intelligence Summaries

- Business value: Turns uploaded/imported project context into readable status, architecture, risk, and next-action summaries for decision makers.
- Technical complexity: Medium. Uses existing manifest, safe previews, thread context, and chat planning behavior.
- Risk level: Low-medium. Must label summaries as inferred and avoid claiming full repository access.
- Dependencies: Project ingestion metadata, text previews, chat prompt boundaries, usage governance.
- Recommended order: 3.

#### 4. Repository Understanding Improvements

- Business value: Improves accuracy of planning by better modeling file inventory, framework signals, dependency surfaces, and likely ownership boundaries.
- Technical complexity: Medium-high. Requires stronger manifest classification and better preview selection.
- Risk level: Medium. Must not execute code or inspect unsafe content.
- Dependencies: ZIP/folder ingestion, manifest generator, text preview indexer, project security events.
- Recommended order: 4.

#### 5. AI Execution Planning Improvements

- Business value: Produces clearer implementation plans, risk logs, verification plans, and operator-ready task breakdowns.
- Technical complexity: Medium. Mostly prompt/schema/workflow improvements, plus UI affordances for plan reuse.
- Risk level: Low-medium. Risk is user confusion if plans sound like actions were executed.
- Dependencies: Current chat route, project context shaping, governance events, safe AI boundary language.
- Recommended order: 5.

### P1 - Operational Depth

#### 6. Usage Analytics Dashboard

- Business value: Helps operators understand AI requests, uploads, context usage, quota pressure, and activity over time.
- Technical complexity: Medium. Current usage tables exist but need safer aggregation and clearer UI.
- Risk level: Low-medium. Must preserve admin/non-admin visibility boundaries.
- Dependencies: Usage events, daily snapshots, admin dashboard, correlation IDs.
- Recommended order: 6.

#### 7. Advanced Governance Visibility

- Business value: Gives admins better insight into quota hits, security events, ingestion failures, and policy boundaries.
- Technical complexity: Medium. Builds on existing governance and audit surfaces.
- Risk level: Medium. Admin-only data must not leak to non-admin users.
- Dependencies: Admin isolation, RLS, audit events, usage events, project security events.
- Recommended order: 7.

#### 8. Operator Tooling

- Business value: Gives the production operator safe tools for smoke checks, release verification, trace lookup, and support triage.
- Technical complexity: Medium. Needs read-only tools, trace views, and clear permission checks.
- Risk level: Medium. Tools must remain non-destructive and admin-scoped.
- Dependencies: Correlation IDs, safe logging, admin dashboard, release runbook.
- Recommended order: 8.

#### 9. Thread Organization and Search

- Business value: Makes repeated use manageable by letting users find prior threads, decisions, plans, and project conversations.
- Technical complexity: Medium. Search can start with relational metadata and titles before deeper semantic search.
- Risk level: Low-medium. Must preserve user/project ownership.
- Dependencies: Threads, messages metadata, project memory summaries, route protection.
- Recommended order: 9.

### P2 - Future Expansion

#### 10. Collaboration

- Business value: Enables shared project understanding between stakeholders.
- Technical complexity: High. Requires membership, permissions, invitations, and data sharing rules.
- Risk level: High. Cross-user access is the main security risk.
- Dependencies: Team workspace model, permission system, audit trail, admin governance.
- Recommended order: 10.

#### 11. Team Workspace Concepts

- Business value: Moves Nexus Core from single-user project workspace to organizational project operating system.
- Technical complexity: High. Requires workspace ownership, roles, billing boundaries, and migration planning.
- Risk level: High. Must avoid breaking current single-user isolation.
- Dependencies: Collaboration model, permissions, admin governance, future billing design.
- Recommended order: 11.

#### 12. Richer AI Tooling

- Business value: Adds more structured AI workflows such as review checklists, roadmap generation, ticket drafting, and decision logs.
- Technical complexity: Medium-high. Requires careful UX and capability boundaries.
- Risk level: Medium-high. Tools must not imply execution or external system changes unless those systems are explicitly integrated later.
- Dependencies: Project memory, context recall, governance, operator tooling.
- Recommended order: 12.

## Version Plan

### v2.1 - Project Intelligence Foundation

Focus:

- Project memory layer.
- Context recall.
- Project intelligence summaries.
- Repository understanding improvements.
- AI execution planning improvements.

Success criteria:

- Users can return to a project and recover useful prior context without re-uploading or re-explaining.
- AI responses clearly distinguish known project facts, inferred summaries, and proposed actions.
- No auth/admin/logging regressions.

### v2.2 - Operator and Governance Depth

Focus:

- Usage analytics dashboard.
- Advanced governance visibility.
- Operator tooling.
- Thread organization/search.

Success criteria:

- Admins can diagnose quota, chat, ingestion, and runtime issues using safe IDs and redacted logs.
- Users can find prior work and project decisions more easily.
- Production smoke remains simple and repeatable after deploy.

### v2.3 - Collaboration Readiness

Focus:

- Collaboration planning.
- Team workspace concepts.
- Richer AI tooling.

Success criteria:

- A permission model is designed before any shared workspace data is exposed.
- Collaboration concepts are validated without weakening single-user isolation.
- Richer AI workflows remain planning-only unless execution capabilities are explicitly approved.

## Do Not Build Yet

The following should remain out of scope until explicitly approved:

- Real code execution.
- Sandboxed execution.
- Autonomous agent actions.
- GitHub repository import or write-back.
- Pull request creation or merge workflows.
- Stripe billing or paid plan enforcement.
- Organization/team permission changes in production.
- Embeddings/vector database infrastructure.
- External monitoring vendors such as Sentry, PostHog, or LogRocket.
- Destructive project operations.
- Large production ZIP upload tests.
- Any feature that requires weakening auth, admin isolation, RLS, route protection, safe logging, or correlation traceability.

## Architectural Guardrails

Top guardrails for all v2 work:

1. Preserve auth isolation.
   Every private route, API, project, thread, message, usage event, and uploaded asset must remain scoped to the authenticated user unless a future permission model explicitly grants access.

2. Preserve admin isolation.
   `/app/admin`, admin dashboard queries, admin checklists, audit visibility, and governance data must remain behind `is_admin()` and must not render before validation.

3. Preserve correlation IDs.
   Server request handling, chat, upload/ingestion, admin warnings, audit events, usage events, and root failures should remain traceable by `correlationId`.

4. Preserve safe logging.
   Logs must stay redacted and must never expose auth headers, cookies, JWTs, API keys, service-role keys, raw prompts, uploaded file contents, or full project source content.

5. Preserve route and API protection.
   Protected routes must redirect unauthenticated users, authenticated APIs must return safe `401` boundaries without secrets, and production errors must remain generic to users.

## Recommended Capability Order

1. Project memory layer.
2. Context recall.
3. Project intelligence summaries.
4. Repository understanding improvements.
5. AI execution planning improvements.
6. Usage analytics dashboard.
7. Advanced governance visibility.
8. Operator tooling.
9. Thread organization/search.
10. Collaboration.
11. Team workspace concepts.
12. Richer AI tooling.
