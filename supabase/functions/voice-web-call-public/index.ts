// Public "Try our agent" link — lets a prospect talk to the DEMO agent from their
// own browser with no HQ login. The only thing that gates it is an unguessable
// link token, so every protection lives here:
//   - the link must exist and be enabled (the Owner can switch it off/rotate it)
//   - it can only ever start the one agent attached to that link
//   - a per-day cap on the whole link and a smaller per-IP cap (bill protection)
//   - calls are tagged demo, so they never mix into real data
// Max call length is a Retell agent setting — set it low on the demo agent.

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const headers = { ...corsHeaders(origin), "content-type": "application/json" }
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(origin) })

  const fail = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers })

  try {
    const { token, action } = await req.json()
    // Same message for "no such link" and "switched off" — don't confirm which.
    const invalid = () => fail(404, "This demo link isn't active.")
    if (typeof token !== "string" || !UUID.test(token)) return invalid()

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
    const { data: link } = await admin
      .from("voice_demo_links")
      .select("id, label, enabled, daily_cap, per_ip_daily_cap, voice_agents(retell_agent_id, audience)")
      .eq("token", token)
      .maybeSingle()
    const agent = link?.voice_agents as { retell_agent_id: string; audience: string } | null | undefined
    if (!link || !link.enabled || !agent || agent.audience !== "demo") return invalid()

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown"
    const { count: usedToday } = await admin
      .from("voice_demo_link_uses")
      .select("id", { count: "exact", head: true })
      .eq("link_id", link.id)
      .gte("created_at", since)
    const { count: usedByIp } = await admin
      .from("voice_demo_link_uses")
      .select("id", { count: "exact", head: true })
      .eq("link_id", link.id)
      .eq("ip", ip)
      .gte("created_at", since)

    if (action === "check") {
      return new Response(
        JSON.stringify({ ok: true, label: link.label, available: (usedToday ?? 0) < link.daily_cap }),
        { headers },
      )
    }
    if (action !== "start") return fail(400, "Unknown action.")

    if ((usedToday ?? 0) >= link.daily_cap) {
      return fail(429, "Today's demo slots are all taken — please try again tomorrow.")
    }
    if ((usedByIp ?? 0) >= link.per_ip_daily_cap) {
      return fail(429, "You've reached today's limit for this demo — thanks for trying it!")
    }

    const apiKey = Deno.env.get("RETELL_API_KEY")
    if (!apiKey) return fail(503, "The demo isn't available right now.")

    const res = await fetch("https://api.retellai.com/v3/create-web-call", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        agent_id: agent.retell_agent_id,
        metadata: { is_demo: true, started_from: "public_demo_link", demo_link_id: link.id },
      }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error("retell create-web-call failed:", res.status, payload)
      return fail(502, "The demo couldn't start — please try again in a moment.")
    }

    await admin.from("voice_demo_link_uses").insert({
      link_id: link.id,
      ip,
      retell_call_id: payload.call_id ?? null,
    })
    return new Response(JSON.stringify(payload), { headers })
  } catch (err) {
    console.error("voice-web-call-public error:", err)
    return fail(500, "Something went wrong — please try again.")
  }
})
