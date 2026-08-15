# Svach AI HQ — Roadmap

Two axes, kept separate on purpose: the **product roadmap** (what HQ builds, in what
order) and the **infrastructure roadmap** (how the underlying systems scale as Svach AI
itself grows). Conflating them was a real risk — client-count-driven infra decisions
don't follow the same timeline as product phases.

---

## Product Roadmap

Sequenced by where the Owner's actual operational pain is today — Sales & Nexus first,
even though the org chart lists departments in a different order — not by build
convenience.

**Phase 0 — Planning & Architecture** *(current)*
The `/docs` set, Phase 1 Supabase schema, design tokens pulled from svach.in, n8n
access confirmed (`DECISION_LOG.md` §11).

**Phase 1 — Foundation + Sales & Nexus** *(next)*
HQ shell (Owner-only auth, sidebar with Sales/Nexus live, Delivery/Marketing/Finance/
Support locked), Dashboard/OOA shell, Sales pipeline, Nexus client management,
Knowledge module, the two required n8n workflows, RLS on every table, audit logging.
Full detail in `PRD.md`.

**Phase 2 — Delivery**
Project Manager Agent module, structured around Svach AI's own Discover → Design →
Deploy → Optimise methodology. This is what actually replaces the current
ClickUp/Notion usage — deliberately sequenced after Sales/Nexus since that's where the
live pain is today, not because Delivery matters less long-term.

**Phase 3 — Finance**
Invoicing, payment tracking, expense tracking, revenue dashboard. Likely a Stripe (or
equivalent) integration via n8n rather than custom billing code.

**Phase 4 — Marketing & Support**
Social media scheduling/analytics; support tickets, bug tracker, SLA monitor. Lowest
urgency on current signals — re-confirm priority before starting rather than assuming
this order still holds by the time Phase 3 finishes.

**Cross-cutting, every phase**: OOA's System Health / Business Insights lenses grow
with each new department's data; the set of approvable action types grows one at a
time; RBAC and audit logging are foundational from Phase 1, never retrofitted.

---

## Infrastructure Roadmap — n8n Hosting

Staged by client count, not by product phase — see `DECISION_LOG.md` §11 for the
Stage 1 resolution and why it's already true today, not a future step.

### Stage 1 — 0–10 clients *(active now)*

Agency-controlled n8n Cloud, live at `svach001.app.n8n.cloud`. No separate n8n
server/VPS per client. Objective: keep operations simple while validating the service
and growing the client base. Client-specific infrastructure only gets created if a
client specifically requires isolation, security, compliance, or ownership of their
own automation environment.

Used for: workflow automation, API integrations, notifications, email workflows,
scheduling, CRM automation, OOA-triggered workflows, internal Svach AI workflows.

### Stage 2 — ~10–25 clients *(future)*

Evaluate moving to a VPS-based, self-hosted n8n environment:
`VPS → self-hosted n8n → Svach AI workflows + managed client workflows`.

Evaluate at this point: CPU/RAM requirements, workflow execution volume, database
requirements, backups, monitoring, uptime, security, secrets management, access
control, workflow isolation, disaster recovery.

**Worth defining before this stage arrives**: a concrete trigger metric (e.g.
execution volume or a monthly-cost crossover point vs. n8n Cloud pricing) rather than
re-litigating "is it time yet" from scratch when client count approaches this range.

**Docker** (Stage 2 / future): not required now; may be introduced alongside the VPS
move to ease deployment/upgrade/isolation (`VPS → Docker → n8n`). Not introduced
before self-hosting unless a specific technical reason arises earlier.

**Caddy** (Stage 2 / future): not required now; introduced alongside self-hosting as
the reverse proxy + HTTPS/TLS layer (`Internet → Caddy → HTTPS/Reverse Proxy → Docker
→ n8n`).

### Enterprise Clients

Not forced into the shared environment. Depending on the client's security,
compliance, data residency, infrastructure, isolation, or ownership requirements:

- **Option A** — client's own n8n.
- **Option B** — dedicated Svach-managed n8n instance.
- **Option C** — whatever infrastructure the client's own security/compliance
  requirements dictate.

### Explicit Scope Guard

Do not introduce a VPS, Docker, or Caddy into the current Svach AI HQ build. This is a
future hosting roadmap, not a Phase 1 requirement — the only things Phase 1 actually
needs from this section are the Stage 1 hostname and the credential-handling rule
(`DECISION_LOG.md` §11).
