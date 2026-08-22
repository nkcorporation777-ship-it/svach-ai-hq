import { FunctionsHttpError } from "@supabase/supabase-js"

/**
 * supabase-js's FunctionsHttpError.message is always the generic "Edge Function
 * returned a non-2xx status code" — the actual JSON body an Edge Function sent
 * (e.g. `{error: "..."}`) lives on `error.context`, a Response, and has to be
 * read separately.
 */
export async function getFunctionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json()
      if (typeof body?.error === "string") return body.error
    } catch {
      // context wasn't JSON — fall through to the generic message below
    }
  }
  return error instanceof Error ? error.message : fallback
}
