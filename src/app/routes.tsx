import type { RouteObject } from "react-router-dom"
import { AppShell } from "@/components/layout/AppShell"
import { RequireAuth } from "@/components/layout/RequireAuth"
import { DashboardPage } from "@/features/dashboard/DashboardPage"
import { KnowledgePage } from "@/features/knowledge/KnowledgePage"
import { KnowledgeDocumentDetailPage } from "@/features/knowledge/KnowledgeDocumentDetailPage"
import { SalesPage } from "@/features/sales/SalesPage"
import { LeadDetailPage } from "@/features/sales/LeadDetailPage"
import { NexusPage } from "@/features/nexus/NexusPage"
import { ClientDetailPage } from "@/features/nexus/ClientDetailPage"
import { SettingsPage } from "@/features/settings/SettingsPage"
import { LoginPage } from "@/features/auth/LoginPage"
import { IntakePage } from "@/features/intake/IntakePage"
import { ProposalAcceptPage } from "@/features/proposals/ProposalAcceptPage"
import { DeliveryPage } from "@/features/delivery/DeliveryPage"
import { ProjectDetailPage } from "@/features/delivery/ProjectDetailPage"
import { VoicePage } from "@/features/voice/VoicePage"
import { CallDetailPage } from "@/features/voice/CallDetailPage"
import { TryAgentPage } from "@/features/voice/TryAgentPage"
import { FinancePage } from "@/features/finance/FinancePage"
import { InvoiceDetailPage } from "@/features/finance/InvoiceDetailPage"
import { InvoicePublicPage } from "@/features/finance/InvoicePublicPage"
import { MarketingPage } from "@/features/marketing/MarketingPage"
import { SupportPage } from "@/features/support/SupportPage"
import { TicketDetailPage } from "@/features/support/TicketDetailPage"

/** One route per INFORMATION_ARCHITECTURE.md §1 sidebar item. */
export const routes: RouteObject[] = [
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/intake/:token",
    element: <IntakePage />,
  },
  {
    path: "/proposals/:token",
    element: <ProposalAcceptPage />,
  },
  {
    path: "/try/:token",
    element: <TryAgentPage />,
  },
  {
    path: "/invoices/:token",
    element: <InvoicePublicPage />,
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
      { path: "/delivery", element: <DeliveryPage /> },
      { path: "/delivery/:id", element: <ProjectDetailPage /> },
      { path: "/voice", element: <VoicePage /> },
      { path: "/voice/calls/:id", element: <CallDetailPage /> },
      { path: "/marketing", element: <MarketingPage /> },
      { path: "/finance", element: <FinancePage /> },
      { path: "/finance/invoices/:id", element: <InvoiceDetailPage /> },
      { path: "/support", element: <SupportPage /> },
      { path: "/support/:id", element: <TicketDetailPage /> },
    ],
  },
]
