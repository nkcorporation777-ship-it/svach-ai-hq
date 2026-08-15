import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowUpDown, Trash2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { useLeads, useDeleteLead } from "./hooks"

type LeadRow = NonNullable<ReturnType<typeof useLeads>["data"]>[number]
type SortKey = "practice_name" | "stage" | "source" | "updated_at"

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  contacted: "Contacted",
  discovery_booked: "Discovery Booked",
  proposal_sent: "Proposal Sent",
  verbal_commit: "Verbal Commit",
  won: "Won",
  lost: "Lost",
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "practice_name", label: "Practice" },
  { key: "stage", label: "Stage" },
  { key: "source", label: "Source" },
  { key: "updated_at", label: "Last activity" },
]

/**
 * INFORMATION_ARCHITECTURE.md §4.2 — sortable/filterable alternative to the
 * pipeline board. Plain client-side sort, not TanStack Table: the installed
 * version (v9) replaced the familiar `useReactTable`/`getCoreRowModel` API
 * with a new composable "features" system (`useTable`, `stockFeatures`, ...);
 * integrating that properly deserves its own pass rather than guessing at an
 * unfamiliar breaking API under this task. This table's actual need — sort by
 * one column at a time — doesn't require the library either way.
 */
export function LeadListView() {
  const { data: leads, isLoading, isError, error, refetch } = useLeads()
  const deleteLead = useDeleteLead()
  const [sortKey, setSortKey] = useState<SortKey>("updated_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [deleteTarget, setDeleteTarget] = useState<LeadRow | null>(null)

  const sorted = useMemo(() => {
    if (!leads) return []
    const copy = [...leads]
    copy.sort((a, b) => {
      const av = (a[sortKey] ?? "") as string
      const bv = (b[sortKey] ?? "") as string
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === "asc" ? cmp : -cmp
    })
    return copy
  }, [leads, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>

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

  if (!leads || leads.length === 0) {
    return (
      <div className="glass-card">
        <p className="text-sm text-muted-foreground">No leads yet.</p>
      </div>
    )
  }

  return (
    <>
      <div className="glass-card overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown
                      className={`size-3 ${sortKey === col.key ? "text-brand-azure" : "text-muted-foreground"}`}
                    />
                  </div>
                </TableHead>
              ))}
              <TableHead>Specialty</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell>
                  <Link
                    to={`/sales/${lead.id}`}
                    className="font-medium text-foreground hover:text-brand-azure"
                  >
                    {lead.practice_name}
                  </Link>
                </TableCell>
                <TableCell>{STAGE_LABELS[lead.stage] ?? lead.stage}</TableCell>
                <TableCell className="text-muted-foreground">{lead.source ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(lead.updated_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {(lead as { specialties?: { name: string } | null }).specialties?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(lead)}
                    aria-label={`Delete ${lead.practice_name}`}
                  >
                    <Trash2 className="size-4 text-status-error" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            deleteLead.reset()
          }
        }}
        title="Delete this lead?"
        description={`"${deleteTarget?.practice_name}" will be removed from the pipeline. This is a soft delete, not permanent.`}
        confirmLabel="Delete"
        isSubmitting={deleteLead.isPending}
        errorMessage={deleteLead.error?.message}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteLead.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }}
      />
    </>
  )
}
