import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Plus } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "./FinanceBits"
import { InvoiceDialog } from "./InvoiceDialog"
import { STATUS_LABEL, displayStatus, formatMoney, useInvoices, type DisplayStatus } from "./hooks"

type Filter = "all" | DisplayStatus

export function InvoicesTab() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data: invoices, isLoading } = useInvoices()
  const [filter, setFilter] = useState<Filter>("all")
  const [newOpen, setNewOpen] = useState(false)
  // Arriving from a client's "Deposit received" step: open their deposit invoice, prefilled.
  const depositFor = params.get("deposit_for") ?? undefined
  useEffect(() => {
    if (depositFor) setNewOpen(true)
  }, [depositFor])

  function onDialogChange(open: boolean) {
    setNewOpen(open)
    if (!open && depositFor) {
      const next = new URLSearchParams(params)
      next.delete("deposit_for")
      setParams(next, { replace: true })
    }
  }

  const rows = (invoices ?? []).filter((i) => filter === "all" || displayStatus(i) === filter)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-48">
            <SelectValue>{filter === "all" ? "All invoices" : STATUS_LABEL[filter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All invoices</SelectItem>
            {(Object.keys(STATUS_LABEL) as DisplayStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="size-4" />
          New invoice
        </Button>
      </div>

      <GlowCard tone="cyan" className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {invoices?.length ? "No invoices match that filter." : "No invoices yet. Create the first one."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Bill to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Issued</TableHead>
                <TableHead className="hidden md:table-cell">Due</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inv) => (
                <TableRow
                  key={inv.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/finance/invoices/${inv.id}`)}
                >
                  <TableCell className="whitespace-nowrap font-mono text-xs">{inv.invoice_number}</TableCell>
                  <TableCell>{inv.bill_to_name}</TableCell>
                  <TableCell>
                    <StatusBadge invoice={inv} />
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap md:table-cell">{inv.issue_date}</TableCell>
                  <TableCell className="hidden whitespace-nowrap md:table-cell">{inv.due_date}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{formatMoney(inv.total, inv.currency)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {inv.status === "void" || inv.status === "draft"
                      ? "—"
                      : formatMoney(Number(inv.total) - Number(inv.amount_paid), inv.currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlowCard>

      <InvoiceDialog open={newOpen} onOpenChange={onDialogChange} depositForClientId={depositFor} />
    </div>
  )
}
