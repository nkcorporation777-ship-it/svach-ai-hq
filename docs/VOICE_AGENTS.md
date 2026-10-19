# Voice Agents — Retell AI + Cal.com in HQ

How the **Voice Agents** department works, what you have to set up outside HQ
(Retell, Cal.com, Supabase secrets), and ready-to-paste setups for the agents.

HQ never runs the voice agent itself. **Retell** talks to people; **Cal.com**
holds the calendar; **HQ** records what happened, updates the person's record,
moves the pipeline and sends reminders.

```
 caller ⇄ Retell agent ──(books/cancels/reschedules)──▶ Cal.com
              │                                            │
        webhook (signed)                            webhook (signed)
              ▼                                            ▼
       retell-webhook ─────────▶ HQ database ◀──────── calcom-webhook
                                   │   │   │
        call + summary on the      │   │   └─ appointments + reminder schedule
        lead/client timeline       │   └───── pipeline stage moves
                                   └───────── Live Console, Calls, Campaigns
 pg_cron (every 5 min) ──▶ appointment-reminders ──▶ email (WhatsApp later)
```

## 1. One-time setup

### Supabase secrets (Edge Functions → Secrets)

| Secret | What it is | Needed for |
|---|---|---|
| `RETELL_API_KEY` | Your Retell API key — use the one with the **webhook badge** | Everything Retell (webhook check, sync, calls) |
| `CALCOM_WEBHOOK_SECRET` | Any long random string you choose; paste the same one into Cal.com's webhook | Booking tracking |
| `OWNER_ALERT_EMAIL` | *(optional)* where hot-lead alerts go; defaults to the sending mailbox | Hot-lead emails |

Already set and reused: `TITAN_SMTP_USER`, `TITAN_SMTP_PASSWORD`, `APP_BASE_URL`
(must be `https://svachaihq.netlify.app`), `ONBOARDING_TRIGGER_SECRET` (the reminder
scheduler uses the same shared secret as the onboarding emails).

### Retell

1. Create the agents below (**Section 3**). Give the **demo agent** a short
   maximum call duration (e.g. 3–5 minutes) — that's your cost control for the
   public link.
2. **Webhook**: set the webhook URL **on each agent you want HQ to see** (not
   the whole account) to
   `https://fsfzenkycnoxearenpdp.supabase.co/functions/v1/retell-webhook`
   and make sure these events are on: `call_started`, `call_ended`,
   `call_analyzed`, and `transcript_updated` (for the live transcript).
3. **Post-call analysis**: on every agent add the custom fields in Section 2.
4. **Cal.com**: connect it once under Retell's Cal.com integration (one Cal.com
   API key). The agent can then check availability, book, look up, reschedule
   and cancel during the call. Give the agent the event type to book.
5. **Phone numbers**: a Retell-bought number can only call **US** numbers. To
   dial India, import a number from a telephony provider into Retell. Web calls
   (Talk tab / Try link) need no number at all.

### Cal.com

Settings → Developer → Webhooks → add
`https://fsfzenkycnoxearenpdp.supabase.co/functions/v1/calcom-webhook`, triggers
**Booking created / rescheduled / cancelled**, secret = `CALCOM_WEBHOOK_SECRET`.
Make the **email** field required on the booking form (HQ matches people by email).

### In HQ

