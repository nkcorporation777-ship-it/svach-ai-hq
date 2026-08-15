# Svach AI HQ — Phase 1 PRD

Turns everything decided in `PRODUCT_VISION.md`, `INFORMATION_ARCHITECTURE.md`,
`DATABASE_SCHEMA.md`, `AI_ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `UI_UX_GUIDELINES.md`,
`SECURITY_POLICY.md`, and `DECISION_LOG.md` into concrete, buildable Phase 1
requirements. This document scopes and sets acceptance criteria — it doesn't restate
screen layouts, schema, or architecture already specified elsewhere; it references
them.

## 1. Overview

Phase 1 builds the HQ foundation plus the first two live departments — **Sales** and
**Nexus** — because that's where the Owner's actual operational pain is today, not
because the org chart lists them first (`DECISION_LOG.md`, roadmap discussion). It
replaces zero of the current tooling for Delivery (that's Phase 2); it's specifically
meant to replace the ad hoc lead/client tracking currently living outside any system.

## 2. Goals for Phase 1

- The Owner can run the full lead lifecycle — capture, track through pipeline stages,
  convert to a client — inside HQ, not a spreadsheet or memory.
- The Owner can see which clients need attention (follow-ups, onboarding progress)
  without checking multiple places.
- The OOA dashboard exists as a real, working shell — System Health populated by real
  n8n signals, Action Queue wired end-to-end (even though it will show few or no cards
  until Hermes exists to populate it — see §8).
- Every write to real business data is audited, and every table has RLS from day one —
  not retrofitted later (`SECURITY_POLICY.md`).
- The whole thing looks and feels like Svach AI HQ, not a generic admin template —
  built against `DESIGN_SYSTEM.md`'s measured tokens and `UI_UX_GUIDELINES.md`'s
  patterns from day one, not skinned after the fact.

## 3. Out of Scope (Explicit)

Consolidated from every doc's own deferral notes, in one place so nothing gets
built by accident:

- **No multi-user.** Single Owner login only. No invites, no team-management UI, no
  role-based nav scoping (`DECISION_LOG.md` §1). Permission roles and department
  membership exist in the schema but aren't exercised.
- **No multi-tenant / tenant RLS.** Single-tenant only (`DECISION_LOG.md` §2).
- **No Delivery, Marketing, Finance, or Support modules.** Locked placeholders in the
  sidebar only (`INFORMATION_ARCHITECTURE.md` §8).
- **No Proposals, Contracts, or Pricing tables/documents.** "Proposal Sent" is a
  pipeline-stage label only (`DATABASE_SCHEMA.md`).
- **No autonomous agents.** Sales/Nexus "agents" (Lead Hunter, Follow-up Agent, etc.)
  are pipeline stages and AI-assist actions, not standalone agents
  (`INFORMATION_ARCHITECTURE.md` §4).
- **No live Hermes integration.** The HQ↔Hermes boundary is built and stubbed
  (endpoints exist, interfaces defined) but not wired to a running Hermes
  (`DECISION_LOG.md` §10).
- **No LLM provider wired up.** AI-assist Edge Functions and prompt templates are built
  against the `AIProvider` interface; the concrete provider is dropped in later
  (`AI_ARCHITECTURE.md`).
- **No semantic/embedding search in Knowledge.** Category/tag + full-text search only
  (`INFORMATION_ARCHITECTURE.md` §3.1).
- **No cross-module Knowledge surfacing** (e.g. "Related Knowledge" panels on Lead/Client
  detail) — Knowledge is reached by navigating to it directly.
- **No full role-capability matrix.** Trivial owner-only RLS policy ships instead
  (`SECURITY_POLICY.md`).
- **No billing/subscription settings.**
- **No self-hosted n8n infrastructure.** Stage 1 is n8n Cloud, already live
  (`DECISION_LOG.md` §11). Do not introduce a VPS, Docker, or Caddy — that's a future
  infrastructure stage (`ROADMAP.md`), not a Phase 1 requirement.

## 4. Users

Single user: the Owner, `permission_role: owner` (`DATABASE_SCHEMA.md`). No persona
work needed beyond this — see `PRODUCT_VISION.md` for the fuller multi-user picture
that Phase 1 deliberately doesn't build toward yet.

## 5. Functional Requirements

### 5.1 Authentication & Shell

- Supabase Auth login (email/password at minimum). No signup flow — the Owner's
  account is provisioned directly, not self-registered, since there's exactly one.
- Sidebar renders per `INFORMATION_ARCHITECTURE.md` §1: Dashboard, Knowledge, Sales,
  Nexus live; Delivery/Marketing/Finance/Support locked with their phase tag; Settings
  live.
- Locked modules are clickable and show an honest "coming in Phase N" state — never a
  404, never hidden.
- Global search (§1) covers leads, clients, and knowledge documents in Phase 1.

### 5.2 Dashboard (OOA Home)

Per `INFORMATION_ARCHITECTURE.md` §2 and `AI_ARCHITECTURE.md`'s OOA Architecture:

- **System Health panel**: reads `ooa_system_health_events`, populated by the two
  Phase 1 n8n workflows (§5.7). Shows connected-system status strip and recent
  workflow runs.
- **Action Queue**: reads `ooa_recommendations` where `status = pending`. Approve
  executes per the two-branch flow (`AI_ARCHITECTURE.md`); Dismiss sets
  `status = dismissed`. Built and testable end-to-end even before Hermes exists — see
  §8 for how this gets verified without a live Hermes.
- **Agent Activity**: derived feed from `audit_logs` — no new table
  (`INFORMATION_ARCHITECTURE.md` §2.3).
- **At-a-glance stats**: pipeline value/count by stage (Sales), clients flagged for
  follow-up (Nexus) (§2.4).
- Empty states throughout are honest, not decorative (`UI_UX_GUIDELINES.md`).

### 5.3 Knowledge

Per `INFORMATION_ARCHITECTURE.md` §3:

- List/search view: full-text search + category/tag filters.
- Document detail: rendered markdown, edit-in-place, version history (every edit
  writes a `knowledge_document_versions` row), optional file attachments.
- New document: manual creation, category + tags required, content optional at
  creation (can be filled in after).
- **Business rule**: deleting a document is a soft delete (`deleted_at`) — version
  history and attachments are retained, not cascade-deleted.

### 5.4 Sales

Per `INFORMATION_ARCHITECTURE.md` §4 and `DATABASE_SCHEMA.md`'s `leads`/`activities`:

- **Pipeline board**: columns = `lead, contacted, discovery_booked, proposal_sent,
  verbal_commit, won, lost`. `verbal_commit` = said yes, contract not signed yet;
  `won` = contract fully executed (`DECISION_LOG.md` §12) — deliberately not called
  "Qualified," which conventionally means early-funnel vetting, not late-funnel
  commitment. Drag-and-drop between columns writes an `activities` row
  (`type: stage_change`).
- **New Lead form** — required: `practice_name`. At least one of `contact_email` /
  `contact_phone` required (a lead with no way to reach them isn't a usable record) —
  enforced by a database `CHECK` constraint, not just UI validation, the same pattern
  as the Lost-reason rule (`DATABASE_SCHEMA.md`). `specialty`, `source` optional but
  presented as fields, not hidden.
- **Lead detail**: profile, activity timeline, AI-assist panel (draft outreach email,
  summarize a call, suggest next action — draft only, human sends).
- **Business rule — Won**: setting stage to `won` (contract fully executed) creates a
  linked `clients` row automatically (`source_lead_id` set), seeds the default
  onboarding checklist (§5.5), and writes an `activities` entry on the lead recording
  the conversion. The lead record itself is not deleted or hidden — it remains as
  history.
- **Business rule — Lost**: setting stage to `lost` requires selecting a
  `lost_reason_category` from a fixed set (with `lost_reason_detail` required only
  under "Other") — enforced by a database `CHECK` constraint, not just UI validation
  (`DATABASE_SCHEMA.md`, `DECISION_LOG.md` §12). Losing a deal with no reason, or an
  inconsistent free-text reason, makes the data useless for the "what's not
  converting" question later.
- Lead List (table view): sortable/filterable by stage, owner, last activity, source.

### 5.5 Nexus (CRM)

Per `INFORMATION_ARCHITECTURE.md` §5 and `DATABASE_SCHEMA.md`'s `clients`/
`client_onboarding_steps`/`follow_ups`:

- **Client List**: health-flag column computed at query time from
  `last_contacted_at` (no stored status — `DATABASE_SCHEMA.md`'s explicit note).
  Flag threshold: **14 days** since last contact = amber flag.
- **Default onboarding checklist — strict sequential gate** (`DECISION_LOG.md` §12):
  *Contract executed* (seeded pre-completed — `won` already means this is true) →
  **Welcome message sent** → **Primary contact confirmed** → **Billing details
  collected** → **Kickoff call scheduled**. The four real steps are gated in order —
  step N+1 is locked in the UI until step N is marked complete, enforced at the
  application layer, not the database (this is a workflow rule, not a security
  boundary). Reflects the handoff from a won deal to an active client — not the
  Delivery-phase Discover→Design→Deploy→Optimise cycle itself, since Delivery doesn't
  exist yet in Phase 1.
- **Client Detail**: profile, onboarding checklist (check off steps), follow-up
  reminders (scheduled + past, snooze/complete), activity timeline (shared with Sales
  history via `activities` if the client originated as a lead), AI-assist panel (draft
  follow-up, summarize recent activity).
- **Follow-up Queue**: cross-client view, sorted by `due_at` ascending, overdue items
  visually distinguished (not just sorted to the top — needs a status treatment per
  `UI_UX_GUIDELINES.md`'s "encode state in form, not just position").
- **Business rule**: completing a follow-up sets `status: done`, `completed_at`, and
  writes a corresponding `activities` row (`type: call` or `email`, matching how the
  follow-up was actually carried out) — that activity entry is what feeds the client's
  live-computed `last_contacted_at` (`DATABASE_SCHEMA.md`), not a direct field update.
  Completing a follow-up without logging what kind of contact it was would silently
  fail to clear the health flag.

### 5.6 Settings

Per `INFORMATION_ARCHITECTURE.md` §7: profile (name, avatar, notification
preferences) only. No team management, no billing.

### 5.7 n8n Workflows Required for Phase 1

Two workflows, proving the HQ↔n8n↔Supabase loop end to end (per the original roadmap
discussion). Hosting resolved (`DECISION_LOG.md` §11): n8n Cloud, live at
`svach001.app.n8n.cloud`, webhook URLs follow `https://svach001.app.n8n.cloud/webhook/...`.

