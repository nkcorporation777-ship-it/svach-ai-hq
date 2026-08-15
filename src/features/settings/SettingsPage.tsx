import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/app/providers/useAuth"

/**
 * INFORMATION_ARCHITECTURE.md §7 — minimal. Profile fields only; no team
 * management, no billing (V1 is single-user/Owner-only, DECISION_LOG.md §1).
 */
export function SettingsPage() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user.id

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, permission_role")
        .eq("id", userId!)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })

  const [fullName, setFullName] = useState("")

  useEffect(() => {
    if (profile) setFullName(profile.full_name ?? "")
  }, [profile])

  const updateProfile = useMutation({
    mutationFn: async (full_name: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name })
        .eq("id", userId!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] })
    },
  })

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
          Settings
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Profile</h1>
      </header>

      <div className="glass-card max-w-md">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              updateProfile.mutate(fullName)
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="full_name" className="text-sm text-muted-foreground">
                Full name
              </label>
              <input
                id="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="rounded-[var(--radius-pill)] border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Email</span>
              <p className="text-sm">{session?.user.email}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Role</span>
              <p className="text-sm capitalize">{profile?.permission_role}</p>
            </div>

            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="mt-2 self-start rounded-[var(--radius-card)] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-[var(--duration-button)] ease-[var(--ease-standard)] hover:bg-brand-azure disabled:opacity-60"
            >
              {updateProfile.isPending ? "Saving…" : "Save"}
            </button>
            {updateProfile.isSuccess && (
              <p className="text-sm text-status-success">Saved.</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
