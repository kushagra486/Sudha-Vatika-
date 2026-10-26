import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth, RequireRole } from './guards';
import { LoginPage } from './LoginPage';
import { NAV_ITEMS } from './nav';
import { ComingSoonPage, NotFoundPage } from './pages';

// Each module replaces its ComingSoonPage entry as its phase lands.
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
      ...NAV_ITEMS.map((item) => ({
        path: item.path.slice(1),
        element: (
          <RequireRole roles={item.roles}>
            <ComingSoonPage labelKey={item.labelKey} />
          </RequireRole>
        ),
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
