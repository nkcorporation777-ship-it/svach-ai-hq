import { Link } from "react-router-dom"
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

/**
 * INFORMATION_ARCHITECTURE.md §5. Shell only — Supabase is connected and the
 * `clients` table exists, wired to real data here (PRD.md §5.5).
 */
export function NexusPage() {
  const { data: clients, isLoading } = useClients()

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

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !clients || clients.length === 0 ? (
        <div className="glass-card">
          <p className="text-sm text-muted-foreground">No clients yet.</p>
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
              {clients.map((client) => (
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
                    {(client as { specialties?: { name: string } | null }).specialties?.name ??
                      "—"}
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
    </div>
  )
}
