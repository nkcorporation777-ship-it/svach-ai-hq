import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

/**
 * Client-side Supabase client — public anon/publishable key + URL only.
 *
 * Per SECURITY_POLICY.md / AI_ARCHITECTURE.md: no service-role key, no Hermes
 * credential, no elevated credential of any kind ever belongs here. Privileged
 * operations (AI-assist, Hermes boundary) go through server-side Edge Functions,
 * not this client.
 *
 * Connected to the dedicated Svach AI HQ project (fsfzenkycnoxearenpdp).
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — check .env.local.",
  )
}

/**
 * "Keep me logged in" (LoginPage.tsx) — the preference itself always lives in
 * localStorage (just a flag, not session data), but it decides where the
 * *session* actually gets written: localStorage when checked (survives
 * browser restarts — supabase-js's own default), sessionStorage when
 * unchecked (cleared the moment the tab/browser closes). Read fresh on every
 * call rather than cached, since the preference can change between sign-ins
 * in the same tab.
 */
export const REMEMBER_ME_KEY = "svach-remember-me"

function activeStorage(): Storage {
  return localStorage.getItem(REMEMBER_ME_KEY) === "false" ? sessionStorage : localStorage
}

const sessionStorageAdapter = {
  getItem: (key: string) => activeStorage().getItem(key),
  setItem: (key: string, value: string) => activeStorage().setItem(key, value),
  removeItem: (key: string) => activeStorage().removeItem(key),
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: { storage: sessionStorageAdapter },
})
