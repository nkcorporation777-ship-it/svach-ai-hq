// Shared Cal.com booking logic for calcom-webhook and voice-demo. Edge
// Functions bundle per-function, so this file is kept as an IDENTICAL copy in
// each function's folder — edit both together.
//
// One Cal.com webhook body in → an `appointments` row (idempotent on
// provider + booking uid), the lead/client matched or created, a timeline
// entry, the pipeline moved, and the reminder schedule rebuilt.

// deno-lint-ignore no-explicit-any
type Admin = any

export const HANDLED_TRIGGERS = new Set(["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"])

const REMINDERS: { kind: "24h" | "1h"; msBefore: number }[] = [
  { kind: "24h", msBefore: 24 * 60 * 60 * 1000 },
  { kind: "1h", msBefore: 60 * 60 * 1000 },
]

export function formatWhen(iso: string, tz: string | null) {
  try {
    return (
      new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: tz || "UTC",
      }).format(new Date(iso)) + ` (${tz || "UTC"})`
    )
  } catch {
    return iso
  }
}

async function findContact(
  admin: Admin,
  email: string | null,
  phone: string | null,
  organisation: string | null,
  demo: boolean,
): Promise<{ type: "lead" | "client"; id: string; viaOrganisation: boolean } | null> {
  if (email) {
    const { data } = await admin.rpc("find_contact_by_email", { p_email: email })
    if (data?.[0])
      return { type: data[0].entity_type as "lead" | "client", id: data[0].entity_id as string, viaOrganisation: false }
  }
  if (phone) {
    const { data } = await admin.rpc("find_contact_by_phone", { p_phone: phone })
    if (data?.[0])
      return { type: data[0].entity_type as "lead" | "client", id: data[0].entity_id as string, viaOrganisation: false }
  }
  // A colleague at a known clinic booking with their own email: same company,
  // so it lands on the clinic's record instead of creating a duplicate lead.
  if (organisation) {
    const { data } = await admin.rpc("find_contact_by_org", { p_org: organisation, p_demo: demo })
    if (data?.[0])
      return { type: data[0].entity_type as "lead" | "client", id: data[0].entity_id as string, viaOrganisation: true }
  }
  return null
}

/** Finds the one unmatched voice call that was in progress when a booking was
 * made and links it to the booking's contact. Ambiguous (several live calls) or
 * no candidate → nothing is linked. If the call was already analysed, its
 * summary is put on the contact's timeline here, since the call webhook that
 * normally does it has already been and gone. */
async function linkLiveCall(
  admin: Admin,
  contact: { type: "lead" | "client"; id: string },
  bookedAt: number,
  demo: boolean,
): Promise<{ id: string; is_demo: boolean } | null> {
  const { data: candidates } = await admin
    .from("voice_calls")
    .select("id, is_demo, summary, activity_id, ended_at, duration_ms, direction, call_type, sentiment, call_successful, retell_call_id, voice_agents!inner(tracked)")
    .is("lead_id", null)
    .is("client_id", null)
    .eq("is_demo", demo)
    .eq("voice_agents.tracked", true)
    .gte("started_at", new Date(bookedAt - 60 * 60 * 1000).toISOString())
    .lte("started_at", new Date(bookedAt + 60 * 1000).toISOString())
    .or(`ended_at.is.null,ended_at.gte.${new Date(bookedAt - 2 * 60 * 1000).toISOString()}`)
    .limit(2)
  if (!candidates || candidates.length !== 1) return null
  const call = candidates[0]

  const link = contact.type === "client" ? { client_id: contact.id } : { lead_id: contact.id }
  const { data: claimed } = await admin
    .from("voice_calls")
    .update(link)
    .eq("id", call.id)
    .is("lead_id", null)
    .is("client_id", null)
    .select("id")
  if (!claimed?.length) return null

  if (call.summary && !call.activity_id) {
    const { data: activity } = await admin
      .from("activities")
      .insert({
        entity_type: contact.type,
        entity_id: contact.id,
        type: "call",
        content: call.summary,
        created_by: null,
        created_at: call.ended_at ?? new Date().toISOString(),
        metadata: {
          source: "voice_agent",
          retell_call_id: call.retell_call_id,
          direction: call.direction,
          call_type: call.call_type,
          duration_ms: call.duration_ms,
          sentiment: call.sentiment,
          call_successful: call.call_successful,
          voice_call_id: call.id,
          linked_by: "booking",
        },
      })
      .select("id")
      .single()
    if (activity) {
      await admin.from("voice_calls").update({ activity_id: activity.id }).eq("id", call.id).is("activity_id", null)
    }
  }
  await admin.from("audit_logs").insert({
    actor_type: "system",
    actor_id: null,
    action: "voice.call_linked_by_booking",
    entity_type: contact.type,
    entity_id: contact.id,
    metadata: { voice_call_id: call.id, retell_call_id: call.retell_call_id },
  })
  return { id: call.id, is_demo: !!call.is_demo }
}

