// Live caller recognition for Retell voice agents. Server-to-server (Retell is
// not an HQ user), so verify_jwt = false; auth is Retell's HMAC signature
// (x-retell-signature, keyed with the Retell API key) — same check as
// retell-webhook.
//
// Two entry points, told apart by the request body:
//   1. Inbound-call webhook   { event: "call_inbound", call_inbound: { from_number, ... } }
//      Runs BEFORE the agent speaks (phone calls only). Looks the caller-ID
//      number up and answers with dynamic variables the prompt can use:
//      caller_status (client | lead | new), caller_name, caller_org.
//   2. Custom function        { name, args: { email?, organization? }, call }
//      Runs DURING the call when the caller gives an email / clinic name. Answers
//      ONLY { status } — never a name or record — so it can't be used to probe
//      who the clients are.
//
// Only connected (tracked) agents are answered. Demo and patient-facing agents
// always get "new": the public demo link must not reveal real records.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Retell header format: `v={timestamp_ms},d={hex}`, d = HMAC-SHA256(rawBody + timestamp, apiKey). */
async function verifyRetellSignature(rawBody: string, apiKey: string, signature: string) {
  const match = /v=(\d+),d=(.*)/.exec(signature)
  if (!match) return false
  const [, timestamp, digest] = match
  if (Math.abs(Date.now() - Number(timestamp)) > SIGNATURE_TOLERANCE_MS) return false
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody + timestamp))
  return timingSafeEqual(toHex(mac), digest.trim())
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

type Match = { type: "client" | "lead"; id: string } | null

// deno-lint-ignore no-explicit-any
type Admin = any

async function byPhone(admin: Admin, phone: unknown): Promise<Match> {
  if (typeof phone !== "string" || !phone.trim()) return null
  const { data } = await admin.rpc("find_contact_by_phone", { p_phone: phone })
  return data?.[0] ? { type: data[0].entity_type, id: data[0].entity_id } : null
}

async function byEmail(admin: Admin, email: unknown): Promise<Match> {
  if (typeof email !== "string" || !email.trim()) return null
  const { data } = await admin.rpc("find_contact_by_email", { p_email: email })
  return data?.[0] ? { type: data[0].entity_type, id: data[0].entity_id } : null
}

async function byOrg(admin: Admin, org: unknown): Promise<Match> {
  if (typeof org !== "string" || !org.trim()) return null
  const { data } = await admin.rpc("find_contact_by_org", { p_org: org })
  return data?.[0] ? { type: data[0].entity_type, id: data[0].entity_id } : null
}

/** The agent may be answered only if the Owner connected it and it serves Svach AI itself. */
async function agentAllowed(admin: Admin, retellAgentId: unknown): Promise<boolean> {
  if (typeof retellAgentId !== "string" || !retellAgentId) return true // payload without agent info
  const { data } = await admin
    .from("voice_agents")
    .select("audience, tracked")
    .eq("retell_agent_id", retellAgentId)
    .maybeSingle()
  return !!data && data.tracked === true && data.audience === "internal"
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 })

  const rawBody = await req.text()
  const signature = req.headers.get("x-retell-signature")
  if (!signature) return json(401, { error: "Unauthorized" })

  const apiKey = Deno.env.get("RETELL_API_KEY")
  if (!apiKey) return json(503, { error: "Retell not connected — RETELL_API_KEY is missing." })
  if (!(await verifyRetellSignature(rawBody, apiKey, signature))) return json(401, { error: "Unauthorized" })

  // deno-lint-ignore no-explicit-any
  let body: Record<string, any>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return json(400, { error: "Invalid JSON" })
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

  try {
    // ── 1. Inbound-call webhook (before the agent speaks) ──────────────────
    if (body.event === "call_inbound" || body.call_inbound) {
      const inbound = body.call_inbound ?? {}
      const unknown = { call_inbound: { dynamic_variables: { caller_status: "new", caller_name: "", caller_org: "" } } }
      if (!(await agentAllowed(admin, inbound.agent_id))) return json(200, unknown)

      const match = await byPhone(admin, inbound.from_number)
      if (!match) return json(200, unknown)

      // deno-lint-ignore no-explicit-any
      const { data: record }: { data: Record<string, any> | null } =
        match.type === "client"
          ? await admin.from("clients").select("practice_name, primary_contact_name").eq("id", match.id).maybeSingle()
          : await admin.from("leads").select("practice_name, contact_name").eq("id", match.id).maybeSingle()
      return json(200, {
        call_inbound: {
          dynamic_variables: {
            caller_status: match.type,
            caller_name: String(record?.primary_contact_name ?? record?.contact_name ?? ""),
            caller_org: String(record?.practice_name ?? ""),
          },
        },
      })
    }

    // ── 2. Custom function (during the call) ───────────────────────────────
    const call = body.call ?? {}
    const args = (body.args ?? body) as Record<string, unknown>
    if (!(await agentAllowed(admin, call.agent_id))) return json(200, { status: "new" })

    // Caller ID counts too (phone calls); the email / clinic name the caller
    // gives are only ever answered with a status, never details.
    const match =
      (await byPhone(admin, call.direction === "inbound" ? call.from_number : null)) ??
      (await byEmail(admin, args.email)) ??
      (await byOrg(admin, args.organization))
    return json(200, { status: match ? match.type : "new" })
  } catch (err) {
    console.error("voice-lookup error:", err)
    // Never block the call: "new" makes the agent ask the questions instead.
    return body.call_inbound || body.event === "call_inbound"
      ? json(200, { call_inbound: { dynamic_variables: { caller_status: "new", caller_name: "", caller_org: "" } } })
      : json(200, { status: "new" })
  }
})
