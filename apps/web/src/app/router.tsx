import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { BookingDetailPage } from '@/features/bookings/BookingDetailPage';
import { BookingsPage } from '@/features/bookings/BookingsPage';
import { QuotePage } from '@/features/bookings/QuotePage';
import { PackagesPage } from '@/features/catalog/PackagesPage';
import { ServicesPage } from '@/features/catalog/ServicesPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { GuestDetailPage } from '@/features/guests/GuestDetailPage';
import { GuestsPage } from '@/features/guests/GuestsPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { CampaignsPage } from '@/features/messaging/CampaignsPage';
import { ChatsPage, ChatThreadPage } from '@/features/messaging/ChatsPage';
import { TemplatesPage } from '@/features/messaging/TemplatesPage';
import { MediaPage } from '@/features/media/MediaPage';
import { LeadDetailPage } from '@/features/leads/LeadDetailPage';
import { LeadsPage } from '@/features/leads/LeadsPage';
import { PaymentsPage } from '@/features/payments/PaymentsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { AppLayout } from './AppLayout';
import { RequireAuth, RequireRole } from './guards';
import { LoginPage } from './LoginPage';
import { NAV_ITEMS, type NavItem } from './nav';
import { ComingSoonPage, NotFoundPage } from './pages';

// Modules that have been built. Everything else in the nav shows ComingSoonPage.
const BUILT: Partial<Record<NavItem['labelKey'], RouteObject[]>> = {
  dashboard: [{ path: 'dashboard', element: <DashboardPage /> }],
  leads: [
    { path: 'leads', element: <LeadsPage /> },
    { path: 'leads/:id', element: <LeadDetailPage /> },
  ],
  bookings: [
    { path: 'bookings', element: <BookingsPage /> },
    { path: 'bookings/:id', element: <BookingDetailPage /> },
  ],
  payments: [{ path: 'payments', element: <PaymentsPage /> }],
  guests: [
    { path: 'guests', element: <GuestsPage /> },
    { path: 'guests/:id', element: <GuestDetailPage /> },
  ],
  inventory: [{ path: 'inventory', element: <InventoryPage /> }],
  services: [{ path: 'services', element: <ServicesPage /> }],
  packages: [{ path: 'packages', element: <PackagesPage /> }],
  chats: [
    { path: 'chats', element: <ChatsPage /> },
    { path: 'chats/:guestId', element: <ChatThreadPage /> },
  ],
  templates: [{ path: 'templates', element: <TemplatesPage /> }],
  campaigns: [{ path: 'campaigns', element: <CampaignsPage /> }],
  media: [{ path: 'media', element: <MediaPage /> }],
  settings: [{ path: 'settings', element: <SettingsPage /> }],
};

function guarded(item: NavItem, route: RouteObject): RouteObject {
  return { ...route, element: <RequireRole roles={item.roles}>{route.element}</RequireRole> };
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  // Printable quotation: signed-in, but without the app chrome.
  {
    path: '/quote/:id',
    element: (
      <RequireAuth>
        <QuotePage />
      </RequireAuth>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      ...NAV_ITEMS.flatMap((item) =>
        (
          BUILT[item.labelKey] ?? [
            { path: item.path.slice(1), element: <ComingSoonPage labelKey={item.labelKey} /> },
          ]
        ).map((route) => guarded(item, route)),
      ),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
