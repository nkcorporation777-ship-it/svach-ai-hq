// Single generic Edge Function, parameterized by task_type — AI_ARCHITECTURE.md's
// "AI-Assist Architecture". Flow: verify session (platform-level via verify_jwt) →
// fetch entity + activities + Knowledge context → build prompt → call
// GeminiProvider.complete() → return draft only → write one audit_logs row.
//
// Nothing here ever sends, saves, or executes anything on the entity — the
// response is a draft string only, per the explicit rule in AI_ARCHITECTURE.md.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { GeminiProvider } from "./gemini.ts"

const ALLOWED_ORIGINS = new Set(["http://localhost:5173", "https://hq.svach.in"])

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : ""
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  }
}

type EntityType = "lead" | "client"

interface TaskTemplate {
  entityType: EntityType
  knowledgeCategorySlug: string
  systemPrompt: string
  buildUserPrompt: (
    entity: Record<string, any>,
    activities: Record<string, any>[],
    knowledge: Record<string, any>[],
  ) => string
}

function formatActivities(activities: Record<string, any>[]) {
  if (activities.length === 0) return "No activity logged yet."
  return activities
    .map((a) => `- [${a.type}] ${a.created_at}: ${a.content ?? "(no notes)"}`)
    .join("\n")
}

function formatKnowledge(docs: Record<string, any>[]) {
  if (docs.length === 0) return "No relevant Knowledge documents found."
  return docs
    .map((d) => `### ${d.title}\n${String(d.content ?? "").slice(0, 1000)}`)
    .join("\n\n")
}

