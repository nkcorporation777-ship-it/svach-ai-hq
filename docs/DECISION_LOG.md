# Architecture Decision Log

**Role of this document**: this is a decision log, not a permanent source of truth. It
exists to resolve architectural ambiguity during planning. As each decision below is
incorporated into its proper core document (`PRD.md`, `SECURITY_STANDARDS.md`/
`SECURITY_POLICY.md`, `DATABASE_SCHEMA.md`, `UI_UX_GUIDELINES.md`, `Claude.md.txt`'s
Technical Direction section), that core document becomes authoritative for that topic.
Once merged, this log is a historical record for traceability — if a future decision
changes something here, update the relevant core document first, and reflect the change
here for the record.

- Architecture Clarifications = Decision Log
- Core Documents = Single Source of Truth

---

## 1. Application Scope

Svach AI HQ is an internal AI Operating System for managing and operating the Svach AI
agency. **Version 1 is single-user (Owner only)** — confirmed: as of this writing, only
the Owner logs in. Svach AI's broader team (2–5 people) continues working outside HQ
for now; multi-user login is explicit future scope, not V1. Do not design or implement
client portals, employee portals, or multi-user collaboration yet. Future expansion
should be possible without major architectural changes.

## 2. Database Architecture

Version 1 is **single-tenant**. Do NOT implement multi-tenant architecture, tenant
isolation, or tenant-based RLS. The schema stays modular and clean so multi-tenancy can
be introduced later without a redesign. Optimize for today's simplicity while keeping
tomorrow's scalability in mind.

## 3. Roles vs. Departments

These are two separate concepts — never combine them.

**Permission Roles** (what a user is allowed to do): Owner, Admin, Manager, Member,
Viewer.

**Departments** (which business modules a user belongs to / which sections they access):
Sales, CRM, Marketing, Delivery, Finance, Support.

**Addendum (confirmed in follow-up)**: the CRM department's product-facing name is
**Nexus**. It remains the CRM-type department functionally (client relationship
management); only the user-facing label changes — table names (`clients`,
`follow_ups`, etc.) stay plain and technical rather than renamed to match the brand,
so the schema stays clear to whoever builds it regardless of what the product calls
the module this month.

## 4. Knowledge

Knowledge is NOT a department. It's a shared intelligence layer used across the entire
platform — every module and every AI agent can access it when required. Designed as a
reusable service, not an independent business department.

**Addendum (confirmed in follow-up discussion)**: Knowledge ships as its own **module
in the sidebar** — a real, database-backed module (Postgres-stored documents authored
in markdown, with tags/categories, full-text search, and optional file attachments via
Supabase Storage), not flat `.md` files in a repo and not an invisible backend-only
service. Positioned in the nav as a global item, not grouped with the six departments,
since it belongs to the whole platform rather than one team. Semantic/embedding-based
retrieval (pgvector) is deferred until there's enough content volume for keyword/tag
search to fall short — V1 keeps retrieval simple.

## 5. Operations Orchestration Agent (OOA)

OOA is the executive AI of Svach AI HQ. Responsibilities: monitor every AI agent,
monitor workflows, detect failures, detect opportunities, coordinate operations,
generate recommendations, notify the Owner.

OOA may: analyze, recommend, prepare actions.

OOA must **never** execute business-impacting actions without explicit Owner approval.
Human approval is mandatory before: sending emails, publishing social media posts,
approving invoices, updating critical records, running destructive operations,
deploying production changes. The Owner always has final authority.

**Addendum (confirmed in follow-up)**: OOA is **the only proactive orchestrating agent**
in the system, and it is developed/deployed separately on **Hermes** — a dedicated
external runtime, not part of the HQ codebase. HQ does not build or own OOA's reasoning
loop; HQ is the control plane OOA reports into and gets approval from. For Phase 1:
`OOA → Analyze → Recommend → Ask Owner → Owner Approves → Execute`. See §9 and §10 for
how this plays out for specialist agents and the HQ↔Hermes boundary — full detail in
`AI_ARCHITECTURE.md`.

