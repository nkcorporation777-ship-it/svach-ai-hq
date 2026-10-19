import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import type { TablesUpdate } from "@/types/database"
import { useDemoMode } from "./demoMode"

export type Audience = "internal" | "demo" | "client_patients"

export const AUDIENCE_LABEL: Record<Audience, string> = {
  internal: "Svach AI (our own calls)",
  demo: "Demo",
  client_patients: "Client's patients",
}

export interface CallFilters {
  agentId?: string
  outcome?: "all" | "successful" | "unsuccessful"
}

const CALL_SELECT =
  "*, voice_agents(id, name, audience), leads(id, practice_name), clients(id, practice_name)"

export function useVoiceAgents() {
  const demo = useDemoMode()
  return useQuery({
    queryKey: ["voice", "agents", demo],
    queryFn: async () => {
      let q = supabase.from("voice_agents").select("*, clients(id, practice_name)").order("name")
      q = demo ? q.eq("audience", "demo") : q.neq("audience", "demo")
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useVoiceCalls(filters: CallFilters = {}) {
  const demo = useDemoMode()
  return useQuery({
    queryKey: ["voice", "calls", demo, filters],
    queryFn: async () => {
      let q = supabase
        .from("voice_calls")
        .select(CALL_SELECT)
        .eq("is_demo", demo)
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(200)
      if (filters.agentId) q = q.eq("agent_id", filters.agentId)
      if (filters.outcome === "successful") q = q.eq("call_successful", true)
      if (filters.outcome === "unsuccessful") q = q.eq("call_successful", false)
      const { data, error } = await q
      if (error) throw error
      return data
    },
  })
}

export function useVoiceCall(id: string | undefined) {
  return useQuery({
    queryKey: ["voice", "call", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_calls")
        .select(CALL_SELECT)
        .eq("id", id!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

/** Per-day totals from the voice_usage_daily view, summed client-side. */
export function useVoiceUsage(days: number) {
  const demo = useDemoMode()
  return useQuery({
    queryKey: ["voice", "usage", demo, days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from("voice_usage_daily")
        .select("*")
        .eq("is_demo", demo)
        .gte("day", since)
        .order("day")
      if (error) throw error

      const byDay = new Map<string, { day: string; calls: number; minutes: number; costCents: number; successful: number }>()
      for (const r of data ?? []) {
        if (!r.day) continue
        const d = byDay.get(r.day) ?? { day: r.day, calls: 0, minutes: 0, costCents: 0, successful: 0 }
        d.calls += Number(r.calls ?? 0)
        d.minutes += Number(r.minutes ?? 0)
        d.costCents += Number(r.cost_cents ?? 0)
        d.successful += Number(r.successful_calls ?? 0)
        byDay.set(r.day, d)
      }
      const daily = [...byDay.values()]
      const totals = daily.reduce(
        (acc, d) => ({
          calls: acc.calls + d.calls,
          minutes: acc.minutes + d.minutes,
          costCents: acc.costCents + d.costCents,
          successful: acc.successful + d.successful,
        }),
        { calls: 0, minutes: 0, costCents: 0, successful: 0 },
      )
      return { daily, totals }
    },
  })
}

/** When the last call arrived and the last Retell sync ran — drives the
 * connection status line (never exposes the API key). */
export function useVoiceStatus() {
  return useQuery({
    queryKey: ["voice", "status"],
    queryFn: async () => {
      const [{ data: call }, { data: agent }] = await Promise.all([
        supabase
          .from("voice_calls")
          .select("updated_at")
          .eq("is_demo", false)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("voice_agents")
          .select("synced_at")
          .not("synced_at", "is", null)
          .order("synced_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      return { lastCallAt: call?.updated_at ?? null, lastSyncAt: agent?.synced_at ?? null }
    },
  })
}

export function useClientsLite() {
  return useQuery({
    queryKey: ["voice", "clients-lite"],
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

function invalidateVoice(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["voice"] })
  queryClient.invalidateQueries({ queryKey: ["leads"] })
  queryClient.invalidateQueries({ queryKey: ["activities"] })
}

export function useSyncRetell() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("retell-sync", { body: { days: 30 } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as {
        agentsSynced: number
        callsSynced: number
        transcriptsFetched: number
        failed: number
      }
    },
    onSuccess: () => invalidateVoice(queryClient),
  })
}

export function useUpdateVoiceAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      audience,
      clientId,
    }: {
      id: string
      audience?: Audience
      clientId?: string | null
    }) => {
      const patch: { audience?: Audience; client_id?: string | null } = {}
      if (audience !== undefined) patch.audience = audience
      if (clientId !== undefined) patch.client_id = clientId
      const { error } = await supabase.from("voice_agents").update(patch).eq("id", id)
      if (error) throw error
      await logAudit({ action: "voice.agent_updated", entityType: "voice_agent", entityId: id, metadata: patch })
    },
    onSuccess: () => invalidateVoice(queryClient),
  })
}

export function useDemoData() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (action: "seed" | "reset") => {
      const { data, error } = await supabase.functions.invoke("voice-demo", { body: { action } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as Record<string, unknown>
    },
    onSuccess: () => invalidateVoice(queryClient),
  })
}

// ── Campaigns (outbound "Call now") ─────────────────────────────────────────

export type CampaignKey = "speed_to_lead" | "proposal_follow_up" | "client_check_in" | "appointment_call"

export const CAMPAIGN_BLURB: Record<CampaignKey, string> = {
  speed_to_lead: "New leads with a phone number nobody has called yet.",
  proposal_follow_up: "Leads whose proposal has sat unsigned for 3+ days.",
  client_check_in: "Clients flagged as overdue for contact.",
  appointment_call: "Appointments in the next 24 hours, or recent ones that never happened.",
}

export function useCampaigns() {
  return useQuery({
    queryKey: ["voice", "campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("voice_campaigns").select("*, voice_agents(id, name)").order("key")
      if (error) throw error
      return data
    },
  })
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      key,
      patch,
    }: {
      key: CampaignKey
      patch: {
        enabled?: boolean
        agent_id?: string | null
        from_number?: string | null
        daily_cap?: number
      }
    }) => {
      const { error } = await supabase
        .from("voice_campaigns")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("key", key)
      if (error) throw error
      await logAudit({ action: "voice.campaign_updated", entityType: "voice_campaign", metadata: { key, ...patch } })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["voice", "campaigns"] }),
  })
}

