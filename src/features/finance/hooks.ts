import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"

// ── Shared vocabulary ───────────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "void"
export type DisplayStatus = InvoiceStatus | "overdue"

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Part paid",
  paid: "Paid",
  void: "Void",
  overdue: "Overdue",
}

export const PAYMENT_METHODS = [
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "paypal", label: "PayPal" },
  { value: "other", label: "Other" },
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"]

export const EXPENSE_CATEGORIES = [
  "software",
  "contractors",
  "advertising",
  "hosting",
  "travel",
  "equipment",
  "fees",
  "other",
] as const

export function formatMoney(value: number | null | undefined, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value ?? 0)
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface DraftItem {
  description: string
  quantity: number
  unitPrice: number
}

export function computeTotals(items: DraftItem[], gstPercent: number) {
  const subtotal = round2(items.reduce((sum, i) => sum + round2(i.quantity * i.unitPrice), 0))
  const gstAmount = round2((subtotal * gstPercent) / 100)
  return { subtotal, gstAmount, total: round2(subtotal + gstAmount) }
}

/** "Overdue" isn't stored: a sent / part-paid invoice past its due date shows as overdue. */
export function displayStatus(inv: { status: string; due_date: string }): DisplayStatus {
  const today = new Date().toISOString().slice(0, 10)
  if ((inv.status === "sent" || inv.status === "partially_paid") && inv.due_date < today) return "overdue"
  return inv.status as InvoiceStatus
}

// ── Invoices ────────────────────────────────────────────────────────────────

const INVOICE_LIST_SELECT = "*, clients(id, practice_name)"

export function useInvoices() {
  return useQuery({
    queryKey: ["finance", "invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(INVOICE_LIST_SELECT)
        .order("issue_date", { ascending: false })
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["finance", "invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, clients(id, practice_name), invoice_items(*), payments(*)")
        .eq("id", id!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

/** Clients to bill, with what's needed to prefill an invoice. */
export function useBillableClients() {
  return useQuery({
    queryKey: ["finance", "billable-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, practice_name, primary_contact_name, primary_contact_email, source_lead_id")
        .is("deleted_at", null)
        .order("practice_name")
      if (error) throw error
      return data
    },
  })
}

/** The client's signed proposal (via the lead it came from), for a one-click deposit invoice. */
export function useSignedProposal(sourceLeadId: string | null | undefined) {
  return useQuery({
    queryKey: ["finance", "signed-proposal", sourceLeadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, price, gst_percent, deposit_percent, signed_at")
        .eq("lead_id", sourceLeadId!)
        .eq("status", "accepted")
        .order("signed_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!sourceLeadId,
  })
}

export interface SaveInvoiceInput {
  id?: string
  clientId: string | null
  proposalId: string | null
  kind: "standard" | "deposit"
  billToName: string
  billToEmail: string
  billToAddress: string
  billToGstin: string
  issueDate: string
  dueDate: string
  gstPercent: number
  notes: string
  items: DraftItem[]
}

/** Creates a draft invoice, or rewrites an existing DRAFT (items are replaced). */
export function useSaveInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveInvoiceInput) => {
      const items = input.items.filter((i) => i.description.trim())
      if (items.length === 0) throw new Error("Add at least one line item.")
      const totals = computeTotals(items, input.gstPercent)
      const row = {
        client_id: input.clientId,
        proposal_id: input.proposalId,
        kind: input.kind,
        bill_to_name: input.billToName.trim(),
        bill_to_email: input.billToEmail.trim() || null,
        bill_to_address: input.billToAddress.trim() || null,
        bill_to_gstin: input.billToGstin.trim() || null,
        issue_date: input.issueDate,
        due_date: input.dueDate,
        gst_percent: input.gstPercent,
        subtotal: totals.subtotal,
        gst_amount: totals.gstAmount,
        total: totals.total,
        notes: input.notes.trim() || null,
      }
      const itemRows = (invoiceId: string) =>
        items.map((i, idx) => ({
          invoice_id: invoiceId,
          description: i.description.trim(),
          quantity: i.quantity,
          unit_price: i.unitPrice,
          amount: round2(i.quantity * i.unitPrice),
          order_index: idx,
        }))

      if (input.id) {
        const { error } = await supabase.from("invoices").update(row).eq("id", input.id).eq("status", "draft")
        if (error) throw error
        const { error: delError } = await supabase.from("invoice_items").delete().eq("invoice_id", input.id)
        if (delError) throw delError
        const { error: insError } = await supabase.from("invoice_items").insert(itemRows(input.id))
        if (insError) throw insError
        await logAudit({ action: "finance.invoice_updated", entityType: "invoice", entityId: input.id })
        return { id: input.id }
      }

      const { data: user } = await supabase.auth.getUser()
      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({ ...row, created_by: user.user?.id ?? null })
        .select("id, invoice_number")
        .single()
      if (error) throw error
      const { error: itemsError } = await supabase.from("invoice_items").insert(itemRows(invoice.id))
      if (itemsError) {
        await supabase.from("invoices").delete().eq("id", invoice.id)
        throw itemsError
      }
      await logAudit({
        action: "finance.invoice_created",
        entityType: "invoice",
        entityId: invoice.id,
        metadata: { invoice_number: invoice.invoice_number, total: totals.total },
      })
      return { id: invoice.id }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] })
    },
  })
}

