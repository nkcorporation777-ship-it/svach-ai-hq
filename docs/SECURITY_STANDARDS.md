# Security Standards

General engineering security rules and patterns — how secure code gets written,
independent of any one project. Reusable across projects; a companion project's
`SECURITY_POLICY.md` applies these patterns to its own specifics (actors, tables,
credentials) rather than restating them. When a project's reality doesn't fit an
example here verbatim, adapt the pattern — don't force the example.

---

## 1. Least Privilege by Default

Every credential, role, and function gets the minimum access it needs to do its job —
never broader "to be safe" or "in case it's needed later." A credential scoped too
broadly is a liability the moment anything downstream of it is compromised, whether
that's a leaked key, a bug, or a malicious input. When in doubt, grant less and widen
later; widening is a one-line change, narrowing after the fact means auditing
everything that came to depend on the extra access.

## 2. Authentication — Session-Based, Never Rolled by Hand

Use the platform's auth system (e.g. Supabase Auth) for session management. Never hand-roll
token generation, password hashing, or session storage. Every server-side entry point
(API route, Edge Function) verifies the caller's session before doing anything —
verifying identity is not the client's job to assert, it's the server's job to check.

## 3. Input Validation at Every Trust Boundary

Validate and sanitize at the boundary where untrusted data enters the system — a form
submission, an API payload, a webhook body, a file upload. Validate shape (types,
required fields) and content (length limits, allowed values), and re-validate
server-side even if the client already validated — client-side validation is a UX
courtesy, not a security control.

## 4. Row Level Security — Non-Negotiable, No Exceptions

If the database is reachable with a public/anon key (common in client-first
architectures), **every table gets RLS enabled, with no exceptions** — including lookup
tables, join tables, and tables that are "unused right now." A table with no RLS is
queryable by anyone holding that key, not just the application's own users. "We'll add
RLS later" is not a deferral, it's a live vulnerability for however long "later" takes.

A trivial interim policy is always acceptable while a real capability model is designed:

```sql
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated access" ON public.table_name
  FOR ALL USING (auth.uid() IS NOT NULL);
```

This is a real, shippable policy — not a placeholder to feel guilty about. It gets
replaced with per-role policies once the project's actual capability model exists; the
trivial version already closes the "reachable by anyone with the key" gap.

## 5. Audit Logging — Every Table That Matters Gets One

A baseline audit log records *who* did *what*, *when*:

```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
```

Treat this as a **starting point, not a template to copy verbatim.** It assumes every
actor is a human with a `auth.users` row — true for many projects, false the moment a
background job, a scheduled workflow, or an external agent can also take actions in the
system. If non-human actors exist, the schema needs an explicit actor-type distinction
(e.g. `actor_type: user | agent | system`) from the start — retrofitting "who/what did
this" onto a log table after the fact means every existing row is ambiguous.

## 6. Secrets Never Live in Client Code

API keys, database credentials, and third-party tokens never ship in a browser bundle,
a mobile app binary, or a public repository — full stop, regardless of how "obfuscated"
or "unlikely to be found" it feels. If a client needs a privileged operation performed,
it calls a server-side function that holds the secret, not the other way around.

## 7. Environment Variables & Config Hygiene

Secrets live in environment variables or a secrets manager, never hardcoded, never
committed. `.env` files are gitignored by default in every project, no exceptions.
Different environments (dev/staging/prod) get different credentials — a leaked dev key
should never be able to touch production data.

## 8. Server-Side Authorization, Not Just UI Hiding

Hiding a button in the UI is not access control. Every privileged action is
authorized server-side (RLS, an Edge Function check, an API middleware) independent of
whether the UI happens to expose a path to it. Assume every client request could be
crafted by hand, because it can be.

## 9. Rate Limiting & Abuse Prevention on Public Endpoints

Any endpoint reachable without authentication (signup, public forms, webhooks) gets
rate limiting or another abuse-prevention mechanism — an open endpoint with no cost to
calling it repeatedly is an invitation, not an oversight.

## 10. Service-Role / Elevated Credentials — Never Exposed, Never Broad

Service-role keys and other elevated credentials never appear in client code (see §6)
and are never handed out more broadly than the one capability they're needed for. Where
an external system (another service, a partner integration, an automation platform)
needs to write to the database, prefer a **purpose-built credential checked by one
dedicated server-side function**, scoped to exactly the operation that system needs —
not a general service-role key that happens to be restricted "by convention" in the
calling code. The difference matters: if the credential itself cannot do more than the
one intended thing, a bug in the calling code can't turn into a bigger breach. If the
credential *can* do more and only the code discipline prevents it, that discipline is
the only thing standing between "working as intended" and "compromised."

