import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import type { TablesInsert } from "@/types/database"

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*, specialties(name)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ["leads", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*, specialties(name)")
        .eq("id", id!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (lead: TablesInsert<"leads">) => {
      const { data, error } = await supabase.from("leads").insert(lead).select().single()
      if (error) throw error
      await logAudit({
        action: "lead.created",
        entityType: "lead",
        entityId: data.id,
        metadata: { practice_name: data.practice_name },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    },
  })
}

/** Simple stage moves only — not `lost` (needs a reason) or `won` (needs the
 * atomic conversion RPC). Writes the activities row in the same mutation, per
 * DATABASE_SCHEMA.md's "moving a card writes an activities row" rule. */
export function useUpdateLeadStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      leadId,
      fromStage,
      toStage,
    }: {
      leadId: string
      fromStage: string
      toStage: string
    }) => {
      const { error: updateError } = await supabase
        .from("leads")
        .update({ stage: toStage })
        .eq("id", leadId)
      if (updateError) throw updateError

      const { error: activityError } = await supabase.from("activities").insert({
        entity_type: "lead",
        entity_id: leadId,
        type: "stage_change",
        metadata: { from_stage: fromStage, to_stage: toStage },
      })
      if (activityError) throw activityError

      await logAudit({
        action: "lead.stage_changed",
        entityType: "lead",
        entityId: leadId,
        metadata: { from_stage: fromStage, to_stage: toStage },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["activities", "lead"] })
    },
  })
}

export function useMarkLost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      leadId,
      fromStage,
      lostReasonCategory,
      lostReasonDetail,
    }: {
      leadId: string
      fromStage: string
      lostReasonCategory: string
      lostReasonDetail?: string
    }) => {
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          stage: "lost",
          lost_reason_category: lostReasonCategory,
          lost_reason_detail: lostReasonDetail ?? null,
        })
        .eq("id", leadId)
      if (updateError) throw updateError

      const { error: activityError } = await supabase.from("activities").insert({
        entity_type: "lead",
        entity_id: leadId,
        type: "stage_change",
        metadata: { from_stage: fromStage, to_stage: "lost", reason: lostReasonCategory },
      })
      if (activityError) throw activityError

      await logAudit({
        action: "lead.stage_changed",
        entityType: "lead",
        entityId: leadId,
        metadata: { from_stage: fromStage, to_stage: "lost", reason: lostReasonCategory },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    },
  })
}

/** Soft delete — sets deleted_at (DATABASE_SCHEMA.md conventions), never a hard
 * DELETE. useLeads/useLead already filter on `deleted_at is null`, so a
 * soft-deleted lead simply stops appearing anywhere in the app.
 *
 * A lead that already converted to a client is blocked at the database level
 * (the `trg_prevent_delete_converted_lead` trigger) rather than trusted to
 * every call site to check first — the client's history traces back to this
 * lead via `source_lead_id`, and deleting it would orphan that link. The
 * trigger's error message is written to be shown to the user as-is. */
export function useDeleteLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { error } = await supabase
        .from("leads")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", leadId)
      if (error) throw error
      await logAudit({ action: "lead.deleted", entityType: "lead", entityId: leadId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
    },
  })
}

/** Atomic: lead → client + 5 onboarding steps + activity log, per the
 * `convert_lead_to_client` Postgres function. */
export function useConvertLeadToClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase.rpc("convert_lead_to_client", {
        p_lead_id: leadId,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] })
      queryClient.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}
