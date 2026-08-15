import type { RouteObject } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { RequireAuth } from "@/components/layout/RequireAuth"
import { LockedModulePlaceholder } from "@/components/layout/LockedModulePlaceholder"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { KnowledgePage } from "@/features/knowledge/KnowledgePage"
import { KnowledgeDocumentDetailPage } from "@/features/knowledge/KnowledgeDocumentDetailPage"
import { SalesPage } from "@/features/sales/SalesPage"
import { LeadDetailPage } from "@/features/sales/LeadDetailPage"
import { NexusPage } from "@/features/nexus/NexusPage"
import { ClientDetailPage } from "@/features/nexus/ClientDetailPage"
import { SettingsPage } from "@/features/settings/SettingsPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { Rocket, Megaphone, Wallet, Headphones } from "lucide-react"

/** One route per INFORMATION_ARCHITECTURE.md §1 sidebar item. */
export const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/knowledge", element: <KnowledgePage /> },
      { path: "/knowledge/:id", element: <KnowledgeDocumentDetailPage /> },
      { path: "/sales", element: <SalesPage /> },
      { path: "/sales/:id", element: <LeadDetailPage /> },
      { path: "/nexus", element: <NexusPage /> },
      { path: "/nexus/:id", element: <ClientDetailPage /> },
      { path: "/settings", element: <SettingsPage /> },
      {
        path: "/delivery",
        element: (
          <LockedModulePlaceholder
            icon={Rocket}
            label="Delivery"
            phaseTag="Phase 2"
            description="Project Manager Agent, structured around Discover → Design → Deploy → Optimise."
          />
        ),
      },
      {
        path: "/marketing",
        element: (
          <LockedModulePlaceholder
            icon={Megaphone}
            label="Marketing"
            phaseTag="Phase 4"
            description="Social media scheduling and analytics."
          />
        ),
      },
      {
        path: "/finance",
        element: (
          <LockedModulePlaceholder
            icon={Wallet}
            label="Finance"
            phaseTag="Phase 3"
            description="Invoicing, payment tracking, expense tracking, revenue dashboard."
          />
        ),
      },
      {
        path: "/support",
        element: (
          <LockedModulePlaceholder
            icon={Headphones}
            label="Support"
            phaseTag="Phase 4"
            description="Support tickets, bug tracker, SLA monitor."
          />
        ),
      },
    ],
  },
]
