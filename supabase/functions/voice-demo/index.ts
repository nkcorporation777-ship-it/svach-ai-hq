// Demo data for the Voice Agents department — lets the Owner show the full
// workflow to prospects without touching real records. `seed` pushes synthetic
// Retell-shaped calls (fictional people, reserved 415-555-01xx numbers)
// through the SAME ingest path real calls use; `reset` deletes ONLY rows tagged
// as demo. Called from a signed-in HQ session (verify_jwt).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { ingestCall } from "./ingest.ts"
import { processBooking } from "./booking.ts"

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

const DAY = 24 * 60 * 60 * 1000
const OUR_NUMBER = "+14155550100"

const RECEPTIONIST = { agent_id: "demo-agent-receptionist", agent_name: "Demo — Svach AI Receptionist" }
const OUTBOUND = { agent_id: "demo-agent-outbound", agent_name: "Demo — Outbound Follow-up" }

interface Scenario {
  id: string
  agent: { agent_id: string; agent_name: string }
  type: "phone_call" | "web_call"
  direction: "inbound" | "outbound"
  daysAgo: number
  hour: number
  seconds: number
  cents: number
  party: string | null
  disconnection: string
  transcript: string
  summary: string
  sentiment: "Positive" | "Neutral" | "Negative"
  successful: boolean
  voicemail?: boolean
  custom?: Record<string, unknown>
}

