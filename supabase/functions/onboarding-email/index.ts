// Sends one onboarding-sequence email for a client_onboarding_steps row and,
// only for the "Welcome message sent" step, marks it complete on success —
// see docs/DECISION_LOG.md §9 (reactive, event-triggered, no approval gate;
// this is deterministic Owner-authored template delivery, not an AI agent
// deciding what to send, so §5's OOA approval rule doesn't apply here).
//
// Called only by the `trigger_onboarding_step_email` Postgres trigger via
// pg_net — never by a browser session, so auth is a shared secret header,
// not verify_jwt/a user JWT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { TitanMailer } from "./mailer.ts"
import { renderTemplate } from "./templates.ts"

Deno.serve(async (req) => {
  try {
    const secret = req.headers.get("x-onboarding-secret")
    if (!secret || secret !== Deno.env.get("ONBOARDING_TRIGGER_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    }

    const { step_id, client_id, order_index, step_name } = await req.json()

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: client, error: clientError } = await admin
      .from("clients")
      .select("*, specialties(name)")
      .eq("id", client_id)
      .single()
    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    }
    if (!client.primary_contact_email) {
      return new Response(
        JSON.stringify({ error: "Client has no primary_contact_email — nothing to send to" }),
        { status: 422, headers: { "content-type": "application/json" } },
      )
    }

    const { data: template, error: templateError } = await admin
      .from("client_email_templates")
      .select("*")
      .eq("step_order_index", order_index)
      .single()
    if (templateError || !template) {
      return new Response(JSON.stringify({ error: `No template for step order_index ${order_index}` }), {
        status: 404,
        headers: { "content-type": "application/json" },
      })
    }

    const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? ""
    const vars = {
      practice_name: client.practice_name ?? "",
      contact_name: client.primary_contact_name ?? "there",
      specialty: (client as { specialties?: { name: string } | null }).specialties?.name ?? "healthcare",
      intake_url: appBaseUrl ? `${appBaseUrl}/intake/${client.intake_token}` : "",
    }
    const subject = renderTemplate(template.subject, vars)
    const body = renderTemplate(template.body, vars)

    const smtpUser = Deno.env.get("TITAN_SMTP_USER")
    const smtpPassword = Deno.env.get("TITAN_SMTP_PASSWORD")
    if (!smtpUser || !smtpPassword) {
      return new Response(
        JSON.stringify({ error: "Email sending not configured — TITAN_SMTP_USER/PASSWORD missing." }),
        { status: 503, headers: { "content-type": "application/json" } },
      )
    }

    const mailer = new TitanMailer(smtpUser, smtpPassword)
    await mailer.send(client.primary_contact_email, subject, body)

    await admin.from("activities").insert({
      entity_type: "client",
      entity_id: client_id,
      type: "email",
      content: subject,
      created_by: null,
      metadata: { step_key: template.step_key, automated: true },
    })

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_type: "agent",
      actor_id: null,
      action: "onboarding.email_sent",
      entity_type: "client",
      entity_id: client_id,
      metadata: { step_key: template.step_key, order_index },
    })
    if (auditError) console.error("audit log write failed:", auditError)

    if (step_name === "Welcome message sent") {
      const { error: completeError } = await admin
        .from("client_onboarding_steps")
        .update({ is_complete: true, completed_at: new Date().toISOString() })
        .eq("id", step_id)
      if (completeError) console.error("failed to mark welcome step complete:", completeError)
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { "content-type": "application/json" },
    })
  } catch (err) {
    console.error("onboarding-email error:", err)
    const message = err instanceof Error ? err.message : "Unexpected error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
})
