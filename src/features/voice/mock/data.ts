// TEMPORARY — fictional data for Voice Agents screenshots. Every clinic and
// person is invented; phone numbers use ranges reserved for fiction (US 555-01xx,
// UK 07700 900xxx, AU 0491 570xxx) and emails use the reserved .example domain.
// Generated from a fixed seed so every reload looks the same.

import type { CallFilters, Candidate, CampaignKey } from "../hooks"

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const OUR_NUMBER = "+15550100"

// ── Deterministic randomness ────────────────────────────────────────────────

let seed = 20261028
function rand() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]
function weighted<T>(items: readonly (readonly [T, number])[]) {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [v, w] of items) if ((r -= w) < 0) return v
  return items[items.length - 1][0]
}
function uuid() {
  const h = () => int(0, 0xffff).toString(16).padStart(4, "0")
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`
}
const iso = (ms: number) => new Date(ms).toISOString()

// ── Clinics (the "clients" and "leads") ─────────────────────────────────────

type Country = "US" | "UK" | "AU"
type Stage = "lead" | "contacted" | "proposal_sent"

interface Clinic {
  id: string
  practice: string
  contact: string
  first: string
  country: Country
  tz: string
  phone: string
  email: string
  kind: "client" | "lead"
  stage: Stage | null
  createdDaysAgo: number
}

const CLINIC_SEED: [string, string, Country, string, "client" | Stage][] = [
  ["Brightwater Dental Studio", "Dr. Emily Carter", "US", "America/New_York", "client"],
  ["Lakeside Family Medicine", "Dr. Marcus Hill", "US", "America/Chicago", "client"],
  ["Pacific Smiles Orthodontics", "Dr. Hannah Lee", "US", "America/Los_Angeles", "client"],
  ["Cedar Grove Physical Therapy", "Jordan Brooks", "US", "America/Denver", "client"],
  ["Summit Dermatology", "Dr. Rachel Nguyen", "US", "America/New_York", "client"],
  ["Willow Creek Veterinary", "Dr. Tom Alvarez", "US", "America/Chicago", "proposal_sent"],
  ["Harborview Chiropractic", "Dr. Kevin Price", "US", "America/Los_Angeles", "contacted"],
  ["Elm Street Eye Care", "Dr. Sofia Ramirez", "US", "America/New_York", "lead"],
  ["Radiance Med Spa", "Olivia Bennett", "US", "America/Phoenix", "lead"],
  ["Thames Valley Dental Care", "Dr. James Whitfield", "UK", "Europe/London", "client"],
  ["Kensington Skin Clinic", "Dr. Amelia Hart", "UK", "Europe/London", "client"],
  ["Pennine Physio & Sports", "Callum Reid", "UK", "Europe/London", "client"],
  ["Riverside Family Practice", "Dr. Priya Desai", "UK", "Europe/London", "client"],
  ["Oakwood Veterinary Surgery", "Dr. Fiona Mackay", "UK", "Europe/London", "proposal_sent"],
  ["Clifton Orthodontics", "Dr. Oliver Grant", "UK", "Europe/London", "contacted"],
  ["Meadowbank Optometrists", "Grace Holloway", "UK", "Europe/London", "lead"],
  ["Harbour Bridge Dental", "Dr. Liam O'Connor", "AU", "Australia/Sydney", "client"],
  ["Coastal Physio Group", "Mia Thompson", "AU", "Australia/Brisbane", "client"],
  ["Yarra Skin & Laser", "Dr. Chloe Martin", "AU", "Australia/Melbourne", "client"],
  ["Bayside Family Clinic", "Dr. Noah Williams", "AU", "Australia/Melbourne", "client"],
  ["Swan River Chiropractic", "Dr. Ethan Clarke", "AU", "Australia/Perth", "proposal_sent"],
  ["Blue Gum Veterinary", "Dr. Isla Robertson", "AU", "Australia/Sydney", "contacted"],
  ["Southern Cross Eye Centre", "Dr. Ava Patel", "AU", "Australia/Adelaide", "lead"],
  ["Northside Dental Group","Dr. Ben Foster", "US", "America/Chicago", "proposal_sent"],
  ["Greenfield Wellness Centre", "Dr. Zoe Campbell", "UK", "Europe/London", "lead"],
  ["Sunrise Med Spa", "Ruby Edwards", "AU", "Australia/Brisbane", "lead"],
]

const counters = { UK: 100, AU: 100 }
function phoneFor(c: "UK" | "AU") {
  const n = counters[c]++
  return c === "UK" ? `+447700900${n}` : `+61491570${n}`
}

const CLINICS: Clinic[] = CLINIC_SEED.map(([practice, contact, country, tz, kind], i) => {
  const first = contact.replace(/^Dr\. /, "").split(" ")[0]
  const domain = practice.toLowerCase().replace(/&/g, "and").replace(/[^a-z]+/g, "").slice(0, 18)
  return {
    id: uuid(),
    practice,
    contact,
    first,
    country,
    tz,
    // US numbers must stay inside 555-0100..0199, so count them from 11 upwards.
    phone: country === "US" ? `+155501${String(11 + i).padStart(2, "0")}` : phoneFor(country),
    email: `${first.toLowerCase()}@${domain}.example`,
    kind: kind === "client" ? "client" : "lead",
    stage: kind === "client" ? null : kind,
    createdDaysAgo: kind === "client" ? int(60, 240) : int(1, 25),
  }
})

// ── Agents ──────────────────────────────────────────────────────────────────

type AgentKey = "receptionist" | "outbound" | "afterhours" | "reminders"

const NOW = Date.now()

const AGENT_DEFS: Record<AgentKey, string> = {
  receptionist: "Svach AI Receptionist",
  outbound: "Outbound Follow-up",
  afterhours: "After-Hours Line",
  reminders: "Appointment Reminders",
}

const AGENT_ROWS = (Object.keys(AGENT_DEFS) as AgentKey[]).map((key, i) => ({
  key,
  id: uuid(),
  retell_agent_id: `agent_${uuid().replace(/-/g, "").slice(0, 24)}`,
  name: AGENT_DEFS[key],
  audience: "internal",
  channel: "voice",
  client_id: null,
  clients: null,
  tracked: true,
  created_at: iso(NOW - (90 - i * 12) * DAY),
  last_modified_at: iso(NOW - int(2, 9) * DAY),
  synced_at: iso(NOW - 25 * MIN),
}))
const agentByKey = Object.fromEntries(AGENT_ROWS.map((a) => [a.key, a])) as Record<AgentKey, (typeof AGENT_ROWS)[number]>

// ── Call scripts ────────────────────────────────────────────────────────────

interface Script {
  agent: AgentKey
  direction: "inbound" | "outbound"
  who: "client" | "lead" | "any" | "none"
  seconds: [number, number]
  successful: boolean
  sentiment: readonly (readonly ["Positive" | "Neutral" | "Negative", number])[]
  books?: boolean
  voicemail?: boolean
  lines: (c: Clinic) => string[]
  summary: (c: Clinic) => string
  analysis?: (c: Clinic) => Record<string, unknown>
}

const caller = (c: Clinic) => ({ caller_name: c.contact, practice_name: c.practice, caller_email: c.email })

const SCRIPTS: Record<string, Script> = {
  discovery: {
    agent: "receptionist",
    direction: "inbound",
    who: "lead",
    seconds: [150, 330],
    successful: true,
    books: true,
    sentiment: [["Positive", 8], ["Neutral", 2]],
    lines: (c) => [
      "Agent: Thanks for calling Svach AI — I'm the virtual assistant. How can I help today?",
      `Caller: Hi, it's ${c.contact} from ${c.practice}. Our front desk can't keep up with the phones.`,
      "Agent: That's exactly what our AI receptionist handles. Roughly how many calls go unanswered in a week?",
      `Caller: Probably ${int(20, 60)} or so — mostly new patients wanting appointments.`,
      "Agent: Our agent answers every call 24/7, books straight into your calendar and sends reminders. Would a 20-minute discovery call help?",
      "Caller: Yes, that would be great.",
      `Agent: I can offer ${pick(["Tuesday at 10 AM", "Wednesday at 2 PM", "Thursday at 11 AM", "Friday at 9:30 AM"])}. Shall I book it and email you the invite?`,
      `Caller: Please do — it's ${c.email}.`,
      "Agent: Done! You'll get a confirmation and a reminder the day before. Anything else I can help with?",
      "Caller: No, that's all. Thank you!",
    ],
    summary: (c) =>
      `${c.contact} (${c.practice}) is missing new-patient calls and wants to automate the front desk. Discovery call booked; confirmation sent to ${c.email}.`,
    analysis: (c) => ({ ...caller(c), appointment_booked: true, hot_lead: rand() < 0.4 }),
  },
  pricing: {
    agent: "receptionist",
    direction: "inbound",
    who: "lead",
    seconds: [120, 260],
    successful: true,
    sentiment: [["Positive", 5], ["Neutral", 4]],
    lines: (c) => [
      "Agent: Svach AI, this is the virtual assistant. How can I help?",
      `Caller: Hi, ${c.first} here from ${c.practice}. What does the AI receptionist cost?`,
      "Agent: Plans start with a one-time setup and a monthly fee based on call volume. Most single-location clinics are on our Growth plan.",
      "Caller: Does that include appointment reminders?",
      "Agent: Yes — email reminders 24 hours and 1 hour before every booking are included.",
      "Caller: Okay. Can you send me the details in writing?",
      `Agent: Of course. I'll email a summary to ${c.email}, and someone from the team will follow up with a tailored proposal.`,
    ],
    summary: (c) =>
      `${c.contact} asked about pricing for ${c.practice}; interested in reminders. Pricing summary emailed, proposal to follow.`,
    analysis: (c) => ({ ...caller(c), callback_requested: true }),
  },
  support: {
    agent: "receptionist",
    direction: "inbound",
    who: "client",
    seconds: [90, 240],
    successful: true,
    sentiment: [["Neutral", 5], ["Positive", 3], ["Negative", 1]],
    lines: (c) => [
      "Agent: Hi, Svach AI support line — I'm the virtual assistant.",
      `Caller: Hi, ${c.contact} from ${c.practice}. Can we change the greeting our agent uses on Saturdays?`,
      "Agent: Absolutely. What would you like it to say?",
      "Caller: That we're open 9 till 1, and emergencies should call the after-hours number.",
      "Agent: Got it. I've logged the change for the team — it'll be live within one business day, and we'll confirm by email.",
      "Caller: Perfect, thanks.",
    ],
    summary: (c) =>
      `Existing client ${c.practice} requested a Saturday greeting update (open 9–1, emergencies to after-hours line). Change logged; confirmation to follow.`,
    analysis: (c) => ({ ...caller(c), callback_requested: true, says_existing_client: true }),
  },
  reschedule: {
    agent: "receptionist",
    direction: "inbound",
    who: "lead",
    seconds: [70, 150],
    successful: true,
    books: true,
    sentiment: [["Positive", 6], ["Neutral", 3]],
    lines: (c) => [
      "Agent: Thanks for calling Svach AI. How can I help?",
      `Caller: Hi, ${c.first} from ${c.practice}. I need to move our discovery call — something came up.`,
      "Agent: No problem. I've found your booking. Would next Monday at 3 PM work instead?",
      "Caller: Monday at 3 is fine.",
      "Agent: All set — I've moved it and sent an updated invite. Your reminders are updated too.",
    ],
    summary: (c) => `${c.contact} (${c.practice}) rescheduled their discovery call to Monday 3 PM. Updated invite sent.`,
    analysis: (c) => ({ ...caller(c), appointment_booked: true }),
  },
  wrong: {
    agent: "receptionist",
    direction: "inbound",
    who: "none",
    seconds: [12, 35],
    successful: false,
    sentiment: [["Neutral", 1]],
    lines: () => [
      "Agent: Thanks for calling Svach AI. How can I help?",
      "Caller: Oh — sorry, I was trying to reach the pharmacy.",
      "Agent: No worries! Have a good day.",
    ],
    summary: () => "Wrong number — caller was looking for a pharmacy. No action needed.",
  },
  afterhours: {
    agent: "afterhours",
    direction: "inbound",
    who: "any",
    seconds: [100, 280],
    successful: true,
    books: true,
    sentiment: [["Positive", 6], ["Neutral", 3]],
    lines: (c) => [
      "Agent: You've reached Svach AI after hours — I'm the virtual assistant and I can help right now.",
      `Caller: Hi, it's ${c.contact} at ${c.practice}. I'm only free in the evenings — can I still book a demo?`,
      "Agent: Of course. I have tomorrow at 8 AM or Thursday at 6 PM your time.",
      "Caller: Thursday at 6 works.",
      `Agent: Booked. The invite is on its way to ${c.email}, with a reminder an hour before.`,
    ],
    summary: (c) => `After-hours call from ${c.contact} (${c.practice}); demo booked for Thursday 6 PM local time.`,
    analysis: (c) => ({ ...caller(c), appointment_booked: true }),
  },
  proposal: {
    agent: "outbound",
    direction: "outbound",
    who: "lead",
    seconds: [110, 300],
    successful: true,
    sentiment: [["Positive", 5], ["Neutral", 4], ["Negative", 1]],
    lines: (c) => [
      `Agent: Hi ${c.first}, this is the Svach AI virtual assistant following up on the proposal we sent. Is now a good time?`,
      "Caller: Sure, I've had a look.",
      "Agent: Great — do you have any questions about the setup or the timeline?",
      "Caller: Mainly whether it works with our practice software.",
      "Agent: It does — we connect to your booking system during setup, and our team handles it end to end.",
      "Caller: Good. I'll review it with my partner and get back to you this week.",
      "Agent: Perfect. I'll note that and check back on Friday if we haven't heard from you.",
    ],
    summary: (c) => `Proposal follow-up with ${c.contact} (${c.practice}): asked about practice-software integration; deciding with partner this week.`,
    analysis: (c) => ({ ...caller(c), hot_lead: true }),
  },
  checkin: {
    agent: "outbound",
    direction: "outbound",
    who: "client",
    seconds: [80, 220],
    successful: true,
    sentiment: [["Positive", 8], ["Neutral", 2]],
    lines: (c) => [
      `Agent: Hi ${c.first}, it's the Svach AI virtual assistant with a quick monthly check-in. How's the receptionist working for ${c.practice}?`,
      `Caller: Really well — we've stopped missing calls and the team loves the reminders.`,
      "Agent: That's great to hear! Anything you'd like changed or added?",
      "Caller: Could it also send a review request after appointments?",
      "Agent: Yes, that's an add-on we offer. I'll have the team send you the details.",
    ],
    summary: (c) => `Monthly check-in with ${c.practice}: very happy, no missed calls. Interested in the review-request add-on — details to be sent.`,
    analysis: (c) => ({ ...caller(c), callback_requested: true }),
  },
  speed: {
    agent: "outbound",
    direction: "outbound",
    who: "lead",
    seconds: [90, 240],
    successful: true,
    books: true,
    sentiment: [["Positive", 7], ["Neutral", 3]],
    lines: (c) => [
      `Agent: Hi ${c.first}, this is the Svach AI virtual assistant — you filled in our website form a few minutes ago. Is now okay?`,
      "Caller: Wow, that was quick. Yes, go ahead.",
      "Agent: You mentioned missed calls at the front desk. Would you like to see the AI receptionist in action on a short call?",
      "Caller: Yes, let's do it.",
      "Agent: I've booked you for tomorrow at 11 AM and emailed the invite.",
    ],
    summary: (c) => `Speed-to-lead call to ${c.contact} (${c.practice}) within minutes of their web form; demo booked for tomorrow 11 AM.`,
    analysis: (c) => ({ ...caller(c), appointment_booked: true, hot_lead: true }),
  },
  reminder: {
    agent: "reminders",
    direction: "outbound",
    who: "any",
    seconds: [45, 110],
    successful: true,
    sentiment: [["Positive", 7], ["Neutral", 3]],
    lines: (c) => [
      `Agent: Hi ${c.first}, this is the Svach AI virtual assistant confirming your call with us tomorrow. Will you be able to make it?`,
      "Caller: Yes, I'll be there.",
      "Agent: Wonderful — the link is in your email. Talk soon!",
    ],
    summary: (c) => `Reminder call: ${c.contact} (${c.practice}) confirmed tomorrow's appointment.`,
  },
  noshow: {
    agent: "reminders",
    direction: "outbound",
    who: "any",
    seconds: [60, 140],
    successful: true,
    books: true,
    sentiment: [["Neutral", 5], ["Positive", 4]],
    lines: (c) => [
      `Agent: Hi ${c.first}, it's the Svach AI virtual assistant. We missed you on today's call — would you like to rebook?`,
      "Caller: Sorry, I got stuck with a patient. Can we do next week?",
      "Agent: Of course — how about Wednesday at 10 AM?",
      "Caller: Perfect.",
      "Agent: Booked, and a new invite is on its way.",
    ],
    summary: (c) => `No-show follow-up: ${c.contact} (${c.practice}) apologised and rebooked for Wednesday 10 AM.`,
    analysis: (c) => ({ ...caller(c), appointment_booked: true }),
  },
  voicemail: {
    agent: "reminders",
    direction: "outbound",
    who: "any",
    seconds: [25, 45],
    successful: false,
    voicemail: true,
    sentiment: [["Neutral", 1]],
    lines: (c) => [
      `Agent: Hi ${c.first}, this is the Svach AI virtual assistant calling about your appointment tomorrow. Please check your email for the link, or call us back to reschedule. Thanks!`,
    ],
    summary: (c) => `Reached voicemail for ${c.contact} (${c.practice}); left a reminder message.`,
  },
}