1. **New-lead notification** — triggers on a new `leads` row, notifies the Owner.
2. **Follow-up reminder scheduler** — scheduled workflow, checks `follow_ups` for
   items due soon/overdue, notifies the Owner.

Both report execution status back into `ooa_system_health_events` on every run,
per `AI_ARCHITECTURE.md`'s System Health lens design. The credential HQ uses to
trigger/read these workflows is handled per `SECURITY_STANDARDS.md` — server-side
only, inside an Edge Function, never shipped to the browser.

## 6. Non-Functional Requirements

- **Design**: built against `DESIGN_SYSTEM.md`'s measured tokens (Fraunces/Inter type
  scale, the exact glassmorphism card recipe, the two-radius scale, measured motion
  timing) — not approximated.
- **Interaction patterns**: per `UI_UX_GUIDELINES.md` — no hero sections anywhere in
  HQ; rainbow/aurora gradients reserved for OOA branding and primary CTAs only; every
  interactive element has a visible keyboard focus state.
- **Security**: RLS enabled on every table listed in `SECURITY_POLICY.md`'s coverage
  list, no exceptions, before any table is considered "shipped." Role-escalation
  trigger (`SECURITY_STANDARDS.md` §16) in place even though there's only one user.
- **Accessibility**: WCAG AA contrast at minimum, checked against actual token pairs,
  not assumed (`UI_UX_GUIDELINES.md`).