/** Emails the invoice link to the client (invoice-send Edge Function) and marks it sent. */
export function useSendInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ invoiceId, toEmail }: { invoiceId: string; toEmail: string }) => {
      const { data, error } = await supabase.functions.invoke("invoice-send", {
        body: { invoice_id: invoiceId, to_email: toEmail },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as { sent: true; token: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] })
      queryClient.invalidateQueries({ queryKey: ["activities"] })
    },
  })
}

export function useVoidInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase
        .from("invoices")
        .update({ status: "void", voided_at: new Date().toISOString() })
        .eq("id", invoiceId)
      if (error) throw error
      await logAudit({ action: "finance.invoice_voided", entityType: "invoice", entityId: invoiceId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] })
    },
  })
}

/** Drafts have never been sent, so they can simply be deleted. */
export function useDeleteDraftInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceId).eq("status", "draft")
      if (error) throw error
      await logAudit({ action: "finance.invoice_deleted", entityType: "invoice", entityId: invoiceId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] })
    },
  })
}

// ── Payments (recorded by hand) ─────────────────────────────────────────────

export interface RecordPaymentInput {
  invoiceId: string
  invoiceNumber: string
  clientId: string | null
  amount: number
  paidOn: string
  method: PaymentMethod
  reference: string
  notes: string
}

export function useRecordPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      const { data: user } = await supabase.auth.getUser()
      const { data: payment, error } = await supabase
        .from("payments")
        .insert({
          invoice_id: input.invoiceId,
          amount: input.amount,
          paid_on: input.paidOn,
          method: input.method,
          reference: input.reference.trim() || null,
          notes: input.notes.trim() || null,
          recorded_by: user.user?.id ?? null,
        })
        .select("id")
        .single()
      if (error) throw error
      if (input.clientId) {
        await supabase.from("activities").insert({
          entity_type: "client",
          entity_id: input.clientId,
          type: "note",
          content: `Payment of ${formatMoney(input.amount)} received for ${input.invoiceNumber} (${input.method.replace("_", " ")}).`,
          metadata: { source: "finance", invoice_id: input.invoiceId, payment_id: payment.id },
        })
      }
      await logAudit({
        action: "finance.payment_recorded",
        entityType: "invoice",
        entityId: input.invoiceId,
        metadata: { amount: input.amount, method: input.method },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] })
      queryClient.invalidateQueries({ queryKey: ["activities"] })
    },
  })
}

export function useDeletePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ paymentId, invoiceId }: { paymentId: string; invoiceId: string }) => {
      const { error } = await supabase.from("payments").delete().eq("id", paymentId)
      if (error) throw error
      await logAudit({
        action: "finance.payment_deleted",
        entityType: "invoice",
        entityId: invoiceId,
        metadata: { payment_id: paymentId },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] })
    },
  })
}

// ── Expenses ────────────────────────────────────────────────────────────────