const SCRIPT_MIX: [keyof typeof SCRIPTS, number][] = [
  ["discovery", 22],
  ["pricing", 14],
  ["support", 14],
  ["reschedule", 6],
  ["wrong", 5],
  ["afterhours", 12],
  ["proposal", 9],
  ["checkin", 9],
  ["speed", 7],
  ["reminder", 12],
  ["noshow", 4],
  ["voicemail", 5],
]

// ── Calls ───────────────────────────────────────────────────────────────────

type Analysis = Record<string, unknown>

interface MockCall {
  id: string
  retell_call_id: string
  agent_id: string
  call_type: string
  direction: string
  call_status: string
  started_at: string | null
  ended_at: string | null
  duration_ms: number | null
  cost_cents: number | null
  disconnection_reason: string | null
  from_number: string | null
  to_number: string | null
  transcript: string | null
  summary: string | null
  sentiment: string | null
  call_successful: boolean | null
  recording_url: string | null
  analysis: Analysis
  metadata: Analysis
  is_demo: boolean
  lead_id: string | null
  client_id: string | null
  activity_id: string | null
  needs_review: boolean
  review_reason: string | null
  review_candidates: { entity_type: string; entity_id: string; practice_name: string }[] | null
  created_at: string
  updated_at: string
  voice_agents: { id: string; name: string; audience: string }
  leads: { id: string; practice_name: string } | null
  clients: { id: string; practice_name: string } | null
}

