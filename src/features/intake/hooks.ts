import { useMutation } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"

/** Public form — anon key only, no session. Errors from client-intake (invalid
 * token, already submitted) come back as FunctionsHttpError; see
 * src/lib/functionsError.ts for why error.message alone isn't the real message. */
export function useSubmitIntake() {
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("client-intake", {
        body: payload,
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
  })
}