const SCENARIOS: Scenario[] = [
  {
    id: "demo-call-01",
    agent: RECEPTIONIST,
    type: "phone_call",
    direction: "inbound",
    daysAgo: 6,
    hour: 10,
    seconds: 214,
    cents: 38,
    party: "+14155550111",
    disconnection: "user_hangup",
    transcript: [
      "Agent: Thanks for calling Svach AI, I'm the virtual assistant. How can I help?",
      "Caller: Hi, this is Dr. Priya Sharma from Sharma Dental Care. We lose a lot of calls after hours.",
      "Agent: That's exactly what our voice receptionist solves. Roughly how many calls do you miss a week?",
      "Caller: Maybe thirty. Mostly appointment requests.",
      "Agent: Our agent answers 24/7, books straight into your calendar and sends reminders. Would a short discovery call help?",
      "Caller: Yes, can we do Thursday afternoon?",
      "Agent: I can offer Thursday at 3 PM. Shall I book that and email you the details?",
      "Caller: Please do. My email is priya@sharmadental.example.",
    ].join("\n"),
    summary:
      "Dr. Priya Sharma (Sharma Dental Care) misses ~30 after-hours calls a week, mostly appointment requests. Interested in the voice receptionist; discovery call offered for Thursday 3 PM.",
    sentiment: "Positive",
    successful: true,
    custom: {
      caller_name: "Dr. Priya Sharma",
      practice_name: "Sharma Dental Care",
      caller_email: "priya@sharmadental.example",
      interest_level: "high",
      hot_lead: true,
      callback_requested: false,
    },
  },
  {
    id: "demo-call-02",
    agent: RECEPTIONIST,
    type: "web_call",
    direction: "inbound",
    daysAgo: 5,
    hour: 14,
    seconds: 171,
    cents: 29,
    party: null,
    disconnection: "user_hangup",
    transcript: [
      "Agent: Hi, you've reached Svach AI. How can I help today?",
      "Caller: I run a dermatology clinic and I'm curious what your packages cost.",
      "Agent: We have three tiers — Foundation, Growth and Intelligence — depending on how much you want automated. What does your front desk handle today?",
      "Caller: Bookings, reminders, a lot of repeat questions.",
      "Agent: Growth would fit well. I can book you a quick call so the team can give an exact quote.",
      "Caller: Sure. I'm Dr. Rahul Mehta, Mehta Skin Clinic, rahul@mehtaskin.example.",
    ].join("\n"),
    summary:
      "Dr. Rahul Mehta (Mehta Skin Clinic) asked about pricing for front-desk automation (bookings, reminders, FAQs). Growth tier suggested; wants a call for an exact quote.",
    sentiment: "Positive",
    successful: true,
    custom: {
      caller_name: "Dr. Rahul Mehta",
      practice_name: "Mehta Skin Clinic",
      caller_email: "rahul@mehtaskin.example",
      interest_level: "medium",
      hot_lead: false,
      callback_requested: false,
    },
  },
  {
    id: "demo-call-03",
    agent: RECEPTIONIST,
    type: "phone_call",
    direction: "inbound",
    daysAgo: 4,
    hour: 9,
    seconds: 8,
    cents: 2,
    party: "+14155550188",
    disconnection: "user_hangup",
    transcript: "Agent: Thanks for calling Svach AI, how can I help?",
    summary: "Caller hung up before speaking.",
    sentiment: "Neutral",
    successful: false,
  },
  {
    id: "demo-call-04",
    agent: OUTBOUND,
    type: "phone_call",
    direction: "outbound",
    daysAgo: 3,
    hour: 11,
    seconds: 143,
    cents: 24,
    party: "+14155550122",
    disconnection: "user_hangup",
    transcript: [
      "Agent: Hello, this is the virtual assistant from Svach AI calling for Dr. Kavita Rao. Is now a good moment?",
      "Caller: Yes, go ahead.",
      "Agent: You enquired about automating patient reminders. Can I ask how you send them today?",
      "Caller: Manually, my receptionist calls everyone.",
      "Agent: We can take that off her plate. Would you like a short demo next week?",
      "Caller: Next week is better, call me Tuesday.",
    ].join("\n"),
    summary:
      "Dr. Kavita Rao (Rao Physio) currently calls patients manually for reminders. Open to a demo but asked to be called back next Tuesday.",
    sentiment: "Neutral",
    successful: true,
    custom: {
      caller_name: "Dr. Kavita Rao",
      practice_name: "Rao Physio",
      interest_level: "medium",
      hot_lead: false,
      callback_requested: true,
    },
  },
  {
    id: "demo-call-05",
    agent: OUTBOUND,
    type: "phone_call",
    direction: "outbound",
    daysAgo: 2,
    hour: 16,
    seconds: 96,
    cents: 17,
    party: "+14155550111",
    disconnection: "user_hangup",
    transcript: [
      "Agent: Hi Dr. Sharma, it's the Svach AI assistant following up on the proposal we sent. Did you get a chance to review it?",
      "Caller: I did, it looks good. I just need to check with my partner.",
      "Agent: Understood. Is there anything in the proposal I can clarify, like the timeline or what's included?",
      "Caller: No, it's clear. I'll sign by Friday.",
    ].join("\n"),
    summary:
      "Proposal follow-up: Dr. Sharma reviewed the proposal and finds it clear; checking with her partner and expects to sign by Friday.",
    sentiment: "Positive",
    successful: true,
    custom: {
      caller_name: "Dr. Priya Sharma",
      practice_name: "Sharma Dental Care",
      interest_level: "high",
      hot_lead: true,
      callback_requested: false,
    },
  },
  {
    id: "demo-call-06",
    agent: OUTBOUND,
    type: "phone_call",
    direction: "outbound",
    daysAgo: 2,
    hour: 12,
    seconds: 31,
    cents: 6,
    party: "+14155550133",
    disconnection: "voicemail_reached",
    transcript:
      "Agent: Hi, this is the Svach AI assistant calling for Dr. Ahmed. I'll try again later, or you can call us back any time.",
    summary: "Reached voicemail; left a short message.",
    sentiment: "Neutral",
    successful: false,
    voicemail: true,
  },
  {
    id: "demo-call-07",
    agent: OUTBOUND,
    type: "phone_call",
    direction: "outbound",
    daysAgo: 1,
    hour: 15,
    seconds: 187,
    cents: 31,
    party: "+14155550142",
    disconnection: "user_hangup",
    transcript: [
      "Agent: Hi, this is the Svach AI assistant checking in on behalf of the team. How is everything going with your new system?",
      "Caller: Mostly good. The reminder emails are great, but we'd like to add WhatsApp reminders too.",
      "Agent: Noted — I'll pass that to the team. Anything else you need?",
      "Caller: Could someone call me about pricing for that?",
      "Agent: Yes, I'll request a callback.",
    ].join("\n"),
    summary:
      "Client check-in: happy with email reminders, wants WhatsApp reminders added and a callback about pricing.",
    sentiment: "Positive",
    successful: true,
    custom: {
      caller_name: "Demo Wellness Clinic",
      interest_level: "high",
      hot_lead: false,
      callback_requested: true,
    },
  },
  {
    id: "demo-call-08",
    agent: RECEPTIONIST,
    type: "web_call",
    direction: "inbound",
    daysAgo: 0,
    hour: 9,
    seconds: 128,
    cents: 22,
    party: null,
    disconnection: "agent_hangup",
    transcript: [
      "Agent: Hi, you've reached Svach AI. How can I help?",
      "Caller: I'm Dr. Sana Iqbal from Iqbal ENT. I have a discovery call booked but need to move it.",
      "Agent: Of course. When does it work better?",
      "Caller: Friday morning, if possible.",
      "Agent: I have Friday at 10 AM. Shall I move it?",
      "Caller: Yes please. My email is sana@iqbalent.example.",
    ].join("\n"),
    summary: "Dr. Sana Iqbal (Iqbal ENT) asked to reschedule her discovery call to Friday 10 AM.",
    sentiment: "Positive",
    successful: true,
    custom: {
      caller_name: "Dr. Sana Iqbal",
      practice_name: "Iqbal ENT",
      caller_email: "sana@iqbalent.example",
      interest_level: "high",
      hot_lead: false,
      callback_requested: false,
    },
  },
]

