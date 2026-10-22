// n8n -> HQ. The only door n8n has into HQ's data, with two narrow actions:
//
//   { action: "followups_due" }
//     Open follow-ups that are overdue or due before the end of today (IST),
//     with the client's name and a link to them in HQ. Used by the 8:30 AM
//     "Follow-up Digest" workflow.
//
//   { action: "report_run", workflow, status: "succeeded" | "failed", detail? }
//     Records a workflow run in ooa_system_health_events (source "n8n"), which
//     feeds the Dashboard's System Health panel. Sent at the end of every
//     workflow, and by the "Failure Alerts" error workflow when a run breaks.
//
// Server-to-server (verify_jwt = false); auth is the shared `x-hq-secret`
// header (Edge secret N8N_HQ_SECRET), the same one social-callback uses.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const IST_OFFSET_MS = 5.5 * 3_600_000

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** The instant today ends in India (next IST midnight), as an ISO string. */
function endOfTodayIst(now = Date.now()) {
  const ist = new Date(now + IST_OFFSET_MS)
  const nextMidnightIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1)
  return new Date(nextMidnightIst - IST_OFFSET_MS).toISOString()
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined)

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "POST only" })
  const expected = Deno.env.get("N8N_HQ_SECRET")
  const given = req.headers.get("x-hq-secret") ?? ""
  if (!expected || !timingSafeEqual(given, expected)) return json(401, { error: "Unauthorized" })

  const body = await req.json().catch(() => null)
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

  if (body?.action === "followups_due") {
    const now = new Date().toISOString()
    const { data, error } = await admin
      .from("follow_ups")
      .select("id, due_at, note, client_id, clients(practice_name, primary_contact_name, deleted_at)")
      .eq("status", "pending")
      .lt("due_at", endOfTodayIst())
      .order("due_at")
    if (error) return json(500, { error: error.message })

    const appBase = (Deno.env.get("APP_BASE_URL") ?? "").replace(/\/$/, "")
    type Row = {
      id: string
      due_at: string
      note: string | null
      client_id: string
      clients: { practice_name: string; primary_contact_name: string | null; deleted_at: string | null } | null
    }
    const items = ((data ?? []) as Row[])
      .filter((f) => !f.clients?.deleted_at)
      .map((f) => ({
        id: f.id,
        due_at: f.due_at,
        overdue: f.due_at < now,
        note: f.note,
        client_name: f.clients?.practice_name ?? "Unknown client",
        contact_name: f.clients?.primary_contact_name ?? null,
        hq_url: appBase ? `${appBase}/nexus/${f.client_id}` : null,
      }))
    return json(200, {
      generated_at: now,
      overdue_count: items.filter((i) => i.overdue).length,
      due_today_count: items.filter((i) => !i.overdue).length,
      items,
    })
  }

  if (body?.action === "report_run") {
    const workflow = clip(body.workflow, 120)
    const status = body.status
    if (!workflow || (status !== "succeeded" && status !== "failed")) {
      return json(400, { error: "report_run needs workflow and status 'succeeded' | 'failed'." })
    }
    const detail: Record<string, unknown> = { workflow }
    if (body.detail && typeof body.detail === "object" && !Array.isArray(body.detail)) {
      // Keep it small: only short scalar fields, never whole payloads.
      for (const [k, v] of Object.entries(body.detail as Record<string, unknown>).slice(0, 12)) {
        if (typeof v === "string") detail[k.slice(0, 40)] = v.slice(0, 500)
        else if (typeof v === "number" || typeof v === "boolean") detail[k.slice(0, 40)] = v
      }
    }
    const { error } = await admin.from("ooa_system_health_events").insert({
      source: "n8n",
      event_type: status === "succeeded" ? "workflow_succeeded" : "workflow_failed",
      severity: status === "succeeded" ? "info" : "error",
      detail,
    })
    if (error) return json(500, { error: error.message })
    return json(200, { ok: true })
  }

  return json(400, { error: "Unknown action. Use 'followups_due' or 'report_run'." })
})
