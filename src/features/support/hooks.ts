import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import type { Tables } from "@/types/database"

// ── Shared vocabulary ───────────────────────────────────────────────────────

export type TicketKind = "ticket" | "bug"

export const PRIORITIES = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
] as const
export type Priority = (typeof PRIORITIES)[number]["value"]

export const TICKET_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting_on_client", label: "Waiting on client" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]["value"]

export const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "meeting", label: "Meeting" },
  { value: "voice_agent", label: "Voice agent" },
  { value: "other", label: "Other" },
] as const

export const SEVERITIES = [
  { value: "critical", label: "Critical" },
  { value: "major", label: "Major" },
  { value: "minor", label: "Minor" },
  { value: "cosmetic", label: "Cosmetic" },
] as const

const labelIn = (list: readonly { value: string; label: string }[]) => (v: string | null | undefined) =>
  list.find((x) => x.value === v)?.label ?? v ?? "—"
export const priorityLabel = labelIn(PRIORITIES)
export const statusLabel = labelIn(TICKET_STATUSES)
export const channelLabel = labelIn(CHANNELS)
export const severityLabel = labelIn(SEVERITIES)

export const isOpenStatus = (s: string) => s !== "resolved" && s !== "closed"

export type Ticket = Tables<"support_tickets"> & {
  clients: { id: string; practice_name: string } | null
  projects: { id: string; name: string } | null
}

// ── SLA ─────────────────────────────────────────────────────────────────────

/** on_track → at_risk (last quarter of the window) → breached; met once done in time. */
export type SlaState = "on_track" | "at_risk" | "breached" | "met"

function clockState(opened: string, due: string | null, doneAt: string | null, now: number): SlaState | null {
  if (!due) return null
  const dueMs = new Date(due).getTime()
  if (doneAt) return new Date(doneAt).getTime() <= dueMs ? "met" : "breached"
  if (now > dueMs) return "breached"
  const window = dueMs - new Date(opened).getTime()
  return dueMs - now <= window / 4 ? "at_risk" : "on_track"
}

/** SLA clocks run in calendar hours from opened_at and don't pause while
 * waiting on the client (v1 — see docs/ROADMAP.md Phase 4). */
export function slaOf(t: Tables<"support_tickets">, now = Date.now()) {
  return {
    response: clockState(t.opened_at, t.first_response_due_at, t.first_responded_at, now),
    resolution: clockState(t.opened_at, t.resolution_due_at, t.resolved_at, now),
  }
}

/** The clock that matters now: response until answered, then resolution. */
export function nextDeadline(t: Tables<"support_tickets">) {
  if (!isOpenStatus(t.status)) return null
  if (!t.first_responded_at) return { label: "First response", due: t.first_response_due_at }
  return { label: "Resolution", due: t.resolution_due_at }
}

/** "in 3h 20m" / "2d 4h overdue" */
export function formatCountdown(due: string | null, now = Date.now()) {
  if (!due) return "—"
  const diff = new Date(due).getTime() - now
  const abs = Math.abs(diff)
  const d = Math.floor(abs / 86_400_000)
  const h = Math.floor((abs % 86_400_000) / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  const span = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
  return diff >= 0 ? `in ${span}` : `${span} overdue`
}

// ── Lookups ─────────────────────────────────────────────────────────────────

export function useSupportClients() {
  return useQuery({
    queryKey: ["support", "clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, practice_name")
        .is("deleted_at", null)
        .order("practice_name")
      if (error) throw error
      return data
    },
  })
}

export function useSupportProjects() {
  return useQuery({
    queryKey: ["support", "projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, client_id")
        .is("deleted_at", null)
        .order("name")
      if (error) throw error
      return data
    },
  })
}

// ── Tickets ─────────────────────────────────────────────────────────────────

const TICKET_SELECT = "*, clients(id, practice_name), projects(id, name)"

export function useTickets(clientId?: string) {
  return useQuery({
    queryKey: ["support", "tickets", clientId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("support_tickets").select(TICKET_SELECT).order("opened_at", { ascending: false })
      if (clientId) q = q.eq("client_id", clientId)
      const { data, error } = await q
      if (error) throw error
      return data as Ticket[]
    },
    // SLA countdowns move with the clock.
    refetchInterval: 60_000,
  })
}

export function useTicket(id: string | undefined) {
  return useQuery({
    queryKey: ["support", "ticket", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`${TICKET_SELECT}, support_ticket_updates(*)`)
        .eq("id", id!)
        .order("created_at", { referencedTable: "support_ticket_updates", ascending: true })
        .single()
      if (error) throw error
      return data as Ticket & { support_ticket_updates: Tables<"support_ticket_updates">[] }
    },
    enabled: !!id,
  })
}

export interface CreateTicketInput {
  kind: TicketKind
  clientId: string | null
  projectId: string | null
  subject: string
  description: string
  channel: string
  priority: Priority
  openedAt: string
  severity: string | null
  stepsToReproduce: string
  environment: string
}

