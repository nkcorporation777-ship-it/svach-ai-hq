// GeminiProvider — first concrete implementation of the AIProvider shape
// defined in src/lib/ai/types.ts. Mirrored here (not imported) since Edge
// Functions run in a separate Deno runtime from the Vite-bundled src/ tree.

const GEMINI_MODEL = "gemini-3.6-flash"

// Gemini periodically answers 503 "high demand" (and 429/500) for minutes at a
// time — transient by Google's own wording. Retry with a short backoff, then
// optionally fall back to GEMINI_FALLBACK_MODEL (unset by default; model names
// get deprecated, so we don't hardcode a guess).
const RETRYABLE_STATUSES = new Set([429, 500, 503])
const ATTEMPTS_PER_MODEL = 3
const BACKOFF_MS = [1000, 2500]

export interface AIProvider {
  complete(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{ text: string; tokensUsed: number }>
}

export class GeminiProvider implements AIProvider {
  #apiKey: string
  #fallbackModel: string | null

  constructor(apiKey: string, fallbackModel?: string | null) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set")
    }
    this.#apiKey = apiKey
    this.#fallbackModel = fallbackModel && fallbackModel !== GEMINI_MODEL ? fallbackModel : null
  }

  async complete(systemPrompt: string, userPrompt: string) {
    const models = this.#fallbackModel ? [GEMINI_MODEL, this.#fallbackModel] : [GEMINI_MODEL]
    let lastError = ""

    for (const model of models) {
      for (let attempt = 0; attempt < ATTEMPTS_PER_MODEL; attempt++) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": this.#apiKey,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            }),
          },
        )

        if (res.ok) {
          const data = await res.json()
          const text =
            data?.candidates?.[0]?.content?.parts
              ?.map((p: { text?: string }) => p.text ?? "")
              .join("") ?? ""
          const tokensUsed = data?.usageMetadata?.totalTokenCount ?? 0

          if (!text) {
            throw new Error("Gemini returned an empty response")
          }

          return { text, tokensUsed }
        }

        const body = await res.text().catch(() => "")
        lastError = `Gemini API error (${res.status}) on ${model}: ${body.slice(0, 500)}`

        // Non-transient errors (bad key, deprecated model → 404, bad request)
        // won't improve on retry — surface them immediately.
        if (!RETRYABLE_STATUSES.has(res.status)) {
          throw new Error(lastError)
        }
        if (attempt < ATTEMPTS_PER_MODEL - 1) {
          await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS[attempt]))
        }
      }
    }

    throw new Error(lastError)
  }
}
