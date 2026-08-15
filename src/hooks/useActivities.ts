import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import type { TablesInsert } from "@/types/database"

type EntityType = "lead" | "client"

/**
 * Shared, polymorphic activity timeline (DATABASE_SCHEMA.md `activities`) — used
 * by both Sales (leads) and Nexus (clients), one table, not two near-identical
 * ones.
 */
export function useActivities(entityType: EntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: ["activities", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!entityId,
  })
}

export function useCreateActivity(entityType: EntityType, entityId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (activity: Omit<TablesInsert<"activities">, "entity_type" | "entity_id">) => {
      const { error } = await supabase.from("activities").insert({
        ...activity,
        entity_type: entityType,
        entity_id: entityId!,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities", entityType, entityId] })
      if (entityType === "client") {
        queryClient.invalidateQueries({ queryKey: ["clientContactStatus"] })
      }
    },
  })
}
