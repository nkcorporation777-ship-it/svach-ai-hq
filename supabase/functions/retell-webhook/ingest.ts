// Shared call-ingest logic for the voice-agent Edge Functions (retell-webhook,
// retell-sync, voice-demo). Edge Functions bundle per-function, so this file is
// kept as an IDENTICAL copy in each function's folder — edit all three together.
//
// One Retell call object in → a `voice_calls` row (idempotent on
// retell_call_id), matched to a lead/client, ONE `call` activity on that
// record's timeline (only once the call is final/analyzed), and — for leads —
// the same stage-change + audit shape the Sales board uses.

// deno-lint-ignore no-explicit-any
type Admin = any
// deno-lint-ignore no-explicit-any
export type RetellCall = Record<string, any>

export interface IngestOptions {
  /** call_started | transcript_updated | call_ended | call_analyzed | sync */
  event?: string
  /** Treat as demo data: tags rows is_demo and creates tagged demo leads. */
  forceDemo?: boolean
}

export interface IngestResult {
  callId: string
  matched: "lead" | "client" | null
  matchedId: string | null
  createdLead: boolean
  activityCreated: boolean
  stageMoved: boolean
  final: boolean
  /** The agent flagged this caller as a hot lead (post-call analysis). */
  hotLead: boolean
  /** Set only when this call was just logged (never on a retry). */
  callerLabel: string | null
  summary: string | null
  isDemo: boolean
  /** Flagged for the Owner: unmatched "existing client" claim, or a new lead that resembles an existing record. */
  needsReview: boolean
}

function truthy(v: unknown) {
  return v === true || v === "true" || v === "yes"
}

// A call shorter than this isn't treated as a real conversation (hang-ups,
// voicemail boxes) — it's logged but doesn't create a lead or move a stage.
const CONNECTED_MIN_MS = 15_000

function iso(ms: unknown): string | null {
  return typeof ms === "number" && Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/** Retell sends the transcript as a string or as an array of turns. */
export function renderTranscript(call: RetellCall): string | null {
  if (typeof call.transcript === "string" && call.transcript.trim()) return call.transcript
  const items = call.transcript_object ?? call.transcript_with_tool_calls
  if (!Array.isArray(items)) return null
  const lines = items
    .filter((i) => (i?.role === "agent" || i?.role === "user") && i?.content)
    .map((i) => `${i.role === "agent" ? "Agent" : "Caller"}: ${i.content}`)
  return lines.length ? lines.join("\n") : null
}

function compact(obj: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null))
}

async function findAgent(admin: Admin, call: RetellCall, forceDemo: boolean) {
  const { data: existing } = await admin
    .from("voice_agents")
    .select("*")
    .eq("retell_agent_id", call.agent_id)
    .maybeSingle()
  if (existing) return existing

  const { data, error } = await admin
    .from("voice_agents")
    .insert({
      retell_agent_id: call.agent_id,
      name: call.agent_name ?? call.agent_id,
      channel: "voice",
      audience: forceDemo ? "demo" : "internal",
    })
    .select("*")
    .single()
  if (error) {
    // Lost a race with a concurrent webhook for the same new agent.
    if (error.code === "23505") {
      const { data: again } = await admin
        .from("voice_agents")
        .select("*")
        .eq("retell_agent_id", call.agent_id)
        .single()
      return again
    }
    throw error
  }
  return data
}

