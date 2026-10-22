import { useEffect, useState } from "react"
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
import { METRIC_FIELDS, platformLabel, useSaveMetrics, type MetricKey, type Platform, type SocialPost } from "./hooks"

type Draft = Record<string, Record<MetricKey, string>>

/** Type in a published post's numbers, one row per platform it went out on.
 * Saving again overwrites — it's a "latest numbers" snapshot, not a history. */
export function MetricsDialog({
  open,
  onOpenChange,
  post,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: SocialPost | null
}) {
  const save = useSaveMetrics()
  const [draft, setDraft] = useState<Draft>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !post) return
    const next: Draft = {}
    for (const p of post.platforms) {
      const existing = post.social_post_metrics.find((m) => m.platform === p)
      next[p] = Object.fromEntries(
        METRIC_FIELDS.map((f) => [f.key, existing?.[f.key] != null ? String(existing[f.key]) : ""]),
      ) as Record<MetricKey, string>
    }
    setDraft(next)
    setError(null)
  }, [open, post])

  if (!post) return null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!post) return
    setError(null)
    const metrics = Object.fromEntries(
      Object.entries(draft).map(([platform, fields]) => [
        platform,
        Object.fromEntries(
          METRIC_FIELDS.map((f) => {
            const raw = fields[f.key].trim()
            return [f.key, raw === "" ? null : Math.max(0, Math.round(Number(raw)))]
          }),
        ),
      ]),
    ) as Partial<Record<Platform, Partial<Record<MetricKey, number | null>>>>
    try {
      await save.mutateAsync({ postId: post.id, metrics })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the stats.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Stats: {post.title}</DialogTitle>
          <DialogDescription>Copy the numbers from each platform's insights. Leave blank what you don't have.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-normal">Platform</th>
                  {METRIC_FIELDS.map((f) => (
                    <th key={f.key} className="px-1 pb-2 font-normal">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {post.platforms.map((p) => (
                  <tr key={p}>
                    <td className="py-1 pr-2 whitespace-nowrap">{platformLabel(p)}</td>
                    {METRIC_FIELDS.map((f) => (
                      <td key={f.key} className="px-1 py-1">
                        <Input
                          type="number"
                          min={0}
                          aria-label={`${platformLabel(p)} ${f.label}`}
                          className="no-spinner min-w-16"
                          value={draft[p]?.[f.key] ?? ""}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, [p]: { ...d[p], [f.key]: e.target.value } }))
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="text-sm text-status-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save stats"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
