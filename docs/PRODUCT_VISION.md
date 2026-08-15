# Svach AI HQ — Product Vision

## Mission

Build one unified platform that allows Svach AI to run its entire business — sales,
clients, delivery, marketing, finance, and support — from a single intelligent
workspace, so that no part of the operation depends on a disconnected tool, a
forgotten spreadsheet, or someone's memory.

## What Svach AI HQ Is

Svach AI HQ is an **AI-first business operating system**, purpose-built for how Svach
AI actually runs — not a general-purpose tool adapted to fit. Every module exists
because it strengthens the same connected ecosystem: a lead becomes a client becomes a
project becomes an invoice, and the system never loses that thread.

At the center sits the **Operations Orchestrator Agent (OOA)** — one intelligence layer
that watches the whole business, in two ways:

- **System Health** — is everything actually running (agents, workflows, integrations)?
- **Business Insights** — what needs attention, and what should happen next?

The OOA never acts on its own. It observes, it recommends, and it executes only after
a human explicitly approves — the same "human-in-the-loop by design" principle Svach AI
already promises its own clients on svach.in. HQ should feel like proof of that promise,
not just a claim on a marketing page.

Alongside the OOA sits the **Knowledge layer** — a shared base of documents, SOPs, and
reference material that every department and every AI agent can draw on. It isn't one
of the six departments; it's infrastructure the departments and the OOA both depend on,
the same way the OOA itself isn't tied to any single department.

## What Svach AI HQ Is Not

- **Not a CRM.** Client relationship management is one module inside HQ — we call it
  **Nexus** — not the whole platform.
- **Not a project management tool.** Delivery tracking is one department among six.
- **Not a generic dashboard.** Every screen ties back to a real business action, not a
  vanity metric.
- **Not a collection of disconnected tools wearing one login.** If a feature doesn't
  share data or context with the rest of the system, it doesn't belong in HQ.

## Primary Users

**Version 1**: single-user — the Owner only. Svach AI itself runs as a small team
(2–5 people) day to day, but V1 of HQ is deliberately scoped to one login: the Owner
operates the system directly while the rest of the team's work continues outside it
for now. This keeps V1 simple — no multi-user permissions, invites, or collaboration
UI to build before the core operational modules exist.

**Later**: individual logins for the rest of the team, then employees and contractors
as the team grows, and eventually external users — clients and healthcare clinics —
through dedicated client portals. The permission-role and department-membership
concepts (see `DATABASE_SCHEMA.md`) are modeled into the schema from V1 so this
expansion is additive, not a rewrite — see `DECISION_LOG.md` for the full reasoning.

## Product Philosophy

**One Platform. One Intelligence Layer. Complete Business Operations.**

Point tools create islands — the same failure mode Svach AI calls out in its own
clients' businesses on svach.in ("point tools create islands... infrastructure connects
them"). HQ exists so Svach AI never becomes the case study it warns its own clients
about. A lead, a project, an invoice, and a support ticket should read as one continuous
record, not four disconnected systems that happen to share a login page.

Every feature is filtered through one question: **does this make Svach AI easier,
smarter, faster, or more automated to run?** If not, it doesn't belong in HQ, no matter
how commonly other tools include it.

## Design Principles

The interface should feel: **premium, enterprise, modern, AI-first, minimal,
professional, calm, trustworthy** — a direct extension of svach.in's visual language
(glassmorphism, the confirmed dark/electric-blue/cyan palette, restrained motion).

Avoid: generic admin templates, gaming aesthetics, cyberpunk themes, excessive visual
clutter, and — consistent with svach.in's own honesty about being pre-launch — any
decorative or fabricated data. Empty states say "coming soon," not a fake chart.

## Long-Term Vision

The website is the public face of Svach AI. **Svach AI HQ is the operational brain.**
It starts as an internal tool for a five-person team and is architected to grow into a
full enterprise AI Operating System — role-based workspaces, client portals, advanced
analytics, and eventually additional SaaS products built on the same intelligence
layer. Every architectural decision in `DATABASE_SCHEMA.md` and `AI_ARCHITECTURE.md`
should be evaluated against whether it supports that trajectory without requiring a
rebuild to get there.