const clientClinics = CLINICS.filter((c) => c.kind === "client")
const leadClinics = CLINICS.filter((c) => c.kind === "lead")

/** A call time on that day; null when today's slot hasn't happened yet. */
function startTime(daysAgo: number, agent: AgentKey) {
  const d = new Date(NOW - daysAgo * DAY)
  const hour = agent === "afterhours" ? pick([19, 20, 21, 22, 6, 7]) : int(8, 17)
  d.setHours(hour, int(0, 59), int(0, 59), 0)
  return d.getTime() > NOW - 15 * MIN ? null : d.getTime()
}

/** The hour and minute a moment shows on the clock in `tz`. */
function clockIn(tz: string, ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hourCycle: "h23" })
    .formatToParts(ms)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return { hour: get("hour"), minute: get("minute") }
}

/** The first half-hour slot at or after `fromMs` that falls in the clinic's business hours. */
function slotIn(tz: string, fromMs: number, hours: readonly number[]) {
  let t = Math.ceil(fromMs / (30 * MIN)) * 30 * MIN
  for (let i = 0; i < 96; i++, t += 30 * MIN) if (hours.includes(clockIn(tz, t).hour)) return t
  return t
}

function buildCall(script: Script, clinic: Clinic | null, startMs: number): MockCall {
  const agent = agentByKey[script.agent]
  const seconds = int(script.seconds[0], script.seconds[1])
  const web = script.direction === "inbound" && rand() < 0.18
  const party = clinic?.phone ?? `+1555019${int(0, 9)}`
  const subject = clinic ?? {
    id: "",
    practice: "Unknown caller",
    contact: "Unknown caller",
    first: "there",
    country: "US" as const,
    tz: "America/New_York",
    phone: party,
    email: "",
    kind: "lead" as const,
    stage: null,
    createdDaysAgo: 0,
  }
  const id = uuid()
  return {
    id,
    retell_call_id: `call_${id.replace(/-/g, "").slice(0, 26)}`,
    agent_id: agent.id,
    call_type: web ? "web_call" : "phone_call",
    direction: script.direction,
    call_status: "ended",
    started_at: iso(startMs),
    ended_at: iso(startMs + seconds * 1000),
    duration_ms: seconds * 1000,
    cost_cents: Math.round((seconds / 60) * (8 + rand() * 3)),
    disconnection_reason: script.voicemail ? "voicemail_reached" : pick(["user_hangup", "user_hangup", "agent_hangup"]),
    from_number: web ? null : script.direction === "inbound" ? party : OUR_NUMBER,
    to_number: web ? null : script.direction === "inbound" ? OUR_NUMBER : party,
    transcript: script.lines(subject).join("\n"),
    summary: script.summary(subject),
    sentiment: weighted(script.sentiment),
    call_successful: script.successful,
    recording_url: null,
    analysis: script.analysis ? script.analysis(subject) : {},
    metadata: web ? { started_from: "website_widget" } : {},
    is_demo: false,
    lead_id: clinic?.kind === "lead" ? clinic.id : null,
    client_id: clinic?.kind === "client" ? clinic.id : null,
    activity_id: clinic ? uuid() : null,
    needs_review: false,
    review_reason: null,
    review_candidates: null,
    created_at: iso(startMs),
    updated_at: iso(startMs + seconds * 1000 + 40_000),
    voice_agents: { id: agent.id, name: agent.name, audience: agent.audience },
    leads: clinic?.kind === "lead" ? { id: clinic.id, practice_name: clinic.practice } : null,
    clients: clinic?.kind === "client" ? { id: clinic.id, practice_name: clinic.practice } : null,
  }
}

