# Svach AI HQ — AI Architecture (Phase 1)

## Core Rule

> OOA may analyze, recommend, and prepare actions. OOA must never execute
> business-impacting actions without explicit Owner approval.

(`DECISION_LOG.md` §5, verbatim.) Every design choice below exists to make this rule
true in practice, not just in policy.

---

## Two AI Surfaces

HQ's runtime AI splits into two distinct surfaces with different risk profiles. Don't
conflate them — they're built differently on purpose.

| | AI-Assist (per-module) | OOA (cross-module) |
|---|---|---|
| Runs where | Inside HQ — a Supabase Edge Function | **Hermes** — a separate runtime, outside the HQ codebase (`DECISION_LOG.md` §10) |
| Triggered by | A human, in the moment (e.g. "draft this email") | Hermes continuously monitors HQ via the API boundary and reasons on its own schedule |
| Output | A draft — always reviewed/edited before use | A recommendation, posted into HQ's Action Queue via API |
| Can it act on its own? | No — never sends, never saves without the human doing so | No — only after Approve (see Core Rule) |
| Where it shows up | Lead/Client/Knowledge detail pages (`INFORMATION_ARCHITECTURE.md` §3–5) | Dashboard (`INFORMATION_ARCHITECTURE.md` §2) |

HQ builds and owns the AI-Assist surface end to end. HQ does **not** build or own OOA's
reasoning — that's Hermes. HQ's responsibility for OOA is limited to the control plane:
displaying recommendations, capturing the Owner's approve/dismiss decision, executing
or delegating on approval, and recording the result. See "Hermes Integration Boundary"
below.

---

## Provider Abstraction Layer

Per `DECISION_LOG.md` §7, the runtime LLM provider isn't chosen yet, and no
implementation decision should depend on which one it ends up being. Concretely, that
means one interface, implemented once per provider:

```
AIProvider {
  complete(systemPrompt, userPrompt, context) → { text, tokensUsed }
}

AnthropicProvider implements AIProvider   // not built until a provider is chosen
OpenAIProvider implements AIProvider      // not built until a provider is chosen
```

**Scope: AI-assist only.** Every AI-assist action goes through this interface, never a
provider SDK directly — swapping providers later means writing one new class and
flipping a config value, not touching any Edge Function, prompt template, or UI code.
This is also why the schema doesn't have a `llm_provider` column baked into business
tables (`audit_logs.metadata` can carry which provider handled a given call, for
observability, without the schema depending on it).

This interface does **not** cover OOA's reasoning. OOA runs on Hermes (`DECISION_LOG.md`
§10) — whatever LLM usage happens inside OOA's reasoning is Hermes's internal concern,
outside HQ's codebase and outside this document's scope.

---

## Security: AI Calls Are Server-Side Only

HQ is a Vite SPA (`Claude.md.txt`) — there is no server rendering the page, which means
**no LLM API key can ever ship in the client bundle.** Every AI call — AI-assist or
OOA — routes through a Supabase Edge Function, never directly from the browser:

```
Browser → Supabase Edge Function → AIProvider → LLM API
              (holds the key)
```

This isn't optional hardening; it's the only place the key can safely live given the
chosen stack. Edge Functions also verify the caller's Supabase auth session before
doing anything, so an unauthenticated request can't spend API credits.

---

## AI-Assist Architecture

One generic Edge Function, `ai-assist`, parameterized by `task_type` — not one function
per feature. Reasoning: drafting an outreach email, summarizing a call, and drafting a
follow-up message are the same shape (fetch entity → fetch context → prompt → return
draft), just different prompt templates. One function with a template map is less to
maintain than four nearly-identical ones, and a fifth AI-assist feature later is a new
template, not a new function.

**Flow:**
1. Client calls `ai-assist` with `{task_type, entity_type, entity_id}` (e.g.
   `task_type: "draft_outreach_email", entity_type: "lead", entity_id: "..."`).
2. Edge Function verifies the session, then fetches the entity record and its
   `activities` timeline (`DATABASE_SCHEMA.md`) using service-role access.
