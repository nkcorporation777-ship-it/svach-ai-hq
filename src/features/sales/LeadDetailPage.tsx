import { useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Sparkles, Trash2 } from "lucide-react"
import { Card } from "@/components/shared/Card"
import { ActivityTimeline } from "@/components/shared/ActivityTimeline"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { useLead, useDeleteLead } from "./hooks"

/** INFORMATION_ARCHITECTURE.md §4.3. */
export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: lead, isLoading } = useLead(id)
  const deleteLead = useDeleteLead()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!lead) return <p className="text-sm text-muted-foreground">Lead not found.</p>

  const specialtyName = (lead as { specialties?: { name: string } | null }).specialties?.name

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
            <p className="mt-2 text-sm text-muted-foreground">
              Coming once an AI provider is connected (AI_ARCHITECTURE.md — no
              provider chosen yet).
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
