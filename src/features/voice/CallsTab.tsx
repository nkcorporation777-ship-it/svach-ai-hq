import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowDownLeft, ArrowUpRight, Globe } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { OutcomeBadge } from "./CallBadges"
import { formatCents, formatMinutes, useVoiceAgents, useVoiceCalls, type CallFilters } from "./hooks"

const OUTCOMES: { value: NonNullable<CallFilters["outcome"]>; label: string }[] = [
  { value: "all", label: "All outcomes" },
  { value: "successful", label: "Successful" },
  { value: "unsuccessful", label: "Unsuccessful" },
  { value: "needs_review", label: "Needs review" },
]

export function CallsTab() {
  const navigate = useNavigate()
  const [agentId, setAgentId] = useState<string>("all")
  const [outcome, setOutcome] = useState<NonNullable<CallFilters["outcome"]>>("all")
  const { data: agents } = useVoiceAgents()
  const { data: calls, isLoading } = useVoiceCalls({
    agentId: agentId === "all" ? undefined : agentId,
    outcome,
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger className="w-56">
            <SelectValue>
              {agentId === "all" ? "All agents" : agents?.find((a) => a.id === agentId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {agents?.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}>
          <SelectTrigger className="w-48">
            <SelectValue>{OUTCOMES.find((o) => o.value === outcome)?.label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {OUTCOMES.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <GlowCard tone="cyan" className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !calls || calls.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No calls yet. Once Retell is connected they appear here as they finish.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="hidden lg:table-cell">Summary</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((c) => {
                const lead = (c as { leads?: { id: string; practice_name: string } | null }).leads
                const client = (c as { clients?: { id: string; practice_name: string } | null }).clients
                const agent = (c as { voice_agents?: { name: string } | null }).voice_agents
                const Icon = c.call_type === "web_call" ? Globe : c.direction === "outbound" ? ArrowUpRight : ArrowDownLeft
                return (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/voice/calls/${c.id}`)}
                  >
                    <TableCell className="whitespace-nowrap">
                      {c.started_at ? new Date(c.started_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <Icon className="size-3.5 text-brand-cyan" />
                        {agent?.name ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {client ? (
                        <Link className="text-brand-cyan hover:underline" to={`/nexus/${client.id}`}>
                          {client.practice_name}
                        </Link>
                      ) : lead ? (
                        <Link className="text-brand-cyan hover:underline" to={`/sales/${lead.id}`}>
                          {lead.practice_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Unmatched</span>
                      )}
                      {c.needs_review && (
                        <span className="ml-2 rounded-[var(--radius-pill)] border border-status-warning/40 bg-status-warning/10 px-2 py-0.5 text-xs text-status-warning">
                          Needs review
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatMinutes(c.duration_ms)}</TableCell>
                    <TableCell>
                      <OutcomeBadge successful={c.call_successful} status={c.call_status} />
                    </TableCell>
                    <TableCell className="hidden max-w-xs truncate text-muted-foreground lg:table-cell">
                      {c.summary ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{formatCents(c.cost_cents)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </GlowCard>
    </div>
  )
}