function clinicFor(script: Script) {
  if (script.who === "none") return null
  if (script.who === "client") return pick(clientClinics)
  if (script.who === "lead") return pick(leadClinics)
  return pick(CLINICS)
}

const CALLS: MockCall[] = []
for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
  const weekday = new Date(NOW - daysAgo * DAY).getDay()
  const weekend = weekday === 0 || weekday === 6
  // A gentle upward trend over the month, quieter at weekends.
  const n = Math.round((weekend ? int(1, 3) : int(5, 8)) * (0.8 + (29 - daysAgo) / 70))
  for (let i = 0; i < n; i++) {
    const script = SCRIPTS[weighted(SCRIPT_MIX)]
    const start = startTime(daysAgo, script.agent)
    if (start === null) continue
    CALLS.push(buildCall(script, clinicFor(script), start))
  }
}

// Three calls the Owner needs to look at.
const REVIEW_REASONS = [
  "Says they are an existing client, but no matching phone, email or organisation was found. No lead was created.",
  "New lead created, but similar existing record(s) were found — check this isn't a duplicate.",
  "Says they are an existing client, but no matching phone, email or organisation was found. No lead was created.",
]
for (const [i, call] of CALLS.filter((c) => c.call_successful && c.direction === "inbound").slice(-12, -9).entries()) {
  const similar = pick(clientClinics)
  call.needs_review = true
  call.review_reason = REVIEW_REASONS[i]
  call.review_candidates = [{ entity_type: "client", entity_id: similar.id, practice_name: similar.practice }]
  if (i !== 1) {
    call.lead_id = null
    call.client_id = null
    call.leads = null
    call.clients = null
  }
}

