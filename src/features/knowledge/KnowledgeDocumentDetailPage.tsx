import { useRef, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { useForm, Controller } from "react-hook-form"
import { ArrowLeft, ChevronDown, ChevronRight, Download, ExternalLink, Link2, Paperclip, Trash2, Upload } from "lucide-react"
import { Card } from "@/components/shared/Card"
import { MarkdownContent } from "@/components/shared/MarkdownContent"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supabase } from "@/lib/supabase/client"
import { useKnowledgeCategories } from "@/hooks/useKnowledgeCategories"
import {
  useKnowledgeDocument,
  useKnowledgeDocumentAttachments,
  useKnowledgeDocumentVersions,
  useUpdateKnowledgeDocument,
  useDeleteKnowledgeDocument,
  useUploadKnowledgeDocumentAttachment,
  useAddKnowledgeDocumentLink,
} from "./hooks"

type EditFormValues = {
  title: string
  category_id: string
  tags: string
  content: string
}

/** INFORMATION_ARCHITECTURE.md §3.2 — edit-in-place, literally toggled on this
 * page (not a separate route/modal), plus version history and attachments. */
export function KnowledgeDocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: doc, isLoading } = useKnowledgeDocument(id)
  const { data: categories } = useKnowledgeCategories()
  const { data: versions } = useKnowledgeDocumentVersions(id)
  const { data: attachments } = useKnowledgeDocumentAttachments(id)
  const updateDoc = useUpdateKnowledgeDocument(id ?? "")
  const deleteDoc = useDeleteKnowledgeDocument()
  const uploadAttachment = useUploadKnowledgeDocumentAttachment(id ?? "")
  const addLink = useAddKnowledgeDocumentLink(id ?? "")

  const [isEditing, setIsEditing] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set())
  const [isAddingLink, setIsAddingLink] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")
  const [linkLabel, setLinkLabel] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // `values` (not a manual reset()-in-useEffect) is RHF's documented way to
  // keep a form synced with async-loaded data — a manual reset() raced with
  // Controller's own register/unregister cycle under React 19 StrictMode's
  // double-invoke in dev, intermittently reverting category_id after it had
  // already been set correctly.
  const { register, handleSubmit, control } = useForm<EditFormValues>({
    values: doc
      ? {
          title: doc.title,
          category_id: doc.category_id ?? "",
          tags: doc.tags.join(", "),
          content: doc.content ?? "",
        }
      : undefined,
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>
  if (!doc) return <p className="text-sm text-muted-foreground">Document not found.</p>

  const categoryName = (doc as { knowledge_categories?: { name: string } | null })
    .knowledge_categories?.name

  async function onSave(values: EditFormValues) {
    await updateDoc.mutateAsync({
      title: values.title,
      category_id: values.category_id || null,
      tags: values.tags.split(",").map((t) => t.trim()).filter(Boolean),
      content: values.content || null,
    })
    setIsEditing(false)
  }

  async function handleDownload(filePath: string, fileName: string) {
    const { data, error } = await supabase.storage
      .from("knowledge-attachments")
      .createSignedUrl(filePath, 60)
    if (error || !data) {
      window.alert(`Couldn't generate a download link: ${error?.message ?? "unknown error"}`)
      return
    }
    const link = document.createElement("a")
    link.href = data.signedUrl
    link.download = fileName
    link.target = "_blank"
    link.rel = "noreferrer"
    link.click()
  }

  async function handleAddLink() {
    if (!linkUrl.trim() || !linkLabel.trim()) return
    await addLink.mutateAsync({ url: linkUrl.trim(), label: linkLabel.trim() })
    setLinkUrl("")
    setLinkLabel("")
    setIsAddingLink(false)
  }

  function toggleVersion(versionId: string) {
    setExpandedVersions((prev) => {
      const next = new Set(prev)
      if (next.has(versionId)) next.delete(versionId)
      else next.add(versionId)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        to="/knowledge"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Knowledge
      </Link>

      <header className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
            {categoryName ?? "Uncategorized"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold">{doc.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              Edit
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteOpen(true)}>
            <Trash2 className="size-4 text-status-error" />
            Delete
          </Button>
        </div>
      </header>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          setConfirmDeleteOpen(open)
          if (!open) deleteDoc.reset()
        }}
        title="Delete this document?"
        description={`"${doc.title}" will be removed from Knowledge. Version history and attachments are kept.`}
        confirmLabel="Delete"
        isSubmitting={deleteDoc.isPending}
        errorMessage={deleteDoc.error?.message}
        onConfirm={() => {
          deleteDoc.mutate(doc.id, { onSuccess: () => navigate("/knowledge") })
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            {isEditing ? (
              <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" {...register("title", { required: true })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Category</Label>
                  <Controller
                    control={control}
                    name="category_id"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          {/* Explicit children, not Radix's auto-lookup — the
                           * lookup only resolves once its SelectItem has
                           * rendered inside an opened dropdown, so a value
                           * pre-filled from existing data (not user-clicked)
                           * would otherwise show the placeholder. */}
                          <SelectValue placeholder="Select a category">
                            {categories?.find((c) => c.id === field.value)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tags">Tags</Label>
                  <Input id="tags" {...register("tags")} placeholder="Comma-separated" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="content">Content (Markdown)</Label>
                  <Textarea id="content" rows={14} className="font-mono text-xs" {...register("content")} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateDoc.isPending}>
                    {updateDoc.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </form>
            ) : doc.content ? (
              <MarkdownContent content={doc.content} />
            ) : (
              <p className="text-sm text-muted-foreground">
                No content yet. Click Edit to add some.
              </p>
            )}
          </Card>

          <Card>
            <h2 className="font-display text-base font-semibold">Version History</h2>
            {!versions || versions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No past versions yet — edits to this document's content will appear here.
              </p>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {versions.map((v) => {
                  const expanded = expandedVersions.has(v.id)
                  return (
                    <div key={v.id} className="rounded-[var(--radius-card)] border border-border">
                      <button
                        type="button"
                        onClick={() => toggleVersion(v.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                      >
                        {expanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">Version {v.version_number}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.created_at).toLocaleString()}
                        </span>
                      </button>
                      {expanded && (
                        <div className="border-t border-border px-3 py-3">
                          {v.content ? (
                            <MarkdownContent content={v.content} />
                          ) : (
                            <p className="text-sm text-muted-foreground">Empty at this version.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="font-display text-base font-semibold">Details</h2>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Category</dt>
                <dd>{categoryName ?? "Uncategorized"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tags</dt>
                <dd>
                  {doc.tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {doc.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-[var(--radius-pill)] border border-border px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Updated</dt>
                <dd>{new Date(doc.updated_at).toLocaleString()}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">Attachments</h2>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsAddingLink((v) => !v)}
                >
                  <Link2 className="size-4" />
                  Add Link
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAttachment.isPending}
                >
                  <Upload className="size-4" />
                  {uploadAttachment.isPending ? "Uploading…" : "Upload"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadAttachment.mutate(file)
                    e.target.value = ""
                  }}
                />
              </div>
            </div>

            {isAddingLink && (
              <div className="mt-3 flex flex-col gap-2 rounded-[var(--radius-card)] border border-border p-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="link-label">Label</Label>
                  <Input
                    id="link-label"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="e.g. Onboarding SOP (Google Doc)"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="link-url">URL</Label>
                  <Input
                    id="link-url"
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsAddingLink(false)
                      setLinkUrl("")
                      setLinkLabel("")
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!linkUrl.trim() || !linkLabel.trim() || addLink.isPending}
                    onClick={handleAddLink}
                  >
                    {addLink.isPending ? "Adding…" : "Add"}
                  </Button>
                </div>
                {addLink.isError && (
                  <p className="text-xs text-status-error">
                    Couldn't add link — {addLink.error instanceof Error ? addLink.error.message : "unknown error"}.
                  </p>
                )}
              </div>
            )}

            {uploadAttachment.isError && (
              <p className="mt-2 text-xs text-status-error">
                Upload failed — {uploadAttachment.error instanceof Error ? uploadAttachment.error.message : "unknown error"}.
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {!attachments || attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments.</p>
              ) : (
                attachments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-[var(--radius-pill)] border border-border px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {a.attachment_type === "link" ? (
                        <Link2 className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate text-sm">{a.file_name}</span>
                    </div>
                    {a.attachment_type === "link" ? (
                      <Button size="icon-sm" variant="ghost" asChild aria-label={`Open ${a.file_name}`}>
                        <a href={a.url!} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    ) : (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleDownload(a.file_path!, a.file_name)}
                        aria-label={`Download ${a.file_name}`}
                      >
                        <Download className="size-4" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