/** A Cal.com webhook body, shaped like the real thing. */
function booking(opts: {
  trigger: "BOOKING_CREATED" | "BOOKING_RESCHEDULED" | "BOOKING_CANCELLED"
  uid: string
  createdAt: number
  startsAt: number
  name: string
  email: string
  phone?: string
  company?: string
  rescheduleUid?: string
  cancellationReason?: string
}) {
  return {
    triggerEvent: opts.trigger,
    createdAt: new Date(opts.createdAt).toISOString(),
    payload: {
      title: `Discovery call between Svach AI and ${opts.name}`,
      startTime: new Date(opts.startsAt).toISOString(),
      endTime: new Date(opts.startsAt + 30 * 60_000).toISOString(),
      uid: opts.uid,
      organizer: { name: "Svach AI", email: "team@demo.invalid", timeZone: "Asia/Kolkata" },
      attendees: [{ name: opts.name, email: opts.email, timeZone: "Asia/Kolkata" }],
      responses: {
        name: { value: opts.name },
        email: { value: opts.email },
        ...(opts.phone ? { attendeePhoneNumber: { value: opts.phone } } : {}),
        ...(opts.company ? { company: { value: opts.company } } : {}),
      },
      metadata: { videoCallUrl: `https://meet.demo.invalid/${opts.uid}`, is_demo: true },
      ...(opts.rescheduleUid ? { rescheduleUid: opts.rescheduleUid } : {}),
      ...(opts.cancellationReason ? { cancellationReason: opts.cancellationReason } : {}),
    },
  }
}

/** Bookings the voice agent "made" during the seeded calls: one plain booking,
 * one booked then rescheduled, one booked then cancelled. */
