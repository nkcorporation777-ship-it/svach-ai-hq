// Receives Cal.com booking webhooks (BOOKING_CREATED / RESCHEDULED / CANCELLED)
// — the voice agent books, reschedules and cancels inside Cal.com through
// Retell's built-in Cal.com integration; HQ just tracks the result. The actual
// work lives in booking.ts (shared with voice-demo); this file only verifies
// the signature and reports failures.
//
// Server-to-server (verify_jwt = false); the auth is Cal.com's HMAC signature
// in `x-cal-signature-256`, keyed with CALCOM_WEBHOOK_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { processBooking } from "./booking.ts"

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function toBase64(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Cal.com signs the raw body with HMAC-SHA256. Their docs don't state the
 * digest encoding, so accept hex (what they send) or base64. */
async function verifySignature(rawBody: string, secret: string, signature: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))
  const given = signature.trim()
  return timingSafeEqual(toHex(mac), given.toLowerCase()) || timingSafeEqual(toBase64(mac), given)
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  const rawBody = await req.text()
  const signature = req.headers.get("x-cal-signature-256")
  if (!signature) return json(401, { error: "Unauthorized" })

  const secret = Deno.env.get("CALCOM_WEBHOOK_SECRET")
  if (!secret) return json(503, { error: "Cal.com not connected — CALCOM_WEBHOOK_SECRET is missing." })
  if (!(await verifySignature(rawBody, secret, signature))) return json(401, { error: "Unauthorized" })

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  let trigger = ""
  let uid = ""
  try {
    const body = JSON.parse(rawBody)
    trigger = body.triggerEvent
    uid = body.payload?.uid ?? ""
    await processBooking(admin, body)
    return new Response(null, { status: 204 })
  } catch (err) {
    console.error("calcom-webhook error:", err)
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unexpected error"
    await admin.from("ooa_system_health_events").insert({
      source: "calcom",
      event_type: "appointment.webhook_failed",
      severity: "error",
      detail: { trigger, uid, message },
    })
    // Non-2xx lets Cal.com retry; processBooking is idempotent.
    return json(500, { error: message })
  }
})
