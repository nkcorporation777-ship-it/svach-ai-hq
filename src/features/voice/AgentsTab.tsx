import { GlowCard } from "@/components/shared/GlowCard"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AUDIENCE_LABEL,
  useClientsLite,
  useUpdateVoiceAgent,
  useVoiceAgents,
  type Audience,
} from "./hooks"

/** Retell agents known to HQ. Set who each one serves and link it to a client. */
export function AgentsTab() {
  const { data: agents, isLoading } = useVoiceAgents()
  const { data: clients } = useClientsLite()
  const update = useUpdateVoiceAgent()

  return (
    <div className="flex flex-col gap-3">
      <GlowCard tone="violet" className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !agents || agents.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No agents yet. They appear after the first call or when you press Sync from Retell.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Serves</TableHead>
                <TableHead>Linked client</TableHead>
                <TableHead className="hidden md:table-cell">Retell ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>
                    <Select
                      value={a.audience}
                      onValueChange={(v) => update.mutate({ id: a.id, audience: v as Audience })}
                    >
                      <SelectTrigger className="w-52">
                        <SelectValue>{AUDIENCE_LABEL[a.audience as Audience]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((k) => (
                          <SelectItem key={k} value={k}>
                            {AUDIENCE_LABEL[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={a.client_id ?? "none"}
                      onValueChange={(v) => update.mutate({ id: a.id, clientId: v === "none" ? null : v })}
                    >
                      <SelectTrigger className="w-52">
                        <SelectValue>
                          {a.client_id
                            ? (clients?.find((c) => c.id === a.client_id)?.practice_name ?? "Linked")
                            : "No client"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No client</SelectItem>
                        {clients?.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.practice_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                    {a.retell_agent_id}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlowCard>
      <p className="text-xs text-muted-foreground">
        “Client's patients” agents store call counts and cost only — no numbers, summaries or
        transcripts — until the patient-data security review is approved.
      </p>
      {update.isError && <p className="text-xs text-status-error">{update.error.message}</p>}
    </div>
  )
}
