// Starts a Retell WEB call (the person talks to the agent through the browser
// microphone — no phone number involved). The Retell API key stays here on the
// server; the browser only receives a short-lived access token (Retell
// invalidates it if the call isn't joined within ~30 seconds).
//
// Called from a signed-in HQ session. When started from a lead/client page the
// record id travels in `metadata`, so the finished call lands on that record.

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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const headers = { ...corsHeaders(origin), "content-type": "application/json" }
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) })

  const fail = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers })

  try {
    const apiKey = Deno.env.get("RETELL_API_KEY")
    if (!apiKey) return fail(503, "Retell not connected — RETELL_API_KEY is missing in Supabase secrets.")

    const { agent_id, lead_id, client_id } = await req.json()
    if (!agent_id) return fail(400, "Choose an agent first.")

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const { data: agent } = await admin
      .from("voice_agents")
      .select("retell_agent_id, name, audience")
      .eq("id", agent_id)
      .maybeSingle()
    if (!agent) return fail(404, "Agent not found.")

    const vars: Record<string, string> = {}
    const metadata: Record<string, unknown> = { started_from: "hq" }
    if (agent.audience === "demo") metadata.is_demo = true
    if (client_id) {
      const { data: c } = await admin
        .from("clients")
        .select("id, practice_name, primary_contact_name")
        .eq("id", client_id)
        .maybeSingle()
      if (c) {
        metadata.client_id = c.id
        vars.contact_name = c.primary_contact_name ?? "there"
        vars.practice_name = c.practice_name
      }
    } else if (lead_id) {
      const { data: l } = await admin
        .from("leads")
        .select("id, practice_name, contact_name")
        .eq("id", lead_id)
        .maybeSingle()
      if (l) {
        metadata.lead_id = l.id
        vars.contact_name = l.contact_name ?? "there"
        vars.practice_name = l.practice_name
      }
    }

    const res = await fetch("https://api.retellai.com/v3/create-web-call", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        agent_id: agent.retell_agent_id,
        metadata,
        ...(Object.keys(vars).length ? { retell_llm_dynamic_variables: vars } : {}),
      }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      return fail(502, `Retell couldn't start the call: ${payload?.message ?? payload?.error ?? res.status}`)
    }
    return new Response(JSON.stringify(payload), { headers })
  } catch (err) {
    console.error("voice-web-call error:", err)
    return fail(500, err instanceof Error ? err.message : "Unexpected error")
  }
})