export interface Candidate {
  key: string
  entityType: "lead" | "client"
  entityId: string
  name: string
  practice: string
  phone: string | null
  reason: string
  appointmentId?: string
}

/** Who each campaign would call right now (demo-aware). */
export function useCampaignCandidates(campaign: CampaignKey) {
  const demo = useDemoMode()
  return useQuery({
    queryKey: ["voice", "candidates", campaign, demo],
    queryFn: async (): Promise<Candidate[]> => {
      const demoFilter = <T extends { filter: (c: string, o: string, v: string) => T; or: (f: string) => T }>(q: T) =>
        demo ? q.filter("metadata->>is_demo", "eq", "true") : q.or("metadata->>is_demo.is.null,metadata->>is_demo.neq.true")

      if (campaign === "speed_to_lead") {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: leads, error } = await demoFilter(
          supabase
            .from("leads")
            .select("id, practice_name, contact_name, contact_phone")
            .eq("stage", "lead")
            .is("deleted_at", null)
            .eq("voice_opt_out", false)
            .not("contact_phone", "is", null)
            .gte("created_at", since),
        ).limit(30)
        if (error) throw error
        const ids = (leads ?? []).map((l) => l.id)
        const touched = new Set<string>()
        if (ids.length) {
          const [{ data: calls }, { data: reqs }] = await Promise.all([
            supabase.from("voice_calls").select("lead_id").in("lead_id", ids),
            supabase.from("voice_call_requests").select("lead_id").eq("campaign_key", campaign).in("lead_id", ids),
          ])
          for (const r of [...(calls ?? []), ...(reqs ?? [])]) if (r.lead_id) touched.add(r.lead_id)
        }
        return (leads ?? [])
          .filter((l) => !touched.has(l.id))
          .map((l) => ({
            key: l.id,
            entityType: "lead" as const,
            entityId: l.id,
            name: l.contact_name ?? "—",
            practice: l.practice_name,
            phone: l.contact_phone,
            reason: "New lead, not called yet",
          }))
      }

      if (campaign === "proposal_follow_up") {
        const { data: leads, error } = await demoFilter(
          supabase
            .from("leads")
            .select("id, practice_name, contact_name, contact_phone, proposals(sent_at, status)")
            .eq("stage", "proposal_sent")
            .is("deleted_at", null)
            .eq("voice_opt_out", false)
            .not("contact_phone", "is", null),
        ).limit(30)
        if (error) throw error
        const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000
        return (leads ?? []).flatMap((l) => {
          const sent = (l.proposals ?? []).filter((p) => p.status === "sent").map((p) => new Date(p.sent_at).getTime())
          if (sent.length === 0 || Math.max(...sent) > cutoff) return []
          const days = Math.round((Date.now() - Math.max(...sent)) / (24 * 60 * 60 * 1000))
          return [
            {
              key: l.id,
              entityType: "lead" as const,
              entityId: l.id,
              name: l.contact_name ?? "—",
              practice: l.practice_name,
              phone: l.contact_phone,
              reason: `Proposal unsigned for ${days} days`,
            },
          ]
        })
      }

      if (campaign === "client_check_in") {
        const { data: flagged, error } = await supabase.from("client_contact_status").select("client_id").eq("is_flagged", true)
        if (error) throw error
        const ids = (flagged ?? []).map((f) => f.client_id).filter((id): id is string => !!id)
        if (ids.length === 0) return []
        const { data: clients, error: clientsError } = await demoFilter(
          supabase
            .from("clients")
            .select("id, practice_name, primary_contact_name, primary_contact_phone")
            .in("id", ids)
            .is("deleted_at", null)
            .eq("voice_opt_out", false)
            .not("primary_contact_phone", "is", null),
        )
        if (clientsError) throw clientsError
        return (clients ?? []).map((c) => ({
          key: c.id,
          entityType: "client" as const,
          entityId: c.id,
          name: c.primary_contact_name ?? "—",
          practice: c.practice_name,
          phone: c.primary_contact_phone,
          reason: "No contact for 14+ days",
        }))
      }

      // appointment_call
      const { data: appts, error } = await supabase
        .from("appointments")
        .select(
          "id, starts_at, attendee_name, attendee_phone, lead_id, client_id, leads(id, practice_name, contact_phone, voice_opt_out), clients(id, practice_name, primary_contact_phone, voice_opt_out)",
        )
        .eq("status", "scheduled")
        .eq("is_demo", demo)
        .gte("starts_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
        .lte("starts_at", new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())
      if (error) throw error
      return (appts ?? []).flatMap((a) => {
        const lead = (a as { leads?: { id: string; practice_name: string; contact_phone: string | null; voice_opt_out: boolean } | null }).leads
        const client = (a as { clients?: { id: string; practice_name: string; primary_contact_phone: string | null; voice_opt_out: boolean } | null }).clients
        const entity = client ?? lead
        if (!entity || entity.voice_opt_out) return []
        const phone = a.attendee_phone ?? (client ? client.primary_contact_phone : lead?.contact_phone) ?? null
        if (!phone) return []
        const past = new Date(a.starts_at).getTime() < Date.now() - 15 * 60 * 1000
        return [
          {
            key: a.id,
            entityType: client ? ("client" as const) : ("lead" as const),
            entityId: entity.id,
            name: a.attendee_name ?? "—",
            practice: entity.practice_name,
            phone,
            reason: past ? "Possible no-show" : `Reminder call · ${formatAppointmentWhen(a.starts_at, null)}`,
            appointmentId: a.id,
          },
        ]
      })
    },
  })
}

