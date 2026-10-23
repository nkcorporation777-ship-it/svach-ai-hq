import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useBillingSettings } from "@/features/settings/hooks"
import {
  computeTotals,
  formatMoney,
  useBillableClients,
  useSaveInvoice,
  useSignedProposal,
  type DraftItem,
} from "./hooks"

const NO_CLIENT = "custom"

interface EditableInvoice {
  id: string
  client_id: string | null
  proposal_id: string | null
  kind: string
  bill_to_name: string
  bill_to_email: string | null
  bill_to_address: string | null
  bill_to_gstin: string | null
  issue_date: string
  due_date: string
  gst_percent: number
  notes: string | null
  invoice_items: { description: string; quantity: number; unit_price: number; order_index: number }[]
}

interface ItemField {
  description: string
  quantity: string
  unitPrice: string
}

const today = () => new Date().toISOString().slice(0, 10)
const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Create a draft invoice (optionally from a client's signed proposal) or edit an existing draft.
 * `depositForClientId` opens it as that client's deposit invoice, filled from their signed
 * proposal — used by the "Deposit received" onboarding step. */
export function InvoiceDialog({
  open,
  onOpenChange,
  invoice,
  depositForClientId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice?: EditableInvoice
  depositForClientId?: string
}) {
  const navigate = useNavigate()
  const { data: clients } = useBillableClients()
  const { data: billing } = useBillingSettings()
  const save = useSaveInvoice()

  const [clientId, setClientId] = useState(NO_CLIENT)
  const [kind, setKind] = useState<"standard" | "deposit">("standard")
  const [proposalId, setProposalId] = useState<string | null>(null)
  const [billToName, setBillToName] = useState("")
  const [billToEmail, setBillToEmail] = useState("")
  const [billToAddress, setBillToAddress] = useState("")
  const [billToGstin, setBillToGstin] = useState("")
  const [issueDate, setIssueDate] = useState(today())
  const [dueDate, setDueDate] = useState(addDays(today(), 7))
  const [gstPercent, setGstPercent] = useState("")
  const [notes, setNotes] = useState("")
  const [items, setItems] = useState<ItemField[]>([{ description: "", quantity: "1", unitPrice: "" }])
  const [error, setError] = useState<string | null>(null)

  const client = clients?.find((c) => c.id === clientId)
  const { data: proposal, isLoading: proposalLoading } = useSignedProposal(client?.source_lead_id)
  // Opened for a client's deposit: select them and apply the proposal's deposit once both have loaded.
  const depositPrefilled = useRef(false)
  const depositClient = depositForClientId ? clients?.find((c) => c.id === depositForClientId) : undefined

  // Load the form each time the dialog opens: the draft being edited, or fresh defaults.
  useEffect(() => {
    if (!open) return
    setError(null)
    if (invoice) {
      setClientId(invoice.client_id ?? NO_CLIENT)
      setKind(invoice.kind === "deposit" ? "deposit" : "standard")
      setProposalId(invoice.proposal_id)
      setBillToName(invoice.bill_to_name)
      setBillToEmail(invoice.bill_to_email ?? "")
      setBillToAddress(invoice.bill_to_address ?? "")
      setBillToGstin(invoice.bill_to_gstin ?? "")
      setIssueDate(invoice.issue_date)
      setDueDate(invoice.due_date)
      setGstPercent(String(invoice.gst_percent))
      setNotes(invoice.notes ?? "")
      setItems(
        [...invoice.invoice_items]
          .sort((a, b) => a.order_index - b.order_index)
          .map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: String(i.unit_price) })),
      )
    } else {
      setClientId(NO_CLIENT)
      setKind("standard")
      setProposalId(null)
      setBillToName("")
      setBillToEmail("")
      setBillToAddress("")
      setBillToGstin("")
      setIssueDate(today())
      setDueDate(addDays(today(), 7))
      setGstPercent(billing?.gst_percent != null ? String(billing.gst_percent) : "0")
      setNotes("")
      setItems([{ description: "", quantity: "1", unitPrice: "" }])
    }
    depositPrefilled.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id])

  useEffect(() => {
    if (!open || invoice || !depositClient || clientId === depositClient.id) return
    setClientId(depositClient.id)
    setKind("deposit")
    setBillToName(depositClient.practice_name)
    setBillToEmail(depositClient.primary_contact_email ?? "")
  }, [open, invoice, depositClient, clientId])

  useEffect(() => {
    if (!open || invoice || !depositClient || clientId !== depositClient.id || depositPrefilled.current) return
    if (proposal) {
      depositPrefilled.current = true
      applyProposalDeposit()
    } else if (!proposalLoading) {
      depositPrefilled.current = true
      setItems([{ description: `Deposit — ${depositClient.practice_name}`, quantity: "1", unitPrice: "" }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice, depositClient, clientId, proposal, proposalLoading])

  function pickClient(id: string) {
    setClientId(id)
    setProposalId(null)
    const c = clients?.find((x) => x.id === id)
    if (c) {
      setBillToName(c.practice_name)
      setBillToEmail(c.primary_contact_email ?? "")
    }
  }

  function applyProposalDeposit() {
    if (!proposal || !client) return
    const pct = Number(proposal.deposit_percent ?? 30)
    const amount = Math.round(((Number(proposal.price) * pct) / 100 + Number.EPSILON) * 100) / 100
    setKind("deposit")
    setProposalId(proposal.id)
    setItems([{ description: `Deposit (${pct}%) — ${client.practice_name} proposal`, quantity: "1", unitPrice: String(amount) }])
    if (proposal.gst_percent != null) setGstPercent(String(proposal.gst_percent))
  }

  const parsed: DraftItem[] = items.map((i) => ({
    description: i.description,
    quantity: Number(i.quantity) || 0,
    unitPrice: Number(i.unitPrice) || 0,
  }))
  const totals = computeTotals(
    parsed.filter((i) => i.description.trim() && i.quantity > 0),
    Number(gstPercent) || 0,
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!billToName.trim()) return setError("Who is this invoice for?")
    if (dueDate < issueDate) return setError("The due date can't be before the issue date.")
    if (!parsed.some((i) => i.description.trim() && i.quantity > 0)) return setError("Add at least one line item.")
    try {
      const result = await save.mutateAsync({
        id: invoice?.id,
        clientId: clientId === NO_CLIENT ? null : clientId,
        proposalId,
        kind,
        billToName,
        billToEmail,
        billToAddress,
        billToGstin,
        issueDate,
        dueDate,
        gstPercent: Number(gstPercent) || 0,
        notes,
        items: parsed.filter((i) => i.quantity > 0),
      })
      onOpenChange(false)
      navigate(`/finance/invoices/${result.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the invoice.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{invoice ? "Edit draft invoice" : "New invoice"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={pickClient} disabled={!!invoice}>
                <SelectTrigger className="w-full">
                  <SelectValue>{client ? client.practice_name : "Someone else (type details below)"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>Someone else (type details below)</SelectItem>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.practice_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv_to">Bill to</Label>
              <Input id="inv_to" value={billToName} onChange={(e) => setBillToName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv_email">Email</Label>
              <Input id="inv_email" type="email" value={billToEmail} onChange={(e) => setBillToEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv_gstin">Client GSTIN (optional)</Label>
              <Input id="inv_gstin" value={billToGstin} onChange={(e) => setBillToGstin(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv_addr">Address (optional)</Label>
            <Textarea id="inv_addr" rows={2} value={billToAddress} onChange={(e) => setBillToAddress(e.target.value)} />
          </div>

          {depositForClientId && !invoice && (
            <p className="rounded-lg border border-status-success/30 bg-status-success/5 p-3 text-sm">
              {depositClient ? `Deposit invoice for ${depositClient.practice_name}. ` : "Deposit invoice. "}
              {proposal
                ? "Filled in from their signed proposal."
                : !proposalLoading && depositClient
                  ? "No signed proposal found, so enter the deposit amount."
                  : ""}{" "}
              Once its payment is recorded in full, “Deposit received” ticks on their onboarding.
            </p>
          )}

          {proposal && !invoice && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-cyan/30 bg-brand-cyan/5 p-3 text-sm">
              <span>
                {client?.practice_name} has a signed proposal ({formatMoney(proposal.price)}, {proposal.deposit_percent}%
                deposit).
              </span>
              <Button type="button" size="sm" variant="outline" onClick={applyProposalDeposit}>
                Use the deposit amount
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv_issue">Issue date</Label>
              <Input id="inv_issue" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv_due">Due date</Label>
              <Input id="inv_due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv_gst">GST %</Label>
              <Input
                id="inv_gst"
                type="number"
                min={0}
                max={100}
                step="0.01"
                className="no-spinner"
                value={gstPercent}
                onChange={(e) => setGstPercent(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "standard" | "deposit")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{kind === "deposit" ? "Deposit" : "Standard"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Line items</Label>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center gap-2">
                <Input
                  className="col-span-12 sm:col-span-6"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, description: e.target.value } : p)))}
                />
                <Input
                  className="no-spinner col-span-4 sm:col-span-2"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, quantity: e.target.value } : p)))}
                />
                <Input
                  className="no-spinner col-span-6 sm:col-span-3"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Price"
                  value={item.unitPrice}
                  onChange={(e) => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, unitPrice: e.target.value } : p)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="col-span-2 sm:col-span-1"
                  disabled={items.length === 1}
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Remove line</span>
                </Button>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItems((prev) => [...prev, { description: "", quantity: "1", unitPrice: "" }])}
              >
                <Plus className="size-4" />
                Add line
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inv_notes">Notes (shown on the invoice)</Label>
            <Textarea id="inv_notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="rounded-lg border border-border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatMoney(totals.subtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">GST ({Number(gstPercent) || 0}%)</span>
              <span>{formatMoney(totals.gstAmount)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
              <span>Total</span>
              <span>{formatMoney(totals.total)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-status-error">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : invoice ? "Save draft" : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
