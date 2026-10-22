import { useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { AlertTriangle, Headphones } from "lucide-react"
import { cn } from "@/lib/utils"
import { SlaTab } from "./SlaTab"
import { TicketsTab } from "./TicketsTab"
import { isOpenStatus, slaOf, useTickets } from "./hooks"

const TABS = [
  { id: "tickets", label: "Tickets" },
  { id: "bugs", label: "Bugs" },
  { id: "sla", label: "SLA monitor" },
] as const

type TabId = (typeof TABS)[number]["id"]

/** Support (Phase 4): tickets and bugs the Owner logs (clients never log in),
 * each with a reply/note thread, and SLA clocks set per priority in Settings. */
export function SupportPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "tickets") as TabId
  const { data: tickets, isLoading } = useTickets()
  const navRef = useRef<HTMLElement>(null)

  // On narrow screens the tab row scrolls; keep the open tab in view (again
  // once tickets load, since the open-count badges widen the tabs).
  useEffect(() => {
    const show = () =>
      navRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" })
    show()
    // Web fonts arriving late widen the labels.
    document.fonts?.ready.then(show)
  }, [tab, isLoading])

  const all = tickets ?? []

  const breached = all.filter((t) => {
    if (!isOpenStatus(t.status)) return false
    const s = slaOf(t)
    return s.response === "breached" || s.resolution === "breached"
  }).length
  const openCount = (kind: string) => all.filter((t) => t.kind === kind && isOpenStatus(t.status)).length

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">Support</p>
        <h1 className="mt-2 flex items-center gap-3 font-display text-3xl font-semibold">
          <Headphones className="size-7 text-brand-cyan" />
          Support
        </h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Log what clients raise by call, WhatsApp or email, track bugs, and keep an eye on response times.
        </p>
      </header>

      {breached > 0 && tab !== "sla" && (
        <button
          type="button"
          onClick={() => setParams({ tab: "sla" })}
          className="flex items-center gap-3 rounded-[var(--radius-card)] border border-status-error bg-status-error/10 px-4 py-3 text-left text-sm font-medium text-status-error hover:bg-status-error/20"
        >
          <AlertTriangle className="size-4 shrink-0" />
          {breached} open ticket{breached === 1 ? " has" : "s have"} missed an SLA target. Click to review.
        </button>
      )}

      <nav ref={navRef} className="flex gap-1 overflow-x-auto border-b border-border pb-px [scrollbar-width:none]">
        {TABS.map((t) => {
          const count = t.id === "tickets" ? openCount("ticket") : t.id === "bugs" ? openCount("bug") : 0
          return (
            <button
              key={t.id}
              aria-current={tab === t.id ? "page" : undefined}
              type="button"
              onClick={() => setParams(t.id === "tickets" ? {} : { tab: t.id })}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm whitespace-nowrap transition-colors",
                tab === t.id
                  ? "border-brand-cyan text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {count > 0 && (
                <span className="rounded-[var(--radius-pill)] bg-white/10 px-1.5 text-[11px] text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {tab === "tickets" && <TicketsTab tickets={all} isLoading={isLoading} kind="ticket" />}
      {tab === "bugs" && <TicketsTab tickets={all} isLoading={isLoading} kind="bug" />}
      {tab === "sla" && <SlaTab tickets={all} />}
    </div>
  )
}