## 6. Audit Logs vs. Version History

Implement audit logs platform-wide — important user actions and AI agent activity.
Full version history is scoped to business-critical entities only: Proposals,
Contracts, Pricing, Knowledge Documents. Do NOT implement version history for every
table.

**Addendum (confirmed in follow-up)**: Proposals/Contracts/Pricing tables are **held,
not scaffolded**, until the feature that actually produces those documents ships
(Phase 1's Sales module only has "Proposal Sent" as a pipeline-stage label, not a
generated/stored document yet). Building empty tables now for entities nothing writes
to would be schema for a feature that doesn't exist — see `DATABASE_SCHEMA.md` for the
full reasoning. Knowledge Documents' version history ships now since that module is
live in Phase 1.

## 7. AI Architecture

Claude Chat and Claude Code are development tools only — not part of the runtime
application. The runtime AI provider is decided later. Do not make implementation
decisions that depend on a specific LLM provider; the AI layer stays modular and
replaceable (a provider adapter, not a hardcoded SDK integration).

## 8. Engineering Philosophy

Prefer: simplicity over unnecessary complexity, modular architecture, reusable
components, clean code, security by default, performance by default, maintainability
over clever implementations. Avoid over-engineering. Build only what Version 1
requires while keeping the architecture extensible.

## 9. Specialist Agents Are Reactive

Sales, Nexus, Delivery, Finance, Marketing, Support, and any future domain agent are
**reactive workers, not proactive monitors**. They do not run their own always-on
watch loop over their department — that job belongs solely to OOA (§5). A specialist
agent acts only when:

- OOA delegates a task to it (after Owner approval),
- a user explicitly requests an action,
- a system event triggers it, or
- an n8n workflow (or another approved workflow) invokes it.

Specialist agents are not required to run on the same runtime as OOA — do not assume
every specialist agent needs to be built or hosted on Hermes. Use whatever runtime or
execution mechanism fits the task (HQ Edge Functions, n8n, or otherwise).

## 10. OOA Runtime — Hermes & the HQ↔Hermes Boundary

OOA's reasoning engine lives on **Hermes**, a separate runtime Claude Code does not
build as part of Svach AI HQ. HQ integrates with it through a defined API boundary,
not a tight coupling to Hermes internals — Hermes can evolve independently of the HQ
application.

**Approval model (Phase 1)**: event → OOA (on Hermes) detects/reasons → OOA creates a
recommendation → **Owner approval required** → approved → OOA delegates the task →
reactive specialist agent/workflow executes → result returned → OOA/HQ records the
result → Owner can review. Rejected recommendations never execute.

**Confirmed (follow-up)**: on approval, delegation is **not** required to always route
through Hermes. Where a recommendation already fully specifies a known, simple action
(e.g. a named n8n workflow + payload), HQ may execute it directly — a fast path.
Hermes is invoked for delegation only when the action genuinely needs Hermes to decide
or dispatch. Full mechanics in `AI_ARCHITECTURE.md`'s "Hermes Integration Boundary."

**Confirmed (follow-up)**: Hermes is **planned, not built yet**. HQ's side of this
boundary is designed and stubbed now — same treatment as the undecided LLM provider
(§7) — not wired to a live system until Hermes exists.

Do not build a complex autonomous multi-agent framework for every department in Phase
1. Phase 1 establishes: the HQ foundation, the OOA integration boundary (stubbed),
the OOA dashboard/interface, the Owner approval mechanism, the specialist-agent
task/delegation model, audit logging, and n8n integration. Actual specialist agents are
introduced incrementally after that.

## 11. n8n Hosting — Stage 1 Resolved

**n8n Cloud, active today** at `svach001.app.n8n.cloud` — not a future decision, a
live fact, verified directly against the connected n8n instance (confirmed again this
session via the n8n MCP tools — a real, active workflow was found on the connected
instance, corroborating it's genuinely live, not a placeholder). This resolves
`PRD.md`'s only real Phase 1 blocker: the two required n8n workflows (new-lead
notification, follow-up reminder scheduler) can now actually be built.

