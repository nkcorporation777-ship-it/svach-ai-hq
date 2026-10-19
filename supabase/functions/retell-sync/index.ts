// "Sync from Retell" — pulls agents and recent calls from the Retell API and
// records them in HQ through the same ingest path as the webhook. Backfills
// history and recovers anything a webhook missed. Called from a signed-in HQ
// session (verify_jwt), so it needs CORS for the app's origins.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { ingestCall } from "./ingest.ts"

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

const RETELL = "https://api.retellai.com"
const MAX_CALL_PAGES = 5
const CALLS_PER_PAGE = 100
const MAX_TRANSCRIPT_FETCHES = 25

// deno-lint-ignore no-explicit-any
async function retell(apiKey: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${RETELL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Retell API error (${res.status}) on ${path}: ${body.slice(0, 300)}`)
  }
  return res.json()
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const headers = { ...corsHeaders(origin), "content-type": "application/json" }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) })
  }

  try {
    const apiKey = Deno.env.get("RETELL_API_KEY")
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Retell not connected — RETELL_API_KEY is missing in Supabase secrets." }),
        { status: 503, headers },
      )
    }

    const body = await req.json().catch(() => ({}))
    const days = Math.min(Math.max(Number(body?.days) || 30, 1), 90)
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    // 1. Agents. Never overwrites audience / client link the Owner has set.
    let agentsSynced = 0
    let agentKey: string | undefined
    for (let page = 0; page < 5; page++) {
      const qs = new URLSearchParams({ limit: "200" })
      if (agentKey) qs.set("pagination_key", agentKey)
      const res = await retell(apiKey, `/v2/list-agents?${qs}`, { method: "POST", body: "{}" })
      for (const a of res.items ?? []) {
        const modified =
          typeof a.user_modified_timestamp === "number" ? new Date(a.user_modified_timestamp).toISOString() : null
        const { data: existing } = await admin
          .from("voice_agents")
          .select("id")
          .eq("retell_agent_id", a.agent_id)
          .maybeSingle()
        if (existing) {
          await admin
            .from("voice_agents")
            .update({
              name: a.agent_name ?? a.agent_id,
              channel: a.channel ?? "voice",
              last_modified_at: modified,
              synced_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
        } else {
          await admin.from("voice_agents").insert({
            retell_agent_id: a.agent_id,
            name: a.agent_name ?? a.agent_id,
            channel: a.channel ?? "voice",
            last_modified_at: modified,
            synced_at: new Date().toISOString(),
          })
        }
        agentsSynced++
      }
      if (!res.has_more || !res.pagination_key) break
      agentKey = res.pagination_key
    }

    // 2. Calls, newest first, until older than the cutoff.
    let callsSynced = 0
    let transcriptsFetched = 0
    let reachedCutoff = false
    let callKey: string | undefined
    const failures: string[] = []
    for (let page = 0; page < MAX_CALL_PAGES && !reachedCutoff; page++) {
      const res = await retell(apiKey, "/v3/list-calls", {
        method: "POST",
        body: JSON.stringify({
          sort_order: "descending",
          limit: CALLS_PER_PAGE,
          ...(callKey ? { pagination_key: callKey } : {}),
        }),
      })
      for (const item of res.items ?? []) {
        if (typeof item.start_timestamp === "number" && item.start_timestamp < cutoff) {
          reachedCutoff = true
          break
        }
        try {
          let call = item
          // list-calls omits the transcript; fetch it for finished calls we
          // don't have one for yet (capped per run to stay within time limits).
          if (item.call_status === "ended" && transcriptsFetched < MAX_TRANSCRIPT_FETCHES) {
            const { data: have } = await admin
              .from("voice_calls")
              .select("transcript")
              .eq("retell_call_id", item.call_id)
              .maybeSingle()
            if (!have?.transcript) {
              call = await retell(apiKey, `/v1/get-call/${item.call_id}`)
              transcriptsFetched++
            }
          }
          await ingestCall(admin, call, { event: "sync" })
          callsSynced++
        } catch (err) {
          failures.push(`${item.call_id}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
      if (!res.has_more || !res.pagination_key) break
      callKey = res.pagination_key
    }

    return new Response(
      JSON.stringify({
        agentsSynced,
        callsSynced,
        transcriptsFetched,
        failed: failures.length,
        failures: failures.slice(0, 5),
      }),
      { headers },
    )
  } catch (err) {
    console.error("retell-sync error:", err)
    const message = err instanceof Error ? err.message : "Unexpected error"
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
})
