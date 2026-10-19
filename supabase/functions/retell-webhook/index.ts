// Receives Retell AI webhooks (call_started, transcript_updated, call_ended,
// call_analyzed) and records them in HQ. Server-to-server: Retell is not an HQ
// user and sends no JWT, so this is verify_jwt = false and the auth is Retell's
// own HMAC signature (x-retell-signature, keyed with the Retell API key).
//
// Reports failures to ooa_system_health_events (observer pattern, like
// Delivery Pulse — it reports, it never decides anything).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { ingestCall } from "./ingest.ts"
import { TitanMailer } from "./mailer.ts"

const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Retell header format: `v={timestamp_ms},d={hex}` where d is
 * HMAC-SHA256(rawBody + timestamp, apiKey). Rejects stale timestamps (replay). */
async function verifyRetellSignature(rawBody: string, apiKey: string, signature: string) {
  const match = /v=(\d+),d=(.*)/.exec(signature)
  if (!match) return false
  const [, timestamp, digest] = match
  if (Math.abs(Date.now() - Number(timestamp)) > SIGNATURE_TOLERANCE_MS) return false

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody + timestamp))
  return timingSafeEqual(toHex(mac), digest.trim())
}

async function sendHotLeadAlert(
  label: string | null,
  summary: string | null,
  type: "lead" | "client" | null,
  id: string | null,
) {
  const user = Deno.env.get("TITAN_SMTP_USER")
  const password = Deno.env.get("TITAN_SMTP_PASSWORD")
  if (!user || !password) return
  const to = Deno.env.get("OWNER_ALERT_EMAIL") ?? user
  const base = Deno.env.get("APP_BASE_URL") ?? ""
  const path = type && id ? (type === "client" ? `/nexus/${id}` : `/sales/${id}`) : ""
  const body = [
    `A voice call just flagged a hot lead${label ? `: ${label}` : ""}.`,
    "",
    summary ?? "(no summary)",
    "",
    base && path ? `Open the record: ${base}${path}` : "",
  ].join("\n")
  await new TitanMailer(user, password).send(to, `Hot lead from a voice call${label ? ` — ${label}` : ""}`, body)
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get("x-retell-signature")
  if (!signature) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const apiKey = Deno.env.get("RETELL_API_KEY")
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Retell not connected — RETELL_API_KEY is missing." }),
      { status: 503, headers: { "content-type": "application/json" } },
    )
  }
  if (!(await verifyRetellSignature(rawBody, apiKey, signature))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

  let event = ""
  let callId = ""
  try {
    const payload = JSON.parse(rawBody)
    event = payload.event
    const call = payload.call
    callId = call?.call_id ?? ""
    if (!call?.call_id || !call?.agent_id) {
      return new Response(null, { status: 204 })
    }

    // Agent-level connection: only agents the Owner connected in HQ are
    // recorded. Anything else in the Retell account is acknowledged and dropped
    // before a call, lead, or timeline entry could be created.
    const { data: allowed } = await admin
      .from("voice_agents")
      .select("id")
      .eq("retell_agent_id", call.agent_id)
      .eq("tracked", true)
      .maybeSingle()
    if (!allowed) return new Response(null, { status: 204 })

    const result = await ingestCall(admin, call, { event })

    // Hot lead → tell the Owner right away. Only the first time this call is
    // logged (retries don't re-send) and never for demo data. An email failure
    // is reported but must not make Retell retry an already-recorded call.
    if (result.activityCreated && result.hotLead && !result.isDemo) {
      try {
        await sendHotLeadAlert(result.callerLabel, result.summary, result.matched, result.matchedId)
      } catch (mailErr) {
        await admin.from("ooa_system_health_events").insert({
          source: "retell",
          event_type: "voice.hot_lead_alert_failed",
          severity: "warning",
          detail: { call_id: callId, message: mailErr instanceof Error ? mailErr.message : String(mailErr) },
        })
      }
    }
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("retell-webhook error:", err)
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unexpected error"
    await admin.from("ooa_system_health_events").insert({
      source: "retell",
      event_type: "voice.webhook_failed",
      severity: "error",
      detail: { event, call_id: callId, message },
    })
    // Non-2xx makes Retell retry the delivery; ingest is idempotent.
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
})