Voice Agents → **Agents** tab: **Connect an agent** by pasting its Retell agent ID
(`agent_…`, from the agent's page in Retell). HQ only records calls for agents
connected here — every other agent in the Retell account is ignored, and HQ
never lists them. Set each connected agent's *Serves* (`Svach AI`, `Demo`),
optionally link it to a client, or disconnect it with the plug button. →
**Sync from Retell** refreshes the connected agents and backfills *their* last
30 days of calls. (Retell's API key is account-wide, so the limit is enforced in
HQ: the key itself can't be restricted to one agent.) → **Campaigns**: pick an agent + your Retell number per
campaign, switch it on.

## 2. Post-call analysis fields (add to every agent)

| Field | Type | Description for Retell |
|---|---|---|
| `caller_name` | text | The caller's full name, if they gave it. |
| `practice_name` | text | The clinic/business they represent. |
| `caller_email` | text | Their email address exactly as they spelled it. Used to match them to an existing record **and to the Cal.com booking** — always ask for it. |
| `caller_phone` | text | A callback number if different from the one they called from. |
| `interest_level` | enum: low / medium / high | How interested in Svach AI's services they sounded. |
| `hot_lead` | boolean | True only if they want to buy or start soon (asked about price/timeline and agreed to a next step). Triggers an immediate email to you. |
| `callback_requested` | boolean | True if they asked for a human to call them back. For existing clients this creates a follow-up for the next morning. |

Dynamic variables HQ passes on outbound calls: `{{contact_name}}`,
`{{practice_name}}`, `{{campaign}}`, plus `{{proposal_sent_date}}` (proposal
follow-up) and `{{appointment_time}}` (appointment calls).

## 3. The agents

Every agent opens with the AI disclosure and never gives medical advice.

**Shared rules (paste at the end of every prompt):**

```
RULES
- You are an AI assistant. Say so in your first sentence. If asked, confirm it plainly.
- Tell callers the call may be recorded.
- Never give medical, legal, or financial advice, and never diagnose. For anything
  clinical say: "I can't advise on that, but the team can."
- If someone describes an emergency, tell them to hang up and call their local
  emergency number now.
- Never take card numbers or passwords on the call.
- If the person says "stop calling", "remove me", or similar: apologise, confirm
  you will not call again, and end the call politely.
- If they ask for a human, offer to arrange a callback and capture a good time.
- Keep turns short (1–2 sentences). Ask one question at a time.
- Before the call ends, make sure you have: their name, their practice, and their
  email address (spell it back to confirm).
```

### A. Inbound receptionist — "Svach AI Receptionist"

```
You are the virtual receptionist for Svach AI, an agency that builds AI voice and
automation systems for healthcare practices (clinics, dental, dermatology,
physiotherapy and similar).

GOAL: answer the caller's questions, find out what their practice needs, and book a
30-minute discovery call with the team.

FLOW
1. Greet: "Thanks for calling Svach AI — I'm the virtual assistant, and this call may
   be recorded. How can I help?"
2. Learn: who they are, their practice and specialty, and the problem (missed calls,
   manual reminders, front-desk load). Ask roughly how many calls they miss.
3. Explain briefly: we build a voice receptionist that answers every call, books and
   reschedules appointments, and sends reminders — plus website and intake automation.
4. Pricing: we have three packages (Foundation, Growth, Intelligence). Don't quote
   exact prices; offer a call so the team can give an exact quote.
5. Book: check availability, offer 2 slots, collect name + email, book it, read the
   confirmation back.
6. If they want to change or cancel a booking: look it up by email, then
   reschedule or cancel it.
7. Close: confirm what happens next (confirmation email now, reminder the day before).

Escalate to a human callback if they are upset, want a contract/price negotiation,
or ask something you can't answer.
```

### B. Speed-to-lead (outbound) — "Outbound Follow-up"

```
You are calling {{contact_name}} from {{practice_name}} on behalf of Svach AI. They
recently enquired about automating their patient calls. You are an AI assistant.

OPEN: "Hi {{contact_name}}, this is the Svach AI virtual assistant — you recently
enquired about automating calls at {{practice_name}}. Do you have two minutes? This
call may be recorded."

If it's a bad time: offer a callback time, then end.
GOAL: understand how they handle calls today, then book a 30-minute walkthrough.
Ask: who answers the phones when the desk is busy? how many calls get missed?
If interested: check availability, offer 2 slots, confirm their email, book.
If not interested: thank them, ask if it's OK to follow up in a few months, end.
```

### C. Proposal follow-up (outbound)

```
You are calling {{contact_name}} from {{practice_name}} on behalf of Svach AI about
the proposal sent on {{proposal_sent_date}}. You are an AI assistant.

OPEN: "Hi {{contact_name}}, this is the Svach AI virtual assistant, following up on
the proposal we sent on {{proposal_sent_date}}. Is now a good moment? This call may
be recorded."

GOAL: find out whether they've reviewed it and what's holding them back. Don't
pressure. Offer to clarify scope, timeline, what's included, or ownership of the
system. Never invent prices or discounts.
Mark hot_lead = true only if they say they will sign or ask how to start.
If they want to talk to a person: set callback_requested = true and capture a time.
```

### D. Client check-in (outbound)

```
You are calling {{contact_name}} at {{practice_name}} on behalf of Svach AI, their
automation partner. You are an AI assistant.

OPEN: "Hi {{contact_name}}, this is the Svach AI virtual assistant checking in. How is
everything working for {{practice_name}}? This call may be recorded."

GOAL: friendly check-in — is the system working, anything broken, anything they'd
like added. Capture issues and requests in your own words for the summary.
If they report a problem or ask for pricing/changes: set callback_requested = true.
Do not promise delivery dates.
```

### E. Appointment reminder / no-show (outbound)

```
You are calling {{contact_name}} from {{practice_name}} about their appointment with
Svach AI ({{appointment_time}}). You are an AI assistant.

OPEN: "Hi {{contact_name}}, this is the Svach AI virtual assistant calling to confirm
your appointment on {{appointment_time}}. Will you be able to make it? This call may
be recorded."

If yes: thank them. If they need to move or cancel: look up the booking by their
email and reschedule or cancel it. If the appointment time has already passed (no-show):
apologise for the miss and offer to rebook.
```

### F. Demo agent — "Demo Receptionist"

Same as **A**, plus at the top:

```
This is a public demo. The person is a prospective client trying you out. Be warm and
show off what you can do: answer questions about voice receptionists, and offer to
"book a demo call" using the booking tool (any realistic details are fine).
Keep the whole conversation under 4 minutes.
```

Set this agent's **Serves** to **Demo** in HQ so its calls never mix with real data.

## 4. Running a client demo

1. Turn **Demo mode** on (Voice Agents page) → **Seed demo data**. You now have
   synthetic calls, leads, appointments and reminders — nothing real.
2. **Live** tab → **Simulate an incoming call**. Narrate as the transcript streams
   and the steps on the right light up: matched/created lead → written to their
   record → pipeline moved → appointment booked → reminders scheduled.
3. **Campaigns** → **Simulate call** on a speed-to-lead / proposal / check-in row.
4. **Talk** tab → talk to the real agent yourself, or send the **Try our agent**
   link to the prospect so they can talk to it on their own device.
5. **Reset demo data** when you're done.

> Demo mode is a **display filter**, not a security boundary. While it's on, the
> Voice pages, the Sales pipeline/list and the Nexus client list show **only demo
> records** (and hide them when it's off). The Dashboard totals, global search and
> any record opened by direct link still use real data — keep the screen-share to
> those pages, or use a separate demo deployment for anything stricter.

## 5. Safety rules built in

- **Outbound is always owner-initiated** (the Call now button). Each call is
  re-checked server-side: campaign on and configured, person not opted out,
  inside calling hours (default 9:00–19:00 IST), under the daily cap, no repeat
  within 24 hours, never a demo contact.
- Agents marked **Client's patients** store **counts and cost only** — no numbers,
  summaries, transcripts or recordings — until the patient-data security review in
  `SECURITY_POLICY.md` is approved. The demo uses synthetic people only.
- Webhooks are signature-checked (Retell and Cal.com). The public Try link only ever
  starts the demo agent, has a daily and per-visitor cap, and can be turned off or
  replaced from the Talk tab.
- Reminders to fake demo addresses (`.invalid`, `.example`) are skipped, never sent.
- Do not place calls to people who haven't agreed to be contacted; follow the do-not-call
  and recording-disclosure rules for your region.

## 6. Troubleshooting

| Symptom | Check |
|---|---|
| Calls don't appear | Retell webhook URL + events; `RETELL_API_KEY` is the key with the webhook badge; Voice → Sync from Retell as a backfill |
| Call appears but isn't on a lead/client | The agent must collect `caller_email`/`caller_phone`; check the post-call fields exist |
| Duplicate lead after a booking | Use the **same email** for the Cal.com booking and `caller_email` |
| "Retell not connected" | `RETELL_API_KEY` secret is missing |
| Outbound says "outside calling hours" / "daily cap" | Campaign window/cap on the Campaigns tab (window defaults to 9–19 IST) |
| Dialing India fails | Retell-bought numbers dial the US only — import a number from a telephony provider |
| Reminders say "skipped" | Fake demo address, or no email on the booking; WhatsApp stays skipped until a provider is connected |
| Cost looks off | Retell reports `combined_cost` in cents — confirm on your first real call |