3. Fetches relevant Knowledge context — see below.
4. Builds the prompt from the `task_type`'s template, calls `AIProvider.complete()`.
5. Returns the draft text to the client. **Nothing is sent, saved, or executed** — the
   human edits and explicitly sends/saves from the UI.
6. Writes one row to `audit_logs` (`actor_type: "agent"`, e.g.
   `action: "ai_assist.email_drafted"`) — not because drafting is business-impacting,
   but because "monitor every AI agent" (`DECISION_LOG.md` §5) needs something to
   monitor even here: latency, failure rate, and usage all become visible this way.

## Knowledge Integration

Per `DECISION_LOG.md` §4, every module and agent can draw on Knowledge. For Phase 1,
that's **simple, not semantic**: the `ai-assist` function matches the current
`task_type`/entity against `knowledge_documents.category` and `.tags`
(`DATABASE_SCHEMA.md`) and includes any matches' content in the prompt context — e.g.
drafting a Sales email pulls documents tagged "sales playbook." No embeddings/vector
search in Phase 1, consistent with `INFORMATION_ARCHITECTURE.md` §3.1's retrieval
scope — this can be upgraded to semantic search later behind the same interface
without changing how AI-assist or OOA call it.

---

## OOA Architecture

OOA's reasoning runs on **Hermes**, not inside HQ (`DECISION_LOG.md` §10). This section
covers HQ's side only: what HQ exposes for OOA to reason over, what HQ receives back,
and how the Owner's approval decision gets carried out. HQ never generates its own
recommendation independently of Hermes.

### System Health lens
Mostly **n8n-native, not LLM-based**, and structurally unchanged from the original
design. n8n already knows when its own workflows succeed, fail, or retry — it reports
that via a webhook into `ooa_system_health_events` (`DATABASE_SCHEMA.md`) on every run.
No AI call is needed to know a workflow failed; the Dashboard's System Health panel is
close to a direct read of this table. **New**: this table is also exposed to Hermes via
the API boundary below, since Hermes needs system state as a reasoning input, not just
HQ's own dashboard.

### Business Insights lens
**Superseded design note**: an earlier version of this document had HQ run its own
scheduled n8n workflow to detect things like cold leads and write recommendations
directly. That design is retired — detecting problems/opportunities and writing the
recommendation is Hermes's job now, not HQ's. HQ's role is purely to (a) expose the
underlying data Hermes needs (leads, clients, activities, health events) via the API
boundary, and (b) receive the resulting recommendation and display it. Whether Hermes's
own internal detection logic is rule-based or LLM-based is Hermes's implementation
choice, outside this document's scope.

### Hermes Integration Boundary

