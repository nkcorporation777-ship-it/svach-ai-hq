// HQ -> n8n. The `trg_n8n_new_lead` database trigger calls this (through
// pg_net) for every new real lead; this function adds the lead's details and
// forwards them to the n8n "New Lead Alert" webhook set in Settings -> n8n
// automations. n8n never reads the database itself.
//
// Server-to-server (verify_jwt = false): inbound auth is the shared trigger
// secret (vault: onboarding_trigger_secret, Edge secret: ONBOARDING_TRIGGER_SECRET);
// outbound requests carry `x-hq-secret` (Edge secret N8N_HQ_SECRET), which the
// n8n webhook checks. A missing URL or a failed hand-off is logged to
// ooa_system_health_events so it shows on the Dashboard.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TIMEOUT_MS = 15_000

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

Deno.serve(async (req) => {
  const secret = req.headers.get("x-onboarding-secret")
  if (!secret || secret !== Deno.env.get("ONBOARDING_TRIGGER_SECRET")) return json(401, { error: "Unauthorized" })

  const body = await req.json().catch(() => null)
  if (body?.event !== "lead.created" || typeof body.lead_id !== "string") {
    return json(400, { error: "Expected { event: 'lead.created', lead_id }." })
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const note = (eventType: string, severity: string, detail: Record<string, unknown>) =>
    admin.from("ooa_system_health_events").insert({ source: "n8n", event_type: eventType, severity, detail })

  const { data: lead, error } = await admin
    .from("leads")
    .select("id, practice_name, contact_name, contact_email, contact_phone, source, stage, value, created_at, specialties(name)")
    .eq("id", body.lead_id)
    .maybeSingle()
  if (error || !lead) return json(404, { error: "Lead not found." })

  const { data: settings } = await admin.from("n8n_settings").select("new_lead_webhook_url").maybeSingle()
  const webhookUrl = settings?.new_lead_webhook_url?.trim()
  if (!webhookUrl || !/^https:\/\//i.test(webhookUrl)) {
    await note("new_lead_alert_skipped", "warning", {
      lead_id: lead.id,
      reason: "New-lead webhook URL not set (Settings -> n8n automations)",
    })
    return json(200, { forwarded: false, reason: "no webhook" })
  }

  const appBase = (Deno.env.get("APP_BASE_URL") ?? "").replace(/\/$/, "")
  const hqSecret = Deno.env.get("N8N_HQ_SECRET") ?? ""
  const specialty = (lead as { specialties?: { name: string } | null }).specialties?.name ?? null

  let failure: string | null = null
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", ...(hqSecret ? { "x-hq-secret": hqSecret } : {}) },
      body: JSON.stringify({
        event: "lead.created",
        lead: {
          id: lead.id,
          practice_name: lead.practice_name,
          contact_name: lead.contact_name,
          contact_email: lead.contact_email,
          contact_phone: lead.contact_phone,
          source: lead.source,
          stage: lead.stage,
          value: lead.value,
          specialty,
          created_at: lead.created_at,
          hq_url: appBase ? `${appBase}/sales/${lead.id}` : null,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) failure = `n8n answered ${res.status} ${(await res.text()).slice(0, 200)}`.trim()
  } catch (err) {
    failure = `Could not reach n8n: ${err instanceof Error ? err.message : String(err)}`
  }

  if (failure) {
    await note("new_lead_alert_failed", "error", { lead_id: lead.id, error: failure })
    return json(502, { forwarded: false, error: failure })
  }
  return json(200, { forwarded: true })
})
