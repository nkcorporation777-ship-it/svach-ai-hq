import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

/** Shared lookup — used by both Sales (leads) and Nexus (clients). */
export function useSpecialties() {
  return useQuery({
    queryKey: ["specialties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("specialties")
        .select("id, name, slug")
        .order("name")
      if (error) throw error
      return data
    },
  })
}
