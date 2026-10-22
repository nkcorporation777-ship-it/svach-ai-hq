// Emails an invoice to the client — called from the invoice page in HQ once the
// Owner confirms. Marks a draft as "sent" only AFTER the email has gone out, so a
// mail failure never leaves an invoice that looks sent but wasn't. Resending an
// already-sent invoice just emails the link again.
//
// Called from a browser session (Owner): verify_jwt, same as proposal-send.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { TitanMailer } from "./mailer.ts"

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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value)

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const headers = { ...corsHeaders(origin), "content-type": "application/json" }
  const fail = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers })

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) })
  }

  try {
    const { invoice_id, to_email } = await req.json().catch(() => ({}))
    if (!invoice_id || typeof to_email !== "string" || !EMAIL.test(to_email.trim())) {
      return fail(400, "An invoice and a valid email address are required.")
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
    const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!)
    const { data: userData } = await anon.auth.getUser(jwt)
    const actorId = userData?.user?.id ?? null

    const { data: invoice, error } = await admin.from("invoices").select("*").eq("id", invoice_id).single()
    if (error || !invoice) return fail(404, "Invoice not found.")
    if (invoice.status === "void" || invoice.status === "paid") {
      return fail(400, `This invoice is ${invoice.status}; there is nothing to send.`)
    }
    if (!(Number(invoice.total) > 0)) return fail(400, "This invoice has no amount to bill.")

    const smtpUser = Deno.env.get("TITAN_SMTP_USER")
    const smtpPassword = Deno.env.get("TITAN_SMTP_PASSWORD")
    if (!smtpUser || !smtpPassword) {
      return fail(503, "Email sending not configured — TITAN_SMTP_USER/PASSWORD missing.")
    }
    const base = Deno.env.get("APP_BASE_URL") ?? ""
    if (!base) return fail(503, "APP_BASE_URL is not set, so there is no link to put in the email.")

    const link = `${base}/invoices/${invoice.token}`
    const balance = Number(invoice.total) - Number(invoice.amount_paid)
    const subject = `Invoice ${invoice.invoice_number} from Svach AI — ${money(balance, invoice.currency)} due ${invoice.due_date}`
    const body = [
      `Hi ${invoice.bill_to_name},`,
      "",
      `Please find your invoice ${invoice.invoice_number} from Svach AI.`,
      "",
      `Amount due: ${money(balance, invoice.currency)}`,
      `Due date: ${invoice.due_date}`,
      "",
      "View the invoice and payment details here:",
      link,
      "",
      "Once you've paid, just reply to this email with the payment reference and we'll mark it as received.",
      "",
      "Thank you,",
      "Svach AI",
    ].join("\n")

    await new TitanMailer(smtpUser, smtpPassword).send(to_email.trim(), subject, body)

    const sentNow = new Date().toISOString()
    const { error: updateError } = await admin
      .from("invoices")
      .update({
        status: invoice.status === "draft" ? "sent" : invoice.status,
        sent_at: sentNow,
        sent_to_email: to_email.trim(),
        ...(invoice.bill_to_email ? {} : { bill_to_email: to_email.trim() }),
      })
      .eq("id", invoice_id)
    if (updateError) throw updateError

    if (invoice.client_id) {
      await admin.from("activities").insert({
        entity_type: "client",
        entity_id: invoice.client_id,
        type: "email",
        content: subject,
        created_by: actorId,
        metadata: { to: to_email.trim(), source: "finance", invoice_id },
      })
    }
    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_type: "user",
      actor_id: actorId,
      action: invoice.status === "draft" ? "finance.invoice_sent" : "finance.invoice_resent",
      entity_type: "invoice",
      entity_id: invoice_id,
      metadata: { to_email: to_email.trim(), invoice_number: invoice.invoice_number, total: invoice.total },
    })
    if (auditError) console.error("audit log write failed:", auditError)

    return new Response(JSON.stringify({ sent: true, token: invoice.token }), { headers })
  } catch (err) {
    console.error("invoice-send error:", err)
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unexpected error"
    return fail(500, message)
  }
})
