import { Fragment, useEffect, useState } from "react"
import { Timer } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PriorityBadge } from "./SupportBits"
import { useSlaTargets, useUpdateSlaTargets } from "./hooks"

type Draft = Record<string, { response: string; resolution: string }>

/** Settings → Support SLA targets: hours to first response and to resolution,
 * per priority. Saving re-times every open ticket of that priority. */
export function SlaTargetsSettings() {
  const { data: targets } = useSlaTargets()
  const save = useUpdateSlaTargets()
  const [draft, setDraft] = useState<Draft>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!targets) return
    setDraft(
      Object.fromEntries(
        targets.map((t) => [
          t.priority,
          { response: String(Number(t.first_response_hours)), resolution: String(Number(t.resolution_hours)) },
        ]),
      ),
    )
  }, [targets])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await save.mutateAsync(
        Object.entries(draft).map(([priority, d]) => ({
          priority,
          firstResponseHours: Number(d.response),
          resolutionHours: Number(d.resolution),
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the targets.")
    }
  }

  return (
    <GlowCard tone="amber" className="max-w-2xl">
      <div id="sla" className="flex scroll-mt-6 items-center gap-2">
        <Timer className="size-4 text-brand-cyan" />
        <h2 className="font-display text-base font-semibold">Support SLA targets</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Calendar hours from when a ticket is raised. Changing a target re-times the open tickets of that priority.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
        {/* One grid for every row so the columns line up whatever the badge widths. */}
        <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:gap-y-3">
          <span className="hidden text-xs text-muted-foreground sm:block">Priority</span>
          <span className="text-xs text-muted-foreground">Respond within (h)</span>
          <span className="text-xs text-muted-foreground">Resolve within (h)</span>
          {(targets ?? []).map((t) => (
            <Fragment key={t.priority}>
              <span className="col-span-2 mt-2 sm:col-span-1 sm:mt-0">
                <PriorityBadge priority={t.priority} />
              </span>
              <Input
                type="number"
                min="0.25"
                step="0.25"
                className="no-spinner min-w-0"
                aria-label={`${t.priority} first response hours`}
                value={draft[t.priority]?.response ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [t.priority]: { ...d[t.priority], response: e.target.value } }))}
              />
              <Input
                type="number"
                min="0.25"
                step="0.25"
                className="no-spinner min-w-0"
                aria-label={`${t.priority} resolution hours`}
                value={draft[t.priority]?.resolution ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [t.priority]: { ...d[t.priority], resolution: e.target.value } }))}
              />
            </Fragment>
          ))}
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
        <Button type="submit" className="self-start" disabled={save.isPending || !targets}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        {save.isSuccess && <p className="text-sm text-status-success">Saved.</p>}
      </form>
    </GlowCard>
  )
}