export function useExpenses() {
  return useQuery({
    queryKey: ["finance", "expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, clients(id, practice_name)")
        .order("spent_on", { ascending: false })
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export interface SaveExpenseInput {
  spentOn: string
  category: string
  vendor: string
  description: string
  amount: number
  clientId: string | null
  notes: string
}

export function useSaveExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: SaveExpenseInput) => {
      const { data: user } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from("expenses")
        .insert({
          spent_on: input.spentOn,
          category: input.category,
          vendor: input.vendor.trim() || null,
          description: input.description.trim() || null,
          amount: input.amount,
          client_id: input.clientId,
          notes: input.notes.trim() || null,
          created_by: user.user?.id ?? null,
        })
        .select("id")
        .single()
      if (error) throw error
      await logAudit({
        action: "finance.expense_added",
        entityType: "expense",
        entityId: data.id,
        metadata: { amount: input.amount, category: input.category },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] })
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id)
      if (error) throw error
      await logAudit({ action: "finance.expense_deleted", entityType: "expense", entityId: id })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] })
    },
  })
}

// ── Revenue dashboard ───────────────────────────────────────────────────────

export interface MonthPoint {
  key: string // YYYY-MM
  label: string
  collected: number
  spent: number
}

export interface FinanceOverview {
  collectedThisMonth: number
  spentThisMonth: number
  netThisMonth: number
  outstanding: number
  outstandingCount: number
  overdue: number
  overdueCount: number
  months: MonthPoint[]
  topClients: { name: string; collected: number }[]
}

function monthKey(date: string) {
  return date.slice(0, 7)
}

export function useFinanceOverview() {
  return useQuery({
    queryKey: ["finance", "overview"],
    queryFn: async (): Promise<FinanceOverview> => {
      const now = new Date()
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)).toISOString().slice(0, 10)
      const [{ data: payments, error: pErr }, { data: expenses, error: eErr }, { data: open, error: oErr }] =
        await Promise.all([
          supabase.from("payments").select("amount, paid_on, invoices(bill_to_name)").gte("paid_on", start),
          supabase.from("expenses").select("amount, spent_on").gte("spent_on", start),
          supabase
            .from("invoices")
            .select("total, amount_paid, due_date, status")
            .in("status", ["sent", "partially_paid"]),
        ])
      if (pErr) throw pErr
      if (eErr) throw eErr
      if (oErr) throw oErr

      const months: MonthPoint[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
        months.push({
          key: d.toISOString().slice(0, 7),
          label: d.toLocaleString("en-IN", { month: "short", timeZone: "UTC" }),
          collected: 0,
          spent: 0,
        })
      }
      const byKey = new Map(months.map((m) => [m.key, m]))
      const clientTotals = new Map<string, number>()
      for (const p of payments ?? []) {
        const m = byKey.get(monthKey(p.paid_on))
        if (m) m.collected += Number(p.amount)
        const name = (p as { invoices?: { bill_to_name: string } | null }).invoices?.bill_to_name ?? "Unknown"
        clientTotals.set(name, (clientTotals.get(name) ?? 0) + Number(p.amount))
      }
      for (const e of expenses ?? []) {
        const m = byKey.get(monthKey(e.spent_on))
        if (m) m.spent += Number(e.amount)
      }

      const today = now.toISOString().slice(0, 10)
      let outstanding = 0
      let outstandingCount = 0
      let overdue = 0
      let overdueCount = 0
      for (const inv of open ?? []) {
        const balance = Number(inv.total) - Number(inv.amount_paid)
        if (balance <= 0) continue
        outstanding += balance
        outstandingCount++
        if (inv.due_date < today) {
          overdue += balance
          overdueCount++
        }
      }

      const thisMonth = months[months.length - 1]
      return {
        collectedThisMonth: thisMonth.collected,
        spentThisMonth: thisMonth.spent,
        netThisMonth: thisMonth.collected - thisMonth.spent,
        outstanding,
        outstandingCount,
        overdue,
        overdueCount,
        months,
        topClients: [...clientTotals.entries()]
          .map(([name, collected]) => ({ name, collected }))
          .sort((a, b) => b.collected - a.collected)
          .slice(0, 5),
      }
    },
  })
}
