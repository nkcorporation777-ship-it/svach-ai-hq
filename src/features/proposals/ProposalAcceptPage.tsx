import { useState } from "react"
import { useParams } from "react-router-dom"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useProposalByToken, useSignProposal } from "./hooks"

/** Public, unauthenticated proposal review + e-signature page — the client
 * is not an HQ user, so auth is the unguessable token in the URL, checked
 * server-side by proposal-get / proposal-accept. Same spirit as
 * src/features/intake/IntakePage.tsx. */
export function ProposalAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const { data: proposal, isLoading, isError, error } = useProposalByToken(token)
  const signProposal = useSignProposal()

  const [signerName, setSignerName] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [signError, setSignError] = useState<string | null>(null)

  function handleSign() {
    if (!token) return
    setSignError(null)
    if (!signerName.trim()) {
      setSignError("Please type your full legal name.")
      return
    }
    if (!agreed) {
      setSignError("Please confirm you've reviewed and accept this proposal.")
      return
    }
    signProposal.mutate(
      { token, signerName: signerName.trim() },
      { onError: (err) => setSignError(err instanceof Error ? err.message : "Something went wrong.") },
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (isError || !proposal) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-2xl font-semibold">This link isn't valid</h1>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Please check the link or contact us for a new one."}
        </p>
      </div>
    )
  }

  const signedSuccessfully = signProposal.isSuccess || proposal.status === "accepted"

  if (signedSuccessfully) {
    const signerLabel = signProposal.isSuccess ? signerName.trim() : proposal.signer_name
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Thanks — you're all set.</h1>
        <p className="text-sm text-muted-foreground">
          Signed by {signerLabel}. We'll be in touch shortly with next steps.
        </p>
      </div>
    )
  }

  if (proposal.status === "superseded") {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-2xl font-semibold">This proposal is no longer active</h1>
        <p className="text-sm text-muted-foreground">
          A newer version has been sent, or please contact us for the current one.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
          Proposal
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">{proposal.practice_name}</h1>
      </header>

      <div className="whitespace-pre-wrap rounded-lg border border-border p-4 text-sm">
        {proposal.content}
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="signer_name">Type your full legal name to sign</Label>
          <Input
            id="signer_name"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>I have reviewed and accept the terms of this proposal.</span>
        </label>
        <Button onClick={handleSign} disabled={signProposal.isPending}>
          {signProposal.isPending ? "Signing…" : "Accept & Sign"}
        </Button>
        {signError && <p className="text-xs text-status-error">{signError}</p>}
      </div>
    </div>
  )
}