- **Performance**: no specific target — V1 is single-user, so this isn't a load-bearing
  requirement yet. Don't optimize prematurely; do avoid obviously wasteful patterns
  (e.g. fetching the full lead list to compute a count that could be a query).

## 7. Definition of Done — Phase 1 Acceptance Checklist

- [ ] Owner can log in and see the sidebar with correct live/locked state per module.
- [ ] A lead can be created, moved through every pipeline stage via drag-and-drop
      (including the `verbal_commit` stage), and marked Won — contract executed —
      (creating a linked client + seeded checklist) or Lost (blocked at the database
      level without a `lost_reason_category`, and without `lost_reason_detail` when
      the category is "Other").
- [ ] A new client's onboarding checklist enforces its sequential gate — step 2 can't
      be completed before step 1, etc. — with "Contract executed" pre-completed.
- [ ] A client's health flag correctly reflects 14+ days since last contact, computed
      live, not stored.
- [ ] Completing a follow-up logs a matching `call`/`email` activity, which correctly
      flows into the client's live-computed `last_contacted_at` and clears its health
      flag — with no direct field update anywhere in the codebase.
- [ ] A Knowledge document can be created, edited (producing a version row each edit),
      tagged, searched by keyword/tag, and soft-deleted without losing its version
      history.
- [ ] AI-assist produces a draft (email/summary/suggestion) that is never sent/saved
      without explicit human action.
