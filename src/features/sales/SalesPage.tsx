import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, LayoutGrid, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { PipelineBoard, type PipelineColumn } from "@/components/shared/PipelineBoard"
import { LeadCard } from "./LeadCard"
import { LeadListView } from "./LeadListView"
import { NewLeadDialog } from "./NewLeadDialog"
import { LostReasonDialog } from "./LostReasonDialog"
import { useLeads, useUpdateLeadStage, useMarkLost, useConvertLeadToClient } from "./hooks"

/** INFORMATION_ARCHITECTURE.md §4.1 — column order matches `leads.stage` exactly. */
const COLUMNS: PipelineColumn[] = [
  { id: "lead", label: "Lead" },
  { id: "contacted", label: "Contacted" },
  { id: "discovery_booked", label: "Discovery Booked" },
  { id: "proposal_sent", label: "Proposal Sent" },
  { id: "verbal_commit", label: "Verbal Commit" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
]

export function SalesPage() {
  const navigate = useNavigate()
  const { data: leads, isLoading, isError, error, refetch } = useLeads()
  const updateStage = useUpdateLeadStage()
  const markLost = useMarkLost()
  const convertToClient = useConvertLeadToClient()

  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [lostDialog, setLostDialog] = useState<{ leadId: string; fromStage: string } | null>(null)
  const [view, setView] = useState<"board" | "list">("board")

  function handleDrop(leadId: string, toColumnId: string) {
    const lead = leads?.find((l) => l.id === leadId)
    if (!lead) return

    if (toColumnId === "lost") {
      setLostDialog({ leadId, fromStage: lead.stage })
      return
    }

    if (toColumnId === "won") {
      convertToClient.mutate(leadId, {
        onSuccess: (clientId) => navigate(`/nexus/${clientId}`),
      })
      return
    }

    updateStage.mutate({ leadId, fromStage: lead.stage, toStage: toColumnId })
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (isError) {
    return (
      <div className="glass-card flex items-center justify-between gap-4">
        <p className="text-sm text-status-error">
          Couldn't load leads — {error instanceof Error ? error.message : "unknown error"}.
        </p>
        <Button size="sm" variant="ghost" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const items = (leads ?? []).map((lead) => ({ id: lead.id, columnId: lead.stage }))

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
            Sales
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            {view === "board" ? "Pipeline" : "Leads"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-[var(--radius-pill)] border border-border p-0.5">
            <button
              type="button"
              onClick={() => setView("board")}
              className={cn(
                "flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium transition-colors",
                view === "board" ? "bg-primary/10 text-foreground" : "text-muted-foreground",
              )}
            >
              <LayoutGrid className="size-3.5" />
              Board
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium transition-colors",
                view === "list" ? "bg-primary/10 text-foreground" : "text-muted-foreground",
              )}
            >
              <List className="size-3.5" />
              List
            </button>
          </div>
          <Button onClick={() => setNewLeadOpen(true)}>
            <Plus className="size-4" />
            New Lead
          </Button>
        </div>
      </header>

      {view === "board" ? (
        <PipelineBoard
          columns={COLUMNS}
          items={items}
          onDrop={handleDrop}
          renderCard={(item, isDragging) => {
            const lead = leads?.find((l) => l.id === item.id)
            if (!lead) return null
            return (
              <LeadCard
                id={lead.id}
                practiceName={lead.practice_name}
                specialtyName={(lead as { specialties?: { name: string } | null }).specialties?.name}
                isDragging={isDragging}
              />
            )
          }}
        />
      ) : (
        <LeadListView />
      )}

      <NewLeadDialog open={newLeadOpen} onOpenChange={setNewLeadOpen} />

      <LostReasonDialog
        open={!!lostDialog}
        onOpenChange={(open) => !open && setLostDialog(null)}
        isSubmitting={markLost.isPending}
        onConfirm={(category, detail) => {
          if (!lostDialog) return
          markLost.mutate(
            {
              leadId: lostDialog.leadId,
              fromStage: lostDialog.fromStage,
              lostReasonCategory: category,
              lostReasonDetail: detail,
            },
            { onSuccess: () => setLostDialog(null) },
          )
        }}
      />
    </div>
  )
}
