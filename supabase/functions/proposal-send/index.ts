// Sends a drafted proposal to a client — called from DraftProposalCard.tsx
// once the Owner has reviewed (and possibly edited) the AI draft and
// confirmed a price. Creates one `proposals` row per send (not per draft),
// each with its own token, so an older link can never be signed after a
// newer draft supersedes it.
//
// Called from a browser session (Owner), so auth is verify_jwt/a user JWT —
// same as ai-assist, unlike onboarding-email's shared-secret pattern which
// is server-to-server via a Postgres trigger.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { TitanMailer } from "./mailer.ts"

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

const EARLY_STAGES = new Set(["lead", "contacted", "discovery_booked"])

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const headers = corsHeaders(origin)

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  try {
    const { lead_id, content, pricing_path, price, to_email } = await req.json()

    if (!lead_id || !content || !pricing_path || price == null || !to_email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...headers, "content-type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace("Bearer ", "")
    const anonClient = createClient(supabaseUrl, anonKey)
    const { data: userData } = await anonClient.auth.getUser(jwt)
    const actorId = userData?.user?.id ?? null

    const { data: lead, error: leadError } = await admin
      .from("leads")
      .select("id, practice_name, stage")
      .eq("id", lead_id)
      .single()
    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...headers, "content-type": "application/json" },
      })
    }

    const { data: billing } = await admin
      .from("billing_settings")
      .select("gst_percent")
      .maybeSingle()

    // A stale link should never be signable once a newer draft is sent.
    await admin
      .from("proposals")
      .update({ status: "superseded" })
      .eq("lead_id", lead_id)
      .eq("status", "sent")

    const { data: proposal, error: insertError } = await admin
      .from("proposals")
      .insert({
        lead_id,
        content,
        pricing_path,
        price,
        gst_percent: billing?.gst_percent ?? null,
        sent_to_email: to_email,
        created_by: actorId,
      })
      .select("token")
      .single()
    if (insertError || !proposal) throw insertError

    const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? ""
    const acceptUrl = appBaseUrl ? `${appBaseUrl}/proposals/${proposal.token}` : ""

    const smtpUser = Deno.env.get("TITAN_SMTP_USER")
    const smtpPassword = Deno.env.get("TITAN_SMTP_PASSWORD")
    if (!smtpUser || !smtpPassword) {
      return new Response(
        JSON.stringify({ error: "Email sending not configured — TITAN_SMTP_USER/PASSWORD missing." }),
        { status: 503, headers: { ...headers, "content-type": "application/json" } },
      )
    }

    const subject = `Your Svach AI Proposal — ${lead.practice_name}`
    const body = `Hi,\n\nThanks for the conversation — your proposal from Svach AI is ready to review.\n\nReview and sign here:\n${acceptUrl}\n\nLooking forward to working together.\n\nSvach AI`

    const mailer = new TitanMailer(smtpUser, smtpPassword)
    await mailer.send(to_email, subject, body)

    if (EARLY_STAGES.has(lead.stage)) {
      await admin.from("leads").update({ stage: "proposal_sent" }).eq("id", lead_id)
      await admin.from("activities").insert({
        entity_type: "lead",
        entity_id: lead_id,
        type: "stage_change",
        content: null,
        created_by: actorId,
        metadata: { from_stage: lead.stage, to_stage: "proposal_sent" },
      })
    }

    await admin.from("activities").insert({
      entity_type: "lead",
      entity_id: lead_id,
      type: "email",
      content: subject,
      created_by: actorId,
      metadata: { to: to_email },
    })

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_type: "user",
      actor_id: actorId,
      action: "sales.proposal_sent",
      entity_type: "lead",
      entity_id: lead_id,
      metadata: { to_email, price, pricing_path },
    })
    if (auditError) console.error("audit log write failed:", auditError)

    return new Response(JSON.stringify({ sent: true, token: proposal.token }), {
      headers: { ...headers, "content-type": "application/json" },
    })
  } catch (err) {
    console.error("proposal-send error:", err)
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
