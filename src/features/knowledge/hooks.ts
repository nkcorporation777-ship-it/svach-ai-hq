import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import type { TablesInsert } from "@/types/database"

export function useKnowledgeDocuments(filters: {
  search?: string
  categoryId?: string
  tag?: string
}) {
  return useQuery({
    queryKey: ["knowledgeDocuments", filters],
    queryFn: async () => {
      let query = supabase
        .from("knowledge_documents")
        .select("*, knowledge_categories(name, slug)")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })

      if (filters.search) {
        query = query.textSearch("search_vector", filters.search, {
          type: "websearch",
          config: "english",
        })
      }
      if (filters.categoryId) {
        query = query.eq("category_id", filters.categoryId)
      }
      if (filters.tag) {
        query = query.contains("tags", [filters.tag])
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

/** Deliberately does not filter `deleted_at is null` — same as useLead/useClient,
 * a direct detail-page hit on a soft-deleted record should still resolve. */
export function useKnowledgeDocument(id: string | undefined) {
  return useQuery({
    queryKey: ["knowledgeDocuments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .select("*, knowledge_categories(name, slug)")
        .eq("id", id!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })
}

export function useKnowledgeDocumentVersions(documentId: string | undefined) {
  return useQuery({
    queryKey: ["knowledgeDocumentVersions", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_document_versions")
        .select("*")
        .eq("document_id", documentId!)
        .order("version_number", { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!documentId,
  })
}

export function useKnowledgeDocumentAttachments(documentId: string | undefined) {
  return useQuery({
    queryKey: ["knowledgeDocumentAttachments", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_document_attachments")
        .select("*")
        .eq("document_id", documentId!)
        .order("created_at", { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!documentId,
  })
}

export function useCreateKnowledgeDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (doc: TablesInsert<"knowledge_documents">) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from("knowledge_documents")
        .insert({ ...doc, created_by: user?.id ?? null })
        .select()
        .single()
      if (error) throw error
      await logAudit({
        action: "knowledge_document.created",
        entityType: "knowledge_document",
        entityId: data.id,
        metadata: { title: data.title },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeDocuments"] })
    },
  })
}

/** The version row for this edit is written by the DB trigger
 * `trg_snapshot_knowledge_document_version`, not by this mutation — it fires
 * automatically whenever `content` actually changes (DATABASE_SCHEMA.md). */
export function useUpdateKnowledgeDocument(documentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      updates: Partial<Pick<TablesInsert<"knowledge_documents">, "title" | "content" | "category_id" | "tags">>,
    ) => {
      const { data, error } = await supabase
        .from("knowledge_documents")
        .update(updates)
        .eq("id", documentId)
        .select()
        .single()
      if (error) throw error
      await logAudit({
        action: "knowledge_document.updated",
        entityType: "knowledge_document",
        entityId: documentId,
        metadata: { title: data.title },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeDocuments"] })
      queryClient.invalidateQueries({ queryKey: ["knowledgeDocumentVersions", documentId] })
    },
  })
}

/** Soft delete only — version history and attachment rows are retained, never
 * cascade-deleted (PRD.md §5.3's explicit business rule). */
export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from("knowledge_documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", documentId)
      if (error) throw error
      await logAudit({
        action: "knowledge_document.deleted",
        entityType: "knowledge_document",
        entityId: documentId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeDocuments"] })
    },
  })
}

/** Storage path is generated client-side, never the raw filename — avoids path
 * traversal/overwrite even without a server-side upload proxy (no Edge Function
 * infra exists yet — see plan's flagged scope note). */
export function useUploadKnowledgeDocumentAttachment(documentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ""
      const path = `${documentId}/${crypto.randomUUID()}${ext}`

      const { error: uploadError } = await supabase.storage
        .from("knowledge-attachments")
        .upload(path, file)
      if (uploadError) throw uploadError

      const { data, error } = await supabase
        .from("knowledge_document_attachments")
        .insert({
          document_id: documentId,
          attachment_type: "file",
          file_path: path,
          file_name: file.name,
          uploaded_by: user?.id ?? null,
        })
        .select()
        .single()
      if (error) throw error

      await logAudit({
        action: "knowledge_document.attachment_uploaded",
        entityType: "knowledge_document",
        entityId: documentId,
        metadata: { file_name: file.name },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeDocumentAttachments", documentId] })
    },
  })
}

/** A link attachment — no Storage upload, just a URL + display label. Same
 * `knowledge_document_attachments` table as file uploads, disambiguated by
 * `attachment_type` (DB CHECK constraint enforces exactly one of
 * file_path/url is set, matching which type is declared). */
export function useAddKnowledgeDocumentLink(documentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ url, label }: { url: string; label: string }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data, error } = await supabase
        .from("knowledge_document_attachments")
        .insert({
          document_id: documentId,
          attachment_type: "link",
          url,
          file_name: label,
          uploaded_by: user?.id ?? null,
        })
        .select()
        .single()
      if (error) throw error

      await logAudit({
        action: "knowledge_document.link_attached",
        entityType: "knowledge_document",
        entityId: documentId,
        metadata: { url, label },
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledgeDocumentAttachments", documentId] })
    },
  })
}