/** "Call now": a real Retell dial-out, or — in demo mode — a simulated call. */
export function useCallNow() {
  const queryClient = useQueryClient()
  const demo = useDemoMode()
  return useMutation({
    mutationFn: async ({ campaign, candidate }: { campaign: CampaignKey; candidate: Candidate }) => {
      const ids =
        candidate.entityType === "client" ? { client_id: candidate.entityId } : { lead_id: candidate.entityId }
      const { data, error } = demo
        ? await supabase.functions.invoke("voice-demo", {
            body: { action: "simulate", scenario: "outbound", campaign, ...ids },
          })
        : await supabase.functions.invoke("voice-outbound", {
            body: { campaign, ...ids, ...(candidate.appointmentId ? { appointment_id: candidate.appointmentId } : {}) },
          })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as { requested?: boolean; started?: boolean }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice"] })
    },
  })
}

/** Demo only: play a fake inbound call that books an appointment. */
export function useSimulateInbound() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("voice-demo", {
        body: { action: "simulate", scenario: "inbound_booking" },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
  })
}

// ── Public demo link ────────────────────────────────────────────────────────

export function useDemoLink() {
  return useQuery({
    queryKey: ["voice", "demo-link"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_demo_links")
        .select("*, voice_agents(id, name)")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpsertDemoLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id?: string
      agentId?: string | null
      enabled?: boolean
      dailyCap?: number
      perIpDailyCap?: number
      rotate?: boolean
    }) => {
      const patch: TablesUpdate<"voice_demo_links"> = {}
      if (input.agentId !== undefined) patch.agent_id = input.agentId
      if (input.enabled !== undefined) patch.enabled = input.enabled
      if (input.dailyCap !== undefined) patch.daily_cap = input.dailyCap
      if (input.perIpDailyCap !== undefined) patch.per_ip_daily_cap = input.perIpDailyCap
      if (input.rotate) patch.token = crypto.randomUUID()
      const { error } = input.id
        ? await supabase.from("voice_demo_links").update(patch).eq("id", input.id)
        : await supabase.from("voice_demo_links").insert(patch)
      if (error) throw error
      // The link token is a credential — never write it to the audit log.
      const { token: _token, ...loggable } = patch
      await logAudit({ action: "voice.demo_link_updated", entityType: "voice_demo_link", entityId: input.id, metadata: loggable })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["voice", "demo-link"] }),
  })
}

