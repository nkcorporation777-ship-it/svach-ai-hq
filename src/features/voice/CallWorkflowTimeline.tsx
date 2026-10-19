import { Check, Loader2, Minus } from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { formatAppointmentWhen, useCallWorkflow } from "./hooks"

type StepState = "done" | "active" | "waiting" | "skipped"

interface Step {
  title: string
  detail: React.ReactNode
  state: StepState
}

const STAGE_LABEL: Record<string, string> = {
  lead: "Lead",
  contacted: "Contacted",
  discovery_booked: "Discovery Booked",
  proposal_sent: "Proposal Sent",
  verbal_commit: "Verbal Commit",
  won: "Won",
  lost: "Lost",
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done")
    return (
      <span className="flex size-7 items-center justify-center rounded-full border border-status-success/60 bg-status-success/15 text-status-success">
        <Check className="size-4" />
      </span>
    )
  if (state === "active")
    return (
      <span className="flex size-7 items-center justify-center rounded-full border border-brand-cyan/60 bg-brand-cyan/15 text-brand-cyan">
        <Loader2 className="size-4 animate-spin" />
      </span>
    )
  if (state === "skipped")
    return (
      <span className="flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground">
        <Minus className="size-4" />
      </span>
    )
  return <span className="size-7 rounded-full border border-dashed border-border" />
}

/** The end-to-end workflow for ONE call, built from what's actually in the
 * database — so each step lights up for real as webhooks and jobs land. */
export function CallWorkflowTimeline({ callId }: { callId: string | undefined }) {
  const { data } = useCallWorkflow(callId)
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>

  const { call, appointments, leadStage } = data
  const lead = (call as { leads?: { id: string; practice_name: string } | null }).leads
  const client = (call as { clients?: { id: string; practice_name: string } | null }).clients
  const person = client ?? lead
  const live = call.call_status === "ongoing" || call.call_status === "registered"
  const finished = !live
  const analysed = !!call.summary
  const appt = appointments.find((a) => a.status === "scheduled") ?? appointments[0]
  const reminders = (appt as { appointment_reminders?: { status: string; send_at: string; kind: string; error: string | null }[] } | undefined)
    ?.appointment_reminders ?? []
  const sent = reminders.filter((r) => r.status === "sent")
  const queued = reminders.filter((r) => r.status === "pending")
  const skippedAll = reminders.length > 0 && reminders.every((r) => r.status === "skipped" || r.status === "cancelled")

  const steps: Step[] = [
    {
      title: "Call received",
      detail: `${call.direction === "outbound" ? "Outbound" : "Inbound"} ${call.call_type === "web_call" ? "web" : "phone"} call${call.started_at ? ` · ${new Date(call.started_at).toLocaleTimeString()}` : ""}`,
      state: "done",
    },
    {
      title: live ? "Conversation in progress" : "Conversation analysed",
      detail: live ? "The agent is talking — transcript is streaming in." : analysed ? "Summary, sentiment and key details captured." : "Waiting for the post-call analysis…",
      state: live ? "active" : analysed ? "done" : "active",
    },
    {
      title: "Person matched or created",
      detail: person ? (
        <>
          On record:{" "}
          <Link className="text-brand-cyan hover:underline" to={client ? `/nexus/${client.id}` : `/sales/${lead!.id}`}>
            {person.practice_name}
          </Link>
        </>
      ) : finished && analysed ? (
        "No contact details to match."
      ) : (
        "Looking up by phone or email…"
      ),
      state: person ? "done" : finished && analysed ? "skipped" : "waiting",
    },
    {
      title: "Written to their record",
      detail: call.activity_id ? "Call summary added to the activity timeline." : "Added once the call is analysed.",
      state: call.activity_id ? "done" : person && !analysed ? "waiting" : "waiting",
    },
    {
      title: "Pipeline updated",
      detail: client
        ? "Client's last-contact date refreshed."
        : leadStage
          ? `Lead is now “${STAGE_LABEL[leadStage] ?? leadStage}”.`
          : "—",
      state: client ? (call.activity_id ? "done" : "waiting") : leadStage && leadStage !== "lead" ? "done" : call.activity_id ? "skipped" : "waiting",
    },
    {
      title: "Appointment booked",
      detail: appt
        ? `${formatAppointmentWhen(appt.starts_at, appt.timezone)}${appt.status === "cancelled" ? " (cancelled)" : ""}`
        : finished && analysed
          ? "No booking on this call."
          : "If the caller books, it appears here.",
      state: appt ? "done" : finished && analysed ? "skipped" : "waiting",
    },
    {
      title: "Reminders scheduled",
      detail: reminders.length
        ? `${reminders.length} reminder${reminders.length > 1 ? "s" : ""}: ${reminders.map((r) => r.kind).join(" + ")} before.`
        : appt
          ? "No email on file, so none scheduled."
          : "—",
      state: reminders.length ? "done" : appt ? "skipped" : "waiting",
    },
    {
      title: "Reminder sent",
      detail: sent.length
        ? `${sent.length} sent.`
        : queued.length
          ? `Next goes out ${new Date([...queued].sort((a, b) => a.send_at.localeCompare(b.send_at))[0].send_at).toLocaleString()}.`
          : skippedAll
            ? "Not emailed (demo or missing address)."
            : "—",
      state: sent.length ? "done" : queued.length ? "waiting" : skippedAll ? "skipped" : "waiting",
    },
  ]

  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3">
          <div className="flex flex-col items-center">
            <StepIcon state={s.state} />
            {i < steps.length - 1 && (
              <span className={cn("my-1 w-px flex-1", s.state === "done" ? "bg-status-success/40" : "bg-border")} />
            )}
          </div>
          <div className={cn("pb-5 transition-opacity", s.state === "waiting" && "opacity-50")}>
            <p className="text-sm font-medium">{s.title}</p>
            <p className="text-xs text-muted-foreground">{s.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
