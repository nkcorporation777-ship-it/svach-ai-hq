import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import { getFunctionErrorMessage } from "@/lib/functionsError"

export function useSystemHealthEvents() {
  return useQuery({
    queryKey: ["systemHealthEvents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ooa_system_health_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    },
  })
}

export function useOoaRecommendations() {
  return useQuery({
    queryKey: ["ooaRecommendations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ooa_recommendations")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAgentActivity() {
  return useQuery({
    queryKey: ["agentActivity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    },
  })
}

/** AI_ARCHITECTURE.md's Branch A fast path — ooa-execute-action re-checks the
 * recommendation is still pending (same atomic-claim race-guard this hook used
 * to do client-side), executes whatever `suggested_action` names, and writes
 * both audit_logs rows itself. This is the first recommendation type with a
 * real action behind it (the PHI-gated onboarding email); approving anything
 * without an implemented action_type comes back as a clean 400, not a crash. */
export function useApproveRecommendation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("ooa-execute-action", {
        body: { id },
      })
      if (error) throw new Error(await getFunctionErrorMessage(error, "Failed to approve."))
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ooaRecommendations"] })
      queryClient.invalidateQueries({ queryKey: ["agentActivity"] })
    },
  })
}

export function useDismissRecommendation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from("ooa_recommendations")
        .update({
          status: "dismissed",
          resolved_by: user?.id ?? null,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("status", "pending")
        .select()

      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error("Already resolved — someone else acted on this first.")
      }

      await logAudit({
        action: "ooa_recommendation.dismissed",
        entityType: "ooa_recommendation",
        entityId: id,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ooaRecommendations"] })
      queryClient.invalidateQueries({ queryKey: ["agentActivity"] })
    },
  })
}
