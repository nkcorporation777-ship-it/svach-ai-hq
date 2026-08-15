import { createContext, useContext } from "react"
import type { Session } from "@supabase/supabase-js"

export interface AuthContextValue {
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

/**
 * Split out from AuthProvider.tsx — a file exporting both a component and a
 * hook breaks React Fast Refresh (Vite: "Could not Fast Refresh (\"useAuth\"
 * export is incompatible)"), which tears down the live context on unrelated
 * HMR updates and throws "useAuth must be used within AuthProvider" for
 * already-mounted consumers. One file per export kind fixes it structurally.
 */
export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
