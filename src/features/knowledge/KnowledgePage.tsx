import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Search } from "lucide-react"
import { Card } from "@/components/shared/Card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useKnowledgeCategories } from "@/hooks/useKnowledgeCategories"
import { useKnowledgeDocuments } from "./hooks"
import { NewDocumentDialog } from "./NewDocumentDialog"

/**
 * INFORMATION_ARCHITECTURE.md §3.1 — full-text search + category/tag filters.
 * No semantic/embedding search in Phase 1 (deferred until content volume grows).
 */
export function KnowledgePage() {
  const { data: categories } = useKnowledgeCategories()
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState<string>("all")
  const [tag, setTag] = useState("")
  const [newDocOpen, setNewDocOpen] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(id)
  }, [searchInput])

  const {
    data: documents,
    isLoading,
    isError,
    error,
    refetch,
  } = useKnowledgeDocuments({
    search: search || undefined,
    categoryId: categoryId === "all" ? undefined : categoryId,
    tag: tag.trim() || undefined,
  })

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
            Knowledge
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            Knowledge Base
          </h1>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Shared across every module and agent — not a department
            (DECISION_LOG.md §4).
          </p>
        </div>
        <Button onClick={() => setNewDocOpen(true)}>
          <Plus className="size-4" />
          New Document
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search documents…"
            className="pl-9"
          />
        </div>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Filter by tag…"
          className="w-[180px]"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <div className="glass-card flex items-center justify-between gap-4">
          <p className="text-sm text-status-error">
            Couldn't load documents — {error instanceof Error ? error.message : "unknown error"}.
          </p>
          <Button size="sm" variant="ghost" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : !documents || documents.length === 0 ? (
        <div className="glass-card">
          <p className="text-sm text-muted-foreground">No documents yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            const categoryName = (
              doc as { knowledge_categories?: { name: string } | null }
            ).knowledge_categories?.name
            return (
              <Card key={doc.id}>
                <Link
                  to={`/knowledge/${doc.id}`}
                  className="font-display text-base font-semibold hover:text-brand-azure"
                >
                  {doc.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {categoryName ?? "Uncategorized"}
                </p>
                {doc.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {doc.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-[var(--radius-pill)] border border-border px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Updated {new Date(doc.updated_at).toLocaleDateString()}
                </p>
              </Card>
            )
          })}
        </div>
      )}

      <NewDocumentDialog open={newDocOpen} onOpenChange={setNewDocOpen} />
    </div>
  )
}
