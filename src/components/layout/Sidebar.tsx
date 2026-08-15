import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  primaryNav,
  globalNav,
  departmentNav,
  settingsNav,
  type NavItem,
} from "./navConfig"

function NavRow({ item }: { item: NavItem }) {
  const Icon = item.icon

  if (item.status === "locked") {
    return (
      <NavLink
        to={item.path}
        className="flex items-center gap-3 rounded-[var(--radius-pill)] px-3 py-2 text-sm text-muted-foreground/70 transition-colors hover:bg-white/5"
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        <span className="rounded-[var(--radius-pill)] border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {item.phaseTag}
        </span>
      </NavLink>
    )
  }

  return (
    <NavLink
      to={item.path}
      end={item.path === "/"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-[var(--radius-pill)] px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-foreground"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  )
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-60 flex-col gap-6 border-r border-border bg-bg-secondary px-3 py-6">
      <div className="flex items-center gap-2 px-3">
        <div className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-brand-blue to-brand-cyan font-mono text-xs font-bold text-white">
          S
        </div>
        <span className="font-display text-sm font-semibold">Svach AI HQ</span>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {primaryNav.map((item) => (
            <NavRow key={item.path} item={item} />
          ))}
        </div>

        <div className="flex flex-col gap-0.5">
          {globalNav.map((item) => (
            <NavRow key={item.path} item={item} />
          ))}
        </div>

        <div className="flex flex-col gap-0.5 border-t border-border pt-4">
          {departmentNav.map((item) => (
            <NavRow key={item.path} item={item} />
          ))}
        </div>
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-border pt-4">
        {settingsNav.map((item) => (
          <NavRow key={item.path} item={item} />
        ))}
      </div>
    </aside>
  )
}
