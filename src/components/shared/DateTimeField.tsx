import { useState } from "react"
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseValue(value: string) {
  if (!value) return { date: null as Date | null, time: "" }
  const [datePart, timePart] = value.split("T")
  const [y, m, d] = datePart.split("-").map(Number)
  return { date: new Date(y, m - 1, d), time: timePart ?? "" }
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const totalMinutes = i * 30
  const h24 = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const period = h24 < 12 ? "AM" : "PM"
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return { value: `${pad(h24)}:${pad(m)}`, label: `${h12}:${pad(m)} ${period}` }
})

/** Replaces the native `datetime-local` input, whose display format (and
 * "--" placeholder segments) follow the browser/OS locale rather than a
 * fixed format. Date always renders/enters as dd/mm/yyyy; time is a plain
 * dropdown of 30-minute slots. Value/onChange keep the same
 * "yyyy-mm-ddTHH:mm" shape datetime-local produced, so callers are
 * unaffected. */
export function DateTimeField({
  value,
  onChange,
  dateLabel = "Date",
  timeLabel = "Time",
  id,
}: {
  value: string
  onChange: (value: string) => void
  dateLabel?: string
  timeLabel?: string
  id?: string
}) {
  const { date, time } = parseValue(value)
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => date ?? new Date())

  function commitDate(d: Date) {
    onChange(`${toDateKey(d)}T${time || "09:00"}`)
    setOpen(false)
  }

  function commitTime(t: string) {
    onChange(`${toDateKey(date ?? new Date())}T${t}`)
  }

  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const startWeekday = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(
    viewMonth.getFullYear(),
    viewMonth.getMonth() + 1,
    0,
  ).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d))
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor={id}>{dateLabel}</Label>
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (next) setViewMonth(date ?? new Date())
            setOpen(next)
          }}
        >
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              className={cn(
                "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]",
                "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                !date && "text-muted-foreground",
              )}
            >
              {date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` : "dd/mm/yyyy"}
              <CalendarIcon className="size-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="flex items-center justify-between pb-2">
              <button
                type="button"
                onClick={() =>
                  setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))
                }
                className="rounded p-1 hover:bg-accent"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
              <span className="text-sm font-medium">
                {MONTH_NAMES[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() =>
                  setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))
                }
                className="rounded p-1 hover:bg-accent"
              >
                <ChevronRightIcon className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {WEEKDAYS.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 pt-1">
              {cells.map((d, i) =>
                d ? (
                  <button
                    key={i}
                    type="button"
                    onClick={() => commitDate(d)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md text-sm hover:bg-accent",
                      date &&
                        toDateKey(date) === toDateKey(d) &&
                        "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                  >
                    {d.getDate()}
                  </button>
                ) : (
                  <div key={i} />
                ),
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{timeLabel}</Label>
        <Select value={time || undefined} onValueChange={commitTime}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Select time" />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
