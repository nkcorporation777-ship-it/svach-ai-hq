import { CalendarClock } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { AppointmentStatusBadge, ReminderChips, type ReminderRow } from "./AppointmentBits"
import { formatAppointmentWhen, useEntityAppointments } from "./hooks"

/** Appointments for a single lead or client — dropped onto their detail page.
 * Renders nothing when there are none, so it never adds empty chrome. */
export function EntityAppointmentsCard({
  entityType,
  entityId,
}: {
  entityType: "lead" | "client"
  entityId: string | undefined
}) {
  const { data: appointments } = useEntityAppointments(entityType, entityId)
  if (!appointments || appointments.length === 0) return null

  return (
    <GlowCard tone="green">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-status-success" />
        <h2 className="font-display text-base font-semibold">Appointments</h2>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {appointments.map((a) => (
          <div key={a.id} className="flex flex-col gap-2 border-b border-border pb-4 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{formatAppointmentWhen(a.starts_at, a.timezone)}</p>
              <AppointmentStatusBadge status={a.status} />
            </div>
            {a.status === "scheduled" && (
              <ReminderChips
                reminders={(a as { appointment_reminders?: ReminderRow[] }).appointment_reminders}
              />
            )}
          </div>
        ))}
      </div>
    </GlowCard>
  )
}
