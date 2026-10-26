import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LeadDetailPage } from '@/features/leads/LeadDetailPage';
import { LeadsPage } from '@/features/leads/LeadsPage';
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
