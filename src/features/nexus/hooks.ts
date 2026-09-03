import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"

/**
 * Clients joined with `client_contact_status` client-side — the view has no
 * declared FK to `clients` for PostgREST to auto-embed, so two queries merged
 * by id rather than a single embedded select.
 */
export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const [{ data: clients, error: clientsError }, { data: status, error: statusError }] =
        await Promise.all([
          supabase
            .from("clients")
            .select("*, specialties(name)")
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase.from("client_contact_status").select("*"),
        ])
      if (clientsError) throw clientsError
      if (statusError) throw statusError

      const statusMap = new Map(status?.map((s) => [s.client_id, s]))
      return (clients ?? []).map((c) => ({
        ...c,
        isFlagged: statusMap.get(c.id)?.is_flagged ?? false,
        lastContactedAt: statusMap.get(c.id)?.last_contacted_at ?? null,
      }))
    },
  })
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ["clients", id],
    queryFn: async () => {
      const [{ data: client, error: clientError }, { data: status, error: statusError }] =
        await Promise.all([
          supabase
            .from("clients")
            .select("*, specialties(name), leads(created_at)")
            .eq("id", id!)
            .single(),
          supabase.from("client_contact_status").select("*").eq("client_id", id!).maybeSingle(),
        ])
      if (clientError) throw clientError
      if (statusError) throw statusError
      return {
        ...client,
        isFlagged: status?.is_flagged ?? false,
        lastContactedAt: status?.last_contacted_at ?? null,
      }
    },
    enabled: !!id,
  })
}

export function useOnboardingSteps(clientId: string | undefined) {
  return useQuery({
    queryKey: ["onboardingSteps", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_onboarding_steps")
        .select("*")
        .eq("client_id", clientId!)
        .order("order_index")
      if (error) throw error
      return data
    },
    enabled: !!clientId,
  })
}

/** Sequential gate enforced by the caller (UI) — step N+1 can't be completed
 * before step N (DATABASE_SCHEMA.md `client_onboarding_steps`). */
export function useCompleteOnboardingStep(clientId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase
        .from("client_onboarding_steps")
        .update({ is_complete: true, completed_at: new Date().toISOString() })
        .eq("id", stepId)
      if (error) throw error
      await logAudit({
        action: "client.onboarding_step_completed",
        entityType: "client",
        entityId: clientId,
        metadata: { step_id: stepId },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboardingSteps", clientId] })
    },
  })
}

export function useIntakeSubmission(clientId: string | undefined) {
  return useQuery({
    queryKey: ["intakeSubmission", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_intake_submissions")
        .select("*")
        .eq("client_id", clientId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!clientId,
  })
}

export function useFollowUps(clientId: string | undefined) {
  return useQuery({
    queryKey: ["followUps", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_ups")
        .select("*")
        .eq("client_id", clientId!)
        .order("due_at")
      if (error) throw error
      return data
    },
    enabled: !!clientId,
  })
}

/** Cross-client Follow-up Queue (INFORMATION_ARCHITECTURE.md §5.3) — powers the
 * Nexus panel and the Dashboard banner. Pending only; done follow-ups have
 * nothing actionable left to show here. */
export function useAllFollowUps() {
  return useQuery({
    queryKey: ["followUps", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_ups")
        .select("*, clients!inner(practice_name)")
        .eq("status", "pending")
        .is("clients.deleted_at", null)
        .order("due_at")
      if (error) throw error
      return data
    },
  })
}

/** Reschedule replaces the old one-way "snooze" (which set status: 'snoozed'
 * with no way back to an actionable date) — this just moves due_at forward,
 * staying status: 'pending' so it's still visible and actionable. */
export function useRescheduleFollowUp(clientId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ followUpId, dueAt }: { followUpId: string; dueAt: string }) => {
      const { error } = await supabase
        .from("follow_ups")
        .update({ due_at: dueAt })
        .eq("id", followUpId)
      if (error) throw error
      await logAudit({
        action: "client.follow_up_rescheduled",
        entityType: "client",
        entityId: clientId,
        metadata: { follow_up_id: followUpId, due_at: dueAt },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followUps"] })
    },
  })
}

/** The client's deal value carries over from its source lead at conversion
 * (convert_lead_to_client), then is independently editable from here on. */
export function useUpdateClientValue(clientId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (value: number | null) => {
      const { error } = await supabase.from("clients").update({ value }).eq("id", clientId!)
      if (error) throw error
      await logAudit({
        action: "client.value_updated",
        entityType: "client",
        entityId: clientId,
        metadata: { value },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", clientId] })
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}

export function useCreateFollowUp(clientId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ dueAt, note }: { dueAt: string; note?: string }) => {
      const { data, error } = await supabase
        .from("follow_ups")
        .insert({
          client_id: clientId!,
          due_at: dueAt,
          note: note ?? null,
        })
        .select()
        .single()
      if (error) throw error
      await logAudit({
        action: "client.follow_up_created",
        entityType: "client",
        entityId: clientId,
        metadata: { follow_up_id: data.id, due_at: dueAt },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followUps", clientId] })
    },
  })
}

export type FollowUpContactType = "call" | "email" | "meeting" | "whatsapp"

/** Completing a follow-up writes a matching activity — that's what actually
 * feeds `client_contact_status`, not a direct field update (DATABASE_SCHEMA.md
 * / PRD.md §5.5). `outcome_notes` records what was actually discussed
 * (transcript, notes, a link — e.g. Fathom), separate from the follow-up's
 * original `note` (why it was scheduled). Optionally chains straight into the
 * next follow-up so completing and scheduling the next one is one action, not
 * two. Sequential client-side writes; lower stakes than the Won conversion, no
 * atomicity concern worth an RPC for. */
export function useCompleteFollowUp(clientId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      followUpId,
      contactType,
      outcomeNotes,
      nextDueAt,
      nextNote,
    }: {
      followUpId: string
      contactType: FollowUpContactType
      outcomeNotes: string
      nextDueAt?: string
      nextNote?: string
    }) => {
      const { error: followUpError } = await supabase
        .from("follow_ups")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
          outcome_notes: outcomeNotes || null,
        })
        .eq("id", followUpId)
      if (followUpError) throw followUpError

      const { error: activityError } = await supabase.from("activities").insert({
        entity_type: "client",
        entity_id: clientId!,
        type: contactType,
        content: outcomeNotes,
      })
      if (activityError) throw activityError

      await logAudit({
        action: "client.follow_up_completed",
        entityType: "client",
        entityId: clientId,
        metadata: { follow_up_id: followUpId, contact_type: contactType },
      })

      if (nextDueAt) {
        const { data: nextFollowUp, error: nextError } = await supabase
          .from("follow_ups")
          .insert({ client_id: clientId!, due_at: nextDueAt, note: nextNote || null })
          .select()
          .single()
        if (nextError) throw nextError
        await logAudit({
          action: "client.follow_up_created",
          entityType: "client",
          entityId: clientId,
          metadata: { follow_up_id: nextFollowUp.id, due_at: nextDueAt },
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followUps"] })
      queryClient.invalidateQueries({ queryKey: ["activities", "client", clientId] })
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}