function buildBookings(now: number) {
  const at = (days: number, hourUtc: number) => {
    const d = new Date(now + days * DAY)
    d.setUTCHours(hourUtc, 0, 0, 0)
    return d.getTime()
  }
  const call = (id: string) => {
    const s = SCENARIOS.find((x) => x.id === id)!
    return callStart(s, now) + 200_000
  }
  return [
    booking({
      trigger: "BOOKING_CREATED",
      uid: "demo-booking-sharma",
      createdAt: call("demo-call-01"),
      startsAt: at(2, 9),
      name: "Dr. Priya Sharma",
      email: "priya@sharmadental.example",
      company: "Sharma Dental Care",
    }),
    booking({
      trigger: "BOOKING_CREATED",
      uid: "demo-booking-mehta",
      createdAt: call("demo-call-02"),
      startsAt: at(3, 8),
      name: "Dr. Rahul Mehta",
      email: "rahul@mehtaskin.example",
      company: "Mehta Skin Clinic",
    }),
    booking({
      trigger: "BOOKING_CREATED",
      uid: "demo-booking-rao",
      createdAt: call("demo-call-04"),
      startsAt: at(4, 7),
      name: "Dr. Kavita Rao",
      email: "kavita@raophysio.example",
      phone: "+14155550122",
      company: "Rao Physio",
    }),
    booking({
      trigger: "BOOKING_CANCELLED",
      uid: "demo-booking-rao",
      createdAt: now - 3_600_000,
      startsAt: at(4, 7),
      name: "Dr. Kavita Rao",
      email: "kavita@raophysio.example",
      cancellationReason: "Asked to postpone to next month",
    }),
    booking({
      trigger: "BOOKING_CREATED",
      uid: "demo-booking-iqbal-1",
      createdAt: now - 2 * DAY,
      startsAt: at(2, 6),
      name: "Dr. Sana Iqbal",
      email: "sana@iqbalent.example",
      company: "Iqbal ENT",
    }),
    booking({
      trigger: "BOOKING_RESCHEDULED",
      uid: "demo-booking-iqbal-2",
      createdAt: now,
      startsAt: at(3, 5),
      name: "Dr. Sana Iqbal",
      email: "sana@iqbalent.example",
      rescheduleUid: "demo-booking-iqbal-1",
    }),
  ]
}

function callStart(s: Scenario, now: number) {
  // Today's call is placed 10 minutes ago so the booking that follows it falls
  // inside the "booked during this call" window.
  if (s.daysAgo === 0) return now - 10 * 60_000
  const start = new Date(now - s.daysAgo * DAY)
  start.setUTCHours(s.hour, 0, 0, 0)
  return Math.min(start.getTime(), now - 60_000)
}

function buildCall(s: Scenario, now: number) {
  const startMs = callStart(s, now)
  return {
    call_id: s.id,
    agent_id: s.agent.agent_id,
    agent_name: s.agent.agent_name,
    call_type: s.type,
    direction: s.direction,
    call_status: "ended",
    from_number: s.type === "web_call" ? undefined : s.direction === "inbound" ? s.party : OUR_NUMBER,
    to_number: s.type === "web_call" ? undefined : s.direction === "inbound" ? OUR_NUMBER : s.party,
    start_timestamp: startMs,
    end_timestamp: startMs + s.seconds * 1000,
    duration_ms: s.seconds * 1000,
    call_cost: { combined_cost: s.cents },
    disconnection_reason: s.disconnection,
    transcript: s.transcript,
    metadata: { is_demo: true },
    call_analysis: {
      call_summary: s.summary,
      user_sentiment: s.sentiment,
      call_successful: s.successful,
      in_voicemail: !!s.voicemail,
      custom_analysis_data: s.custom ?? {},
    },
  }
}

// ── Live simulation ─────────────────────────────────────────────────────────
// Plays a synthetic call through the real ingest/booking code, event by event,
// so the Live Console shows a call arriving, the transcript streaming, then the
// lead, appointment and reminders appearing — no phone or Retell account needed.

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const PERSONAS = [
  { name: "Dr. Arjun Nair", practice: "Nair Eye Care", email: "arjun@naireyecare.example", phone: "+14155550161" },
  { name: "Meera Kapoor", practice: "Kapoor Pediatrics", email: "meera@kapoorpeds.example", phone: "+14155550162" },
  { name: "Dr. Zoya Khan", practice: "Khan Dermatology", email: "zoya@khanderm.example", phone: "+14155550163" },
  { name: "Dr. Vikram Patel", practice: "Patel Orthopaedics", email: "vikram@patelortho.example", phone: "+14155550164" },
]