// One call happening right now, for the Live tab.
{
  const clinic = leadClinics[0]
  const call = buildCall(SCRIPTS.discovery, clinic, NOW - 95_000)
  Object.assign(call, {
    call_status: "ongoing",
    ended_at: null,
    duration_ms: null,
    cost_cents: null,
    disconnection_reason: null,
    transcript: SCRIPTS.discovery.lines(clinic).slice(0, 5).join("\n"),
    summary: null,
    sentiment: null,
    call_successful: null,
    analysis: {},
    activity_id: null,
    updated_at: iso(NOW - 4_000),
  })
  CALLS.push(call)
}

CALLS.sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""))

// ── Appointments ────────────────────────────────────────────────────────────

const bookingCalls = CALLS.filter((c) => c.call_status === "ended" && (c.analysis as Analysis).appointment_booked)
const APPOINTMENTS = bookingCalls.slice(0, 24).map((call, i) => {
  const clinic = CLINICS.find((c) => c.id === (call.lead_id ?? call.client_id)) ?? pick(CLINICS)
  // Spread from two weeks ago to ten days ahead, a few inside the next 24 hours,
  // always at a business-hours time on the clinic's own clock.
  const startMs =
    i < 3
      ? slotIn(clinic.tz, NOW + (2 + i * 4) * HOUR, [9, 10, 11, 12, 13, 14, 15, 16])
      : slotIn(clinic.tz, NOW + int(-14, 10) * DAY - 12 * HOUR + int(0, 12) * HOUR, [pick([9, 10, 11, 14, 15, 16])])
  const past = startMs < NOW
  const status = past
    ? weighted([["completed", 8], ["cancelled", 1], ["rescheduled", 1]] as const)
    : weighted([["scheduled", 9], ["cancelled", 1]] as const)
  const id = uuid()
  const reminders = (["24h", "1h"] as const).map((kind) => {
    const sendAt = startMs - (kind === "24h" ? DAY : HOUR)
    const due = sendAt < NOW
    return {
      id: uuid(),
      appointment_id: id,
      kind,
      channel: "email",
      status: status === "cancelled" ? (due ? "sent" : "cancelled") : due ? (rand() < 0.05 ? "failed" : "sent") : "pending",
      send_at: iso(sendAt),
      sent_at: due ? iso(sendAt + 20_000) : null,
      error: null as string | null,
      created_at: call.created_at,
    }
  })
  for (const r of reminders) if (r.status === "failed") r.error = "Mailbox not found"
  return {
    id,
    call_id: call.id,
    provider: "calcom",
    provider_booking_uid: `bk_${id.slice(0, 8)}`,
    title: `Discovery call — ${clinic.practice}`,
    starts_at: iso(startMs),
    ends_at: iso(startMs + 30 * MIN),
    timezone: clinic.tz,
    status,
    attendee_name: clinic.contact,
    attendee_email: clinic.email,
    attendee_phone: clinic.phone,
    meeting_url: `https://meet.example/${id.slice(0, 10)}`,
    is_demo: false,
    lead_id: clinic.kind === "lead" ? clinic.id : null,
    client_id: clinic.kind === "client" ? clinic.id : null,
    created_at: call.created_at,
    updated_at: call.updated_at,
    appointment_reminders: reminders,
    leads: clinic.kind === "lead" ? { id: clinic.id, practice_name: clinic.practice } : null,
    clients: clinic.kind === "client" ? { id: clinic.id, practice_name: clinic.practice } : null,
  }
})
APPOINTMENTS.sort((a, b) => b.starts_at.localeCompare(a.starts_at))

