import { useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { supabase, REMEMBER_ME_KEY } from "@/lib/supabase/client"
import { useAuth } from "@/app/providers/useAuth"

/**
 * Owner-only login (DECISION_LOG.md §1) — no signup flow, the account is
 * provisioned directly via the Supabase dashboard, not through this app.
 */
export function LoginPage() {
  const { session } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) {
    const from = (location.state as { from?: Location })?.from?.pathname ?? "/"
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    // Set before signing in — the storage adapter reads this to decide where
    // the session lands (client.ts).
    localStorage.setItem(REMEMBER_ME_KEY, String(rememberMe))
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) {
      setError(error.message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="glass-card w-full max-w-sm">
        <h1 className="font-display text-xl font-semibold">Svach AI HQ</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to continue.</p>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-[var(--radius-pill)] border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm text-muted-foreground">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-[var(--radius-pill)] border border-border bg-transparent px-3 py-2 pr-10 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded border-border accent-brand-azure"
            />
            Keep me logged in
          </label>

          {error && <p className="text-sm text-status-error">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-[var(--radius-card)] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-[var(--duration-button)] ease-[var(--ease-standard)] hover:bg-brand-azure disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </div>
  )
}
