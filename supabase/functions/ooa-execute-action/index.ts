// AI_ARCHITECTURE.md's "Branch A — fast path": Owner clicks Approve on a
// recommendation whose suggested_action already names a specific, fully
// specified action -> this function re-checks it's still pending, executes
// it, and records the outcome. Scoped to the one action_type that exists
// (send_onboarding_step_email, the PHI-gate deferred send) -- no framework
// for hypothetical future action types; the switch grows one case when a
// second type actually exists.
//
// Owner-session-authenticated (verify_jwt: true) -- this is the client
// calling on the Owner's behalf, unlike onboarding-email/client-intake which
// are server-to-server or public-token calls.

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
    const { id } = await req.json()

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace("Bearer ", "")
    const anonClient = createClient(supabaseUrl, anonKey)
    const { data: userData } = await anonClient.auth.getUser(jwt)
    const actorId = userData?.user?.id ?? null

    const { data: rec, error: claimError } = await admin
      .from("ooa_recommendations")
      .update({ status: "approved", resolved_by: actorId, resolved_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select()
      .single()

    if (claimError || !rec) {
      return new Response(JSON.stringify({ error: "Already resolved — someone else acted on this first." }), {
        status: 409,
        headers: { ...headers, "content-type": "application/json" },
      })
    }

    await admin.from("audit_logs").insert({
      actor_type: "user",
      actor_id: actorId,
      action: "ooa_recommendation.approved",
      entity_type: "ooa_recommendation",
      entity_id: id,
    })

    const suggestedAction = rec.suggested_action as Record<string, unknown>

    if (suggestedAction?.action_type === "send_onboarding_step_email") {
      const secret = Deno.env.get("ONBOARDING_TRIGGER_SECRET")!
      const res = await fetch(`${supabaseUrl}/functions/v1/onboarding-email`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-onboarding-secret": secret },
        body: JSON.stringify({
          step_id: suggestedAction.step_id,
          client_id: suggestedAction.client_id,
          order_index: suggestedAction.order_index,
          step_name: suggestedAction.step_name,
        }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`onboarding-email execution failed (${res.status}): ${body.slice(0, 300)}`)
      }

      await admin.from("audit_logs").insert({
        actor_type: "agent",
        actor_id: null,
        action: "ooa_recommendation.executed",
        entity_type: "ooa_recommendation",
        entity_id: id,
        metadata: { action_type: suggestedAction.action_type },
      })

      return new Response(JSON.stringify({ approved: true, executed: true }), {
        headers: { ...headers, "content-type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({ error: `Not implemented: action_type "${suggestedAction?.action_type}"` }),
      { status: 400, headers: { ...headers, "content-type": "application/json" } },
    )
  } catch (err) {
    console.error("ooa-execute-action error:", err)
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unexpected error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...headers, "content-type": "application/json" },
    })
  }
})
