# Svach AI HQ — Database Schema (Phase 1)

Supabase Postgres. Scope: Identity/Access, Sales, Nexus (CRM), Knowledge, and OOA — the tables
needed to build `INFORMATION_ARCHITECTURE.md`'s Phase 1 screens. Delivery, Marketing,
Finance, and Support tables arrive with their own phases (see `ROADMAP.md`).

## Conventions

- **Primary keys**: `uuid`, generated via `gen_random_uuid()`.
- **Timestamps**: every table gets `created_at timestamptz default now()`; mutable
  tables also get `updated_at timestamptz` (kept current via trigger).
- **Soft deletes**: `deleted_at timestamptz null` on user-facing records (leads,
  clients, knowledge_documents). Not applied to append-only log/event tables — a log
  entry is never "deleted," it just exists or doesn't.
- **Extensibility**: a `metadata jsonb default '{}'` column on core entities (leads,
  clients, knowledge_documents) so minor future fields don't require a migration.
- **RLS**: enabled on every table, per `DECISION_LOG.md` §8 (security by default). V1
  policies are simple and auth-gated (`auth.uid() is not null`), **not** tenant-scoped —
  §2 explicitly rules out tenant-based RLS for V1. No `org_id` column is added yet
  either: adding one later, when a second tenant actually exists, is a cheap additive
  migration in Postgres — paying that cost today for a tenant that doesn't exist yet
  would cut against §8's "avoid over-engineering."
- **Audit logging**: one platform-wide `audit_logs` table (below), not a separate log
  per module — matches §6's "implement audit logs across the platform" as a single
  system rather than several bespoke ones.
- **Version history**: only on entities named in `DECISION_LOG.md` §6. In Phase 1 that's
  just Knowledge Documents (Proposals/Contracts/Pricing don't have tables yet — see
  "Deferred" section below).

---

## Identity & Access

### `profiles`
1:1 extension of Supabase `auth.users`. V1 has exactly one row (the Owner), but the
table is fully shaped for multi-user from the start.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, FK → `auth.users.id` |
| full_name | text | |
| avatar_url | text | nullable |
| permission_role | enum(`owner`, `admin`, `manager`, `member`, `viewer`) | default `owner` in V1 |
| created_at / updated_at | timestamptz | |

### `departments`
Lookup table, not an enum — departments are a small, curated list today but should be
addable later (a 7th department) without a schema migration touching a type definition.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | Sales, Nexus, Marketing, Delivery, Finance, Support |
| slug | text | unique |

Seeded with the six current departments at migration time.

