import { useMutation, useQuery } from "@tanstack/react-query"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export interface ProposalPortalData {
  practice_name: string
  content: string
  status: "sent" | "accepted" | "superseded"
  price: number
  gst_percent: number | null
  deposit_percent: number
  signer_name: string | null
  signed_at: string | null
}

/** Public, token-authenticated read — proposal-get is GET-with-query-param,
 * which supabase.functions.invoke() doesn't cleanly support, so this uses a
 * plain fetch (same anon key the supabase client uses) rather than the
 * FunctionsHttpError wrapper every other call site goes through. */
export function useProposalByToken(token: string | undefined) {
  return useQuery({
    queryKey: ["proposal-portal", token],
    queryFn: async (): Promise<ProposalPortalData> => {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/proposal-get?token=${encodeURIComponent(token!)}`,
        { headers: { apikey: supabaseAnonKey } },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "This link is invalid.")
      return data as ProposalPortalData
    },
    enabled: !!token,
    retry: false,
  })
}

export function useSignProposal() {
  return useMutation({
    mutationFn: async ({ token, signerName }: { token: string; signerName: string }) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/proposal-accept`, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: supabaseAnonKey },
        body: JSON.stringify({ token, signer_name: signerName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Something went wrong — please try again.")
      return data as { accepted: true }
    },
  })
}
