import { useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react"
import { Card } from "@/components/shared/Card"
import { ActivityTimeline } from "@/components/shared/ActivityTimeline"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
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
import { useLead, useDeleteLead } from "./hooks"

/** AI_ARCHITECTURE.md's "AI-Assist Architecture" — task_types valid for a lead. */
const AI_TASKS = [
  { value: "draft_outreach_email", label: "Draft outreach email" },
  { value: "summarize_call", label: "Summarize latest call" },
  { value: "suggest_next_action", label: "Suggest next action" },
]

/** INFORMATION_ARCHITECTURE.md §4.3. */
export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: lead, isLoading } = useLead(id)
  const deleteLead = useDeleteLead()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const [aiTaskType, setAiTaskType] = useState(AI_TASKS[0].value)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!lead) return <p className="text-sm text-muted-foreground">Lead not found.</p>

  const specialtyName = (lead as { specialties?: { name: string } | null }).specialties?.name

  async function handleGenerate() {
    setAiLoading(true)
    setAiError(null)
    setAiResult(null)
    const { data, error } = await supabase.functions.invoke("ai-assist", {
      body: { task_type: aiTaskType, entity_type: "lead", entity_id: lead!.id },
    })
    setAiLoading(false)
    if (error) {
      setAiError(await getFunctionErrorMessage(error, "Draft failed, try again."))
      return
    }
    if (data?.error) {
      setAiError(data.error)
      return
    }
    setAiResult(data?.text ?? "")
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        to="/sales"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Pipeline
      </Link>

      <header className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
            {lead.stage.replace(/_/g, " ")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            {lead.practice_name}
          </h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
          <Trash2 className="size-4 text-status-error" />
          Delete
        </Button>
      </header>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          setConfirmDeleteOpen(open)
          if (!open) deleteLead.reset()
        }}
        title="Delete this lead?"
        description={`"${lead.practice_name}" will be removed from the pipeline. This is a soft delete, not permanent.`}
        confirmLabel="Delete"
        isSubmitting={deleteLead.isPending}
        errorMessage={deleteLead.error?.message}
        onConfirm={() => {
          deleteLead.mutate(lead.id, { onSuccess: () => navigate("/sales") })
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <h2 className="font-display text-base font-semibold">Activity</h2>
            <div className="mt-4">
              <ActivityTimeline entityType="lead" entityId={lead.id} />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="font-display text-base font-semibold">Profile</h2>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Contact</dt>
                <dd>{lead.contact_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd>{lead.contact_email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd>{lead.contact_phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Specialty</dt>
                <dd>{specialtyName || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Source</dt>
                <dd>{lead.source || "—"}</dd>
              </div>
              {lead.stage === "lost" && (
                <div>
                  <dt className="text-xs text-muted-foreground">Lost reason</dt>
                  <dd className="capitalize">
                    {lead.lost_reason_category?.replace(/_/g, " ")}
                    {lead.lost_reason_detail && ` — ${lead.lost_reason_detail}`}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-cyan" />
              <h2 className="font-display text-base font-semibold">AI Assist</h2>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Select
                value={aiTaskType}
                onValueChange={(v) => {
                  setAiTaskType(v)
                  setAiResult(null)
                  setAiError(null)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {AI_TASKS.find((t) => t.value === aiTaskType)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {AI_TASKS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleGenerate} disabled={aiLoading}>
                {aiLoading ? "Generating…" : "Generate"}
              </Button>
              {aiError && <p className="text-xs text-status-error">{aiError}</p>}
              {aiResult && (
                <div className="flex flex-col gap-2">
                  <Textarea readOnly rows={8} value={aiResult} className="text-xs" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigator.clipboard.writeText(aiResult)}
                  >
                    Copy
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