### `profile_departments`
Many-to-many membership — which departments a person works in (distinct from what
they're *allowed* to do, which is `permission_role`).

| Column | Type | Notes |
|---|---|---|
| profile_id | uuid | FK → profiles |
| department_id | uuid | FK → departments |

**Note**: the Owner role sees every module regardless of department-membership rows —
membership only becomes meaningful once non-Owner roles exist and their nav needs to be
scoped to just their departments. V1 doesn't need this table populated at all.

### `specialties`
Lookup table for healthcare specialty (dental, med spa, cosmetic, dermatology,
physiotherapy, endocrinology, …), used by both `leads` and `clients`. A lookup table
rather than free text, matching svach.in's own specialty list, and matching
`departments`' reasoning — svach.in shows a "View All Healthcare Specialties" link, so
the list is expected to grow.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | e.g. "Dental Clinics" |
| slug | text | unique |

---

## Cross-Cutting: Activity Timeline

### `activities`
One shared, polymorphic timeline table — used by both Sales (`leads`) and Nexus
(`clients`) rather than two near-identical tables, and ready to extend to future
entities (Delivery projects, Finance records) without a new table each time.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| entity_type | enum(`lead`, `client`) | extend as new modules ship |
| entity_id | uuid | the lead or client this activity belongs to |
| type | enum(`call`, `email`, `note`, `stage_change`, `ai_draft`) | |
| content | text | |
| created_by | uuid | FK → profiles, nullable (null = AI-generated) |
| metadata | jsonb | e.g. `{from_stage, to_stage}` for stage_change entries |
| created_at | timestamptz | |

---

## Sales

### `leads`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| practice_name | text | |
| contact_name / contact_email / contact_phone | text | |
| specialty_id | uuid | FK → specialties, nullable |
| source | text | how the lead arrived |
| stage | enum(`lead`, `contacted`, `discovery_booked`, `proposal_sent`, `verbal_commit`, `won`, `lost`) | drives the pipeline board in `INFORMATION_ARCHITECTURE.md` §4.1 |
| lost_reason_category | enum(`budget`, `timing`, `chose_competitor`, `building_in_house`, `not_ready_for_ai`, `unresponsive`, `practice_closed`, `other`) | nullable — required by constraint when stage = lost |
| lost_reason_detail | text | nullable — required by constraint only when `lost_reason_category = 'other'` |
| owner_id | uuid | FK → profiles |
| metadata | jsonb | |
| created_at / updated_at / deleted_at | timestamptz | |

```sql
CHECK (stage <> 'lost' OR lost_reason_category IS NOT NULL)
CHECK (lost_reason_category <> 'other' OR lost_reason_detail IS NOT NULL)
CHECK (contact_email IS NOT NULL OR contact_phone IS NOT NULL)
```
Enforced at the database level, not just the UI — a fixed reason set with a free-text
escape hatch under "Other" keeps loss data reportable ("most leads lost to budget this
quarter") without losing the ability to capture something that doesn't fit a bucket.
Same reasoning applies to contact info: `PRD.md` §5.4 states at least one contact
method is required, and that rule needs the same DB-level enforcement as the lost
reason — a UI-only requirement is one bypassed API call away from a lead with no way
to reach them.

**`verbal_commit`** sits between `proposal_sent` and `won` — a lead has said yes but
the contract isn't signed yet. **`won` specifically means the contract is fully
executed**, not just a verbal agreement — see `DECISION_LOG.md`'s Sales Pipeline
Refinements entry.

Moving a card between pipeline columns writes an `activities` row
(`type = stage_change`) — no separate stage-history table needed.

Marking a lead **Won** creates a linked `clients` row (see `clients.source_lead_id`)
rather than mutating the lead into a client — keeps Sales and Nexus data cleanly
separated while preserving the link. Because `won` already means the contract is
signed, the client's onboarding checklist doesn't need a "contract executed" gate —
see `client_onboarding_steps` below.

---

## Nexus (CRM)

Product-facing name for the CRM department is **Nexus** — see `DECISION_LOG.md` §3
addendum. Table names below stay plain and technical (`clients`, `follow_ups`) rather
than renamed to match the brand, so the schema reads clearly regardless of what the
product calls the module.

### `clients`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| practice_name | text | |
| primary_contact_name / email / phone | text | |
| specialty_id | uuid | FK → specialties, nullable |
| source_lead_id | uuid | FK → leads, nullable |
| metadata | jsonb | |
| created_at / updated_at / deleted_at | timestamptz | |

**No stored `last_contacted_at` or `health_status` column — both computed live,
never persisted.** This extends the same reasoning one level further: a stored
`last_contacted_at` would need every contact path (calls, emails, AI-assist sends) to
remember to update it, and any path that forgets silently breaks the health flag.
Deriving it live from the single source of truth (`activities`) makes that class of
bug structurally impossible instead of a discipline problem.

```sql
CREATE VIEW client_contact_status AS
SELECT
  c.id AS client_id,
  MAX(a.created_at) AS last_contacted_at,
  (MAX(a.created_at) IS NULL
    OR MAX(a.created_at) < now() - (CLIENT_HEALTH_THRESHOLD_DAYS || ' days')::interval
  ) AS is_flagged
FROM clients c
LEFT JOIN activities a
  ON a.entity_type = 'client' AND a.entity_id = c.id
  AND a.type IN ('call', 'email')  -- contact only; excludes note/ai_draft/stage_change
GROUP BY c.id;
```

`CLIENT_HEALTH_THRESHOLD_DAYS` is a named constant (14, per `DECISION_LOG.md`) defined
once — application config or a Postgres setting — never inlined as a bare `14`
wherever this logic is needed.

Only `call` and `email` activity types count as contact — a logged `note` or an
`ai_draft` (a drafted-but-unsent message) doesn't reset the flag, since neither
represents actual outreach having happened.

### `client_onboarding_steps`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → clients |
| step_name | text | |
| order_index | int | |
| is_complete | boolean | default false — seeded `true` only for the synthetic "Contract executed" row (see below) |
| completed_at | timestamptz | nullable |

**Default seed on client creation** (order matters — this is a **strict sequential
gate**, enforced at the application layer: step N+1 can't be marked complete until
step N is):

1. *Contract executed* — seeded already `is_complete: true`, `completed_at: now()`.
   Not a real gate; shown so the checklist visually represents the full journey
   instead of mysteriously starting at step 2 — true by definition the moment a
   `won` lead creates this client record.
2. Welcome message sent
3. Primary contact confirmed
4. Billing details collected
5. Kickoff call scheduled

Enforcement lives in the application, not a DB trigger — this is a workflow ordering
rule, not a security boundary, so it doesn't need the same structural guarantee as
(e.g.) the Hermes credential in `SECURITY_POLICY.md`.

### `follow_ups`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | FK → clients |
| due_at | timestamptz | |
| note | text | |
| status | enum(`pending`, `done`, `snoozed`) | default `pending` |
| completed_at | timestamptz | nullable |
| created_at | timestamptz | |

Powers the Follow-up Queue in `INFORMATION_ARCHITECTURE.md` §5.3.

---

## Knowledge

### `knowledge_categories`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | e.g. "Sales Playbooks," "Pricing," "SOPs" |
| slug | text | unique |

### `knowledge_documents`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| title | text | |
| content | text | markdown |
| category_id | uuid | FK → knowledge_categories, nullable |
| tags | text[] | free-form; a join table would be over-engineering at this content volume |
| created_by | uuid | FK → profiles |
| created_at / updated_at / deleted_at | timestamptz | |

### `knowledge_document_versions`
One of the four entities with full version history per `DECISION_LOG.md` §6.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| document_id | uuid | FK → knowledge_documents |
| version_number | int | |
| content | text | snapshot at that version |
| created_by | uuid | FK → profiles |
| created_at | timestamptz | |

A new row is written here every time `knowledge_documents.content` is edited — the
document row always holds current content, this table holds history.

### `knowledge_document_attachments`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| document_id | uuid | FK → knowledge_documents |
| file_path | text | Supabase Storage path |
| file_name | text | |
| uploaded_by | uuid | FK → profiles |
| created_at | timestamptz | |

---

## OOA

### `ooa_recommendations`
Backs the Action Queue in `INFORMATION_ARCHITECTURE.md` §2.2.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| lens | enum(`system_health`, `business_insight`) | which OOA lens generated this |
| type | text | e.g. `cold_lead_followup`, `client_health_flag` |
| title / description | text | shown on the card |
| related_entity_type | text | nullable, e.g. `lead`, `client` |
| related_entity_id | uuid | nullable |
| suggested_action | jsonb | e.g. `{n8n_workflow: "send-followup-email", payload: {...}}`, or `{delegate_to_hermes: true, ...}` when Hermes must decide how to execute it |
| source | text | e.g. `hermes` — who/what created this recommendation |
| hermes_reference_id | text | nullable — correlates this row to Hermes's own reasoning trace |
| status | enum(`pending`, `approved`, `dismissed`) | default `pending`. The `hermes/recommendations` API can only ever write `pending` — no code path lets an external caller set `approved` |
| resolved_by | uuid | FK → profiles, nullable |
| resolved_at | timestamptz | nullable |
| created_at | timestamptz | |

OOA's reasoning runs on Hermes, not in HQ (`DECISION_LOG.md` §10) — Hermes creates
these rows via `POST /functions/v1/hermes/recommendations`. Approving one writes to
`audit_logs` (below) and either calls the referenced n8n workflow directly (fast path,
when `suggested_action` is fully specified) or notifies Hermes to delegate (when it
isn't) — see `AI_ARCHITECTURE.md`'s "Approve-to-execute flow" for the full two-branch
logic. Either way, OOA never executes without this row's status flipping to `approved`
first.

### `ooa_system_health_events`
Feeds the System Health panel. Populated by a webhook from n8n execution results
(success/failure/retry) rather than HQ polling n8n's API on every dashboard load.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| source | text | e.g. `n8n`, `supabase`, `email_provider` |
| event_type | text | e.g. `workflow_failed`, `workflow_retried`, `api_down` |
| severity | enum(`info`, `warning`, `error`) | |
| detail | jsonb | |
| resolved_at | timestamptz | nullable |
| created_at | timestamptz | |

---

## Platform-Wide Audit Log

### `audit_logs`
Single mechanism for every user action and every AI agent action, per
`DECISION_LOG.md` §6. OOA-approved actions log here too (no separate OOA-specific log
table) — an OOA execution is just an action with `actor_type = 'agent'`.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| actor_type | enum(`user`, `agent`, `system`) | Hermes-originated actions still use `agent` — see `metadata.source` below rather than a dedicated enum value |
| actor_id | uuid | nullable — FK → profiles if actor_type = user, null/agent-name in metadata otherwise |
| action | text | e.g. `lead.stage_changed`, `ooa.recommendation_approved` |
| entity_type / entity_id | text / uuid | what was acted on |
| metadata | jsonb | before/after values, n8n execution id, `source: "hermes"` for Hermes-originated actions, etc. |
| created_at | timestamptz | |

---

## Deferred (not built in Phase 1)

`DECISION_LOG.md` §6 names **Proposals, Contracts, and Pricing** as entities that will
need full version history — but `INFORMATION_ARCHITECTURE.md`'s Phase 1 Sales module
doesn't yet generate or store formal proposal/contract documents; "Proposal Sent" is
currently just a pipeline stage label. Building those tables now would be schema for a
feature that doesn't exist yet, against §8's "avoid over-engineering."

**Confirmed: held, not scaffolded**, until the feature that produces them actually
ships (likely a Sales enhancement or part of Delivery/Finance in Phase 2–3). Logged in
`DECISION_LOG.md` §6 addendum.

Also deferred: Delivery (`projects`, `project_tasks`), Finance (`invoices`, `payments`,
`expenses`), Marketing, and Support tables — each arrives with its own phase.

---

## RLS Policy Approach (V1)

Every table above has RLS enabled. V1 policies are intentionally simple:

- **Read/write**: any authenticated user (`auth.uid() is not null`) — there's only the
  Owner in V1, so role-based restriction has nothing to differentiate yet.
- **Policies are written to already reference `profiles.permission_role`** (e.g.
  `admin`+ can do X, `viewer` is read-only) so that when a second user is added, the
  restriction takes effect immediately — no policy rewrite needed, just assigning a
  role to the new profile.
- **Hermes doesn't authenticate as a user.** The `hermes/*` Edge Functions
  (`AI_ARCHITECTURE.md`) are called with a **purpose-built credential** scoped to
  exactly that function's one capability — not a Supabase auth session, and not a
  general service-role key — so RLS (keyed to `auth.uid()`) doesn't apply to that
  traffic. Authorization for Hermes is explicit code inside those Edge Functions
  (verify the credential; only ever allow writing `pending` recommendations /
  delegation results), not a database policy. Full reasoning in `SECURITY_POLICY.md`.
- **Role escalation prevention**: `profiles.permission_role` is protected by a
  `SECURITY DEFINER` trigger so a user can never write their own role field directly —
  pattern and SQL in `SECURITY_STANDARDS.md` §16. Build this before a second real user
  exists (`SECURITY_POLICY.md`).
