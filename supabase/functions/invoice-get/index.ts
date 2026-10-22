// Public, token-authenticated invoice lookup — the client is not an HQ user, so
// this is NOT verify_jwt; the unguessable token in the link IS the auth (same
// pattern as proposal-get). Returns only what the client needs to read and pay
// the invoice, never internal ids or the Owner's notes about the client.
// Drafts are never visible. The first view is recorded (viewed_at).

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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const headers = { ...corsHeaders(origin), "content-type": "application/json" }
  const fail = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers })

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) })
  }

  try {
    const token = new URL(req.url).searchParams.get("token") ?? ""
    if (!UUID.test(token)) return fail(404, "This link is invalid.")

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    const { data: invoice } = await admin
      .from("invoices")
      .select(
        "id, invoice_number, status, kind, issue_date, due_date, currency, bill_to_name, bill_to_address, bill_to_gstin, subtotal, gst_percent, gst_amount, total, amount_paid, notes, viewed_at",
      )
      .eq("token", token)
      .maybeSingle()
    // A draft hasn't been sent to anyone, so its link must not work yet.
    if (!invoice || invoice.status === "draft") return fail(404, "This link is invalid.")

    const [{ data: items }, { data: billing }] = await Promise.all([
      admin
        .from("invoice_items")
        .select("description, quantity, unit_price, amount")
        .eq("invoice_id", invoice.id)
        .order("order_index"),
      admin.from("billing_settings").select("invoice_from, payment_instructions").maybeSingle(),
    ])

    if (!invoice.viewed_at) {
      await admin.from("invoices").update({ viewed_at: new Date().toISOString() }).eq("id", invoice.id)
    }

    const { id: _id, viewed_at: _viewedAt, ...visible } = invoice
    return new Response(
      JSON.stringify({
        ...visible,
        items: items ?? [],
        invoice_from: billing?.invoice_from ?? null,
        payment_instructions: billing?.payment_instructions ?? null,
      }),
      { headers },
    )
  } catch (err) {
    console.error("invoice-get error:", err)
    return fail(500, err instanceof Error ? err.message : "Unexpected error")
  }
})