function inboundScript(p: (typeof PERSONAS)[number]) {
  return [
    "Agent: Thanks for calling Svach AI, I'm the virtual assistant. How can I help?",
    `Caller: Hi, I'm ${p.name} from ${p.practice}. We're drowning in missed calls.`,
    "Agent: That's something our voice receptionist handles — it answers every call, books appointments and sends reminders. How many calls do you miss in a week?",
    "Caller: Probably twenty or more, mostly after hours.",
    "Agent: We can cover that. Would a 30-minute discovery call with the team be useful?",
    "Caller: Yes, please. Early next week works.",
    `Agent: I have an opening in two days at 10 AM. Shall I book it and email the details to ${p.email}?`,
    "Caller: Perfect, go ahead.",
    "Agent: Done — you'll get a confirmation now and a reminder the day before. Anything else I can help with?",
    "Caller: No, that's all. Thanks!",
  ]
}

type Campaign = "speed_to_lead" | "proposal_follow_up" | "client_check_in" | "appointment_call"

interface OutboundPlan {
  lines: string[]
  summary: string
  hotLead: boolean
  /** Also book a discovery call at the end of the conversation. */
  books: boolean
}

function outboundPlan(campaign: Campaign, name: string, practice: string): OutboundPlan {
  switch (campaign) {
    case "speed_to_lead":
      return {
        lines: [
          `Agent: Hi ${name}, this is the Svach AI assistant — you just enquired about automating patient calls at ${practice}. Do you have two minutes?`,
          "Caller: Sure, go ahead.",
          "Agent: Great. Right now, who answers your phones when the front desk is busy?",
          "Caller: Honestly, nobody — we miss a lot of calls at lunch and after hours.",
          "Agent: That's exactly what our voice receptionist covers. Would a 30-minute walkthrough with the team help?",
          "Caller: Yes, let's do that.",
          "Agent: I'll book the first available slot and email you the details. Thanks, " + name + "!",
        ],
        summary: `Speed-to-lead call: ${name} (${practice}) misses calls at lunch and after hours and agreed to a walkthrough; discovery call booked.`,
        hotLead: true,
        books: true,
      }
    case "proposal_follow_up":
      return {
        lines: [
          `Agent: Hi ${name}, this is the Svach AI assistant calling about the proposal we sent ${practice}. Is now a good moment?`,
          "Caller: Yes, I've just been going through it.",
          "Agent: Great. Is there anything in the scope, timeline or pricing I can clarify?",
          "Caller: The timeline is fine. I'd like to understand what support is included afterwards.",
          "Agent: Support starts once you confirm you're satisfied with the system, and training is included so your team can run it independently.",
          "Caller: That works. I'll sign it this week.",
          "Agent: Wonderful. I'll let the team know, and thanks for your time.",
        ],
        summary: `Proposal follow-up with ${name} (${practice}): timeline is fine, asked about post-delivery support; expects to sign this week.`,
        hotLead: true,
        books: false,
      }
    case "client_check_in":
      return {
        lines: [
          `Agent: Hi ${name}, this is the Svach AI assistant checking in on behalf of the team. How is everything going with ${practice}'s system?`,
          "Caller: Mostly good. The reminder emails are great, but we'd love WhatsApp reminders too.",
          "Agent: Noted — I'll pass that to the team. Is there anything that isn't working as expected?",
          "Caller: No, everything's fine. Could someone call me about pricing for the WhatsApp add-on?",
          "Agent: Yes, I'll request a callback and the team will reach out tomorrow.",
        ],
        summary: `Client check-in with ${name} (${practice}): happy overall, wants WhatsApp reminders and a callback about pricing.`,
        hotLead: false,
        books: false,
      }
    default:
      return {
        lines: [
          `Agent: Hi ${name}, this is the Svach AI assistant calling to confirm your appointment with the team. Will you be able to make it?`,
          "Caller: Yes, I'll be there.",
          "Agent: Perfect. You'll also get an email reminder the day before. Is there anything you'd like the team to prepare?",
          "Caller: Just the pricing for the Growth package, please.",
          "Agent: I'll note that. See you then!",
        ],
        summary: `Appointment confirmation with ${name} (${practice}): attending as planned; asked the team to prepare Growth package pricing.`,
        hotLead: false,
        books: false,
      }
  }
}