// ── Campaigns and the public link ───────────────────────────────────────────

const CAMPAIGNS = (
  [
    ["appointment_call", "Appointment call", "reminders", 40],
    ["client_check_in", "Client check-in", "outbound", 15],
    ["proposal_follow_up", "Proposal follow-up", "outbound", 20],
    ["speed_to_lead", "Speed to lead", "outbound", 30],
  ] as const
).map(([key, label, agent, cap]) => ({
  key,
  label,
  enabled: true,
  agent_id: agentByKey[agent].id,
  voice_agents: { id: agentByKey[agent].id, name: agentByKey[agent].name },
  from_number: OUR_NUMBER,
  daily_cap: cap,
  default_country_code: "+1",
  timezone: "America/New_York",
  window_start_hour: 9,
  window_end_hour: 18,
  updated_at: iso(NOW - 3 * DAY),
}))

const DEMO_LINK = {
  id: uuid(),
  label: "Talk to Svach AI",
  slug: "svach",
  token: uuid(),
  enabled: true,
  daily_cap: 20,
  per_ip_daily_cap: 3,
  agent_id: agentByKey.receptionist.id,
  created_at: iso(NOW - 4 * DAY),
  voice_agents: { id: agentByKey.receptionist.id, name: agentByKey.receptionist.name },
}