// ── Web calls (talk to an agent from the browser) ───────────────────────────

export interface WebCallToken {
  access_token: string
  call_id?: string
  transport?: "livekit" | "gateway"
  url?: string
  ice_servers?: RTCIceServer[]
}

export async function requestWebCall(body: {
  agent_id: string
  lead_id?: string
  client_id?: string
}): Promise<WebCallToken> {
  const { data, error } = await supabase.functions.invoke("voice-web-call", { body })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as WebCallToken
}

// ── Call workflow timeline (Live Console + call detail) ─────────────────────

export function useCallWorkflow(callId: string | undefined) {
  return useQuery({
    queryKey: ["voice", "workflow", callId],
    queryFn: async () => {
      const [{ data: call, error }, { data: appts }] = await Promise.all([
        supabase.from("voice_calls").select(CALL_SELECT).eq("id", callId!).single(),
        supabase
          .from("appointments")
          .select("id, starts_at, timezone, status, appointment_reminders(id, kind, channel, status, send_at, error)")
          .eq("call_id", callId!),
      ])
      if (error) throw error
      let leadStage: string | null = null
      if (call.lead_id) {
        const { data: lead } = await supabase.from("leads").select("stage").eq("id", call.lead_id).maybeSingle()
        leadStage = lead?.stage ?? null
      }
      return { call, appointments: appts ?? [], leadStage }
    },
    enabled: !!callId,
    refetchInterval: (query) => (query.state.data?.call.call_status === "ongoing" ? 3000 : false),
  })
}

/** Newest calls first, refreshed as changes arrive from the database. */
export function useLiveCalls() {
  const demo = useDemoMode()
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel(`voice-live-${demo ? "demo" : "real"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "voice_calls" }, () => {
        queryClient.invalidateQueries({ queryKey: ["voice", "live"] })
        queryClient.invalidateQueries({ queryKey: ["voice", "workflow"] })
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () =>
        queryClient.invalidateQueries({ queryKey: ["voice", "workflow"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "appointment_reminders" }, () =>
        queryClient.invalidateQueries({ queryKey: ["voice", "workflow"] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [demo, queryClient])

  return useQuery({
    queryKey: ["voice", "live", demo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_calls")
        .select(CALL_SELECT)
        .eq("is_demo", demo)
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(8)
      if (error) throw error
      return data
    },
    refetchInterval: 15000,
  })
}

const APPOINTMENT_SELECT =
  "*, appointment_reminders(id, kind, channel, status, send_at, error), leads(id, practice_name), clients(id, practice_name)"

export function useAppointments() {
  const demo = useDemoMode()
  return useQuery({
    queryKey: ["voice", "appointments", demo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(APPOINTMENT_SELECT)
        .eq("is_demo", demo)
        .order("starts_at", { ascending: false })
        .limit(200)
      if (error) throw error
      return data
    },
  })
}

/** Appointments for one lead or client (shown on their detail page). */
export function useEntityAppointments(entityType: "lead" | "client", entityId: string | undefined) {
  return useQuery({
    queryKey: ["voice", "appointments", entityType, entityId],
    queryFn: async () => {
      const col = entityType === "lead" ? "lead_id" : "client_id"
      const { data, error } = await supabase
        .from("appointments")
        .select(APPOINTMENT_SELECT)
        .eq(col, entityId!)
        .order("starts_at", { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!entityId,
  })
}

export function formatAppointmentWhen(iso: string, tz: string | null) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz || undefined,
    }).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleString()
  }
}

export function formatMinutes(ms: number | null | undefined) {
  if (!ms) return "—"
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`
}

export function formatCents(cents: number | null | undefined) {
  if (cents == null) return "—"
  return `$${(Number(cents) / 100).toFixed(2)}`
}
