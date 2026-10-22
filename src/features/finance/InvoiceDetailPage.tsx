import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, Copy, Mail, Pencil, Plus, Trash2 } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { getFunctionErrorMessage } from "@/lib/functionsError"
import { StatusBadge } from "./FinanceBits"
import { InvoiceDialog } from "./InvoiceDialog"
import {
  PAYMENT_METHODS,
  formatMoney,
  useDeleteDraftInvoice,
  useDeletePayment,
  useInvoice,
  useRecordPayment,
  useSendInvoice,
  useVoidInvoice,
  type PaymentMethod,
} from "./hooks"

const today = () => new Date().toISOString().slice(0, 10)

function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: { id: string; invoice_number: string; client_id: string | null; total: number; amount_paid: number }
}) {
  const record = useRecordPayment()
  const balance = Math.max(0, Math.round((Number(invoice.total) - Number(invoice.amount_paid)) * 100) / 100)
  const [amount, setAmount] = useState("")
  const [paidOn, setPaidOn] = useState(today())
  const [method, setMethod] = useState<PaymentMethod>("upi")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const value = Number(amount || balance)
    if (!(value > 0)) return setError("Enter the amount received.")
    if (value > balance + 0.005) {
      return setError(`That's more than the balance due (${formatMoney(balance)}). Record at most the balance.`)
    }
    try {
      await record.mutateAsync({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        clientId: invoice.client_id,
        amount: value,
        paidOn,
        method,
        reference,
        notes,
      })
      setAmount("")
      setReference("")
      setNotes("")
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't record the payment.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Money you've already received for {invoice.invoice_number}. Balance due: {formatMoney(balance)}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay_amount">Amount (₹)</Label>
              <Input
                id="pay_amount"
                type="number"
                min={0}
                step="0.01"
                className="no-spinner"
                placeholder={String(balance)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay_date">Received on</Label>
              <Input id="pay_date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger className="w-full">
                <SelectValue>{PAYMENT_METHODS.find((m) => m.value === method)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay_ref">Reference (UTR / transaction ID)</Label>
            <Input id="pay_ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay_notes">Notes</Label>
            <Textarea id="pay_notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-status-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending ? "Saving…" : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SendDialog({
  open,
  onOpenChange,
  invoiceId,
  number,
  defaultEmail,
  alreadySent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  number: string
  defaultEmail: string
  alreadySent: boolean
}) {
  const send = useSendInvoice()
  const [email, setEmail] = useState(defaultEmail)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await send.mutateAsync({ invoiceId, toEmail: email.trim() })
      onOpenChange(false)
    } catch (err) {
      setError(await getFunctionErrorMessage(err, "Couldn't send the invoice."))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{alreadySent ? "Resend invoice" : "Send invoice"}</DialogTitle>
          <DialogDescription>
            This emails {number} to the address below, with a private link where they can view it. The email goes out
            from Svach AI's mailbox as soon as you confirm.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="send_email">Send to</Label>
            <Input
              id="send_email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-status-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={send.isPending || !email.trim()}>
              <Mail className="size-4" />
              {send.isPending ? "Sending…" : alreadySent ? "Resend email" : "Send email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: invoice, isLoading } = useInvoice(id)
  const delPayment = useDeletePayment()
  const voidInvoice = useVoidInvoice()
  const deleteDraft = useDeleteDraftInvoice()
  const [editOpen, setEditOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!invoice) return <p className="text-sm text-muted-foreground">Invoice not found.</p>

  const items = [...invoice.invoice_items].sort((a, b) => a.order_index - b.order_index)
  const payments = [...invoice.payments].sort((a, b) => a.paid_on.localeCompare(b.paid_on))
  const client = (invoice as { clients?: { id: string; practice_name: string } | null }).clients
  const balance = Math.max(0, Number(invoice.total) - Number(invoice.amount_paid))
  const isOpen = invoice.status === "sent" || invoice.status === "partially_paid"
  const link = `${window.location.origin}/invoices/${invoice.token}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Copy this link", link)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        to="/finance?tab=invoices"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to invoices
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
            {invoice.kind === "deposit" ? "Deposit invoice" : "Invoice"}
          </p>
          <h1 className="mt-2 flex flex-wrap items-center gap-3 font-display text-3xl font-semibold">
            {invoice.invoice_number}
            <StatusBadge invoice={invoice} />
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {client ? (
              <Link className="text-brand-cyan hover:underline" to={`/nexus/${client.id}`}>
                {invoice.bill_to_name}
              </Link>
            ) : (
              invoice.bill_to_name
            )}{" "}
            · issued {invoice.issue_date} · due {invoice.due_date}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {invoice.status === "draft" && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button onClick={() => setSendOpen(true)}>
                <Mail className="size-4" />
                Send to client
              </Button>
            </>
          )}
          {isOpen && (
            <>
              <Button onClick={() => setPayOpen(true)}>
                <Plus className="size-4" />
                Record payment
              </Button>
              <Button variant="outline" onClick={() => setSendOpen(true)}>
                <Mail className="size-4" />
                Resend
              </Button>
            </>
          )}
          {invoice.status !== "draft" && invoice.status !== "void" && (
            <Button variant="outline" onClick={copyLink}>
              <Copy className="size-4" />
              {copied ? "Copied" : "Copy link"}
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <GlowCard tone="cyan" className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="whitespace-normal">{i.description}</TableCell>
                    <TableCell className="text-right">{i.quantity}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatMoney(i.unit_price, invoice.currency)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatMoney(i.amount, invoice.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t border-border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatMoney(invoice.subtotal, invoice.currency)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">GST ({invoice.gst_percent}%)</span>
                <span>{formatMoney(invoice.gst_amount, invoice.currency)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
                <span>Total</span>
                <span>{formatMoney(invoice.total, invoice.currency)}</span>
              </div>
              {invoice.status !== "draft" && invoice.status !== "void" && (
                <>
                  <div className="mt-1 flex justify-between text-status-success">
                    <span>Paid</span>
                    <span>{formatMoney(invoice.amount_paid, invoice.currency)}</span>
                  </div>
                  <div className="mt-1 flex justify-between font-semibold">
                    <span>Balance due</span>
                    <span>{formatMoney(balance, invoice.currency)}</span>
                  </div>
                </>
              )}
            </div>
          </GlowCard>

          {invoice.notes && (
            <GlowCard tone="violet">
              <h2 className="font-display text-base font-semibold">Notes</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm">{invoice.notes}</p>
            </GlowCard>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <GlowCard tone="green">
            <h2 className="font-display text-base font-semibold">Payments</h2>
            {payments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {invoice.status === "draft" ? "Send the invoice first, then record payments here." : "No payments recorded yet."}
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{formatMoney(p.amount, invoice.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.paid_on} · {PAYMENT_METHODS.find((m) => m.value === p.method)?.label ?? p.method}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </p>
                      {p.notes && <p className="mt-0.5 text-xs text-muted-foreground">{p.notes}</p>}
                    </div>
                    {invoice.status !== "void" &&
                      (confirm === p.id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-status-error"
                          disabled={delPayment.isPending}
                          onClick={() =>
                            delPayment.mutate({ paymentId: p.id, invoiceId: invoice.id }, { onSettled: () => setConfirm(null) })
                          }
                        >
                          Remove?
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setConfirm(p.id)}>
                          <Trash2 className="size-4" />
                          <span className="sr-only">Remove payment</span>
                        </Button>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </GlowCard>

          <GlowCard tone="amber">
            <h2 className="font-display text-base font-semibold">Details</h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Bill to</dt>
                <dd>
                  {invoice.bill_to_name}
                  {invoice.bill_to_email && <span className="block text-muted-foreground">{invoice.bill_to_email}</span>}
                  {invoice.bill_to_address && (
                    <span className="block whitespace-pre-wrap text-muted-foreground">{invoice.bill_to_address}</span>
                  )}
                  {invoice.bill_to_gstin && <span className="block text-muted-foreground">GSTIN {invoice.bill_to_gstin}</span>}
                </dd>
              </div>
              {invoice.sent_at && (
                <div>
                  <dt className="text-xs text-muted-foreground">Sent</dt>
                  <dd>
                    {new Date(invoice.sent_at).toLocaleString()} to {invoice.sent_to_email}
                  </dd>
                </div>
              )}
              {invoice.viewed_at && (
                <div>
                  <dt className="text-xs text-muted-foreground">First viewed by client</dt>
                  <dd>{new Date(invoice.viewed_at).toLocaleString()}</dd>
                </div>
              )}
            </dl>

            {(invoice.status === "draft" || (isOpen && payments.length === 0)) && (
              <div className="mt-4 border-t border-border pt-3">
                {invoice.status === "draft" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-status-error"
                    disabled={deleteDraft.isPending}
                    onClick={() => {
                      if (confirm !== "delete") return setConfirm("delete")
                      deleteDraft.mutate(invoice.id, { onSuccess: () => navigate("/finance?tab=invoices") })
                    }}
                  >
                    {confirm === "delete" ? "Click again to delete this draft" : "Delete draft"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-status-error"
                    disabled={voidInvoice.isPending}
                    onClick={() => {
                      if (confirm !== "void") return setConfirm("void")
                      voidInvoice.mutate(invoice.id, { onSettled: () => setConfirm(null) })
                    }}
                  >
                    {confirm === "void" ? "Click again to void" : "Void invoice"}
                  </Button>
                )}
              </div>
            )}
            {(delPayment.isError || voidInvoice.isError || deleteDraft.isError) && (
              <p className="mt-2 text-xs text-status-error">
                {(delPayment.error ?? voidInvoice.error ?? deleteDraft.error)?.message}
              </p>
            )}
          </GlowCard>
        </div>
      </div>

      {invoice.status === "draft" && <InvoiceDialog open={editOpen} onOpenChange={setEditOpen} invoice={invoice} />}
      <RecordPaymentDialog open={payOpen} onOpenChange={setPayOpen} invoice={invoice} />
      <SendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        invoiceId={invoice.id}
        number={invoice.invoice_number}
        defaultEmail={invoice.bill_to_email ?? ""}
        alreadySent={invoice.status !== "draft"}
      />
    </div>
  )
}
