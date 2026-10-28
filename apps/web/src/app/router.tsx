import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { BookingDetailPage } from '@/features/bookings/BookingDetailPage';
import { BookingsPage } from '@/features/bookings/BookingsPage';
import { PackagesPage } from '@/features/catalog/PackagesPage';
import { ServicesPage } from '@/features/catalog/ServicesPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
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
  inventory: [{ path: 'inventory', element: <InventoryPage /> }],
  services: [{ path: 'services', element: <ServicesPage /> }],
  packages: [{ path: 'packages', element: <PackagesPage /> }],
  settings: [{ path: 'settings', element: <SettingsPage /> }],
};

function guarded(item: NavItem, route: RouteObject): RouteObject {
  return { ...route, element: <RequireRole roles={item.roles}>{route.element}</RequireRole> };
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
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
