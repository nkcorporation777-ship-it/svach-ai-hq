// Public, token-authenticated proposal signature — the client is not an HQ
// user, so this is NOT verify_jwt; the token IS the auth, same pattern as
// client-intake. Records a typed-name + checkbox "clickwrap" signature with
// server-side timestamp and IP, then advances the lead's stage the same way
// a manual Board drag would (see src/features/sales/hooks.ts's
// useUpdateLeadStage — mirrored here since this write has to happen
// server-side with no HQ session).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "https://hq.svach.in"])

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
  const headers = corsHeaders(origin)

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  try {
    const { token, signer_name } = await req.json()
    if (!token || !signer_name || !String(signer_name).trim()) {
      return new Response(JSON.stringify({ error: "A signer name is required." }), {
        status: 400,
        headers: { ...headers, "content-type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: proposal, error: proposalError } = await admin
      .from("proposals")
      .select("id, lead_id, status")
      .eq("token", token)
      .single()
    if (proposalError || !proposal) {
      return new Response(JSON.stringify({ error: "This link is invalid." }), {
        status: 404,
        headers: { ...headers, "content-type": "application/json" },
      })
    }
    if (proposal.status !== "sent") {
      return new Response(
        JSON.stringify({ error: "This proposal has already been handled.", status: proposal.status }),
        { status: 409, headers: { ...headers, "content-type": "application/json" } },
      )
    }

    const signerIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null

    const { error: updateError } = await admin
      .from("proposals")
      .update({
        status: "accepted",
        signer_name: String(signer_name).trim(),
        signed_at: new Date().toISOString(),
        signer_ip: signerIp,
      })
      .eq("id", proposal.id)
    if (updateError) throw updateError

    const { data: lead } = await admin
      .from("leads")
      .select("stage")
      .eq("id", proposal.lead_id)
      .maybeSingle()

    if (lead?.stage === "proposal_sent") {
      await admin.from("leads").update({ stage: "verbal_commit" }).eq("id", proposal.lead_id)
      await admin.from("activities").insert({
        entity_type: "lead",
        entity_id: proposal.lead_id,
        type: "stage_change",
        content: null,
        created_by: null,
        metadata: { from_stage: "proposal_sent", to_stage: "verbal_commit" },
      })
    }

    await admin.from("activities").insert({
      entity_type: "lead",
      entity_id: proposal.lead_id,
      type: "note",
      content: `Proposal signed by ${String(signer_name).trim()}`,
      created_by: null,
      metadata: { source: "proposal_accept", signer_ip: signerIp },
    })

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_type: "system",
      actor_id: null,
      action: "sales.proposal_accepted",
      entity_type: "lead",
      entity_id: proposal.lead_id,
      metadata: { signer_name: String(signer_name).trim(), signer_ip: signerIp },
    })
    if (auditError) console.error("audit log write failed:", auditError)

    return new Response(JSON.stringify({ accepted: true }), {
      headers: { ...headers, "content-type": "application/json" },
    })
  } catch (err) {
    console.error("proposal-accept error:", err)
    const message = err instanceof Error ? err.message : "Unexpected error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...headers, "content-type": "application/json" },
    })
  }
})