// Cal.com booking-form answers arrive as { <field id>: { label, value } }. The
// field ids are whatever was typed in the event type (e.g. "Company-Name"), so
// match loosely instead of by one exact key.
// deno-lint-ignore no-explicit-any
type Responses = Record<string, any>

const BASIC_FIELDS = new Set(["name", "email", "attendeephonenumber", "phone", "location", "title", "guests", "reschedulereason"])

function answerText(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(", ")
  if (v === true) return "Yes"
  if (v === false || v === null || v === undefined) return ""
  return String(v).trim()
}

export function practiceFromResponses(responses: Responses): string | null {
  for (const [key, field] of Object.entries(responses)) {
    if (/company|practice|clinic|organi[sz]ation/i.test(key) && !/employee|department/i.test(key)) {
      const text = answerText(field?.value)
      if (text) return text.slice(0, 120)
    }
  }
  return null
}

/** The custom questions a person answered on the booking form, as readable lines. */
export function intakeAnswers(responses: Responses): string[] {
  const lines: string[] = []
  for (const [key, field] of Object.entries(responses)) {
    if (BASIC_FIELDS.has(key.toLowerCase()) || field?.isHidden) continue
    const text = answerText(field?.value)
    if (!text || /^confirmation$/i.test(key)) continue
    const label = String(field?.label || key.replace(/-/g, " ")).replace(/\s+/g, " ").trim()
    lines.push(`${label}: ${text}`)
  }
  return lines
}

async function rebuildReminders(admin: Admin, appointmentId: string, email: string | null, startsAt: string) {
  // Anything not yet sent is replaced by the new schedule.
  await admin
    .from("appointment_reminders")
    .update({ status: "cancelled" })
    .eq("appointment_id", appointmentId)
    .in("status", ["pending", "sending"])
  if (!email) return
  const start = new Date(startsAt).getTime()
  for (const r of REMINDERS) {
    const sendAt = start - r.msBefore
    if (sendAt <= Date.now() + 60_000) continue
    await admin.from("appointment_reminders").upsert(
      {
        appointment_id: appointmentId,
        channel: "email",
        kind: r.kind,
        send_at: new Date(sendAt).toISOString(),
        status: "pending",
        sent_at: null,
        error: null,
      },
      { onConflict: "appointment_id,channel,kind" },
    )
  }
}

export interface BookingResult {
  handled: boolean
  appointmentId: string | null
  createdLead: boolean
  stageMoved: boolean
}

