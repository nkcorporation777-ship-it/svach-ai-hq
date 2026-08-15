/**
 * AIProvider interface — AI_ARCHITECTURE.md "Provider Abstraction Layer".
 *
 * Scope: AI-assist only (draft/summarize/suggest). Does NOT cover OOA's reasoning —
 * that runs on Hermes, outside this codebase (DECISION_LOG.md §10).
 *
 * No concrete provider is chosen yet (DECISION_LOG.md §7). This interface lets every
 * Edge Function and prompt template be built now; the concrete implementation
 * (AnthropicProvider, OpenAIProvider, ...) drops in later without touching callers.
 */
export interface AIProvider {
  complete(
    systemPrompt: string,
    userPrompt: string,
    context?: Record<string, unknown>,
  ): Promise<{ text: string; tokensUsed: number }>
}