export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      if (!input.subject.trim()) throw new Error("Add a subject.")
      const { data: user } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          kind: input.kind,
          client_id: input.clientId,
          project_id: input.projectId,
          subject: input.subject.trim(),
          description: input.description.trim() || null,
          channel: input.channel,
          priority: input.priority,
          opened_at: input.openedAt,
          severity: input.kind === "bug" ? input.severity : null,
          steps_to_reproduce: input.kind === "bug" ? input.stepsToReproduce.trim() || null : null,
          environment: input.kind === "bug" ? input.environment.trim() || null : null,
          created_by: user.user?.id ?? null,
        })
        .select("id, ticket_number")
        .single()
      if (error) throw error
      if (input.clientId) {
        await supabase.from("activities").insert({
          entity_type: "client",
          entity_id: input.clientId,
          type: "note",
          content: `${input.kind === "bug" ? "Bug" : "Support ticket"} ${data.ticket_number} logged: ${input.subject.trim()}`,
          created_by: user.user?.id ?? null,
          metadata: { source: "support", ticket_id: data.id },
        })
      }
      await logAudit({
        action: input.kind === "bug" ? "support.bug_logged" : "support.ticket_created",
        entityType: "support_ticket",
        entityId: data.id,
        metadata: { ticket_number: data.ticket_number, priority: input.priority },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support"] })
      queryClient.invalidateQueries({ queryKey: ["activities"] })
    },
  })
}

export type TicketPatch = Partial<
  Pick<
    Tables<"support_tickets">,
    | "status"
    | "priority"
    | "subject"
    | "description"
    | "client_id"
    | "project_id"
    | "severity"
    | "steps_to_reproduce"
    | "environment"
    | "fixed_in"
  >
>

/** Edits a ticket. Status and priority changes are also written to the
 * ticket's thread so its history reads end to end. */
export function useUpdateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticket, patch }: { ticket: Ticket; patch: TicketPatch }) => {
      const { error } = await supabase.from("support_tickets").update(patch).eq("id", ticket.id)
      if (error) throw error
      const { data: user } = await supabase.auth.getUser()
      const changes: string[] = []
      if (patch.status && patch.status !== ticket.status) {
        changes.push(`Status: ${statusLabel(ticket.status)} → ${statusLabel(patch.status)}`)
      }
      if (patch.priority && patch.priority !== ticket.priority) {
        changes.push(`Priority: ${priorityLabel(ticket.priority)} → ${priorityLabel(patch.priority)} (SLA re-timed)`)
      }
      if (changes.length) {
        await supabase.from("support_ticket_updates").insert(
          changes.map((body) => ({ ticket_id: ticket.id, kind: "status_change", body, created_by: user.user?.id ?? null })),
        )
      }
      if (patch.status === "resolved" && ticket.client_id && isOpenStatus(ticket.status)) {
        await supabase.from("activities").insert({
          entity_type: "client",
          entity_id: ticket.client_id,
          type: "note",
          content: `${ticket.ticket_number} resolved: ${ticket.subject}`,
          created_by: user.user?.id ?? null,
          metadata: { source: "support", ticket_id: ticket.id },
        })
      }
      await logAudit({
        action: patch.status && patch.status !== ticket.status ? `support.ticket_${patch.status}` : "support.ticket_updated",
        entityType: "support_ticket",
        entityId: ticket.id,
        metadata: patch,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support"] })
      queryClient.invalidateQueries({ queryKey: ["activities"] })
    },
  })
}

/** A reply (what you told the client — stops the first-response clock) or an internal note. */
export function useAddTicketUpdate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, kind, body }: { ticketId: string; kind: "reply" | "note"; body: string }) => {
      if (!body.trim()) throw new Error("Write something first.")
      const { data: user } = await supabase.auth.getUser()
      const { error } = await supabase
        .from("support_ticket_updates")
        .insert({ ticket_id: ticketId, kind, body: body.trim(), created_by: user.user?.id ?? null })
      if (error) throw error
      await logAudit({ action: `support.${kind}_added`, entityType: "support_ticket", entityId: ticketId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support"] })
    },
  })
}

export function useDeleteTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("support_tickets").delete().eq("id", id)
      if (error) throw error
      await logAudit({ action: "support.ticket_deleted", entityType: "support_ticket", entityId: id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support"] })
    },
  })
}

// ── SLA targets (edited in Settings) ────────────────────────────────────────

export function useSlaTargets() {
  return useQuery({
    queryKey: ["support", "sla-targets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("support_sla_targets").select("*").order("order_index")
      if (error) throw error
      return data
    },
  })
}

export function useUpdateSlaTargets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      targets: { priority: string; firstResponseHours: number; resolutionHours: number }[],
    ) => {
      for (const t of targets) {
        if (!(t.firstResponseHours > 0) || !(t.resolutionHours > 0)) {
          throw new Error(`${priorityLabel(t.priority)}: both targets must be more than 0 hours.`)
        }
        if (t.resolutionHours < t.firstResponseHours) {
          throw new Error(`${priorityLabel(t.priority)}: resolution can't be sooner than the first response.`)
        }
      }
      for (const t of targets) {
        const { error } = await supabase
          .from("support_sla_targets")
          .update({
            first_response_hours: t.firstResponseHours,
            resolution_hours: t.resolutionHours,
            updated_at: new Date().toISOString(),
          })
          .eq("priority", t.priority)
        if (error) throw error
      }
      await logAudit({ action: "settings.sla_targets_updated", entityType: "support_sla_targets" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support"] })
    },
  })
}
