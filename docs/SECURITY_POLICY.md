# Security Policy — Svach AI HQ

Project-specific security decisions; companion to `SECURITY_STANDARDS.md` (the general
engineering rules). Phase 0 — Product Planning & Architecture.

## How This Relates to `SECURITY_STANDARDS.md`

That document is how Claude Code writes secure code — patterns, checklists,
non-negotiables, reusable across any project. This document is what's actually true
for Svach AI HQ — who the actors are, what each role can do, how the audit trail
actually works here, and what's still genuinely undecided. Implementation follows the
standards doc's patterns applied to this doc's specifics, not the standards doc's
generic examples verbatim.

## Actor Model

Three actor types can act inside HQ — the one place the generic standard needs
adapting, not just applying:

| Actor | What it is | Supabase Auth user? |
|---|---|---|
| `user` | A human, a row in `profiles`, `permission_role` in (owner, admin, manager, member, viewer) | Yes |
| `agent` | OOA (on Hermes) today; future specialist agents | No — never a Supabase Auth session |
| `system` | n8n workflows, scheduled jobs | No |

Why `SECURITY_STANDARDS.md` §5's generic `audit_logs` example (`user_id REFERENCES
auth.users(id)`, nothing else) can't be used as written: there's no way to represent an
agent- or system-initiated action. Svach AI HQ's already-decided schema
(`audit_logs.actor_type: user | agent | system`, `DATABASE_SCHEMA.md`) is correct and
implemented as designed. This isn't a stylistic preference — without it, there's no way
to audit the exact category of action ("OOA proposed this," "n8n executed this") that
the whole approval model (`DECISION_LOG.md` §5, §10) depends on being traceable.

## Permission Role → Capability Mapping — Two Decisions, Not One

**Deferred, reasonably**: the full capability matrix (what manager vs. member vs.
viewer can each do). With one real user (the Owner — `DECISION_LOG.md` §1), there's no
scenario yet where the distinction matters. Design this when there's a second real
user, not before.

**Not deferred — ships in Phase 1 regardless of team size**: RLS enabled on every
table, with a trivial interim policy (`SECURITY_STANDARDS.md` §4). This isn't about
internal role granularity; it's that HQ is a client-only SPA shipping a public anon key
by design (`Claude.md.txt`), and a table with no RLS is queryable by anyone who finds
that key, not just teammates.

```sql
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access" ON public.table_name
  FOR ALL USING (auth.uid() IS NOT NULL);