**Hermes → HQ** (inbound to HQ; each endpoint below is authenticated via its **own**
purpose-built credential, scoped to only that endpoint's one capability — never a
general Supabase service-role key, never one credential shared across endpoints, never
the end-user's Supabase session; full reasoning in `SECURITY_POLICY.md`):
- `POST /functions/v1/hermes/recommendations` — create a recommendation. This endpoint
  **can only ever create `status: "pending"`** — there is no code path in this function
  that accepts or sets `approved`, so Hermes cannot self-approve no matter what it
  sends. Writes `source: "hermes"` and `hermes_reference_id` on the row
  (`DATABASE_SCHEMA.md`) so it can be correlated back to Hermes's own reasoning trace.
- `POST /functions/v1/hermes/delegation-results` — report the outcome of a task Hermes
  was delegated (Branch B below).
- `POST /functions/v1/hermes/agent-status` *(optional, Phase 1+)* — heartbeat/status,
  feeding the Dashboard's Agent Activity element.

**HQ → Hermes** (outbound from HQ): event notifications when key state changes (new
lead, stage change, health event, follow-up overdue) and when a Branch B recommendation
is approved. The exact endpoint/wire format on Hermes's side isn't defined yet — HQ's
outbound call is written behind an interface, the same pattern as `AIProvider`, so this
side can be built now and pointed at a real Hermes once one exists.

**Status**: Hermes is planned, not built (`DECISION_LOG.md` §10). This boundary is
designed and stubbed in Phase 1 — interfaces and Edge Function shells exist, but
nothing is wired to a live Hermes yet, mirroring how the undecided LLM provider is
handled above.

### Approve-to-execute flow — two branches

Which branch applies is decided by the shape of `suggested_action`
(`DATABASE_SCHEMA.md`), not by who created the recommendation:

**Branch A — fast path** (`suggested_action` already names a specific `n8n_workflow` +
`payload`, i.e. the action is fully specified and needs no further decision):
1. User clicks **Approve** on a card in the Action Queue.
2. Client calls an `ooa-execute-action` Edge Function with the recommendation `id`.
3. Edge Function re-checks the recommendation is still `pending` (avoids a
   double-execute race if two tabs are open), reads `suggested_action.n8n_workflow` +
   `payload`, and calls that n8n workflow via webhook directly — no Hermes round-trip.
4. Writes `ooa_recommendations.status = approved`, `resolved_by`, `resolved_at`.
5. Writes to `audit_logs` (`actor_type: "user"` for the approval, `actor_type: "agent"`
   for the resulting execution once n8n reports back success/failure via a completion
   webhook).
6. UI reflects the outcome once the completion webhook lands.

**Branch B — delegated** (`suggested_action` has no `n8n_workflow`, or explicitly sets
`delegate_to_hermes: true` — the action needs Hermes to decide *how* to execute it):
1–2. Same as Branch A through the Approve click and status re-check.
3. Edge Function instead calls Hermes via the outbound boundary above, notifying it of
   the approval.
4. Writes `ooa_recommendations.status = approved`, `resolved_by`, `resolved_at` — same
   as Branch A, HQ doesn't wait on Hermes to record that the Owner approved.
5. Hermes delegates to whichever specialist agent/workflow it decides, then calls
   `POST /hermes/delegation-results` to report the outcome.
6. HQ writes the result to `audit_logs` (`actor_type: "agent"`, `metadata.source:
   "hermes"`) and the UI reflects it — same end state as Branch A, different path to
   get there.

Both branches converge on the same audit trail and the same UI outcome — the fast path
just skips a hop when nothing needs deciding.

### Dismiss
`status = dismissed`, `resolved_by`, `resolved_at`, one `audit_logs` row. Since Hermes
is now the one deciding what to recommend, the "don't repeat a just-dismissed
suggestion" logic is Hermes's responsibility, not a query HQ runs — HQ's job is to make
sure dismissal history is visible to Hermes via the API boundary (recommendations,
including dismissed ones, are readable by Hermes) so it has the information to avoid
repeating itself.

---

## Guardrails & Failure Handling

- **LLM failures are visible, not silent.** A timed-out or errored `AIProvider` call
  returns a clear error to the client ("Draft failed, try again") rather than an empty
  or partial draft presented as complete.
- **Prompt-injection surface is real but contained.** Lead notes, client activity, and
  Knowledge documents are user-authored content that ends up inside prompts. The
  mitigation isn't trying to sanitize every input — it's structural: AI-assist output
  is always a human-reviewed draft, and OOA's suggested actions always require
  human Approve. Even a manipulated prompt can't skip either checkpoint, because
  nothing in this architecture lets an AI-generated action execute without one.
- **Every AI call is logged** (`audit_logs`), so a bad draft or a bad recommendation is
  traceable to exactly which call produced it — provider, prompt template, and input
  entity.

## Open Items

- **LLM provider** — still not chosen (`DECISION_LOG.md` §7). Unblocked by the adapter
  pattern above: the Edge Functions, prompt templates, and AI-assist flow can all be
  built now, with the concrete `AIProvider` implementation dropped in whenever the
  provider is picked.
- **Hermes** — planned, not built (`DECISION_LOG.md` §10). HQ's side of the boundary
  (endpoints, interfaces, DB columns) is designed and stubbed now; wiring to a live
  Hermes happens once one exists — same treatment as the LLM provider above.
- **Cost/rate-limit policy** — not addressed here; V1 is single-user, so usage is
  naturally bounded. Worth a real answer once a provider (and its pricing) is chosen.
