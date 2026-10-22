import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NewTicketDialog } from "./NewTicketDialog"
import { PriorityBadge, SlaCell, TicketStatusBadge } from "./SupportBits"
import { TICKET_STATUSES, isOpenStatus, severityLabel, statusLabel, type Ticket, type TicketKind } from "./hooks"

type Filter = "active" | "all" | string

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }

/** Tickets and bugs share one list; `kind` picks which. Open ones sort by
 * priority, then by whichever SLA deadline is nearest. */
export function TicketsTab({ tickets, isLoading, kind }: { tickets: Ticket[]; isLoading: boolean; kind: TicketKind }) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>("active")
  const [newOpen, setNewOpen] = useState(false)
  const isBug = kind === "bug"

  const ofKind = tickets.filter((t) => t.kind === kind)
  const rows = ofKind
    .filter((t) => (filter === "active" ? isOpenStatus(t.status) : filter === "all" || t.status === filter))
    .sort((a, b) => {
      const openDiff = Number(!isOpenStatus(a.status)) - Number(!isOpenStatus(b.status))
      if (openDiff) return openDiff
      const pDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (pDiff) return pDiff
      const due = (t: Ticket) => (t.first_responded_at ? t.resolution_due_at : t.first_response_due_at) ?? ""
      return due(a).localeCompare(due(b))
    })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue>
              {filter === "active" ? "Open" : filter === "all" ? `All ${isBug ? "bugs" : "tickets"}` : statusLabel(filter)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Open</SelectItem>
            <SelectItem value="all">All {isBug ? "bugs" : "tickets"}</SelectItem>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="size-4" />
          {isBug ? "Log bug" : "New ticket"}
        </Button>
      </div>

      <GlowCard tone={isBug ? "red" : "cyan"} className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {ofKind.length
              ? filter === "active"
                ? `Nothing open. Every ${isBug ? "bug" : "ticket"} is resolved.`
                : "Nothing matches that filter."
              : isBug
                ? "No bugs logged."
                : "No tickets yet. Log one when a client gets in touch."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{isBug ? "Bug" : "Ticket"}</TableHead>
                <TableHead className="hidden md:table-cell">Client</TableHead>
                <TableHead>Priority</TableHead>
                {isBug && <TableHead className="hidden lg:table-cell">Severity</TableHead>}
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead>SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/support/${t.id}`)}>
                  <TableCell>
                    <span className="block font-mono text-[11px] text-muted-foreground">{t.ticket_number}</span>
                    <span className="font-medium">{t.subject}</span>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {t.clients?.practice_name ?? "Internal"}
                    {t.projects && <span className="block text-xs">{t.projects.name}</span>}
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={t.priority} />
                  </TableCell>
                  {isBug && <TableCell className="hidden lg:table-cell">{severityLabel(t.severity)}</TableCell>}
                  <TableCell className="hidden sm:table-cell">
                    <TicketStatusBadge status={t.status} />
                  </TableCell>
                  <TableCell>
                    <SlaCell ticket={t} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlowCard>

      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} kind={kind} />
    </div>
  )
}
