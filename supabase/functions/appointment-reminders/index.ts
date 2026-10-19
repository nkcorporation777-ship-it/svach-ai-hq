// Sends due appointment reminders (24h and 1h before). Called every 5 minutes
// by a pg_cron job through pg_net — never by a browser — so auth is the same
// shared secret the onboarding trigger uses (vault: onboarding_trigger_secret,
// Edge secret: ONBOARDING_TRIGGER_SECRET), not a user JWT.
//
// Email is built; WhatsApp reminders are recorded as `skipped` until a
// WhatsApp Business provider is connected (see docs/VOICE_AGENTS.md).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { TitanMailer } from "./mailer.ts"

const BATCH = 20
// Addresses on reserved/fake domains (demo data) are never emailed.
const FAKE_DOMAIN = /\.(invalid|example|test)$/i

function formatWhen(iso: string, tz: string | null) {
  try {
    return `${new Intl.DateTimeFormat("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz || "UTC",
    }).format(new Date(iso))} (${tz || "UTC"})`
  } catch {
    return iso
  }
}

Deno.serve(async (req) => {
  const secret = req.headers.get("x-onboarding-secret")
  if (!secret || secret !== Deno.env.get("ONBOARDING_TRIGGER_SECRET")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
  const smtpUser = Deno.env.get("TITAN_SMTP_USER")
  const smtpPassword = Deno.env.get("TITAN_SMTP_PASSWORD")
  const summary = { due: 0, sent: 0, skipped: 0, cancelled: 0, failed: 0 }

  try {
    const { data: due, error } = await admin
      .from("appointment_reminders")
      .select("*, appointments(*)")
      .eq("status", "pending")
      .lte("send_at", new Date().toISOString())
      .order("send_at")
      .limit(BATCH)
    if (error) throw error
    summary.due = due?.length ?? 0

    for (const reminder of due ?? []) {
      // Claim it so an overlapping run can't send it twice.
      const { data: claimed } = await admin
        .from("appointment_reminders")
        .update({ status: "sending" })
        .eq("id", reminder.id)
        .eq("status", "pending")
        .select("id")
      if (!claimed?.length) continue

      const appt = reminder.appointments
      const finish = (status: string, err?: string) =>
        admin
          .from("appointment_reminders")
          .update({ status, error: err ?? null, sent_at: status === "sent" ? new Date().toISOString() : null })
          .eq("id", reminder.id)

      // Stale: the appointment was cancelled/moved or already started.
      if (!appt || appt.status !== "scheduled" || new Date(appt.starts_at).getTime() < Date.now()) {
        await finish("cancelled", "appointment no longer upcoming")
        summary.cancelled++
        continue
      }
      if (reminder.channel !== "email") {
        await finish("skipped", "WhatsApp provider not connected yet")
        summary.skipped++
        continue
      }
      const to: string | null = appt.attendee_email
      if (!to || FAKE_DOMAIN.test(to.split("@")[1] ?? "")) {
        await finish("skipped", "no deliverable email (demo or missing)")
        summary.skipped++
        continue
      }
      if (!smtpUser || !smtpPassword) {
        await finish("failed", "TITAN_SMTP_USER/PASSWORD missing")
        summary.failed++
        continue
      }

      try {
        const when = formatWhen(appt.starts_at, appt.timezone)
        const soon = reminder.kind === "1h"
        const subject = soon
          ? "Starting in about an hour: your Svach AI appointment"
          : `Reminder: your Svach AI appointment on ${when}`
        const greeting = appt.attendee_name ? `Hi ${appt.attendee_name},` : "Hi,"
        const body = [
          greeting,
          "",
          soon
            ? "A quick reminder that your appointment with Svach AI starts in about an hour."
            : "This is a reminder of your upcoming appointment with Svach AI.",
          "",
          `When: ${when}`,
          appt.meeting_url ? `Join: ${appt.meeting_url}` : null,
          "",
          "Need to change the time? Use the link in your original booking confirmation, or just reply to this email.",
          "",
          "Svach AI",
        ]
          .filter((l) => l !== null)
          .join("\n")

        await new TitanMailer(smtpUser, smtpPassword).send(to, subject, body)
        await finish("sent")
        summary.sent++

        const ownerType = appt.client_id ? "client" : appt.lead_id ? "lead" : null
        const ownerId = appt.client_id ?? appt.lead_id
        if (ownerType && ownerId) {
          await admin.from("activities").insert({
            entity_type: ownerType,
            entity_id: ownerId,
            type: "email",
            content: subject,
            created_by: null,
            metadata: {
              automated: true,
              source: "appointment_reminder",
              reminder_kind: reminder.kind,
              appointment_id: appt.id,
            },
          })
          await admin.from("audit_logs").insert({
            actor_type: "system",
            actor_id: null,
            action: "appointment.reminder_sent",
            entity_type: ownerType,
            entity_id: ownerId,
            metadata: { appointment_id: appt.id, kind: reminder.kind, channel: "email" },
          })
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await finish("failed", message.slice(0, 300))
        summary.failed++
        await admin.from("ooa_system_health_events").insert({
          source: "appointment_reminders",
          event_type: "appointment.reminder_failed",
          severity: "error",
          detail: { reminder_id: reminder.id, message: message.slice(0, 300) },
        })
      }
    }

    return new Response(JSON.stringify(summary), { headers: { "content-type": "application/json" } })
  } catch (err) {
    console.error("appointment-reminders error:", err)
    const message = err instanceof Error ? err.message : "Unexpected error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    })
  }
})
