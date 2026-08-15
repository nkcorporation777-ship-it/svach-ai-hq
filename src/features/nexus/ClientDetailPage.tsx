import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft, Sparkles, Plus } from "lucide-react"
import { Card } from "@/components/shared/Card"
import { ActivityTimeline } from "@/components/shared/ActivityTimeline"
import { HealthFlagBadge } from "@/components/shared/HealthFlagBadge"
import { SequentialChecklistItem } from "@/components/shared/SequentialChecklistItem"
import { Button } from "@/components/ui/button"
import {
  useClient,
  useOnboardingSteps,
  useCompleteOnboardingStep,
  useFollowUps,
  useCompleteFollowUp,
  useSnoozeFollowUp,
} from "./hooks"
import { CompleteFollowUpDialog } from "./CompleteFollowUpDialog"
import { NewFollowUpDialog } from "./NewFollowUpDialog"

/** INFORMATION_ARCHITECTURE.md §5.2 + §5.3 (Follow-up Queue, client-scoped). */
export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: client, isLoading } = useClient(id)
  const { data: steps } = useOnboardingSteps(id)
  const completeStep = useCompleteOnboardingStep(id)
  const { data: followUps } = useFollowUps(id)
  const completeFollowUp = useCompleteFollowUp(id)
  const snoozeFollowUp = useSnoozeFollowUp(id)

  const [completingFollowUpId, setCompletingFollowUpId] = useState<string | null>(null)
  const [newFollowUpOpen, setNewFollowUpOpen] = useState(false)

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!client) return <p className="text-sm text-muted-foreground">Client not found.</p>

  const specialtyName = (client as { specialties?: { name: string } | null }).specialties?.name

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
                        <p className="text-xs text-muted-foreground capitalize">{fu.status}</p>
                      </div>
                      {fu.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => snoozeFollowUp.mutate(fu.id)}>
                            Snooze
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
            </dl>
          </Card>

          <Card>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-brand-cyan" />
              <h2 className="font-display text-base font-semibold">AI Assist</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Coming once an AI provider is connected (AI_ARCHITECTURE.md — no
              provider chosen yet).
            </p>
          </Card>
        </div>
      </div>

      <CompleteFollowUpDialog
        open={!!completingFollowUpId}
        onOpenChange={(open) => !open && setCompletingFollowUpId(null)}
        isSubmitting={completeFollowUp.isPending}
        onConfirm={(contactType, note) => {
          if (!completingFollowUpId) return
          completeFollowUp.mutate(
            { followUpId: completingFollowUpId, contactType, note },
            { onSuccess: () => setCompletingFollowUpId(null) },
          )
        }}
      />

      {id && (
        <NewFollowUpDialog clientId={id} open={newFollowUpOpen} onOpenChange={setNewFollowUpOpen} />
      )}
    </div>
  )
}