// ── What the hooks return ───────────────────────────────────────────────────

export const agents = () => AGENT_ROWS

export function calls(filters: CallFilters = {}) {
  return CALLS.filter((c) => {
    if (filters.agentId && c.agent_id !== filters.agentId) return false
    if (filters.outcome === "successful") return c.call_successful === true
    if (filters.outcome === "unsuccessful") return c.call_successful === false
    if (filters.outcome === "needs_review") return c.needs_review
    return true
  }).slice(0, 200)
}

export const call = (id: string | undefined) => CALLS.find((c) => c.id === id) ?? null

export const liveCalls = () => CALLS.slice(0, 8)

export function usage(days: number) {
  const since = new Date(NOW - days * DAY).toISOString().slice(0, 10)
  const byDay = new Map<string, { day: string; calls: number; minutes: number; costCents: number; successful: number }>()
  for (const c of CALLS) {
    if (c.call_status !== "ended" || !c.started_at) continue
    const day = c.started_at.slice(0, 10)
    if (day < since) continue
    const d = byDay.get(day) ?? { day, calls: 0, minutes: 0, costCents: 0, successful: 0 }
    d.calls += 1
    d.minutes += (c.duration_ms ?? 0) / MIN
    d.costCents += c.cost_cents ?? 0
    d.successful += c.call_successful ? 1 : 0
    byDay.set(day, d)
  }
  const daily = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
  for (const d of daily) d.minutes = Math.round(d.minutes * 10) / 10
  const totals = daily.reduce(
    (acc, d) => ({
      calls: acc.calls + d.calls,
      minutes: acc.minutes + d.minutes,
      costCents: acc.costCents + d.costCents,
      successful: acc.successful + d.successful,
    }),
    { calls: 0, minutes: 0, costCents: 0, successful: 0 },
  )
  return { daily, totals }
}

