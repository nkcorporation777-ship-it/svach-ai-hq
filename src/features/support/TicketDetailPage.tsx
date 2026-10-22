import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, MessageSquare, Pencil, StickyNote, Trash2 } from "lucide-react"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
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
import { cn } from "@/lib/utils"
import { PriorityBadge, SlaStateText, TicketStatusBadge } from "./SupportBits"
import {
  PRIORITIES,
  SEVERITIES,
  TICKET_STATUSES,
  channelLabel,
  formatCountdown,
  isOpenStatus,
  priorityLabel,
  severityLabel,
  slaOf,
  statusLabel,
  useAddTicketUpdate,
  useDeleteTicket,
  useTicket,
  useUpdateTicket,
  type Priority,
  type Ticket,
} from "./hooks"

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "—"

function EditTicketDialog({
  open,
  onOpenChange,
  ticket,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticket: Ticket
}) {
  const update = useUpdateTicket()
  const isBug = ticket.kind === "bug"
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [severity, setSeverity] = useState("major")
  const [steps, setSteps] = useState("")
  const [environment, setEnvironment] = useState("")
  const [fixedIn, setFixedIn] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSubject(ticket.subject)
    setDescription(ticket.description ?? "")
    setSeverity(ticket.severity ?? "major")
    setSteps(ticket.steps_to_reproduce ?? "")
    setEnvironment(ticket.environment ?? "")
    setFixedIn(ticket.fixed_in ?? "")
    setError(null)
  }, [open, ticket])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!subject.trim()) return setError("Add a subject.")
    try {
      await update.mutateAsync({
        ticket,
        patch: {
          subject: subject.trim(),
          description: description.trim() || null,
          ...(isBug
            ? {
                severity,
                steps_to_reproduce: steps.trim() || null,
                environment: environment.trim() || null,
                fixed_in: fixedIn.trim() || null,
              }
            : {}),
        },
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {ticket.ticket_number}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit_subject">Subject</Label>
            <Input id="edit_subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit_desc">Description</Label>
            <Textarea id="edit_desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {isBug && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit_steps">Steps to reproduce</Label>
                <Textarea id="edit_steps" rows={3} value={steps} onChange={(e) => setSteps(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                  <Label htmlFor="edit_env">Where</Label>
                  <Input id="edit_env" value={environment} onChange={(e) => setEnvironment(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit_fixed">Fixed in</Label>
                  <Input
                    id="edit_fixed"
                    placeholder="e.g. workflow v12"
                    value={fixedIn}
                    onChange={(e) => setFixedIn(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}
          {error && <p className="text-sm text-status-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SlaRow({ label, due, doneAt, state }: { label: string; due: string | null; doneAt: string | null; state: ReturnType<typeof slaOf>["response"] }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <SlaStateText state={state} />
      </div>
      <p className="text-xs text-muted-foreground">
        Due {when(due)}
        {doneAt ? ` · done ${when(doneAt)}` : ` · ${formatCountdown(due)}`}
      </p>
    </div>
  )
}

export function TicketDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: ticket, isLoading, error } = useTicket(id)
  const update = useUpdateTicket()
  const addUpdate = useAddTicketUpdate()
  const del = useDeleteTicket()

  const [composerKind, setComposerKind] = useState<"reply" | "note">("reply")
  const [composer, setComposer] = useState("")
  const [composerError, setComposerError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (error || !ticket) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/support" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to support
        </Link>
        <p className="text-sm text-muted-foreground">This ticket doesn't exist or was deleted.</p>
      </div>
    )
  }

  const isBug = ticket.kind === "bug"
  const sla = slaOf(ticket)
  const updates = ticket.support_ticket_updates

  async function patch(p: Parameters<typeof update.mutateAsync>[0]["patch"]) {
    setActionError(null)
    try {
      await update.mutateAsync({ ticket: ticket!, patch: p })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't update the ticket.")
    }
  }

  async function post(e: React.FormEvent) {
    e.preventDefault()
    setComposerError(null)
    try {
      await addUpdate.mutateAsync({ ticketId: ticket!.id, kind: composerKind, body: composer })
      setComposer("")
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : "Couldn't add it.")
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        to={isBug ? "/support?tab=bugs" : "/support"}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to {isBug ? "bugs" : "tickets"}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
            {isBug ? "Bug" : "Support ticket"} · {ticket.ticket_number}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">{ticket.subject}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {isBug && ticket.severity && (
              <span className="text-xs text-muted-foreground">Severity: {severityLabel(ticket.severity)}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isOpenStatus(ticket.status) ? (
            <Button disabled={update.isPending} onClick={() => patch({ status: "resolved" })}>
              Mark resolved
            </Button>
          ) : (
            <Button variant="outline" disabled={update.isPending} onClick={() => patch({ status: "open" })}>
              Reopen
            </Button>
          )}
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
          <Button variant="ghost" aria-label="Delete ticket" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </header>

      {actionError && <p className="text-sm text-status-error">{actionError}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <GlowCard tone={isBug ? "red" : "cyan"}>
            <h2 className="font-display text-base font-semibold">{isBug ? "What happens" : "What they asked"}</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm">
              {ticket.description || <span className="text-muted-foreground">No description.</span>}
            </p>
            {isBug && (
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Steps to reproduce</dt>
                  <dd className="whitespace-pre-wrap">{ticket.steps_to_reproduce || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Where</dt>
                  <dd>{ticket.environment || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Fixed in</dt>
                  <dd>{ticket.fixed_in || "—"}</dd>
                </div>
              </dl>
            )}
          </GlowCard>

          <GlowCard tone="violet">
            <h2 className="font-display text-base font-semibold">Thread</h2>
            {updates.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing yet. Log your reply to the client to stop the first-response clock.
              </p>
            ) : (
              <ol className="mt-4 flex flex-col gap-4">
                {updates.map((u) => (
                  <li key={u.id} className="flex gap-3 text-sm">
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                        u.kind === "reply" && "bg-brand-cyan/15 text-brand-cyan",
                        u.kind === "note" && "bg-status-warning/15 text-status-warning",
                        u.kind === "status_change" && "bg-white/5 text-muted-foreground",
                      )}
                    >
                      {u.kind === "reply" ? (
                        <MessageSquare className="size-3.5" />
                      ) : u.kind === "note" ? (
                        <StickyNote className="size-3.5" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-current" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {u.kind === "reply" ? "Reply to client" : u.kind === "note" ? "Internal note" : "Update"} ·{" "}
                        {when(u.created_at)}
                      </p>
                      <p className={cn("mt-0.5 whitespace-pre-wrap", u.kind === "status_change" && "text-muted-foreground")}>
                        {u.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <form onSubmit={post} className="mt-6 flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex gap-1 self-start rounded-[var(--radius-pill)] border border-border p-1">
                {(["reply", "note"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setComposerKind(k)}
                    className={cn(
                      "rounded-[var(--radius-pill)] px-3 py-1 text-xs transition-colors",
                      composerKind === k ? "bg-brand-cyan/15 text-brand-cyan" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {k === "reply" ? "Reply to client" : "Internal note"}
                  </button>
                ))}
              </div>
              <Textarea
                rows={3}
                aria-label={composerKind === "reply" ? "Reply to client" : "Internal note"}
                placeholder={
                  composerKind === "reply"
                    ? "What you told the client (you send it yourself, by WhatsApp, email or call)"
                    : "Only you see this"
                }
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
              />
              {composerError && <p className="text-sm text-status-error">{composerError}</p>}
              <Button type="submit" className="self-start" disabled={addUpdate.isPending}>
                {addUpdate.isPending ? "Saving…" : composerKind === "reply" ? "Log reply" : "Add note"}
              </Button>
            </form>
          </GlowCard>
        </div>

        <div className="flex flex-col gap-6">
          <GlowCard tone={sla.response === "breached" || sla.resolution === "breached" ? "red" : "green"}>
            <h2 className="font-display text-base font-semibold">SLA</h2>
            <div className="mt-4 flex flex-col gap-3">
              <SlaRow
                label="First response"
                due={ticket.first_response_due_at}
                doneAt={ticket.first_responded_at}
                state={sla.response}
              />
              <SlaRow label="Resolution" due={ticket.resolution_due_at} doneAt={ticket.resolved_at} state={sla.resolution} />
            </div>
          </GlowCard>

          <GlowCard tone="cyan">
            <h2 className="font-display text-base font-semibold">Details</h2>
            <div className="mt-4 flex flex-col gap-4 text-sm">
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select value={ticket.status} onValueChange={(v) => patch({ status: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{statusLabel(ticket.status)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Priority</Label>
                <Select value={ticket.priority} onValueChange={(v) => patch({ priority: v as Priority })}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{priorityLabel(ticket.priority)}</SelectValue>
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
              <dl className="flex flex-col gap-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Client</dt>
                  <dd>
                    {ticket.clients ? (
                      <Link className="text-brand-cyan hover:underline" to={`/nexus/${ticket.clients.id}`}>
                        {ticket.clients.practice_name}
                      </Link>
                    ) : (
                      "Internal"
                    )}
                  </dd>
                </div>
                {ticket.projects && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Project</dt>
                    <dd>
                      <Link className="text-brand-cyan hover:underline" to={`/delivery/${ticket.projects.id}`}>
                        {ticket.projects.name}
                      </Link>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Came in by</dt>
                  <dd>{channelLabel(ticket.channel)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Raised</dt>
                  <dd>{when(ticket.opened_at)}</dd>
                </div>
                {ticket.closed_at && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Closed</dt>
                    <dd>{when(ticket.closed_at)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </GlowCard>
        </div>
      </div>

      <EditTicketDialog open={editOpen} onOpenChange={setEditOpen} ticket={ticket} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete ${ticket.ticket_number}?`}
        description="The ticket and its whole thread are removed. Resolving or closing it keeps the history instead."
        confirmLabel="Delete"
        isSubmitting={del.isPending}
        onConfirm={() =>
          del.mutate(ticket.id, {
            onSuccess: () => navigate(isBug ? "/support?tab=bugs" : "/support"),
          })
        }
      />
    </div>
  )
}
