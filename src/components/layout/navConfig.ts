import {
  LayoutDashboard,
  BookOpen,
  Target,
  Users,
  Rocket,
  Megaphone,
  Wallet,
  Headphones,
  Settings,
  type LucideIcon,
} from "lucide-react"

/**
 * Sidebar nav, per INFORMATION_ARCHITECTURE.md §1. Locked modules stay visible
 * with an honest phase tag — never hidden, never a fake preview.
 */
export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  status: "live" | "locked"
  phaseTag?: string
}

export const primaryNav: NavItem[] = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, status: "live" },
]

export const globalNav: NavItem[] = [
  { label: "Knowledge", path: "/knowledge", icon: BookOpen, status: "live" },
]

export const departmentNav: NavItem[] = [
  { label: "Sales", path: "/sales", icon: Target, status: "live" },
  { label: "Nexus", path: "/nexus", icon: Users, status: "live" },
  {
    label: "Delivery",
    path: "/delivery",
    icon: Rocket,
    status: "locked",
    phaseTag: "Phase 2",
  },
  {
    label: "Marketing",
    path: "/marketing",
    icon: Megaphone,
    status: "locked",
    phaseTag: "Phase 4",
  },
  {
    label: "Finance",
    path: "/finance",
    icon: Wallet,
    status: "locked",
    phaseTag: "Phase 3",
  },
  {
    label: "Support",
    path: "/support",
    icon: Headphones,
    status: "locked",
    phaseTag: "Phase 4",
  },
]

export const settingsNav: NavItem[] = [
  { label: "Settings", path: "/settings", icon: Settings, status: "live" },
]