interface SimulateOptions {
  scenario: "inbound_booking" | "outbound"
  campaign: Campaign
  leadId: string | null
  clientId: string | null
}

// deno-lint-ignore no-explicit-any
async function simulateCall(admin: any, opts: SimulateOptions) {
  const start = Date.now()
  const callId = `demo-live-${start}`
  const isInbound = opts.scenario === "inbound_booking"

  let persona = PERSONAS[Math.floor(Math.random() * PERSONAS.length)]
  let lines: string[]
  let summary: string
  let hotLead = false
  let books = isInbound
  let phone: string | null = null

  if (isInbound) {
    lines = inboundScript(persona)
    summary = `${persona.name} (${persona.practice}) misses 20+ calls a week, mostly after hours. Booked a discovery call.`
  } else {
    // deno-lint-ignore no-explicit-any
    const person: Record<string, any> | null = opts.clientId
      ? (
          await admin
            .from("clients")
            .select("practice_name, primary_contact_name, primary_contact_phone, primary_contact_email, metadata")
            .eq("id", opts.clientId)
            .maybeSingle()
        ).data
      : (
          await admin
            .from("leads")
            .select("practice_name, contact_name, contact_phone, contact_email, metadata")
            .eq("id", opts.leadId ?? "")
            .maybeSingle()
        ).data
    if (!person) throw new Error("Contact not found.")
    persona = {
      name: (opts.clientId ? person.primary_contact_name : person.contact_name) ?? "there",
      practice: person.practice_name,
      email: (opts.clientId ? person.primary_contact_email : person.contact_email) ?? "",
      phone: (opts.clientId ? person.primary_contact_phone : person.contact_phone) ?? "",
    }
    phone = persona.phone || null
    const plan = outboundPlan(opts.campaign, persona.name, persona.practice)
    lines = plan.lines
    summary = plan.summary
    hotLead = plan.hotLead
    books = plan.books && !!persona.email
  }

  const agent = isInbound ? RECEPTIONIST : OUTBOUND
  const base = {
    call_id: callId,
    agent_id: agent.agent_id,
    agent_name: agent.agent_name,
    call_type: isInbound ? "web_call" : "phone_call",
    direction: isInbound ? "inbound" : "outbound",
    metadata: {
      is_demo: true,
      ...(opts.leadId ? { lead_id: opts.leadId } : {}),
      ...(opts.clientId ? { client_id: opts.clientId } : {}),
    },
    start_timestamp: start,
    ...(isInbound ? {} : { from_number: OUR_NUMBER, to_number: phone ?? undefined }),
  }
  const o = { forceDemo: true }

  await ingestCall(admin, { ...base, call_status: "ongoing" }, { ...o, event: "call_started" })
  for (let i = 0; i < lines.length; i++) {
    await sleep(2800)
    await ingestCall(
      admin,
      { ...base, call_status: "ongoing", transcript: lines.slice(0, i + 1).join("\n") },
      { ...o, event: "transcript_updated" },
    )
  }
  await sleep(1500)
  const end = Date.now()
  const finished = {
    ...base,
    call_status: "ended",
    end_timestamp: end,
    duration_ms: end - start,
    call_cost: { combined_cost: 25 },
    transcript: lines.join("\n"),
    disconnection_reason: isInbound ? "user_hangup" : "agent_hangup",
  }
  await ingestCall(admin, finished, { ...o, event: "call_ended" })
  await sleep(1200)
  await ingestCall(
    admin,
    {
      ...finished,
      call_analysis: {
        call_summary: summary,
        user_sentiment: "Positive",
        call_successful: true,
        in_voicemail: false,
        custom_analysis_data: {
          caller_name: persona.name,
          practice_name: persona.practice,
          caller_email: persona.email,
          caller_phone: persona.phone,
          interest_level: "high",
          hot_lead: hotLead,
          callback_requested: opts.campaign === "client_check_in" && !isInbound,
        },
      },
    },
    { ...o, event: "call_analyzed" },
  )

  if (books) {
    await sleep(1500)
    const startsAt = new Date(Date.now() + 2 * DAY)
    startsAt.setUTCHours(4, 30, 0, 0) // 10:00 IST
    await processBooking(
      admin,
      booking({
        trigger: "BOOKING_CREATED",
        uid: `demo-live-booking-${start}`,
        createdAt: Date.now(),
        startsAt: startsAt.getTime(),
        name: persona.name,
        email: persona.email,
        phone: persona.phone,
        company: persona.practice,
      }),
      { forceDemo: true },
    )
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const headers = { ...corsHeaders(origin), "content-type": "application/json" }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) })
  }

  try {
    const { action, scenario, campaign, lead_id, client_id } = await req.json().catch(() => ({ action: "" }))
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)

    if (action === "simulate") {
      const kind = scenario === "outbound" ? "outbound" : "inbound_booking"
      const camp: Campaign = (["speed_to_lead", "proposal_follow_up", "client_check_in", "appointment_call"] as const).includes(campaign)
        ? campaign
        : "speed_to_lead"
      if (kind === "outbound") {
        // Fail fast (before going to the background) unless this is demo data.
        const { data: person } = client_id
          ? await admin.from("clients").select("metadata").eq("id", client_id).maybeSingle()
          : await admin.from("leads").select("metadata").eq("id", lead_id ?? "").maybeSingle()
        if (!person || person.metadata?.is_demo !== true) {
          return new Response(JSON.stringify({ error: "Simulated calls only run for demo contacts." }), {
            status: 400,
            headers,
          })
        }
      }
      // Respond now; keep playing the call in the background so the UI can watch it live.
      EdgeRuntime.waitUntil(
        simulateCall(admin, {
          scenario: kind,
          campaign: camp,
          leadId: lead_id ?? null,
          clientId: client_id ?? null,
        }).catch((e) => console.error("simulate failed:", e)),
      )
      return new Response(JSON.stringify({ started: true, scenario: kind }), { headers })
    }

    if (action === "seed") {
      // A demo client so the "client check-in" call has someone to land on.
      const { data: demoClient } = await admin
        .from("clients")
        .select("id")
        .filter("metadata->>is_demo", "eq", "true")
        .limit(1)
        .maybeSingle()
      if (!demoClient) {
        const { error } = await admin.from("clients").insert({
          practice_name: "Demo Wellness Clinic",
          primary_contact_name: "Demo Contact",
          primary_contact_email: "demo-wellness@demo.invalid",
          primary_contact_phone: "+14155550142",
          metadata: { is_demo: true },
        })
        if (error) throw error
      }

      // People the campaign queues can offer: a brand-new lead nobody has
      // called yet, a lead whose proposal went quiet, and a client who has gone
      // quiet for a month (so the health flag lights up).
      const demoMeta = { is_demo: true, created_by: "voice_demo" }
      const ensureLead = async (row: Record<string, unknown>) => {
        const { data: found } = await admin.from("leads").select("id").eq("contact_email", row.contact_email).limit(1).maybeSingle()
        if (found) return found.id as string
        const { data, error } = await admin.from("leads").insert({ ...row, metadata: demoMeta }).select("id").single()
        if (error) throw error
        return data.id as string
      }
      await ensureLead({
        practice_name: "Singh Family Clinic",
        contact_name: "Dr. Harpreet Singh",
        contact_email: "harpreet@singhclinic.example",
        contact_phone: "+14155550171",
        source: "Demo Call",
        stage: "lead",
      })
      const proposalLeadId = await ensureLead({
        practice_name: "Verma Dental Studio",
        contact_name: "Dr. Neha Verma",
        contact_email: "neha@vermadental.example",
        contact_phone: "+14155550172",
        source: "Demo Call",
        stage: "proposal_sent",
      })
      const { data: haveProposal } = await admin.from("proposals").select("id").eq("lead_id", proposalLeadId).limit(1).maybeSingle()
      if (!haveProposal) {
        await admin.from("proposals").insert({
          lead_id: proposalLeadId,
          content: "DEMO PROPOSAL — voice receptionist for Verma Dental Studio.",
          pricing_path: "tier",
          price: 4500,
          gst_percent: 18,
          sent_to_email: "neha@vermadental.example",
          sent_at: new Date(Date.now() - 5 * DAY).toISOString(),
        })
      }
      const { data: quietClient } = await admin
        .from("clients")
        .select("id")
        .eq("primary_contact_email", "quiet@demo.invalid")
        .maybeSingle()
      if (!quietClient) {
        await admin.from("clients").insert({
          practice_name: "Demo Dental Studio",
          primary_contact_name: "Demo Owner",
          primary_contact_email: "quiet@demo.invalid",
          primary_contact_phone: "+14155550173",
          metadata: demoMeta,
          created_at: new Date(Date.now() - 30 * DAY).toISOString(),
        })
      }

      const now = Date.now()
      let leadsCreated = 0
      let activities = 0
      for (const s of SCENARIOS) {
        const r = await ingestCall(admin, buildCall(s, now), { event: "call_analyzed", forceDemo: true })
        if (r.createdLead) leadsCreated++
        if (r.activityCreated) activities++
      }
      let appointments = 0
      for (const b of buildBookings(now)) {
        const r = await processBooking(admin, b, { forceDemo: true })
        if (r.handled && b.triggerEvent !== "BOOKING_CANCELLED") appointments++
      }
      return new Response(
        JSON.stringify({ seeded: SCENARIOS.length, leadsCreated, activities, appointments }),
        { headers },
      )
    }

    if (action === "reset") {
      const demoLeads = await admin.from("leads").select("id").filter("metadata->>is_demo", "eq", "true")
      const demoClients = await admin.from("clients").select("id").filter("metadata->>is_demo", "eq", "true")
      const leadIds = (demoLeads.data ?? []).map((r: { id: string }) => r.id)
      const clientIds = (demoClients.data ?? []).map((r: { id: string }) => r.id)

      if (leadIds.length) {
        await admin.from("activities").delete().eq("entity_type", "lead").in("entity_id", leadIds)
        await admin.from("proposals").delete().in("lead_id", leadIds)
      }
      if (clientIds.length) {
        await admin.from("activities").delete().eq("entity_type", "client").in("entity_id", clientIds)
        await admin.from("follow_ups").delete().in("client_id", clientIds)
      }
      // Reminders go with their appointment (ON DELETE CASCADE).
      await admin.from("appointments").delete().eq("is_demo", true)
      await admin.from("voice_calls").delete().eq("is_demo", true)
      if (leadIds.length) await admin.from("leads").delete().in("id", leadIds)
      if (clientIds.length) {
        await admin.from("voice_agents").update({ client_id: null }).in("client_id", clientIds)
        await admin.from("clients").delete().in("id", clientIds)
      }
      return new Response(
        JSON.stringify({ reset: true, leadsRemoved: leadIds.length, clientsRemoved: clientIds.length }),
        { headers },
      )
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers })
  } catch (err) {
    console.error("voice-demo error:", err)
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null && "message" in err
          ? String((err as { message: unknown }).message)
          : "Unexpected error"
    return new Response(JSON.stringify({ error: message }), { status: 500, headers })
  }
})
