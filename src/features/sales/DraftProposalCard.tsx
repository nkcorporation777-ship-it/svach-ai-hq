import { useState } from "react"
import { FileText } from "lucide-react"
import { Card } from "@/components/shared/Card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase/client"
import { getFunctionErrorMessage } from "@/lib/functionsError"
import { useCreateActivity } from "@/hooks/useActivities"
import { usePricingTiers } from "@/features/settings/hooks"
import { useProposals, useSendProposal } from "./hooks"
import type { Tables } from "@/types/database"

type PricingPath = "tier" | "hourly"

/** Dedicated proposal-drafting section, separate from the generic "AI Assist"
 * card — a proposal needs several inputs at once (transcript, website,
 * pricing path, price) before it can generate anything, unlike the
 * one-input AI-assist tasks. See docs/plan: "Proposal drafting: dedicated
 * section on the lead." */
export function DraftProposalCard({ lead }: { lead: Tables<"leads"> }) {
  const { data: tiers } = usePricingTiers()
  const { data: proposals } = useProposals(lead.id)
  const createActivity = useCreateActivity("lead", lead.id)
  const sendProposal = useSendProposal()

  const [transcript, setTranscript] = useState("")
  const [website, setWebsite] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [pricingPath, setPricingPath] = useState<PricingPath>(
    lead.source === "Upwork" ? "hourly" : "tier",
  )
  const [finalizedPrice, setFinalizedPrice] = useState("")
  const [preferredTier, setPreferredTier] = useState<string>("")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const [confirmedPrice, setConfirmedPrice] = useState("")
  const [sendToEmail, setSendToEmail] = useState(lead.contact_email ?? "")
  const [sendError, setSendError] = useState<string | null>(null)

  const latestProposal = proposals?.[0]

  const canGenerate = pricingPath === "tier" || finalizedPrice.trim() !== ""

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    setResult(null)
    const { data, error: fnError } = await supabase.functions.invoke("ai-assist", {
      body: {
        task_type: "draft_proposal",
        entity_type: "lead",
        entity_id: lead.id,
        transcript,
        website,
        projectDescription,
        pricingPath,
        finalizedPrice: pricingPath === "hourly" ? Number(finalizedPrice) : null,
        preferredTier: pricingPath === "tier" && preferredTier ? preferredTier : null,
      },
    })
    setLoading(false)
    if (fnError) {
      setError(await getFunctionErrorMessage(fnError, "Draft failed, try again."))
      return
    }
    if (data?.error) {
      setError(data.error)
      return
    }
    const text = data?.text ?? ""
    setResult(text)
    setConfirmedPrice(pricingPath === "hourly" ? finalizedPrice : "")
    setSendError(null)
    createActivity.mutate({ type: "ai_draft", content: "Drafted proposal" })
  }

  function handleSendToClient() {
    if (!result) return
    setSendError(null)
    const price = Number(confirmedPrice)
    if (!confirmedPrice.trim() || Number.isNaN(price)) {
      setSendError("Enter the confirmed price before sending.")
      return
    }
    if (!sendToEmail.trim()) {
      setSendError("Enter the client's email before sending.")
      return
    }
    sendProposal.mutate(
      { leadId: lead.id, content: result, pricingPath, price, toEmail: sendToEmail.trim() },
      { onError: async (err) => setSendError(await getFunctionErrorMessage(err, "Send failed, try again.")) },
    )
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <FileText className="size-4 text-brand-cyan" />
        <h2 className="font-display text-base font-semibold">Draft Proposal</h2>
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Discovery call transcript</label>
          <Textarea
            rows={4}
            placeholder="Paste the Fathom transcript or call notes…"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            className="mt-1 text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Website</label>
          <Input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Project description</label>
          <Textarea
            rows={3}
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            className="mt-1 text-xs"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Pricing path</label>
          <Select
            value={pricingPath}
            onValueChange={(v) => setPricingPath(v as PricingPath)}
          >
            <SelectTrigger className="mt-1 w-full">
              <SelectValue>
                {pricingPath === "hourly" ? "Hourly" : "Fixed tier package"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tier">Fixed tier package</SelectItem>
              <SelectItem value="hourly">Hourly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {pricingPath === "hourly" ? (
          <div>
            <label className="text-xs text-muted-foreground">Finalized price (required)</label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min={0}
                className="no-spinner pl-6"
                value={finalizedPrice}
                onChange={(e) => setFinalizedPrice(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-xs text-muted-foreground">Preferred tier</label>
            <Select
              value={preferredTier || "ai-recommend"}
              onValueChange={(v) => setPreferredTier(v === "ai-recommend" ? "" : v)}
            >
              <SelectTrigger className="mt-1 w-full">
                <SelectValue>
                  {preferredTier
                    ? tiers?.find((t) => t.id === preferredTier)?.name
                    : "Let AI recommend"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai-recommend">Let AI recommend</SelectItem>
                {tiers?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button size="sm" onClick={handleGenerate} disabled={loading || !canGenerate}>
          {loading ? "Generating…" : "Generate"}
        </Button>
        {error && <p className="text-xs text-status-error">{error}</p>}
        {result && (
          <div className="flex flex-col gap-2">
            <Textarea
              rows={14}
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="text-xs"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigator.clipboard.writeText(result)}
            >
              Copy
            </Button>

            <div className="mt-2 flex flex-col gap-3 border-t border-border pt-3">
              <div>
                <label className="text-xs text-muted-foreground">Confirmed price</label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    min={0}
                    className="no-spinner pl-6"
                    value={confirmedPrice}
                    onChange={(e) => setConfirmedPrice(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Send to</label>
                <Input
                  type="email"
                  className="mt-1"
                  value={sendToEmail}
                  onChange={(e) => setSendToEmail(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={handleSendToClient} disabled={sendProposal.isPending}>
                {sendProposal.isPending ? "Sending…" : "Send to Client"}
              </Button>
              {sendError && <p className="text-xs text-status-error">{sendError}</p>}
              {sendProposal.isSuccess && (
                <p className="text-xs text-brand-cyan">Sent — awaiting signature.</p>
              )}
            </div>
          </div>
        )}

        {latestProposal && (
          <p className="text-xs text-muted-foreground">
            {latestProposal.status === "accepted"
              ? `Signed by ${latestProposal.signer_name} on ${new Date(latestProposal.signed_at!).toLocaleDateString()}`
              : latestProposal.status === "sent"
                ? `Sent to ${latestProposal.sent_to_email} on ${new Date(latestProposal.sent_at).toLocaleDateString()} — awaiting signature`
                : `Superseded — sent to ${latestProposal.sent_to_email} on ${new Date(latestProposal.sent_at).toLocaleDateString()}`}
          </p>
        )}
      </div>
    </Card>
  )
}
