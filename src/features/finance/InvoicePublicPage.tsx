import { useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

interface PublicInvoice {
  invoice_number: string
  status: "sent" | "partially_paid" | "paid" | "void"
  kind: string
  issue_date: string
  due_date: string
  currency: string
  bill_to_name: string
  bill_to_address: string | null
  bill_to_gstin: string | null
  subtotal: number
  gst_percent: number
  gst_amount: number
  total: number
  amount_paid: number
  notes: string | null
  items: { description: string; quantity: number; unit_price: number; amount: number }[]
  invoice_from: string | null
  payment_instructions: string | null
}

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value)

/** Public, unauthenticated invoice view — the client isn't an HQ user, so the
 * unguessable token in the URL is the auth, checked server-side by invoice-get. */
export function InvoicePublicPage() {
  const { token } = useParams<{ token: string }>()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["invoice-portal", token],
    queryFn: async (): Promise<PublicInvoice> => {
      const res = await fetch(`${supabaseUrl}/functions/v1/invoice-get?token=${encodeURIComponent(token!)}`, {
        headers: { apikey: supabaseAnonKey },
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error ?? "This link is invalid.")
      return body as PublicInvoice
    },
    enabled: !!token,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-2xl font-semibold">This link isn't valid</h1>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Please check the link or contact us for a new one."}
        </p>
      </div>
    )
  }

  const balance = Math.max(0, Number(data.total) - Number(data.amount_paid))
  const paid = data.status === "paid"

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
            {data.kind === "deposit" ? "Deposit invoice" : "Invoice"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">{data.invoice_number}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Issued {data.issue_date} · due {data.due_date}
          </p>
        </div>
        <span
          className={
            paid
              ? "rounded-full border border-status-success/40 bg-status-success/10 px-3 py-1 text-sm text-status-success"
              : data.status === "void"
                ? "rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
                : "rounded-full border border-brand-cyan/40 bg-brand-cyan/10 px-3 py-1 text-sm text-brand-cyan"
          }
        >
          {paid ? "Paid" : data.status === "void" ? "Void" : data.status === "partially_paid" ? "Part paid" : "Payment due"}
        </span>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">From</p>
          <p className="mt-1 whitespace-pre-wrap">{data.invoice_from || "Svach AI"}</p>
        </div>
        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Bill to</p>
          <p className="mt-1 font-medium">{data.bill_to_name}</p>
          {data.bill_to_address && <p className="whitespace-pre-wrap text-muted-foreground">{data.bill_to_address}</p>}
          {data.bill_to_gstin && <p className="text-muted-foreground">GSTIN {data.bill_to_gstin}</p>}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="p-3">Description</th>
              <th className="p-3 text-right">Qty</th>
              <th className="p-3 text-right">Price</th>
              <th className="p-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((i, idx) => (
              <tr key={idx} className="border-b border-border last:border-0">
                <td className="p-3">{i.description}</td>
                <td className="p-3 text-right">{i.quantity}</td>
                <td className="p-3 text-right whitespace-nowrap">{money(i.unit_price, data.currency)}</td>
                <td className="p-3 text-right whitespace-nowrap">{money(i.amount, data.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{money(data.subtotal, data.currency)}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">GST ({data.gst_percent}%)</span>
            <span>{money(data.gst_amount, data.currency)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
            <span>Total</span>
            <span>{money(data.total, data.currency)}</span>
          </div>
          {Number(data.amount_paid) > 0 && (
            <div className="mt-1 flex justify-between text-status-success">
              <span>Paid</span>
              <span>{money(data.amount_paid, data.currency)}</span>
            </div>
          )}
          {!paid && data.status !== "void" && (
            <div className="mt-1 flex justify-between font-semibold">
              <span>Balance due</span>
              <span>{money(balance, data.currency)}</span>
            </div>
          )}
        </div>
      </div>

      {data.notes && <p className="whitespace-pre-wrap text-sm">{data.notes}</p>}

      {!paid && data.status !== "void" && data.payment_instructions && (
        <div className="rounded-lg border border-brand-cyan/30 bg-brand-cyan/5 p-4 text-sm">
          <p className="font-medium">How to pay</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{data.payment_instructions}</p>
        </div>
      )}
      {paid && (
        <p className="text-sm text-status-success">Thank you — this invoice has been paid in full.</p>
      )}
    </div>
  )
}