Practical implications:
- Webhook URLs follow `https://svach001.app.n8n.cloud/webhook/...`.
- Auth model is n8n Cloud's API-key pattern.
- The credential HQ uses to trigger/read n8n workflows is handled like every other
  secret in `SECURITY_STANDARDS.md` — server-side only, inside an Edge Function, never
  shipped to the browser.

This is Stage 1 of a staged infrastructure roadmap (agency-controlled n8n Cloud now,
evaluate self-hosted at ~10–25 clients, dedicated/client-owned for enterprise cases
with isolation requirements) — full staged plan in `ROADMAP.md`. **Explicit scope
guard**: do not introduce a VPS, Docker, or Caddy into the current build — that's
future-stage infrastructure, not a Phase 1 requirement.

**Connects to `SECURITY_POLICY.md`'s data-sensitivity scope**: that question was
answered for what lives in Supabase (business-relationship level only, confirmed). n8n
Cloud is a second place the same question applies — it's a third-party processor for
whatever data flows through these workflows. Doesn't change the Stage 1 decision; the
data-sensitivity boundary just needs to be understood as covering both.

## 12. Sales Pipeline & Onboarding Refinements

Resolved while writing `PRD.md`'s business rules — three related decisions:

**Verbal commit vs. signed contract are different stages.** The Sales pipeline gets a
new stage, `verbal_commit`, between `proposal_sent` and `won` — a lead has said yes,
the contract isn't signed yet. **`won` now specifically means the contract is fully
executed.** Deliberately not named "Qualified" — that term conventionally means
early-funnel vetting ("legitimate prospect"), not late-funnel commitment ("said yes,
paperwork pending"); reusing it here would make pipeline reports ambiguous. Full stage
list and schema in `DATABASE_SCHEMA.md`.

**Lost reason is structured and DB-enforced.** A fixed `lost_reason_category` enum
(with a required free-text `lost_reason_detail` only under `other`), enforced by a
`CHECK` constraint — not a UI-only requirement — so loss data can't exist without a
reason and can't be inconsistent free text that resists reporting.

**Onboarding checklist is a 4-step strict sequential gate**, not the originally
proposed unordered 5-step list. Because `won` already means the contract is signed,
"Contract executed" isn't a real gate anymore — it's seeded pre-completed so the
checklist still shows the full journey. Real order: Welcome message sent → Primary
contact confirmed → Billing details collected → Kickoff call scheduled. Sequential
because the steps have real dependencies (can't schedule kickoff with an unconfirmed
contact); enforced at the application layer, not the database, since this is a
workflow rule, not a security boundary.

## 13. Client Health-Flag Source of Truth

Extends the "computed, never stored" pattern one level further. `clients` no longer
has a stored `last_contacted_at` column at all — it's derived live as
`MAX(activities.created_at)`, filtered to `call`/`email` types only (a logged `note` or
an `ai_draft` doesn't count as contact), via the `client_contact_status` view
(`DATABASE_SCHEMA.md`).

Why: a stored `last_contacted_at` requires every contact path to remember to update
it — the original design only updated it on follow-up completion, which meant a call
or email logged any other way wouldn't have cleared the flag. Deriving it from
`activities`, the single source of truth for what actually happened, removes that
whole class of bug rather than trying to catch every write path by discipline.

The 14-day threshold is a named constant (`CLIENT_HEALTH_THRESHOLD_DAYS`), not a bare
number inlined wherever this logic runs.

## 14. Decision-Making Rules

If documentation conflicts, precedence order: PRD → Security (`SECURITY_STANDARDS.md`/
`SECURITY_POLICY.md`) → Database → UI/UX → `Claude.md.txt`'s Technical Direction
(the tech stack has no separate `/docs` file) → this Decision Log.

If requirements remain unclear: do not guess. Explain the conflict, recommend the best
solution, wait for approval before implementation. The goal is a production-quality
foundation for V1, not anticipating every future feature.
