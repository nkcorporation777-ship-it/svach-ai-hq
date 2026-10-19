// Retell connection, agent by agent. Called from a signed-in HQ session
// (verify_jwt), so it needs CORS for the app's origins.
//
//   { action: "add_agent", agent_id }  connect ONE agent by its Retell ID. The
//                                      only thing read from Retell is that agent.
//   { days }                           "Sync from Retell": refresh connected
//                                      agents' names and backfill THEIR recent
//                                      calls through the same ingest path as
//                                      the webhook. Other agents in the Retell
//                                      account are never listed or recorded.

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
const AGENT_ID = /^[A-Za-z0-9_-]{6,80}$/

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
    throw Object.assign(new Error(`Retell API error (${res.status}) on ${path}: ${body.slice(0, 300)}`), {
      status: res.status,
    })
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
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    // ── Connect one agent by ID ────────────────────────────────────────────
    if (body?.action === "add_agent") {
      const agentId = String(body.agent_id ?? "").trim()
      if (!AGENT_ID.test(agentId)) {
        return new Response(JSON.stringify({ error: "That doesn't look like a Retell agent ID." }), {
          status: 400,
          headers,
        })
      }
      let agent
      try {
        agent = await retell(apiKey, `/get-agent/${encodeURIComponent(agentId)}`)
      } catch (err) {
        const status = (err as { status?: number }).status
        const message =
          status === 404 || status === 422
            ? "Retell doesn't know that agent ID. Copy it from the agent's page in Retell."
            : status === 401
              ? "Retell rejected the API key stored in Supabase."
              : err instanceof Error
                ? err.message
                : "Couldn't reach Retell."
        return new Response(JSON.stringify({ error: message }), { status: 400, headers })
      }
      const name: string = agent.agent_name ?? agentId
      const modified =
        typeof agent.last_modification_timestamp === "number"
          ? new Date(agent.last_modification_timestamp).toISOString()
          : null

      const { data: existing } = await admin
        .from("voice_agents")
        .select("id")
        .eq("retell_agent_id", agentId)
        .maybeSingle()
      const fields = {
        name,
        channel: "voice",
        last_modified_at: modified,
        synced_at: new Date().toISOString(),
        tracked: true,
      }
      const { data: row, error } = existing
        ? await admin.from("voice_agents").update(fields).eq("id", existing.id).select("id, name").single()
        : await admin
            .from("voice_agents")
            .insert({ retell_agent_id: agentId, ...fields })
            .select("id, name")
            .single()
      if (error) throw error
      return new Response(JSON.stringify({ id: row.id, name: row.name }), { headers })
    }

    // ── Sync connected agents only ─────────────────────────────────────────
    const days = Math.min(Math.max(Number(body?.days) || 30, 1), 90)
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000

    const { data: connected } = await admin
      .from("voice_agents")
      .select("id, retell_agent_id")
      .eq("tracked", true)
      .not("retell_agent_id", "like", "demo-%")
    const agentIds = new Set((connected ?? []).map((a: { retell_agent_id: string }) => a.retell_agent_id))
    if (agentIds.size === 0) {
      return new Response(
        JSON.stringify({
          agentsSynced: 0,
          callsSynced: 0,
          transcriptsFetched: 0,
          failed: 0,
          failures: [],
          note: "No agents connected yet — add one by its ID on the Agents tab.",
        }),
        { headers },
      )
    }

    const failures: string[] = []
    let agentsSynced = 0
    for (const id of agentIds) {
      try {
        const a = await retell(apiKey, `/get-agent/${encodeURIComponent(id)}`)
        await admin
          .from("voice_agents")
          .update({
            name: a.agent_name ?? id,
            last_modified_at:
              typeof a.last_modification_timestamp === "number"
                ? new Date(a.last_modification_timestamp).toISOString()
                : null,
            synced_at: new Date().toISOString(),
          })
          .eq("retell_agent_id", id)
        agentsSynced++
      } catch (err) {
        failures.push(`${id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // Calls, newest first, until older than the cutoff. Ask Retell to filter to
    // the connected agents; if it rejects the filter, fall back to skipping the
    // others here (they are never fetched in full or stored either way).
    let callsSynced = 0
    let transcriptsFetched = 0
    let reachedCutoff = false
    let callKey: string | undefined
    let useFilter = true
    for (let page = 0; page < MAX_CALL_PAGES && !reachedCutoff; page++) {
      const request = () =>
        retell(apiKey, "/v3/list-calls", {
          method: "POST",
          body: JSON.stringify({
            sort_order: "descending",
            limit: CALLS_PER_PAGE,
            ...(useFilter ? { filter_criteria: { agent_id: [...agentIds] } } : {}),
            ...(callKey ? { pagination_key: callKey } : {}),
          }),
        })
      let res
      try {
        res = await request()
      } catch (err) {
        const status = (err as { status?: number }).status
        if (useFilter && status && status >= 400 && status < 500 && status !== 401) {
          useFilter = false
          res = await request()
        } else {
          throw err
        }
      }
      for (const item of res.items ?? []) {
        if (typeof item.start_timestamp === "number" && item.start_timestamp < cutoff) {
          reachedCutoff = true
          break
        }
        if (!agentIds.has(item.agent_id)) continue
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
