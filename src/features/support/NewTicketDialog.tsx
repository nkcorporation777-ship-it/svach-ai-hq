import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { DateTimeField } from "@/components/shared/DateTimeField"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  CHANNELS,
  PRIORITIES,
  SEVERITIES,
  channelLabel,
  priorityLabel,
  severityLabel,
  useCreateTicket,
  useSupportClients,
  useSupportProjects,
  type Priority,
  type TicketKind,
} from "./hooks"

const NONE = "none"
const pad = (n: number) => String(n).padStart(2, "0")
/** Now, rounded down to the half hour (DateTimeField offers 30-minute slots). */
function nowInput() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${d.getMinutes() < 30 ? "00" : "30"}`
}

/** Log a ticket or a bug you heard about by call, WhatsApp, email… Clients
 * never log in, so everything starts here. */
export function NewTicketDialog({
  open,
  onOpenChange,
  kind,
  clientId: fixedClientId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: TicketKind
  /** Prefill (and lock) the client, e.g. when opened from a client's page. */
  clientId?: string
}) {
  const navigate = useNavigate()
  const create = useCreateTicket()
  const { data: clients } = useSupportClients()
  const { data: projects } = useSupportProjects()

  const [clientId, setClientId] = useState(NONE)
  const [projectId, setProjectId] = useState(NONE)
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [channel, setChannel] = useState("whatsapp")
  const [priority, setPriority] = useState<Priority>("normal")
  const [openedAt, setOpenedAt] = useState(nowInput())
  const [severity, setSeverity] = useState("major")
  const [steps, setSteps] = useState("")
  const [environment, setEnvironment] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setClientId(fixedClientId ?? NONE)
    setProjectId(NONE)
    setSubject("")
    setDescription("")
    setChannel("whatsapp")
    setPriority(kind === "bug" ? "high" : "normal")
    setOpenedAt(nowInput())
    setSeverity("major")
    setSteps("")
    setEnvironment("")
    setError(null)
  }, [open, kind, fixedClientId])

  const clientProjects = (projects ?? []).filter((p) => clientId !== NONE && p.client_id === clientId)
  const isBug = kind === "bug"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (new Date(openedAt).getTime() > Date.now() + 60_000) return setError("'Raised at' can't be in the future.")
    try {
      const ticket = await create.mutateAsync({
        kind,
        clientId: clientId === NONE ? null : clientId,
        projectId: projectId === NONE ? null : projectId,
        subject,
        description,
        channel,
        priority,
        openedAt: new Date(openedAt).toISOString(),
        severity: isBug ? severity : null,
        stepsToReproduce: steps,
        environment,
      })
      onOpenChange(false)
      navigate(`/support/${ticket.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save it.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isBug ? "Log a bug" : "New support ticket"}</DialogTitle>
          <DialogDescription>
            The SLA clock starts from when it was raised, so backdate it if the client got in touch earlier.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Client</Label>
              <Select
                value={clientId}
                disabled={!!fixedClientId}
                onValueChange={(v) => {
                  setClientId(v)
                  setProjectId(NONE)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {clientId === NONE ? "No client (internal)" : clients?.find((c) => c.id === clientId)?.practice_name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No client (internal)</SelectItem>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.practice_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Project (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={clientProjects.length === 0}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {projectId === NONE
                      ? clientProjects.length
                        ? "Not tied to a project"
                        : "No projects for this client"
                      : clientProjects.find((p) => p.id === projectId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not tied to a project</SelectItem>
                  {clientProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ticket_subject">Subject</Label>
            <Input
              id="ticket_subject"
              placeholder={isBug ? "e.g. Booking bot double-books the 10am slot" : "e.g. Can't log in to the dashboard"}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ticket_desc">{isBug ? "What happens" : "What they asked"}</Label>
            <Textarea id="ticket_desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {isBug && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bug_steps">Steps to reproduce</Label>
                <Textarea
                  id="bug_steps"
                  rows={3}
                  placeholder={"1. …\n2. …"}
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Severity</Label>
                  <Select value={severity} onValueChange={setSeverity}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{severityLabel(severity)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="bug_env">Where (optional)</Label>
                  <Input
                    id="bug_env"
                    placeholder="e.g. n8n workflow, Retell agent, website"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Priority (sets the SLA)</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{priorityLabel(priority)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Came in by</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger className="w-full">
                  <SelectValue>{channelLabel(channel)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DateTimeField id="ticket_opened" dateLabel="Raised on" timeLabel="At" value={openedAt} onChange={setOpenedAt} />

          {error && <p className="text-sm text-status-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : isBug ? "Log bug" : "Create ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