- [ ] Both Phase 1 n8n workflows run and report status into `ooa_system_health_events`,
      visible on the Dashboard's System Health panel.
- [ ] The Action Queue UI, `hermes/recommendations` endpoint, and Approve/Dismiss flow
      are functional and testable via a manually-inserted test recommendation (§8) —
      even with no live Hermes yet.
- [ ] Every table in `SECURITY_POLICY.md`'s RLS coverage list has RLS enabled, verified
      directly against the schema, not assumed.
- [ ] The role-escalation-prevention trigger (`SECURITY_STANDARDS.md` §16) is in place
      on `profiles.permission_role` — a user cannot write their own role field
      directly, verified by attempting it, not assumed from the migration existing.
- [ ] `audit_logs` records every write from every actor type exercised in Phase 1
      (`user`, `agent` for AI-assist calls — `system`/Hermes-agent entries won't appear
      until those integrations are live).
- [ ] Shared UI primitives (status indicators, cards, buttons) are implemented once
      and reused across Sales, Nexus, and Dashboard — not recreated per-screen.
      `COMPONENT_LIBRARY.md` captures these as-built once Phase 1 ships.

## 8. Dependencies & Open Items

Carried forward from each doc's own "Open Items," consolidated here so nothing is
blocking silently:

| Item | Status | Blocks Phase 1? |
|---|---|---|
| LLM provider choice | Undecided (`DECISION_LOG.md` §7) | No — `AIProvider` interface ships now, concrete implementation drops in later |
| Hermes | Planned, not built (`DECISION_LOG.md` §10) | No — boundary is stubbed; verify the Approve/Dismiss flow via a manually-inserted test row in `ooa_recommendations` rather than waiting for real Hermes traffic |
| n8n hosting | **Resolved** — n8n Cloud, live at `svach001.app.n8n.cloud` (`DECISION_LOG.md` §11) | No longer blocking — §5.7 can be built |
| Fraunces font hosting | Self-host recommended (`DESIGN_SYSTEM.md`) | No — cosmetic, not a blocker |
| Full role-capability matrix | Deferred to 2nd user (`SECURITY_POLICY.md`) | No — trivial RLS policy is the Phase 1 requirement |
