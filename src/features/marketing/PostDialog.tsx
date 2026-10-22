import { useEffect, useState } from "react"
import { AlertTriangle, ExternalLink } from "lucide-react"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { DateTimeField } from "@/components/shared/DateTimeField"
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { PlatformChips, PostStatusBadge } from "./MarketingBits"
import {
  PLATFORMS,
  formatWhen,
  toLocalInput,
  useCancelPost,
  useDeletePost,
  useMarkPublished,
  useSavePost,
  type Platform,
  type SocialPost,
} from "./hooks"

const EDITABLE = new Set(["draft", "scheduled", "failed"])

/** Write, schedule or edit one post. Once a post has gone to n8n it's shown
 * read-only, with "Mark as posted" for when n8n didn't report back. */
export function PostDialog({
  open,
  onOpenChange,
  post,
  defaultWhen,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  post?: SocialPost | null
  /** "yyyy-mm-ddTHH:mm" to prefill a new post (e.g. the calendar day clicked). */
  defaultWhen?: string
}) {
  const save = useSavePost()
  const markPublished = useMarkPublished()
  const cancel = useCancelPost()
  const del = useDeletePost()

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [linkUrl, setLinkUrl] = useState("")
  const [mediaUrls, setMediaUrls] = useState("")
  const [campaign, setCampaign] = useState("")
  const [when, setWhen] = useState("")
  const [publishedUrl, setPublishedUrl] = useState("")
  const [showMarkPublished, setShowMarkPublished] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle(post?.title ?? "")
    setBody(post?.body ?? "")
    setPlatforms((post?.platforms as Platform[]) ?? [])
    setLinkUrl(post?.link_url ?? "")
    setMediaUrls((post?.media_urls ?? []).join("\n"))
    setCampaign(post?.campaign ?? "")
    setWhen(post ? toLocalInput(post.scheduled_at) : (defaultWhen ?? ""))
    setPublishedUrl(post?.published_url ?? "")
    setShowMarkPublished(false)
    setError(null)
    // Keyed on the post's id + updated_at, not the object: the list refetches
    // every minute and a new copy of an unchanged post mustn't wipe edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, post?.id, post?.updated_at, defaultWhen])

  const editable = !post || EDITABLE.has(post.status)
  const tightest = PLATFORMS.filter((p) => platforms.includes(p.value)).sort((a, b) => a.limit - b.limit)[0]
  const overLimit = tightest && body.length > tightest.limit

  function toggle(p: Platform) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  }

  async function submit(schedule: boolean) {
    setError(null)
    if (schedule) {
      if (!when) return setError("Pick a date and time to schedule it.")
      if (overLimit) {
        return setError(`The post is too long for ${tightest.label} (${body.length} of ${tightest.limit}). Shorten it or untick ${tightest.label}.`)
      }
      if (new Date(when).getTime() < Date.now() - 60_000 && post?.status !== "failed") {
        return setError("That time has already passed. Pick a time in the future.")
      }
    }
    try {
      await save.mutateAsync({
        id: post?.id,
        title,
        body,
        platforms,
        linkUrl,
        mediaUrls: mediaUrls.split("\n"),
        campaign,
        scheduledAt: schedule ? new Date(when).toISOString() : null,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the post.")
    }
  }

  async function run(fn: () => Promise<unknown>) {
    setError(null)
    try {
      await fn()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {post ? (editable ? "Edit post" : post.title) : "New post"}
              {post && <PostStatusBadge status={post.status} />}
            </DialogTitle>
            {!editable && post && (
              <DialogDescription>
                {post.status === "published"
                  ? `Published ${formatWhen(post.published_at)}.`
                  : post.status === "cancelled"
                    ? "Cancelled. It won't be posted."
                    : `Handed to n8n ${formatWhen(post.handed_off_at)}. Waiting for n8n to report back.`}
              </DialogDescription>
            )}
          </DialogHeader>

          {post?.last_error && post.status !== "published" && (
            <p className="flex items-start gap-2 rounded-md border border-status-error/40 bg-status-error/10 px-3 py-2 text-sm text-status-error">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {post.last_error}
                {post.status === "scheduled" && post.attempts > 0 && ` (will retry, attempt ${post.attempts} of 3)`}
              </span>
            </p>
          )}

          {editable ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="post_title">Title (only you see this)</Label>
                <Input id="post_title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Platforms</Label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => toggle(p.value)}
                      aria-pressed={platforms.includes(p.value)}
                      className={cn(
                        "rounded-[var(--radius-pill)] border px-3 py-1 text-sm transition-colors",
                        platforms.includes(p.value)
                          ? "border-brand-cyan bg-brand-cyan/15 text-brand-cyan"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="post_body">Post</Label>
                <Textarea id="post_body" rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
                <p className={cn("text-xs", overLimit ? "text-status-error" : "text-muted-foreground")}>
                  {body.length} characters
                  {tightest && ` · ${tightest.label} allows ${tightest.limit.toLocaleString()}`}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="post_link">Link (optional)</Label>
                  <Input
                    id="post_link"
                    type="url"
                    placeholder="https://svach.in/…"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="post_campaign">Campaign (optional)</Label>
                  <Input
                    id="post_campaign"
                    placeholder="e.g. Clinic launch"
                    value={campaign}
                    onChange={(e) => setCampaign(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="post_media">Image / video links (one per line, optional)</Label>
                <Textarea
                  id="post_media"
                  rows={2}
                  placeholder="https://…/image.jpg"
                  value={mediaUrls}
                  onChange={(e) => setMediaUrls(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Passed to n8n as-is, for the workflow to attach.</p>
              </div>

              <DateTimeField id="post_when" dateLabel="Post on" timeLabel="At" value={when} onChange={setWhen} />
            </div>
          ) : (
            post && (
              <div className="flex flex-col gap-3 text-sm">
                <PlatformChips platforms={post.platforms} />
                <p className="whitespace-pre-wrap rounded-md border border-border p-3">{post.body}</p>
                {post.link_url && <p className="text-muted-foreground">Link: {post.link_url}</p>}
                {post.published_url && (
                  <a
                    href={post.published_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-brand-cyan hover:underline"
                  >
                    View the live post <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            )
          )}

          {showMarkPublished && post && (
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <Label htmlFor="published_url">Link to the live post (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="published_url"
                  type="url"
                  value={publishedUrl}
                  onChange={(e) => setPublishedUrl(e.target.value)}
                />
                <Button
                  disabled={markPublished.isPending}
                  onClick={() => run(() => markPublished.mutateAsync({ id: post.id, publishedUrl }))}
                >
                  Confirm
                </Button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-status-error">{error}</p>}

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {post && post.status !== "published" && post.status !== "cancelled" && !showMarkPublished && (
                <Button variant="outline" onClick={() => setShowMarkPublished(true)}>
                  Mark as posted
                </Button>
              )}
              {post && editable && (
                <Button variant="ghost" disabled={cancel.isPending} onClick={() => run(() => cancel.mutateAsync(post.id))}>
                  Cancel post
                </Button>
              )}
              {post && (editable || post.status === "cancelled") && (
                <Button variant="ghost" className="text-status-error" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
            </div>
            {editable && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" disabled={save.isPending} onClick={() => submit(false)}>
                  Save as draft
                </Button>
                <Button disabled={save.isPending} onClick={() => submit(true)}>
                  {save.isPending ? "Saving…" : post?.status === "failed" ? "Reschedule" : "Schedule"}
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {post && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete this post?"
          description={`"${post.title}" and any stats logged for it will be removed.`}
          confirmLabel="Delete"
          isSubmitting={del.isPending}
          onConfirm={() =>
            del.mutate(post.id, {
              onSuccess: () => {
                setConfirmDelete(false)
                onOpenChange(false)
              },
            })
          }
        />
      )}
    </>
  )
}
