// Places ONE outbound voice call through Retell on the Owner's say-so ("Call
// now" in HQ). v1 is deliberately Owner-initiated — nothing here dials on its
// own. Guardrails run before every call: campaign switched on and configured,
// the person hasn't opted out, calling hours, a daily cap, no repeat call in 24h
// and demo contacts are never dialed. Called from a signed-in HQ session.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "https://hq.svach.in",
  "https://svachaihq.netlify.app",
])

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : ""
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  }
}

const KEYS = new Set(["speed_to_lead", "proposal_follow_up", "client_check_in", "appointment_call"])

class Refusal extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message)
  }
}

/** E.164 from whatever is stored on the record (often a bare local number). */
function toE164(raw: string, defaultCountryCode: string) {
  const trimmed = raw.trim()
  const digits = trimmed.replace(/\D/g, "")
  if (trimmed.startsWith("+")) return digits.length >= 8 ? `+${digits}` : null
  if (digits.length === 10) return `${defaultCountryCode}${digits}`
  const cc = defaultCountryCode.replace(/\D/g, "")
  if (digits.length > 10 && digits.startsWith(cc)) return `+${digits}`
  return null
}

function hourIn(tz: string, at = new Date()) {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(at)
  return Number(h)
}

function startOfDayIn(tz: string) {
  // Midnight today in `tz`, as a UTC instant.
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now) // YYYY-MM-DD
  const midnightLocalAsUtc = new Date(`${parts}T00:00:00Z`).getTime()
  const offsetMs = new Date(now.toLocaleString("en-US", { timeZone: tz })).getTime() - new Date(now.toLocaleString("en-US", { timeZone: "UTC" })).getTime()
  return new Date(midnightLocalAsUtc - offsetMs)
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const headers = { ...corsHeaders(origin), "content-type": "application/json" }
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) })

  try {
    const { campaign, lead_id, client_id, appointment_id } = await req.json()
    if (!KEYS.has(campaign) || (!lead_id && !client_id)) {
      throw new Refusal("A campaign and a lead or client are required.", 400)
    }

    const apiKey = Deno.env.get("RETELL_API_KEY")
    if (!apiKey) throw new Refusal("Retell not connected — RETELL_API_KEY is missing in Supabase secrets.", 503)

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
    const { data: userData } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(jwt)
    const actorId = userData?.user?.id ?? null

    // 1. Campaign must be on and fully configured.
    const { data: camp } = await admin.from("voice_campaigns").select("*, voice_agents(retell_agent_id, name)").eq("key", campaign).single()
    if (!camp) throw new Refusal("Unknown campaign.", 404)
    if (!camp.enabled) throw new Refusal(`The "${camp.label}" campaign is switched off.`)
    if (!camp.agent_id || !camp.from_number) {
      throw new Refusal(`Choose an agent and a from-number for "${camp.label}" first.`)
    }
    const retellAgentId = camp.voice_agents?.retell_agent_id
    if (!retellAgentId) throw new Refusal("The campaign's agent is missing — pick one again.")

    // 2. The person.
    const isClient = !!client_id
    // deno-lint-ignore no-explicit-any
    const { data: person }: { data: Record<string, any> | null } = isClient
      ? await admin
          .from("clients")
          .select("id, practice_name, primary_contact_name, primary_contact_phone, voice_opt_out, metadata")
          .eq("id", client_id)
          .maybeSingle()
      : await admin
          .from("leads")
          .select("id, practice_name, contact_name, contact_phone, voice_opt_out, metadata")
          .eq("id", lead_id)
          .maybeSingle()
    if (!person) throw new Refusal("Contact not found.", 404)
    if (person.metadata?.is_demo === true) {
      throw new Refusal("Demo contacts are never dialed — use Simulate call in demo mode.")
    }
    if (person.voice_opt_out) throw new Refusal("This person has opted out of voice calls.")
    const rawPhone = isClient ? person.primary_contact_phone : person.contact_phone
    if (!rawPhone) throw new Refusal("This record has no phone number.")
    const toNumber = toE164(rawPhone, camp.default_country_code)
    if (!toNumber) throw new Refusal(`"${rawPhone}" isn't a number I can dial — add the country code (e.g. +91…).`)
    const name = (isClient ? person.primary_contact_name : person.contact_name) ?? ""

    // 3. Calling hours.
    const hour = hourIn(camp.timezone)
    if (hour < camp.window_start_hour || hour >= camp.window_end_hour) {
      throw new Refusal(
        `Outside calling hours (${camp.window_start_hour}:00–${camp.window_end_hour}:00 ${camp.timezone}).`,
      )
    }

    // 4. Daily cap and no repeat call within 24h.
    const { count: today } = await admin
      .from("voice_call_requests")
      .select("id", { count: "exact", head: true })
      .eq("campaign_key", campaign)
      .eq("status", "requested")
      .gte("created_at", startOfDayIn(camp.timezone).toISOString())
    if ((today ?? 0) >= camp.daily_cap) throw new Refusal(`Daily cap of ${camp.daily_cap} calls reached.`, 429)

    const personCol = isClient ? "client_id" : "lead_id"
    const { count: recent } = await admin
      .from("voice_call_requests")
      .select("id", { count: "exact", head: true })
      .eq("campaign_key", campaign)
      .eq("status", "requested")
      .eq(personCol, person.id)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    if ((recent ?? 0) > 0) throw new Refusal("This person was already called for this campaign in the last 24 hours.")

    // 5. What the agent should know. (All values must be strings for Retell.)
    const vars: Record<string, string> = {
      contact_name: name || "there",
      practice_name: person.practice_name ?? "",
      campaign: camp.label,
    }
    if (campaign === "proposal_follow_up" && !isClient) {
      const { data: proposal } = await admin
        .from("proposals")
        .select("sent_at")
        .eq("lead_id", person.id)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (proposal) vars.proposal_sent_date = new Date(proposal.sent_at).toDateString()
    }
    if (campaign === "appointment_call" && appointment_id) {
      const { data: appt } = await admin.from("appointments").select("starts_at, timezone").eq("id", appointment_id).maybeSingle()
      if (appt) {
        vars.appointment_time = new Intl.DateTimeFormat("en-IN", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: appt.timezone || camp.timezone,
        }).format(new Date(appt.starts_at))
      }
    }

    // 6. Place the call.
    const day = new Date().toISOString().slice(0, 10)
    const res = await fetch("https://api.retellai.com/v2/create-phone-call", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from_number: camp.from_number,
        to_number: toNumber,
        override_agent_id: retellAgentId,
        retell_llm_dynamic_variables: vars,
        metadata: { campaign, [personCol]: person.id, ...(appointment_id ? { appointment_id } : {}) },
        idempotency_key: `${campaign}-${person.id}-${day}`,
        honor_internal_dnc: true,
      }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message = payload?.message ?? payload?.error ?? `Retell returned ${res.status}`
      await admin.from("voice_call_requests").insert({
        campaign_key: campaign,
        [personCol]: person.id,
        appointment_id: appointment_id ?? null,
        to_number: toNumber,
        status: "failed",
        error: String(message).slice(0, 300),
        requested_by: actorId,
      })
      throw new Refusal(`Retell couldn't place the call: ${message}`, 502)
    }

    await admin.from("voice_call_requests").insert({
      campaign_key: campaign,
      [personCol]: person.id,
      appointment_id: appointment_id ?? null,
      to_number: toNumber,
      retell_call_id: payload.call_id ?? null,
      status: "requested",
      requested_by: actorId,
    })
    await admin.from("audit_logs").insert({
      actor_type: "user",
      actor_id: actorId,
      action: "voice.outbound_requested",
      entity_type: isClient ? "client" : "lead",
      entity_id: person.id,
      metadata: { campaign, call_id: payload.call_id ?? null },
    })

    return new Response(JSON.stringify({ requested: true, call_id: payload.call_id ?? null }), { headers })
  } catch (err) {
    if (err instanceof Refusal) {
      return new Response(JSON.stringify({ error: err.message }), { status: err.status, headers })
    }
    console.error("voice-outbound error:", err)
    const message = err instanceof Error ? err.message : "Unexpected error"
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
})
