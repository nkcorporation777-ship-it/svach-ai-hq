import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { useKnowledgeCategories } from "@/hooks/useKnowledgeCategories"
import { useCreateKnowledgeDocument } from "./hooks"

/** category + tags required at creation, content optional (PRD.md §5.3). */
const schema = z.object({
  title: z.string().min(1, "Required"),
  category_id: z.string().min(1, "Required"),
  tags: z.string().min(1, "Required"),
  content: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function NewDocumentDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const { data: categories } = useKnowledgeCategories()
  const createDocument = useCreateKnowledgeDocument()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    const doc = await createDocument.mutateAsync({
      title: values.title,
      category_id: values.category_id,
      tags: values.tags.split(",").map((t) => t.trim()).filter(Boolean),
      content: values.content || null,
    })
    reset()
    onOpenChange(false)
    navigate(`/knowledge/${doc.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Document</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} />
            {errors.title && (
              <p className="text-xs text-status-error">{errors.title.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select
              value={watch("category_id")}
              onValueChange={(v) => setValue("category_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category">
                  {categories?.find((c) => c.id === watch("category_id"))?.name}
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
            {errors.category_id && (
              <p className="text-xs text-status-error">{errors.category_id.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" {...register("tags")} placeholder="e.g. onboarding, pricing" />
            <p className="text-xs text-muted-foreground">Comma-separated</p>
            {errors.tags && (
              <p className="text-xs text-status-error">{errors.tags.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content">Content</Label>
            <Textarea id="content" rows={6} {...register("content")} placeholder="Markdown (optional — can be filled in later)" />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createDocument.isPending}>
              {createDocument.isPending ? "Creating…" : "Create Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
