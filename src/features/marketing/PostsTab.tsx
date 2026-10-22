import { useState } from "react"
import { BarChart3, Plus } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlatformChips, PostStatusBadge } from "./MarketingBits"
import { POST_STATUS_LABEL, engagementOf, formatWhen, type PostStatus, type SocialPost } from "./hooks"

type Filter = "all" | PostStatus

export function PostsTab({
  posts,
  isLoading,
  onOpenPost,
  onNewPost,
  onOpenMetrics,
}: {
  posts: SocialPost[]
  isLoading: boolean
  onOpenPost: (post: SocialPost) => void
  onNewPost: () => void
  onOpenMetrics: (post: SocialPost) => void
}) {
  const [filter, setFilter] = useState<Filter>("all")
  const rows = posts.filter((p) => filter === "all" || p.status === filter)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-48">
            <SelectValue>{filter === "all" ? "All posts" : POST_STATUS_LABEL[filter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All posts</SelectItem>
            {(Object.keys(POST_STATUS_LABEL) as PostStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {POST_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onNewPost}>
          <Plus className="size-4" />
          New post
        </Button>
      </div>

      <GlowCard tone="violet" className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {posts.length ? "No posts match that filter." : "No posts yet. Write the first one."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">When</TableHead>
                <TableHead className="hidden lg:table-cell">Platforms</TableHead>
                <TableHead className="text-right">Engagement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const engagement = p.social_post_metrics.reduce((sum, m) => sum + engagementOf(m), 0)
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => onOpenPost(p)}>
                    <TableCell>
                      <span className="font-medium">{p.title}</span>
                      {p.campaign && <span className="block text-xs text-muted-foreground">{p.campaign}</span>}
                    </TableCell>
                    <TableCell>
                      <PostStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap md:table-cell">
                      {formatWhen(p.published_at ?? p.scheduled_at)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <PlatformChips platforms={p.platforms} />
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === "published" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenMetrics(p)
                          }}
                        >
                          <BarChart3 className="size-4" />
                          {p.social_post_metrics.length ? engagement.toLocaleString("en-IN") : "Add stats"}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </GlowCard>
    </div>
  )
}
