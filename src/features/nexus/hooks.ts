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
          supabase.from("clients").select("*, specialties(name)").eq("id", id!).single(),
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

export function useSnoozeFollowUp(clientId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (followUpId: string) => {
      const { error } = await supabase
        .from("follow_ups")
        .update({ status: "snoozed" })
        .eq("id", followUpId)
      if (error) throw error
      await logAudit({
        action: "client.follow_up_snoozed",
        entityType: "client",
        entityId: clientId,
        metadata: { follow_up_id: followUpId },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followUps", clientId] })
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

/** Completing a follow-up writes a matching call/email activity — that's what
 * actually feeds `client_contact_status`, not a direct field update
 * (DATABASE_SCHEMA.md / PRD.md §5.5). Sequential client-side writes; lower
 * stakes than the Won conversion, no atomicity concern worth an RPC for. */
export function useCompleteFollowUp(clientId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      followUpId,
      contactType,
      note,
    }: {
      followUpId: string
      contactType: "call" | "email"
      note: string
    }) => {
      const { error: followUpError } = await supabase
        .from("follow_ups")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", followUpId)
      if (followUpError) throw followUpError

      const { error: activityError } = await supabase.from("activities").insert({
        entity_type: "client",
        entity_id: clientId!,
        type: contactType,
        content: note,
      })
      if (activityError) throw activityError

      await logAudit({
        action: "client.follow_up_completed",
        entityType: "client",
        entityId: clientId,
        metadata: { follow_up_id: followUpId, contact_type: contactType },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followUps", clientId] })
      queryClient.invalidateQueries({ queryKey: ["activities", "client", clientId] })
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}
