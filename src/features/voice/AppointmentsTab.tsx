import { Link } from "react-router-dom"
import { GlowCard } from "@/components/shared/GlowCard"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AppointmentStatusBadge, ReminderChips, type ReminderRow } from "./AppointmentBits"
import { formatAppointmentWhen, useAppointments } from "./hooks"

/** Appointments the voice agent booked (via Cal.com), with their reminders. */
export function AppointmentsTab() {
  const { data: appointments, isLoading } = useAppointments()

  return (
    <GlowCard tone="green" className="p-0">
      {isLoading ? (
        <p className="p-6 text-sm text-muted-foreground">Loading…</p>
      ) : !appointments || appointments.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          No appointments yet. When the voice agent books one on Cal.com it appears here, with its
          reminders.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reminders</TableHead>
              <TableHead className="hidden lg:table-cell">Booked on call</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((a) => {
              const lead = (a as { leads?: { id: string; practice_name: string } | null }).leads
              const client = (a as { clients?: { id: string; practice_name: string } | null }).clients
              const reminders = (a as { appointment_reminders?: ReminderRow[] }).appointment_reminders
              return (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap font-medium">
                    {formatAppointmentWhen(a.starts_at, a.timezone)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{a.timezone}</span>
                  </TableCell>
                  <TableCell>
                    {client ? (
                      <Link className="text-brand-cyan hover:underline" to={`/nexus/${client.id}`}>
                        {client.practice_name}
                      </Link>
                    ) : lead ? (
                      <Link className="text-brand-cyan hover:underline" to={`/sales/${lead.id}`}>
                        {lead.practice_name}
                      </Link>
                    ) : (
                      (a.attendee_name ?? "—")
                    )}
                    {a.attendee_name && (client || lead) && (
                      <span className="block text-xs text-muted-foreground">{a.attendee_name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <AppointmentStatusBadge status={a.status} />
                  </TableCell>
                  <TableCell>
                    <ReminderChips reminders={reminders} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {a.call_id ? (
                      <Link className="text-brand-cyan hover:underline" to={`/voice/calls/${a.call_id}`}>
                        View call
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </GlowCard>
  )
}
