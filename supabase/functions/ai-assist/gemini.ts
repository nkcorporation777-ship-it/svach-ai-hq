// GeminiProvider — first concrete implementation of the AIProvider shape
// defined in src/lib/ai/types.ts. Mirrored here (not imported) since Edge
// Functions run in a separate Deno runtime from the Vite-bundled src/ tree.

const GEMINI_MODEL = "gemini-3.6-flash"

export interface AIProvider {
  complete(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{ text: string; tokensUsed: number }>
}

export class GeminiProvider implements AIProvider {
  #apiKey: string

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set")
    }
    this.#apiKey = apiKey
  }

  async complete(systemPrompt: string, userPrompt: string) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
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

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`Gemini API error (${res.status}): ${body.slice(0, 500)}`)
    }

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
}
