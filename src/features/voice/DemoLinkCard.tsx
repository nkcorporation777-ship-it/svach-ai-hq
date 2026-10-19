import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Copy, Link2, RefreshCw } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useDemoLink, useUpsertDemoLink } from "./hooks"

function useDemoAgents() {
  return useQuery({
    queryKey: ["voice", "demo-agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("voice_agents").select("id, name").eq("audience", "demo").order("name")
      if (error) throw error
      return data
    },
  })
}

/** The public "Try our agent" link a prospect can open on their own device —
 * capped per day and per visitor, tied to ONE demo agent, switch-off-able. */
export function DemoLinkCard() {
  const { data: link, isLoading } = useDemoLink()
  const { data: agents } = useDemoAgents()
  const upsert = useUpsertDemoLink()
  const [copied, setCopied] = useState(false)

  const url = link ? `${window.location.origin}/try/${link.token}` : null

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the link is visible to copy by hand.
    }
  }

  return (
    <GlowCard tone="violet">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-brand-cyan" />
        <h2 className="font-display text-base font-semibold">Public “Try our agent” link</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Send this to a prospect — they talk to your demo agent from their own browser, no login. It only
        ever starts the demo agent, and the daily limits protect your Retell bill.
      </p>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : !link ? (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {agents && agents.length > 0
              ? "No link yet."
              : "First set one agent's “Serves” to Demo on the Agents tab (or seed demo data), then create the link."}
          </p>
          <Button
            size="sm"
            className="w-fit"
            disabled={!agents || agents.length === 0 || upsert.isPending}
            onClick={() => upsert.mutate({ agentId: agents![0].id })}
          >
            Create link
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input readOnly value={url ?? ""} className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button size="sm" variant="ghost" onClick={copy}>
              <Copy className="size-4" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Agent</label>
              <Select
                value={link.agent_id ?? "none"}
                onValueChange={(v) => upsert.mutate({ id: link.id, agentId: v === "none" ? null : v })}
              >
                <SelectTrigger className="w-56">
                  <SelectValue>
                    {link.agent_id ? (agents?.find((a) => a.id === link.agent_id)?.name ?? "Agent") : "Choose an agent"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {agents?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Calls per day</label>
              <Input
                type="number"
                min={1}
                max={500}
                className="no-spinner w-24"
                defaultValue={link.daily_cap}
                onBlur={(e) => {
                  const n = Math.round(Number(e.target.value))
                  if (n >= 1 && n <= 500 && n !== link.daily_cap) upsert.mutate({ id: link.id, dailyCap: n })
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Per visitor / day</label>
              <Input
                type="number"
                min={1}
                max={50}
                className="no-spinner w-24"
                defaultValue={link.per_ip_daily_cap}
                onBlur={(e) => {
                  const n = Math.round(Number(e.target.value))
                  if (n >= 1 && n <= 50 && n !== link.per_ip_daily_cap) upsert.mutate({ id: link.id, perIpDailyCap: n })
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={link.enabled}
              onClick={() => upsert.mutate({ id: link.id, enabled: !link.enabled })}
              className={cn(
                "inline-flex items-center gap-2 rounded-[var(--radius-pill)] border px-3 py-1.5 text-sm transition-colors",
                link.enabled
                  ? "border-status-success/50 bg-status-success/10 text-status-success"
                  : "border-border text-muted-foreground",
              )}
            >
              <span className={cn("size-2 rounded-full", link.enabled ? "bg-status-success" : "bg-muted-foreground")} />
              Link is {link.enabled ? "on" : "off"}
            </button>
            <Button
              size="sm"
              variant="ghost"
              disabled={upsert.isPending}
              onClick={() => upsert.mutate({ id: link.id, rotate: true })}
            >
              <RefreshCw className="size-4" />
              New link (old one stops working)
            </Button>
          </div>
        </div>
      )}
      {upsert.isError && <p className="mt-3 text-xs text-status-error">{upsert.error.message}</p>}
    </GlowCard>
  )
}
