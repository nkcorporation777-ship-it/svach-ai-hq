// Public, token-authenticated intake form submission — the client is not an
// HQ user, so this is NOT the shared-secret server-to-server pattern
// (onboarding-email); the intake_token in the URL IS the auth.
//
// Deliberately calls record_client_intake_submission() rather than writing
// client_intake_submissions directly — see that function's definition for why
// it's NOT security definer (the token check happens here, in this function,
// not in the DB layer).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { z } from "https://esm.sh/zod@3"

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

const schema = z.object({
  token: z.string().uuid(),
  legal_name: z.string().min(1).max(200),
  dba: z.string().max(200).optional(),
  location: z.string().min(1).max(500),
  secondary_contact_name: z.string().max(200).optional(),
  secondary_contact_email: z.string().email().max(200).optional().or(z.literal("")),
  secondary_contact_phone: z.string().max(50).optional(),
  services: z.string().min(1).max(2000),
  hours: z.string().max(500).optional(),
  website_urls: z.string().max(1000).optional(),
  uses_crm: z.boolean(),
  crm_name: z.string().max(200).optional(),
  uses_database: z.boolean(),
  database_name: z.string().max(200).optional(),
  hosting_provider: z.string().max(200).optional(),
  dns_manager: z.string().max(200).optional(),
  other_software: z.string().max(2000).optional(),
  billing_contact_name: z.string().max(200).optional(),
  billing_contact_email: z.string().email().max(200).optional().or(z.literal("")),
  brand_assets_note: z.string().max(1000).optional(),
  has_phi: z.boolean(),
})

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const headers = corsHeaders(origin)

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid submission", details: parsed.error.flatten() }), {
        status: 400,
        headers: { ...headers, "content-type": "application/json" },
      })
    }
    const { token, ...submission } = parsed.data

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: client, error: clientError } = await admin
      .from("clients")
      .select("id")
      .eq("intake_token", token)
      .single()
    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "This link is invalid." }), {
        status: 404,
        headers: { ...headers, "content-type": "application/json" },
      })
    }

    const { error: rpcError } = await admin.rpc("record_client_intake_submission", {
      p_client_id: client.id,
      p_submission: submission,
    })
    if (rpcError) {
      if (rpcError.code === "23505") {
        return new Response(JSON.stringify({ error: "This form has already been submitted." }), {
          status: 409,
          headers: { ...headers, "content-type": "application/json" },
        })
      }
      throw rpcError
    }

    await admin.from("activities").insert({
      entity_type: "client",
      entity_id: client.id,
      type: "note",
      content: "Intake form submitted",
      created_by: null,
      metadata: { has_phi: submission.has_phi, source: "client_intake_form" },
    })

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_type: "system",
      actor_id: null,
      action: "client.intake_submitted",
      entity_type: "client",
      entity_id: client.id,
      metadata: { has_phi: submission.has_phi },
    })
    if (auditError) console.error("audit log write failed:", auditError)

    return new Response(JSON.stringify({ submitted: true }), {
      headers: { ...headers, "content-type": "application/json" },
    })
  } catch (err) {
    console.error("client-intake error:", err)
    // supabase-js's PostgrestError (thrown for non-23505 rpcError above) is a
    // plain object with a .message, not an Error instance — check for the
    // property directly rather than `err instanceof Error`, which would
    // silently mask the real Postgres error behind a generic message.
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
