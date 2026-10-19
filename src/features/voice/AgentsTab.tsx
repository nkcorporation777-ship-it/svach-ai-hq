import { useState } from "react"
import { Plus, Unplug } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getFunctionErrorMessage } from "@/lib/functionsError"
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
  useAddRetellAgent,
  useClientsLite,
  useStopTrackingAgent,
  useUpdateVoiceAgent,
  useVoiceAgents,
  type Audience,
} from "./hooks"

/** Connect one Retell agent at a time by its ID. HQ records calls only for the
 * agents added here and never lists the rest of the Retell account. */
function AddAgentCard() {
  const add = useAddRetellAgent()
  const [agentId, setAgentId] = useState("")
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  async function submit() {
    setMessage(null)
    try {
      const agent = await add.mutateAsync(agentId)
      setAgentId("")
      setMessage({ kind: "ok", text: `Connected “${agent.name}”.` })
    } catch (err) {
      setMessage({ kind: "error", text: await getFunctionErrorMessage(err, "Couldn't connect that agent.") })
    }
  }

  return (
    <GlowCard tone="cyan">
      <h3 className="font-display text-base font-semibold">Connect an agent</h3>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Paste the agent's ID from Retell (it looks like <span className="font-mono">agent_…</span>, shown on the agent's
        page). Only agents you add here are recorded in HQ — every other agent in your Retell account is ignored.
      </p>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (agentId.trim()) submit()
        }}
      >
        <Input
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="agent_xxxxxxxxxxxxxxxx"
          className="w-80 max-w-full font-mono"
          autoComplete="off"
        />
        <Button type="submit" disabled={add.isPending || !agentId.trim()}>
          <Plus className="size-4" />
          {add.isPending ? "Checking…" : "Connect agent"}
        </Button>
      </form>
      {message && (
        <p className={`mt-2 text-xs ${message.kind === "error" ? "text-status-error" : "text-brand-cyan"}`}>
          {message.text}
        </p>
      )}
    </GlowCard>
  )
}

/** Retell agents connected to HQ. Set who each one serves and link it to a client. */
export function AgentsTab() {
  const { data: agents, isLoading } = useVoiceAgents()
  const { data: clients } = useClientsLite()
  const update = useUpdateVoiceAgent()
  const stop = useStopTrackingAgent()

  return (
    <div className="flex flex-col gap-3">
      <AddAgentCard />
      <GlowCard tone="violet" className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !agents || agents.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No agents connected yet. Paste an agent ID above to connect one.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Serves</TableHead>
                <TableHead>Linked client</TableHead>
                <TableHead className="hidden md:table-cell">Retell ID</TableHead>
                <TableHead className="w-10" />
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
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Stop recording this agent's calls in HQ"
                      disabled={stop.isPending}
                      onClick={() => stop.mutate(a.id)}
                    >
                      <Unplug className="size-4" />
                      <span className="sr-only">Disconnect {a.name}</span>
                    </Button>
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
      {stop.isError && <p className="text-xs text-status-error">{stop.error.message}</p>}
    </div>
  )
}