async function matchContact(
  admin: Admin,
  call: RetellCall,
  row: Record<string, any>,
  custom: Record<string, any>,
  isDemo: boolean,
): Promise<{ type: "lead" | "client"; id: string; via: "metadata" | "phone" | "email" | "organisation" } | null> {
  const meta = call.metadata ?? {}

  // 1. HQ started this call from a record (metadata set by our own server).
  if (meta.client_id) {
    const { data } = await admin.from("clients").select("id").eq("id", meta.client_id).maybeSingle()
    if (data) return { type: "client", id: data.id, via: "metadata" }
  }
  if (meta.lead_id) {
    const { data } = await admin.from("leads").select("id").eq("id", meta.lead_id).maybeSingle()
    if (data) return { type: "lead", id: data.id, via: "metadata" }
  }

  // 2. The other party's phone number (phone calls only).
  if (call.call_type !== "web_call") {
    const other = row.direction === "outbound" ? call.to_number : call.from_number
    if (other) {
      const { data } = await admin.rpc("find_contact_by_phone", { p_phone: other })
      if (data?.[0]) return { type: data[0].entity_type, id: data[0].entity_id, via: "phone" }
    }
  }

  // 3. Contact details the agent collected during the call.
  if (custom.caller_email) {
    const { data } = await admin.rpc("find_contact_by_email", { p_email: String(custom.caller_email) })
    if (data?.[0]) return { type: data[0].entity_type, id: data[0].entity_id, via: "email" }
  }
  if (custom.caller_phone) {
    const { data } = await admin.rpc("find_contact_by_phone", { p_phone: String(custom.caller_phone) })
    if (data?.[0]) return { type: data[0].entity_type, id: data[0].entity_id, via: "phone" }
  }

  // 4. The organisation they named — several people at one clinic can call, so a
  // colleague with a different number/email still lands on the clinic's record.
  if (custom.practice_name) {
    const { data } = await admin.rpc("find_contact_by_org", { p_org: String(custom.practice_name), p_demo: isDemo })
    if (data?.[0]) return { type: data[0].entity_type, id: data[0].entity_id, via: "organisation" }
  }
  return null
}

