import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"

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

/** Atomic conditional update — `.eq("status", "pending")` is the same race-guard
 * AI_ARCHITECTURE.md's ooa-execute-action Edge Function would perform via a
 * re-check-then-write; doing it as one conditional UPDATE gets the same
 * atomicity without needing that Edge Function to exist yet. If another tab
 * already resolved it, this affects 0 rows — surfaced as "Already resolved,"
 * not a silent no-op. */
export function useApproveRecommendation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from("ooa_recommendations")
        .update({
          status: "approved",
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
        action: "ooa_recommendation.approved",
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
