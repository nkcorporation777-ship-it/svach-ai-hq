import { useState } from "react"
import { Link } from "react-router-dom"
import { Headphones, Plus } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import { NewTicketDialog } from "./NewTicketDialog"
import { SlaCell, TicketStatusBadge } from "./SupportBits"
import { isOpenStatus, useTickets } from "./hooks"

/** A client's open tickets and bugs on their Nexus page, with a shortcut to
 * log a new one already tied to them. */
export function ClientTicketsCard({ clientId }: { clientId: string }) {
  const { data: tickets } = useTickets(clientId)
  const [newOpen, setNewOpen] = useState(false)
  const open = (tickets ?? []).filter((t) => isOpenStatus(t.status))
  const closedCount = (tickets?.length ?? 0) - open.length

  return (
    <GlowCard tone={open.length ? "amber" : "cyan"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Headphones className="size-4 text-brand-cyan" />
          <h2 className="font-display text-base font-semibold">Support</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setNewOpen(true)}>
          <Plus className="size-4" />
          Log ticket
        </Button>
      </div>
      {open.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No open tickets{closedCount ? ` (${closedCount} resolved)` : ""}.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {open.map((t) => (
            <li key={t.id}>
              <Link to={`/support/${t.id}`} className="flex flex-col gap-1 rounded-md hover:bg-white/5">
                <span className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{t.subject}</span>
                  <TicketStatusBadge status={t.status} />
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">{t.ticket_number}</span>
                  <SlaCell ticket={t} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} kind="ticket" clientId={clientId} />
    </GlowCard>
  )
}