```

One line per table, no role logic required. Gets swapped for real per-role policies
once the capability matrix is designed — nothing here is wasted work, just tightened
later.

**Mechanism for the eventual matrix is already solved** — the `is_admin()`-style
`SECURITY DEFINER` function and `prevent_role_escalation()` trigger from
`SECURITY_STANDARDS.md` §16 are the right pattern, directly usable with Svach's actual
`permission_role` enum. Build the escalation-prevention trigger before there's a second
user, not after — cheap now, awkward to retrofit once there's something real to
escalate to.

## Hermes Service Credential — Resolved

Open question from `AI_ARCHITECTURE.md`'s Hermes Integration Boundary: a general
Supabase service-role key, or something narrower? Resolved using
`SECURITY_STANDARDS.md`'s own principles (§10 — never expose service-role keys; §1 —
least privilege; §17 — prefer minimal, focused changes):

Hermes authenticates with a **purpose-built credential**, checked by one dedicated Edge
Function (`hermes/recommendations`), scoped to exactly one capability: insert
`ooa_recommendations` rows with `status = 'pending'`. Never a Supabase service-role
key. This makes the "the Hermes-facing endpoint can only ever write `pending`"
guarantee already documented in `DATABASE_SCHEMA.md` a **structural fact**, not an
assumption about how carefully the endpoint code was written — if the credential
itself can't do more than that, a bug in the endpoint can't either. If Hermes is ever
compromised, the blast radius is "can create pending recommendations," not "can read or
write anything in the database."

**Same pattern, three separate credentials — not one shared credential across
endpoints.** `AI_ARCHITECTURE.md` names two other Hermes-facing endpoints,
`hermes/delegation-results` and `hermes/agent-status` (Phase 1+). Each gets its **own**
purpose-built credential, scoped to only that endpoint's one capability — reporting a
delegation result can't also create recommendations, and vice versa. A single
credential valid across all three would make the blast radius "everything Hermes can
do," not "the one thing this specific compromised credential could ever do" — exactly
the failure mode the recommendations-endpoint design above was built to avoid. Stating
this explicitly rather than leaving it implied by proximity to the recommendations
design.

**Worth stating explicitly so this doesn't get built two different ways**: Hermes never
calls Supabase directly and never gets its own RLS policy on `ooa_recommendations`. It
calls the dedicated Edge Function; that function alone holds the elevated credential
needed to write, and enforces the pending-only constraint in its own code before
writing. The table's RLS policy (the owner-only interim rule above) governs
browser/user access only — Hermes's access is controlled entirely at the Edge Function
layer, not the database layer. Stated plainly because the natural but wrong assumption
is that Hermes needs its own RLS entry.

## RLS Coverage — Pattern Decided, Full Phase 1 Table List Confirmed

`SECURITY_STANDARDS.md` §4 and §19 give the baseline and checklist. Checked directly
against `DATABASE_SCHEMA.md`, not assumed:

- **Real data — owner-only interim policy** (per above): `profiles`, `leads`,
  `activities` (the shared timeline used by both leads and clients — easy to miss since
  it's not named after either), `clients`, `client_onboarding_steps`, `follow_ups`,
  `knowledge_documents`, `knowledge_document_versions`, `knowledge_document_attachments`,
  `ooa_recommendations`, `ooa_system_health_events`, `audit_logs`.
- **Lookup/reference tables** — RLS still enabled (no exceptions, `SECURITY_STANDARDS.md`
  §4), but the policy is "readable by any authenticated user," not owner-scoped, since
  they're shared enums rather than per-record data: `departments`, `specialties`,
  `knowledge_categories` (the lookup table behind Knowledge's "Sales Playbooks,"
  "Pricing," "SOPs" categories — `DATABASE_SCHEMA.md` — easy to miss for the same
  reason `activities` was: it's not the table anyone's thinking about when reasoning
  through "what needs RLS").
  `profile_departments` (the department-membership junction table) gets the same
  owner-only interim policy as the real-data tables, even though it's unused in V1 —
  "unused" isn't a reason to skip RLS, it's a reason the policy will be trivial to
  write.

Single-tenant/single-user today lowers urgency but doesn't remove it:
`DECISION_LOG.md`'s tenancy decision already commits to RLS "from day one," and the
Phase-4-and-beyond client-portal direction (`PRODUCT_VISION.md`) depends on this already
being correct rather than retrofitted under deadline pressure.

## Data Sensitivity — Resolved

**Confirmed**: everything HQ stores stays at the business-relationship level — clinic
contacts, deal value, contract/engagement status, onboarding progress. Nothing
patient-identifiable is ever expected to enter HQ (activity notes, onboarding
checklists, and engagement records are about the *clinic as a client*, not their
patients). No healthcare-data-handling obligation (e.g. a business-associate-style
requirement) is triggered by anything currently planned.

This is a confirmed scope boundary, not just an assumption — if that ever changes (a
future feature that touches patient-level data, even indirectly), it needs a fresh
security pass at that point, not a quiet extension of the current plan.

**Second location this applies to**: this question was originally scoped to what lives
in Supabase. n8n Cloud (`DECISION_LOG.md` §11) is a second place it now applies — it's
a third-party processor for whatever data flows through the Phase 1 workflows. The
"business-relationship level only" answer covers both locations as currently scoped;
if a future workflow ever touches patient-level data, both this doc and the n8n
data-flow need re-checking together, not just one.

## Explicitly Not Addressed Yet

- **Data retention / backup policy** — `SECURITY_STANDARDS.md` §21.
- **Incident-response procedure** — `SECURITY_STANDARDS.md` places this under "Long
  Term" (§21); reasonable to defer, just noting it hasn't started.
- **Environments/deployment security** (dev/staging/prod separation, how Hermes and HQ
  stay in sync across environments, Supabase migration flow) — **genuinely
  undecided, not documented anywhere yet.** Previously described here as "belongs in
  `ROADMAP.md`" — checked directly against the actual `ROADMAP.md`, and it isn't
  there; that doc covers the product phases and the n8n hosting stages only. Correcting
  the record: saying where something *should* go isn't the same as it being written
  down. Worth resolving before Phase 1 kickoff, not assumed to already exist.

## Next Step

Trivial single-owner RLS ships in Phase 1, on every table, no exceptions — cheap and
non-negotiable regardless of team size. The full role capability matrix is genuinely
deferred until there's a second real user. The data-sensitivity question is resolved
(business-relationship level only) — revisit only if a future feature changes that
boundary.
