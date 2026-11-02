import { useState } from "react"
import { Link } from "react-router-dom"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { HealthFlagBadge } from "@/components/shared/HealthFlagBadge"
import { useClients } from "./hooks"
import { FollowUpQueuePanel } from "./FollowUpQueuePanel"

/**
 * INFORMATION_ARCHITECTURE.md §5. Shell only — Supabase is connected and the
 * `clients` table exists, wired to real data here (PRD.md §5.5).
 */
export function NexusPage() {
  const { data: clients, isLoading } = useClients()
  const [search, setSearch] = useState("")

  const query = search.trim().toLowerCase()
  const matches = (clients ?? []).filter(
    (c) =>
      c.practice_name.toLowerCase().includes(query) ||
      c.primary_contact_name?.toLowerCase().includes(query),
  )

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="font-mono text-xs uppercase tracking-[1.68px] text-brand-cyan">
          Nexus
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Clients</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Product-facing name for the CRM department (DECISION_LOG.md §3).
        </p>
      </header>

      <FollowUpQueuePanel />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Contacts</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts by name…"
              aria-label="Search contacts by name"
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !clients || clients.length === 0 ? (
          <div className="glass-card">
            <p className="text-sm text-muted-foreground">No clients yet.</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="glass-card">
            <p className="text-sm text-muted-foreground">No contacts match “{search.trim()}”.</p>
          </div>
        ) : (
          <div className="glass-card overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Practice</TableHead>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <Link
                        to={`/nexus/${client.id}`}
                        className="font-medium text-foreground hover:text-brand-azure"
                      >
                        {client.practice_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {(client as { specialties?: { name: string } | null }).specialties
                        ?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <HealthFlagBadge
                        isFlagged={client.isFlagged}
                        lastContactedAt={client.lastContactedAt}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
