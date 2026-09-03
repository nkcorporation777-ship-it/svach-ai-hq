import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, Sparkles, Plus, Pencil } from "lucide-react"
import { Card } from "@/components/shared/Card"
import { ActivityTimeline } from "@/components/shared/ActivityTimeline"
import { HealthFlagBadge } from "@/components/shared/HealthFlagBadge"
import { SequentialChecklistItem } from "@/components/shared/SequentialChecklistItem"
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
import { formatCurrency } from "@/lib/format"
import {
  useClient,
  useOnboardingSteps,
  useCompleteOnboardingStep,
  useIntakeSubmission,
  useFollowUps,
  useCompleteFollowUp,
  useRescheduleFollowUp,
  useUpdateClientValue,
} from "./hooks"
import { CompleteFollowUpDialog } from "./CompleteFollowUpDialog"
import { NewFollowUpDialog } from "./NewFollowUpDialog"
import { RescheduleFollowUpDialog } from "./RescheduleFollowUpDialog"

/** AI_ARCHITECTURE.md's "AI-Assist Architecture" — task_types valid for a client. */
const AI_TASKS = [
  { value: "draft_follow_up", label: "Draft follow-up message" },
  { value: "summarize_activity", label: "Summarize recent activity" },
]

/** INFORMATION_ARCHITECTURE.md §5.2 + §5.3 (Follow-up Queue, client-scoped). */
export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: client, isLoading } = useClient(id)
  const { data: steps } = useOnboardingSteps(id)
  const completeStep = useCompleteOnboardingStep(id)
  const { data: intake } = useIntakeSubmission(id)
  const { data: followUps } = useFollowUps(id)
  const completeFollowUp = useCompleteFollowUp(id)
  const rescheduleFollowUp = useRescheduleFollowUp(id)
  const updateValue = useUpdateClientValue(id)

  const [completingFollowUpId, setCompletingFollowUpId] = useState<string | null>(null)
  const [reschedulingFollowUpId, setReschedulingFollowUpId] = useState<string | null>(null)
  const [newFollowUpOpen, setNewFollowUpOpen] = useState(false)
  const [editingValue, setEditingValue] = useState(false)
  const [valueDraft, setValueDraft] = useState("")

  const [aiTaskType, setAiTaskType] = useState(AI_TASKS[0].value)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!client) return <p className="text-sm text-muted-foreground">Client not found.</p>

  const specialtyName = (client as { specialties?: { name: string } | null }).specialties?.name
  const leadAddedAt = (client as { leads?: { created_at: string } | null }).leads?.created_at

  async function handleGenerate() {
    setAiLoading(true)
    setAiError(null)
    setAiResult(null)
    const { data, error } = await supabase.functions.invoke("ai-assist", {
      body: { task_type: aiTaskType, entity_type: "client", entity_id: client!.id },
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
        to="/nexus"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Clients
      </Link>

      <header className="flex items-center gap-3">
        <h1 className="font-display text-3xl font-semibold">{client.practice_name}</h1>
        <HealthFlagBadge isFlagged={client.isFlagged} lastContactedAt={client.lastContactedAt} />
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <h2 className="font-display text-base font-semibold">Onboarding</h2>
            <div className="mt-4 flex flex-col gap-2">
              {steps?.map((step, i) => {
                const isLocked = steps.slice(0, i).some((s) => !s.is_complete)
                return (
                  <SequentialChecklistItem
                    key={step.id}
                    stepName={step.step_name}
                    isComplete={step.is_complete}
                    isLocked={isLocked}
                    onComplete={() => completeStep.mutate(step.id)}
                  />
                )
              })}
            </div>
          </Card>

          {intake && (
            <Card>
              <h2 className="font-display text-base font-semibold">Intake Details</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Submitted {new Date(intake.submitted_at).toLocaleString()} via the client intake form.
              </p>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Legal name</dt>
                  <dd>{intake.legal_name}{intake.dba && ` (dba ${intake.dba})`}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Location</dt>
                  <dd>{intake.location}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Services</dt>
                  <dd>{intake.services}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Hours</dt>
                  <dd>{intake.hours || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Website</dt>
                  <dd>{intake.website_urls || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">CRM</dt>
                  <dd>{intake.uses_crm ? intake.crm_name || "Yes (unnamed)" : "None"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Database / backend</dt>
                  <dd>{intake.uses_database ? intake.database_name || "Yes (unnamed)" : "None"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Hosting</dt>
                  <dd>{intake.hosting_provider || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">DNS manager</dt>
                  <dd>{intake.dns_manager || "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Other software</dt>
                  <dd>{intake.other_software || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Billing contact</dt>
                  <dd>
                    {intake.billing_contact_name || "—"}
                    {intake.billing_contact_email && ` (${intake.billing_contact_email})`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">PHI</dt>
                  <dd className={intake.has_phi ? "font-medium text-status-warning" : ""}>
                    {intake.has_phi ? "Yes — access request held for review" : "No"}
                  </dd>
                </div>
              </dl>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Follow-up Queue</h2>
              <Button size="sm" variant="ghost" onClick={() => setNewFollowUpOpen(true)}>
                <Plus className="size-4" />
                New
              </Button>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {!followUps || followUps.length === 0 ? (
                <p className="text-sm text-muted-foreground">No follow-ups.</p>
              ) : (
                followUps.map((fu) => {
                  const overdue = fu.status === "pending" && new Date(fu.due_at) < new Date()
                  return (
                    <div
                      key={fu.id}
                      className="flex items-center justify-between rounded-[var(--radius-pill)] border border-border px-3 py-2.5"
                    >
                      <div>
                        <p
                          className={
                            overdue ? "text-sm font-medium text-status-warning" : "text-sm"
                          }
                        >
                          {new Date(fu.due_at).toLocaleString()}
                          {overdue && " — overdue"}
                        </p>
                        {fu.note && <p className="text-xs text-muted-foreground">{fu.note}</p>}
                        {fu.outcome_notes && (
                          <p className="text-xs text-muted-foreground">Outcome: {fu.outcome_notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground capitalize">{fu.status}</p>
                      </div>
                      {fu.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setReschedulingFollowUpId(fu.id)}
                          >
                            Reschedule
                          </Button>
                          <Button size="sm" onClick={() => setCompletingFollowUpId(fu.id)}>
                            Complete
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-base font-semibold">Activity</h2>
            <div className="mt-4">
              <ActivityTimeline entityType="client" entityId={client.id} />
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="font-display text-base font-semibold">Profile</h2>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Contact</dt>
                <dd>{client.primary_contact_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd>{client.primary_contact_email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd>{client.primary_contact_phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Specialty</dt>
                <dd>{specialtyName || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Value</dt>
                {editingValue ? (
                  <div className="mt-1 flex items-center gap-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={valueDraft}
                        onChange={(e) => setValueDraft(e.target.value)}
                        className="no-spinner h-8 pl-6"
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={updateValue.isPending}
                      onClick={() => {
                        const parsed = valueDraft === "" ? null : Number(valueDraft)
                        updateValue.mutate(parsed, { onSuccess: () => setEditingValue(false) })
                      }}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingValue(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <dd className="flex items-center gap-2">
                    {formatCurrency(client.value)}
                    <button
                      type="button"
                      onClick={() => {
                        setValueDraft(client.value != null ? String(client.value) : "")
                        setEditingValue(true)
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Lead added</dt>
                <dd>{leadAddedAt ? new Date(leadAddedAt).toLocaleDateString() : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Onboarded</dt>
                <dd>{new Date(client.created_at).toLocaleDateString()}</dd>
              </div>
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

      <CompleteFollowUpDialog
        open={!!completingFollowUpId}
        onOpenChange={(open) => !open && setCompletingFollowUpId(null)}
        isSubmitting={completeFollowUp.isPending}
        onConfirm={(contactType, outcomeNotes, nextDueAt, nextNote) => {
          if (!completingFollowUpId) return
          completeFollowUp.mutate(
            { followUpId: completingFollowUpId, contactType, outcomeNotes, nextDueAt, nextNote },
            { onSuccess: () => setCompletingFollowUpId(null) },
          )
        }}
      />

      <RescheduleFollowUpDialog
        open={!!reschedulingFollowUpId}
        onOpenChange={(open) => !open && setReschedulingFollowUpId(null)}
        isSubmitting={rescheduleFollowUp.isPending}
        onConfirm={(dueAt) => {
          if (!reschedulingFollowUpId) return
          rescheduleFollowUp.mutate(
            { followUpId: reschedulingFollowUpId, dueAt },
            { onSuccess: () => setReschedulingFollowUpId(null) },
          )
        }}
      />

      {id && (
        <NewFollowUpDialog clientId={id} open={newFollowUpOpen} onOpenChange={setNewFollowUpOpen} />
      )}
    </div>
  )
}