const TASK_TEMPLATES: Record<string, TaskTemplate> = {
  draft_outreach_email: {
    entityType: "lead",
    knowledgeCategorySlug: "sales-playbooks",
    systemPrompt:
      "You are a helpful assistant for Svach AI, an AI agency serving healthcare practices. Draft a warm, professional first-touch outreach email to a lead. Keep it concise (under 150 words), reference their specialty if known, and end with a clear, low-pressure call to action. Output only the email body, no subject line, no unfilled placeholders.",
    buildUserPrompt: (lead, activities, knowledge) => `Lead details:
Practice: ${lead.practice_name}
Contact: ${lead.contact_name ?? "unknown"}
Specialty: ${lead.specialties?.name ?? "unknown"}
Source: ${lead.source ?? "unknown"}
Stage: ${lead.stage}

Recent activity:
${formatActivities(activities)}

Relevant playbook context:
${formatKnowledge(knowledge)}

Draft the outreach email now.`,
  },
  summarize_call: {
    entityType: "lead",
    knowledgeCategorySlug: "sales-playbooks",
    systemPrompt:
      "You summarize sales call notes into a brief, structured summary for a CRM. Use short bullet points: key points discussed, concerns raised, and next steps if mentioned. Do not invent details not present in the notes.",
    buildUserPrompt: (lead, activities) => `Practice: ${lead.practice_name}

Activity log (most recent first):
${formatActivities(activities)}

Summarize the most recent call. If there is no call activity, say so plainly.`,
  },
  suggest_next_action: {
    entityType: "lead",
    knowledgeCategorySlug: "sales-playbooks",
    systemPrompt:
      "You suggest exactly ONE concrete next action for a sales rep to take on a lead, based on its pipeline stage and activity history. Be specific and brief (1-2 sentences). Do not suggest generic advice like 'follow up' without specifics.",
    buildUserPrompt: (lead, activities, knowledge) => `Practice: ${lead.practice_name}
Stage: ${lead.stage}

Recent activity:
${formatActivities(activities)}

Relevant playbook context:
${formatKnowledge(knowledge)}

Suggest the single best next action.`,
  },
  draft_follow_up: {
    entityType: "client",
    knowledgeCategorySlug: "sops",
    systemPrompt:
      "You are a helpful assistant for Svach AI. Draft a warm, brief follow-up message to an existing client (not a lead) — checking in, not selling. Under 100 words. Output only the message body.",
    buildUserPrompt: (client, activities, knowledge) => `Client: ${client.practice_name}
Contact: ${client.primary_contact_name ?? "unknown"}

Recent activity:
${formatActivities(activities)}

Relevant SOP context:
${formatKnowledge(knowledge)}

Draft the follow-up message now.`,
  },
  summarize_activity: {
    entityType: "client",
    knowledgeCategorySlug: "sops",
    systemPrompt:
      "You summarize a client's recent activity into a brief status update, 3-5 bullet points, for an internal team member catching up. Do not invent details not present in the notes.",
    buildUserPrompt: (client, activities) => `Client: ${client.practice_name}

Activity log (most recent first):
${formatActivities(activities)}

Summarize recent activity.`,
  },
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin")
  const headers = corsHeaders(origin)

  if (req.method === "OPTIONS") {
    return new Response(null, { headers })
  }

  try {
    const { task_type, entity_type, entity_id } = await req.json()

    const template = TASK_TEMPLATES[task_type]
    if (!template) {
      return new Response(JSON.stringify({ error: `Unknown task_type: ${task_type}` }), {
        status: 400,
        headers: { ...headers, "content-type": "application/json" },
      })
    }
    if (template.entityType !== entity_type) {
      return new Response(
        JSON.stringify({
          error: `task_type ${task_type} is not valid for entity_type ${entity_type}`,
        }),
        { status: 400, headers: { ...headers, "content-type": "application/json" } },
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!

    const admin = createClient(supabaseUrl, serviceRoleKey)

    // Resolve the calling user's id for the audit log — verify_jwt already
    // blocked bad/missing tokens at the platform level; this just identifies who.
    const authHeader = req.headers.get("Authorization") ?? ""
    const jwt = authHeader.replace("Bearer ", "")
    const anonClient = createClient(supabaseUrl, anonKey)
    const { data: userData } = await anonClient.auth.getUser(jwt)
    const actorId = userData?.user?.id ?? null

    const table = entity_type === "lead" ? "leads" : "clients"
    const { data: entity, error: entityError } = await admin
      .from(table)
      .select("*, specialties(name)")
      .eq("id", entity_id)
      .single()
    if (entityError || !entity) {
      return new Response(JSON.stringify({ error: "Entity not found" }), {
        status: 404,
        headers: { ...headers, "content-type": "application/json" },
      })
    }

    const { data: activities } = await admin
      .from("activities")
      .select("*")
      .eq("entity_type", entity_type)
      .eq("entity_id", entity_id)
      .order("created_at", { ascending: false })
      .limit(10)

    const { data: category } = await admin
      .from("knowledge_categories")
      .select("id")
      .eq("slug", template.knowledgeCategorySlug)
      .maybeSingle()

    let knowledge: Record<string, any>[] = []
    if (category) {
      const { data } = await admin
        .from("knowledge_documents")
        .select("title, content")
        .eq("category_id", category.id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(3)
      knowledge = data ?? []
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY")
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI provider not configured — GEMINI_API_KEY is missing." }),
        { status: 503, headers: { ...headers, "content-type": "application/json" } },
      )
    }

    const provider = new GeminiProvider(apiKey)
    const userPrompt = template.buildUserPrompt(entity, activities ?? [], knowledge)
    const { text, tokensUsed } = await provider.complete(template.systemPrompt, userPrompt)

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_type: "agent",
      actor_id: actorId,
      action: `ai_assist.${task_type}`,
      entity_type,
      entity_id,
      metadata: { provider: "gemini", tokens_used: tokensUsed },
    })
    if (auditError) console.error("audit log write failed:", auditError)

    return new Response(JSON.stringify({ text }), {
      headers: { ...headers, "content-type": "application/json" },
    })
  } catch (err) {
    console.error("ai-assist error:", err)
    const message = err instanceof Error ? err.message : "Unexpected error"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...headers, "content-type": "application/json" },
    })
  }
})
