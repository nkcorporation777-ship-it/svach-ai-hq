// Public, token-authenticated proposal lookup — the client is not an HQ
// user, so this is NOT verify_jwt; the token in the URL/query string IS the
// auth, same pattern as client-intake's intake_token. Returns only the
// fields a client needs to review and sign, never internal ids or the
// Owner's audit trail.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "https://hq.svach.in"])

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : ""
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const headers = corsHeaders(origin)

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  try {
    const token = new URL(req.url).searchParams.get("token")
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { ...headers, "content-type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: proposal, error } = await admin
      .from("proposals")
      .select("content, status, price, gst_percent, deposit_percent, signer_name, signed_at, lead_id")
      .eq("token", token)
      .single()
    if (error || !proposal) {
      return new Response(JSON.stringify({ error: "This link is invalid." }), {
        status: 404,
        headers: { ...headers, "content-type": "application/json" },
      })
    }

    const { data: lead } = await admin
      .from("leads")
      .select("practice_name")
      .eq("id", proposal.lead_id)
      .maybeSingle()

    return new Response(
      JSON.stringify({
        practice_name: lead?.practice_name ?? "",
        content: proposal.content,
        status: proposal.status,
        price: proposal.price,
        gst_percent: proposal.gst_percent,
        deposit_percent: proposal.deposit_percent,
        signer_name: proposal.signer_name,
        signed_at: proposal.signed_at,
      }),
      { headers: { ...headers, "content-type": "application/json" } },
    )
  } catch (err) {
    console.error("proposal-get error:", err)
    const message = err instanceof Error ? err.message : "Unexpected error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...headers, "content-type": "application/json" },
    })
  }
})
