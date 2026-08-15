# Svach AI HQ — Component Library

**Status**: skeleton only. This doc is populated *as Phase 1 is actually built*, not
speculated in advance — a component's real props/variants/states are only known once
it exists. Premature detail here would just be guessed and likely wrong.

Component styling foundation (colors, type, radius, glassmorphism recipe, motion) is
already fully specified in `DESIGN_SYSTEM.md`'s Component Mapping section — this doc
inventories the actual components once built, it doesn't re-derive their tokens.

## Anticipated Inventory (from `INFORMATION_ARCHITECTURE.md` and `PRD.md`)

Named here so nothing gets built as a one-off when it should be shared — fill in
props/variants/states as each is actually implemented:

- **Card** — the glassmorphism base (`DESIGN_SYSTEM.md`'s recipe), used everywhere:
  Dashboard tiles, Knowledge documents, Lead/Client detail panels. Covers both of
  `UI_UX_GUIDELINES.md`'s observed card modes (feature-grid vs. narrative/stacked) —
  those are layout treatments of this one shared Card, not two separate components.
- **Pipeline Board / Kanban Column** — Sales pipeline (`INFORMATION_ARCHITECTURE.md`
  §4.1), drag-and-drop between stage columns.
- **Data Table** — Lead List, Client List, Follow-up Queue (TanStack Table, per the
  approved stack).
- **Stat Tile** — Dashboard at-a-glance stats, styled per `DESIGN_SYSTEM.md`'s
  measured stat-tile pattern.
- **Action Queue Card** — OOA recommendation card with Approve/Dismiss
  (`AI_ARCHITECTURE.md`'s two-branch flow).
- **Sequential Checklist Item** — Nexus onboarding steps, gated per
  `DATABASE_SCHEMA.md`'s `client_onboarding_steps` design.
- **Health Flag Badge** — amber/healthy indicator, driven by `client_contact_status`
  (`DATABASE_SCHEMA.md`).
- **AI-Assist Panel** — draft/summarize/suggest UI shared across Lead, Client, and
  Knowledge detail views (`AI_ARCHITECTURE.md`).
- **Locked Module Placeholder** — "Coming in Phase N" state for Delivery/Marketing/
  Finance/Support (`INFORMATION_ARCHITECTURE.md` §8).
- **Empty / Loading / Error States** — per `UI_UX_GUIDELINES.md`'s honesty and
  skeleton-loading rules, needed across every list/detail view.
- **Form Field Set** — React Hook Form + Zod, per the approved stack; New Lead, New
  Client, New Knowledge Document forms all share this foundation.

## Patterns From `UI_UX_GUIDELINES.md` Not Listed Above — Why

- **Section rhythm** (eyebrow → headline → paragraph) is page-level composition —
  typography and layout convention, not a discrete component with its own
  props/state. Correctly excluded from a *component* inventory; it still applies to
  HQ pages, just isn't something this doc tracks.
- **Capability checklist** (icon-badge + checkmark list, e.g. "KEY CAPABILITIES") —
  observed on the marketing site, but no Phase 1 HQ screen has a confirmed use for a
  display-only capability list (distinct from the interactive Sequential Checklist
  Item used for Nexus onboarding). Not added speculatively — add it here the moment a
  real screen needs it, per this doc's own rule against pre-populating unbuilt
  components.

## When to Update This Doc

Add a component here the moment it's built with more than one call site, or the
moment a second feature needs something close enough to an existing component that
reuse vs. duplicate is a real decision. Don't pre-populate variants/props before the
first real implementation exists.