export async function ingestCall(
  admin: Admin,
  call: RetellCall,
  opts: IngestOptions = {},
): Promise<IngestResult> {
  const event = opts.event ?? "sync"
  const analysis = call.call_analysis ?? null
  const custom: Record<string, any> = analysis?.custom_analysis_data ?? {}
  const isFinal =
    event === "call_analyzed" ||
    (event === "sync" && call.call_status === "ended" && !!analysis)

  const agent = await findAgent(admin, call, !!opts.forceDemo)
  // Calls for a clinic's patients are metadata-only until the patient-data
  // security review (docs/SECURITY_POLICY.md) is approved: no numbers,
  // summary, transcript or recording are stored.
  const patientSafe = agent.audience === "client_patients"
  const isDemo = !!opts.forceDemo || agent.audience === "demo" || call.metadata?.is_demo === true

  const patch: Record<string, unknown> = compact({
    agent_id: agent.id,
    call_type: call.call_type,
    direction: call.direction ?? (call.call_type === "web_call" ? "inbound" : undefined),
    call_status: call.call_status,
    started_at: iso(call.start_timestamp),
    ended_at: iso(call.end_timestamp),
    duration_ms: typeof call.duration_ms === "number" ? call.duration_ms : undefined,
    cost_cents: call.call_cost?.combined_cost,
    disconnection_reason: call.disconnection_reason,
    is_demo: isDemo,
    metadata: call.metadata && Object.keys(call.metadata).length ? call.metadata : undefined,
    updated_at: new Date().toISOString(),
  })
  if (!patientSafe) {
    Object.assign(
      patch,
      compact({
        from_number: call.from_number,
        to_number: call.to_number,
        transcript: renderTranscript(call),
        recording_url: call.recording_url,
        summary: analysis?.call_summary,
        sentiment: analysis?.user_sentiment,
        call_successful: analysis?.call_successful,
        analysis: analysis ? custom : undefined,
      }),
    )
  }

  // Upsert on retell_call_id, tolerant of two events racing to insert.
  const { data: existing } = await admin
    .from("voice_calls")
    .select("*")
    .eq("retell_call_id", call.call_id)
    .maybeSingle()

  let row = existing
  if (!row) {
    const { data, error } = await admin
      .from("voice_calls")
      .insert({ retell_call_id: call.call_id, ...patch })
      .select("*")
      .single()
    if (error?.code === "23505") {
      const { data: again } = await admin
        .from("voice_calls")
        .update(patch)
        .eq("retell_call_id", call.call_id)
        .select("*")
        .single()
      row = again
    } else if (error) {
      throw error
    } else {
      row = data
    }
  } else {
    const { data, error } = await admin
      .from("voice_calls")
      .update(patch)
      .eq("id", row.id)
      .select("*")
      .single()
    if (error) throw error
    row = data
  }

  const result: IngestResult = {
    callId: row.id,
    matched: null,
    matchedId: null,
    createdLead: false,
    activityCreated: false,
    stageMoved: false,
    final: isFinal,
    hotLead: false,
    callerLabel: null,
    summary: analysis?.call_summary ?? null,
    isDemo,
    needsReview: false,
  }
  if (patientSafe) return result

  // Match to a record (once), so even in-progress calls link up when possible.
  let contact: { type: "lead" | "client"; id: string; via?: string } | null = row.client_id
    ? { type: "client", id: row.client_id }
    : row.lead_id
      ? { type: "lead", id: row.lead_id }
      : await matchContact(admin, call, row, custom, isDemo)

  const connected =
    (row.duration_ms ?? 0) >= CONNECTED_MIN_MS && !analysis?.in_voicemail

  // Unknown caller on a finished, real conversation. A caller who says they are an
  // existing client but can't be matched must NOT become a duplicate lead: flag the
  // call for the Owner instead, with close name matches as suggestions.
  const saysClient = truthy(custom.says_existing_client)
  const candidates: { entity_type: string; entity_id: string; practice_name: string }[] =
    !contact && isFinal && connected && custom.practice_name
      ? ((await admin.rpc("find_org_candidates", { p_org: String(custom.practice_name), p_demo: isDemo })).data ?? [])
      : []
  if (!contact && isFinal && connected && saysClient) {
    if (!row.needs_review) {
      await admin
        .from("voice_calls")
        .update({
          needs_review: true,
          review_reason:
            "Says they are an existing client, but no matching phone, email or organisation was found. No lead was created.",
          review_candidates: candidates,
        })
        .eq("id", row.id)
    }
    result.needsReview = true
    return result
  }

  // Otherwise a first-time caller → create a lead so nothing said on the phone is lost.
  if (!contact && isFinal && connected) {
    const otherNumber =
      call.call_type === "web_call"
        ? null
        : row.direction === "outbound"
          ? call.to_number
          : call.from_number
    const phone = otherNumber ?? custom.caller_phone ?? null
    let email = custom.caller_email ?? null
    if (!phone && !email && isDemo) {
      email = `demo-${String(call.call_id).slice(-8).toLowerCase()}@demo.invalid`
    }
    if (phone || email) {
      const last4 = phone ? String(phone).replace(/\D/g, "").slice(-4) : ""
      const { data: lead, error: leadError } = await admin
        .from("leads")
        .insert({
          practice_name:
            custom.practice_name || custom.caller_name || (last4 ? `Voice caller ${last4}` : "Voice caller"),
          contact_name: custom.caller_name ?? null,
          contact_phone: phone,
          contact_email: email,
          source: isDemo ? "Demo Call" : "Voice Agent",
          stage: "lead",
          metadata: { created_by: "voice_agent", is_demo: isDemo, retell_call_id: call.call_id },
        })
        .select("id")
        .single()
      if (leadError) throw leadError
      contact = { type: "lead", id: lead.id }
      result.createdLead = true
      if (candidates.length > 0) {
        await admin
          .from("voice_calls")
          .update({
            needs_review: true,
            review_reason: "New lead created, but similar existing record(s) were found — check this isn't a duplicate.",
            review_candidates: candidates,
          })
          .eq("id", row.id)
        result.needsReview = true
      }
      await admin.from("audit_logs").insert({
        actor_type: "agent",
        actor_id: null,
        action: "lead.created",
        entity_type: "lead",
        entity_id: lead.id,
        metadata: { source: "voice_agent", retell_call_id: call.call_id },
      })
    }
  }

  if (!contact) return result
  result.matched = contact.type
  result.matchedId = contact.id

  const link = contact.type === "client" ? { client_id: contact.id } : { lead_id: contact.id }
  if (!row.lead_id && !row.client_id) {
    await admin.from("voice_calls").update(link).eq("id", row.id)
    row = { ...row, ...link }
  }

  if (!isFinal) return result

  // ONE timeline entry per call, even if Retell retries the webhook.
  if (!row.activity_id) {
    const minutes = Math.max(1, Math.round((row.duration_ms ?? 0) / 60000))
    const content =
      analysis?.call_summary ||
      `${row.direction === "outbound" ? "Outbound" : "Inbound"} voice call (${minutes} min)`
    const { data: activity, error: activityError } = await admin
      .from("activities")
      .insert({
        entity_type: contact.type,
        entity_id: contact.id,
        type: "call",
        content,
        created_by: null,
        created_at: row.ended_at ?? new Date().toISOString(),
        metadata: {
          source: "voice_agent",
          retell_call_id: call.call_id,
          direction: row.direction,
          call_type: row.call_type,
          duration_ms: row.duration_ms,
          sentiment: row.sentiment,
          call_successful: row.call_successful,
          voice_call_id: row.id,
        },
      })
      .select("id")
      .single()
    if (activityError) throw activityError

    const { data: claimed } = await admin
      .from("voice_calls")
      .update({ activity_id: activity.id })
      .eq("id", row.id)
      .is("activity_id", null)
      .select("id")
    if (!claimed?.length) {
      // A concurrent delivery already logged this call — drop our duplicate.
      await admin.from("activities").delete().eq("id", activity.id)
    } else {
      result.activityCreated = true
      await admin.from("audit_logs").insert({
        actor_type: "agent",
        actor_id: null,
        action: "voice.call_logged",
        entity_type: contact.type,
        entity_id: contact.id,
        metadata: { retell_call_id: call.call_id, direction: row.direction },
      })
    }
  }

  // Matched on the organisation name alone: record WHO called, so a colleague isn't
  // mistaken for the usual contact.
  if (result.activityCreated && contact.via === "organisation") {
    const who = [custom.caller_name, custom.caller_email, custom.caller_phone].filter(Boolean).join(", ")
    await admin.from("activities").insert({
      entity_type: contact.type,
      entity_id: contact.id,
      type: "note",
      content: `Call from ${who || "an unnamed caller"} — matched by organisation name (${custom.practice_name}). Not the usual contact?`,
      created_by: null,
      metadata: { source: "voice_agent", retell_call_id: call.call_id, matched_by: "organisation" },
    })
  }

  if (result.activityCreated) {
    result.hotLead = truthy(custom.hot_lead)
    result.callerLabel = custom.practice_name || custom.caller_name || null

    // "Please call me back" from an existing client becomes a Follow-up Queue
    // item for tomorrow morning, so it can't be forgotten. (Leads have no
    // follow-up queue; the call summary on their timeline carries it.)
    if (contact.type === "client" && truthy(custom.callback_requested)) {
      const due = new Date()
      due.setUTCDate(due.getUTCDate() + 1)
      due.setUTCHours(4, 30, 0, 0) // 10:00 IST
      await admin.from("follow_ups").insert({
        client_id: contact.id,
        due_at: due.toISOString(),
        note: `Callback requested on a voice call${analysis?.call_summary ? ` — ${analysis.call_summary}` : ""}`.slice(0, 500),
      })
    }
  }

  // A real conversation with a brand-new lead means we've made contact.
  if (result.activityCreated && contact.type === "lead" && connected) {
    const { data: lead } = await admin.from("leads").select("stage").eq("id", contact.id).maybeSingle()
    if (lead?.stage === "lead") {
      await admin.from("leads").update({ stage: "contacted" }).eq("id", contact.id)
      await admin.from("activities").insert({
        entity_type: "lead",
        entity_id: contact.id,
        type: "stage_change",
        content: null,
        created_by: null,
        metadata: { from_stage: "lead", to_stage: "contacted", source: "voice_agent" },
      })
      await admin.from("audit_logs").insert({
        actor_type: "agent",
        actor_id: null,
        action: "lead.stage_changed",
        entity_type: "lead",
        entity_id: contact.id,
        metadata: { from_stage: "lead", to_stage: "contacted", source: "voice_agent" },
      })
      result.stageMoved = true
    }
  }

  return result
}
