import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

/** Lookup table, no admin UI in V1 (DATABASE_SCHEMA.md `knowledge_categories`). */
export function useKnowledgeCategories() {
  return useQuery({
    queryKey: ["knowledgeCategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_categories")
        .select("id, name, slug")
        .order("name")
      if (error) throw error
      return data
    },
  })
}