export async function processBooking(
  admin: Admin,
  // deno-lint-ignore no-explicit-any
  body: Record<string, any>,
  opts: { forceDemo?: boolean } = {},
): Promise<BookingResult> {
  const result: BookingResult = { handled: false, appointmentId: null, createdLead: false, stageMoved: false }
  const trigger: string = body.triggerEvent
  if (!HANDLED_TRIGGERS.has(trigger)) return result

  const p = body.payload ?? {}
  const uid: string | undefined = p.uid
  if (!uid || !p.startTime) return result

  const attendee = p.attendees?.[0] ?? {}
  const responses = p.responses ?? {}
  const name: string | null = attendee.name ?? responses.name?.value ?? null
  const email: string | null = attendee.email ?? responses.email?.value ?? null
  const phone: string | null =
    responses.attendeePhoneNumber?.value ?? responses.phone?.value ?? attendee.phoneNumber ?? null
  const tz: string | null = attendee.timeZone ?? p.organizer?.timeZone ?? null
  const location: string | null = typeof p.location === "string" ? p.location : null
  const meetingUrl: string | null = p.metadata?.videoCallUrl ?? (location?.startsWith("http") ? location : null)
  const createdAt = body.createdAt ? new Date(body.createdAt).getTime() : Date.now()

  const { data: existing } = await admin
    .from("appointments")
    .select("*")
    .eq("provider", "calcom")
    .eq("provider_booking_uid", uid)
    .maybeSingle()
  const previous =
    trigger === "BOOKING_RESCHEDULED" && p.rescheduleUid
      ? (
          await admin
            .from("appointments")
            .select("*")
            .eq("provider", "calcom")
            .eq("provider_booking_uid", p.rescheduleUid)
            .maybeSingle()
        ).data
      : null

  // ── Cancelled ───────────────────────────────────────────────────────────
  if (trigger === "BOOKING_CANCELLED") {
    if (!existing) return result
    result.handled = true
    result.appointmentId = existing.id
    await admin
      .from("appointments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", existing.id)
    await admin
      .from("appointment_reminders")
      .update({ status: "cancelled" })
      .eq("appointment_id", existing.id)
      .in("status", ["pending", "sending"])
    const owner = existing.client_id
      ? { type: "client", id: existing.client_id }
      : existing.lead_id
        ? { type: "lead", id: existing.lead_id }
        : null
    if (owner) {
      await admin.from("activities").insert({
        entity_type: owner.type,
        entity_id: owner.id,
        type: "note",
        content: `Appointment on ${formatWhen(existing.starts_at, existing.timezone)} was cancelled${p.cancellationReason ? ` — ${p.cancellationReason}` : ""}.`,
        created_by: null,
        metadata: { source: "calcom", appointment_id: existing.id },
      })
    }
    await admin.from("audit_logs").insert({
      actor_type: "system",
      actor_id: null,
      action: "appointment.cancelled",
      entity_type: owner?.type ?? null,
      entity_id: owner?.id ?? null,
      metadata: { provider_booking_uid: uid },
    })
    return result
  }

  // ── Created / rescheduled ───────────────────────────────────────────────
  let contact: { type: "lead" | "client"; id: string } | null = null
  let matchedByOrganisation = false
  const demoFlag = !!opts.forceDemo || p.metadata?.is_demo === true
  if (previous?.client_id) contact = { type: "client", id: previous.client_id }
  else if (previous?.lead_id) contact = { type: "lead", id: previous.lead_id }
  else if (existing?.client_id) contact = { type: "client", id: existing.client_id }
  else if (existing?.lead_id) contact = { type: "lead", id: existing.lead_id }
  else {
    const found = await findContact(admin, email, phone, practiceFromResponses(responses), demoFlag)
    contact = found ? { type: found.type, id: found.id } : null
    matchedByOrganisation = !!found?.viaOrganisation
  }

  if (!contact && (email || phone)) {
    const { data: lead, error: leadError } = await admin
      .from("leads")
      .insert({
        practice_name: practiceFromResponses(responses) || name || email || "Cal.com booking",
        contact_name: name,
        contact_email: email,
        contact_phone: phone,
        source: demoFlag ? "Demo Call" : "Cal.com",
        // A brand-new person starts in the Lead column ("new lead captured");
        // the appointment is on their record and the Owner moves them on.
        stage: "lead",
        metadata: { created_by: "calcom_webhook", is_demo: demoFlag },
      })
      .select("id")
      .single()
    if (leadError) throw leadError
    contact = { type: "lead", id: lead.id }
    result.createdLead = true
    await admin.from("audit_logs").insert({
      actor_type: "system",
      actor_id: null,
      action: "lead.created",
      entity_type: "lead",
      entity_id: lead.id,
      metadata: { source: "calcom", provider_booking_uid: uid },
    })
    // What they told us on the booking form stays on the lead's timeline.
    const answers = intakeAnswers(responses)
    if (answers.length) {
      await admin.from("activities").insert({
        entity_type: "lead",
        entity_id: lead.id,
        type: "note",
        content: `Booking form answers:\n${answers.join("\n")}`.slice(0, 4000),
        created_by: null,
        metadata: { source: "calcom", provider_booking_uid: uid },
      })
    }
  }

  // Link the voice call that most likely produced this booking.
  let callId: string | null = existing?.call_id ?? previous?.call_id ?? null
  let callIsDemo = false
  if (!callId && contact) {
    const col = contact.type === "client" ? "client_id" : "lead_id"
    const { data: call } = await admin
      .from("voice_calls")
      .select("id, is_demo")
      .eq(col, contact.id)
      .gte("started_at", new Date(createdAt - 3 * 60 * 60 * 1000).toISOString())
      .lte("started_at", new Date(createdAt + 5 * 60 * 1000).toISOString())
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (call) {
      callId = call.id
      callIsDemo = !!call.is_demo
    }
  }

  // The agent booked during a web call it couldn't match to anyone (web calls
  // carry no phone number, and the caller's email only arrives with the
  // post-call analysis). If exactly one unmatched call from a tracked agent was
  // live when this booking was made, it's the call that made it: link it to the
  // booking's contact so its summary lands on that record's timeline.
  if (!callId && contact) {
    const linked = await linkLiveCall(admin, contact, createdAt, demoFlag)
    if (linked) {
      callId = linked.id
      callIsDemo = !!linked.is_demo
    }
  }

  let leadIsDemo = false
  if (contact?.type === "lead") {
    const { data: l } = await admin.from("leads").select("metadata").eq("id", contact.id).maybeSingle()
    leadIsDemo = l?.metadata?.is_demo === true
  }

  const { data: appt, error: apptError } = await admin
    .from("appointments")
    .upsert(
      {
        provider: "calcom",
        provider_booking_uid: uid,
        lead_id: contact?.type === "lead" ? contact.id : null,
        client_id: contact?.type === "client" ? contact.id : null,
        call_id: callId,
        attendee_name: name,
        attendee_email: email,
        attendee_phone: phone,
        title: p.title ?? null,
        starts_at: p.startTime,
        ends_at: p.endTime ?? null,
        timezone: tz,
        status: "scheduled",
        meeting_url: meetingUrl,
        is_demo: demoFlag || callIsDemo || leadIsDemo,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider,provider_booking_uid" },
    )
    .select("*")
    .single()
  if (apptError) throw apptError
  result.handled = true
  result.appointmentId = appt.id

  if (previous && previous.id !== appt.id) {
    await admin
      .from("appointments")
      .update({ status: "rescheduled", updated_at: new Date().toISOString() })
      .eq("id", previous.id)
    await admin
      .from("appointment_reminders")
      .update({ status: "cancelled" })
      .eq("appointment_id", previous.id)
      .in("status", ["pending", "sending"])
  }

  await rebuildReminders(admin, appt.id, email, p.startTime)

  // A webhook retry (or demo re-seed) for a booking that hasn't changed must not
  // add another timeline entry.
  const unchanged =
    !!existing &&
    existing.status === "scheduled" &&
    new Date(existing.starts_at).getTime() === new Date(p.startTime).getTime()

  if (contact && !unchanged) {
    const isNew = !existing && !previous
    await admin.from("activities").insert({
      entity_type: contact.type,
      entity_id: contact.id,
      type: "meeting",
      content: isNew
        ? `Appointment booked for ${formatWhen(p.startTime, tz)}${matchedByOrganisation ? ` by ${[name, email].filter(Boolean).join(", ") || "a colleague"} (matched by company name)` : ""}.`
        : `Appointment moved to ${formatWhen(p.startTime, tz)}.`,
      created_by: null,
      metadata: { source: "calcom", appointment_id: appt.id, starts_at: p.startTime, call_id: callId },
    })

    if (contact.type === "lead" && !result.createdLead) {
      const { data: lead } = await admin.from("leads").select("stage").eq("id", contact.id).maybeSingle()
      if (lead && (lead.stage === "lead" || lead.stage === "contacted")) {
        await admin.from("leads").update({ stage: "discovery_booked" }).eq("id", contact.id)
        await admin.from("activities").insert({
          entity_type: "lead",
          entity_id: contact.id,
          type: "stage_change",
          content: null,
          created_by: null,
          metadata: { from_stage: lead.stage, to_stage: "discovery_booked", source: "calcom" },
        })
        await admin.from("audit_logs").insert({
          actor_type: "system",
          actor_id: null,
          action: "lead.stage_changed",
          entity_type: "lead",
          entity_id: contact.id,
          metadata: { from_stage: lead.stage, to_stage: "discovery_booked", source: "calcom" },
        })
        result.stageMoved = true
      }
    }
    await admin.from("audit_logs").insert({
      actor_type: "system",
      actor_id: null,
      action: trigger === "BOOKING_CREATED" ? "appointment.booked" : "appointment.rescheduled",
      entity_type: contact.type,
      entity_id: contact.id,
      metadata: { provider_booking_uid: uid, starts_at: p.startTime },
    })
  }

  return result
}