export const status = () => ({ lastCallAt: iso(NOW - 4_000), lastSyncAt: iso(NOW - 25 * MIN) })

// Zero keeps the amber badge off the Calls tab in the screenshots.
export const needsReviewCount = () => 0

export const leadsLite = () =>
  leadClinics
    .map((c) => ({ id: c.id, practice_name: c.practice, contact_name: c.contact }))
    .sort((a, b) => a.practice_name.localeCompare(b.practice_name))

export const clientsLite = () =>
  clientClinics.map((c) => ({ id: c.id, practice_name: c.practice })).sort((a, b) => a.practice_name.localeCompare(b.practice_name))

export const campaigns = () => CAMPAIGNS

export function candidates(campaign: CampaignKey): Candidate[] {
  const row = (c: Clinic, reason: string, appointmentId?: string): Candidate => ({
    key: appointmentId ?? c.id,
    entityType: c.kind,
    entityId: c.id,
    name: c.contact,
    practice: c.practice,
    phone: c.phone,
    reason,
    ...(appointmentId ? { appointmentId } : {}),
  })
  if (campaign === "speed_to_lead") {
    return leadClinics.filter((c) => c.stage === "lead").map((c) => row(c, "New lead, not called yet"))
  }
  if (campaign === "proposal_follow_up") {
    return leadClinics.filter((c) => c.stage === "proposal_sent").map((c, i) => row(c, `Proposal unsigned for ${4 + i * 2} days`))
  }
  if (campaign === "client_check_in") {
    return clientClinics.slice(2, 5).map((c) => row(c, "No contact for 14+ days"))
  }
  return APPOINTMENTS.filter((a) => a.status === "scheduled" && new Date(a.starts_at).getTime() < NOW + DAY).map((a) => {
    const clinic = CLINICS.find((c) => c.id === (a.lead_id ?? a.client_id))!
    const when = new Date(a.starts_at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })
    return row(clinic, `Reminder call · ${when}`, a.id)
  })
}

export const demoLink = () => DEMO_LINK

export function workflow(callId: string | undefined) {
  const c = CALLS.find((x) => x.id === callId)
  if (!c) throw new Error("Call not found.")
  const clinic = CLINICS.find((x) => x.id === c.lead_id)
  return {
    call: c,
    appointments: APPOINTMENTS.filter((a) => a.call_id === c.id),
    leadStage: clinic ? (clinic.stage === "lead" && c.call_status === "ended" ? "contacted" : clinic.stage) : null,
  }
}

export const appointments = () => APPOINTMENTS

export const entityAppointments = (entityType: "lead" | "client", entityId: string | undefined) =>
  APPOINTMENTS.filter((a) => (entityType === "lead" ? a.lead_id : a.client_id) === entityId)