## 11. Encryption in Transit and at Rest

HTTPS everywhere, no exceptions, including internal service-to-service calls. Data at
rest relies on the platform's built-in encryption (e.g. Supabase/Postgres) unless a
specific field needs additional application-level encryption (e.g. a field regulated
data would land in) — flag that need explicitly rather than assuming platform defaults
cover every case.

## 12. Dependency & Supply Chain Hygiene

Keep dependencies current, review new packages before adding them (maintenance status,
install-time scripts, actual necessity for a one-off need), and avoid pulling in a
whole library for a function that's ten lines to write directly.

## 13. CORS and Origin Restrictions

Server-side endpoints restrict allowed origins to the actual application domains —
`*` is a starting point for local development, never a production setting.

## 14. Error Handling — Fail Safe, Don't Leak Internals

Errors returned to the client are actionable and human-readable, never a raw stack
trace, SQL error, or internal file path. Log full detail server-side; return a clean,
specific message client-side ("that email is already in use," not `duplicate key value
violates unique constraint "users_email_key"`).

## 15. File Upload & Storage Validation

Validate file type, size, and (where relevant) content server-side before storing —
never trust a client-supplied MIME type or extension alone. Generate storage paths
server-side rather than trusting client-supplied paths, to prevent path traversal or
overwrite of unrelated files.

## 16. Role Escalation Prevention

Where a role/permission field exists on a user-editable record (e.g. a profile table),
prevent a user from writing to their own role field directly. The standard pattern:
a `SECURITY DEFINER` helper function (e.g. `is_admin()`) that checks the *current*
role from the database rather than trusting a client-supplied value, plus a trigger
that rejects any update attempting to change a role field unless the actor already
holds a role permitted to grant it:

```sql
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT permission_role IN ('owner', 'admin')
  FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.permission_role IS DISTINCT FROM OLD.permission_role
     AND NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to change role';
  END IF;
  RETURN NEW;
END;
$$;
```

Build this **before** a second real user exists, not after — cheap to add to an empty
scenario, awkward to retrofit once there's a real privilege boundary to protect.

## 17. Prefer Minimal, Focused Changes

A security fix addresses the security issue — it doesn't bundle in an unrelated
refactor, a broader permission grant "while we're in there," or scope creep beyond
what the actual risk requires. Minimal changes are easier to review, easier to reason
about, and don't introduce a second, unreviewed change riding along with the first.

## 18. Security Review Before Merge

Any change touching auth, RLS policies, credential handling, or an audit-relevant code
path gets a deliberate security-focused review pass — not just a functional one —
before it ships.

## 19. Row Level Security Checklist (Pre-Ship)

Before any table ships:

- [ ] RLS is enabled (§4) — check directly against the schema, don't assume.
- [ ] Every table has a policy, including lookup/reference and currently-unused tables.
- [ ] The policy matches the table's actual sensitivity — a shared lookup table gets
      "any authenticated user," not the same owner-only default as real user data.
- [ ] No table is reachable by a credential broader than it needs (§10) — check whether
      an external/service credential can touch this table, and if so, exactly how.
- [ ] Role/permission fields, if present, are protected against self-escalation (§16).

## 20. Monitoring & Alerting for Security Events

Failed auth attempts, RLS policy violations, and unusual credential usage patterns are
worth surfacing somewhere a human will actually see them — not necessarily a full SIEM
on day one, but at minimum logged in a way that's queryable when something looks wrong.

## 21. Long Term

Items that are real but not Day-1 blockers — track them, don't let "long term" become
"never":

- **Incident response procedure**: who gets notified, what the containment steps are,
  how affected users/data are identified — written down before it's needed, not
  improvised during an actual incident.
- **Data retention & backup policy**: how long data is kept, backup frequency and
  restoration testing, and deletion procedures for data that's aged out.
- **Compliance & audits**: any applicable regulatory framework (industry-specific,
  regional) gets a deliberate scoping pass once the project's actual data handling is
  clear enough to evaluate against it — not assumed either way.
- **Penetration testing / external review**: valuable once there's a real system to
  test against; premature before then.
