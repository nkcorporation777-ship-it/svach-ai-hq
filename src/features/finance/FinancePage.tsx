import { useSearchParams } from "react-router-dom"
import { Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { ExpensesTab } from "./ExpensesTab"
import { InvoicesTab } from "./InvoicesTab"
import { OverviewTab } from "./OverviewTab"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "invoices", label: "Invoices" },
  { id: "expenses", label: "Expenses" },
] as const

type TabId = (typeof TABS)[number]["id"]

/** Finance (Phase 3): invoices you send, payments you record by hand, expenses,
 * and a money-in / money-out overview. A payment gateway (PayPal) can be added
 * later — `payments.provider` / `provider_ref` are already there for it. */
export function FinancePage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "overview") as TabId

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">Finance</p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-semibold">
          <Wallet className="size-7 text-brand-cyan" />
          Finance
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Invoices, payments you've received, expenses and a revenue overview.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setParams(t.id === "overview" ? {} : { tab: t.id })}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm transition-colors",
              tab === t.id
                ? "border-brand-cyan text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <OverviewTab />}
      {tab === "invoices" && <InvoicesTab />}
      {tab === "expenses" && <ExpensesTab />}
    </div>
  )
}
