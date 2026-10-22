import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { GlowCard } from "@/components/shared/GlowCard"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  EXPENSE_CATEGORIES,
  formatMoney,
  useBillableClients,
  useDeleteExpense,
  useExpenses,
  useSaveExpense,
} from "./hooks"

const NO_CLIENT = "none"
const today = () => new Date().toISOString().slice(0, 10)
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function AddExpenseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const save = useSaveExpense()
  const { data: clients } = useBillableClients()
  const [spentOn, setSpentOn] = useState(today())
  const [category, setCategory] = useState<string>("software")
  const [vendor, setVendor] = useState("")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [clientId, setClientId] = useState(NO_CLIENT)
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setSpentOn(today())
    setCategory("software")
    setVendor("")
    setDescription("")
    setAmount("")
    setClientId(NO_CLIENT)
    setNotes("")
    setError(null)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const value = Number(amount)
    if (!(value > 0)) return setError("Enter the amount spent.")
    try {
      await save.mutateAsync({
        spentOn,
        category,
        vendor,
        description,
        amount: value,
        clientId: clientId === NO_CLIENT ? null : clientId,
        notes,
      })
      reset()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the expense.")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp_date">Date</Label>
              <Input id="exp_date" type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp_amount">Amount (₹, incl. GST)</Label>
              <Input
                id="exp_amount"
                type="number"
                min={0}
                step="0.01"
                className="no-spinner"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue>{label(category)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {label(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exp_vendor">Paid to</Label>
              <Input id="exp_vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp_desc">What it was for</Label>
            <Input id="exp_desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>For a client (optional)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {clientId === NO_CLIENT ? "Not for a specific client" : clients?.find((c) => c.id === clientId)?.practice_name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CLIENT}>Not for a specific client</SelectItem>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.practice_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp_notes">Notes / receipt reference</Label>
            <Textarea id="exp_notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-status-error">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ExpensesTab() {
  const { data: expenses, isLoading } = useExpenses()
  const del = useDeleteExpense()
  const [addOpen, setAddOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add expense
        </Button>
      </div>

      <GlowCard tone="amber" className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : !expenses || expenses.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No expenses logged yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Paid to</TableHead>
                <TableHead className="hidden md:table-cell">For</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((e) => {
                const client = (e as { clients?: { practice_name: string } | null }).clients
                return (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{e.spent_on}</TableCell>
                    <TableCell>{label(e.category)}</TableCell>
                    <TableCell>
                      {e.vendor ?? "—"}
                      {e.description && <span className="block text-xs text-muted-foreground">{e.description}</span>}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{client?.practice_name ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">{formatMoney(e.amount)}</TableCell>
                    <TableCell className="text-right">
                      {confirmId === e.id ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-status-error"
                          disabled={del.isPending}
                          onClick={() => del.mutate(e.id, { onSettled: () => setConfirmId(null) })}
                        >
                          Delete?
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setConfirmId(e.id)}>
                          <Trash2 className="size-4" />
                          <span className="sr-only">Delete expense</span>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </GlowCard>

      <AddExpenseDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
