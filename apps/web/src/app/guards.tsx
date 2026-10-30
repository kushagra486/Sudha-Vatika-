import type { Role } from '@bm/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { FullPageMessage } from '@/components/FullPageMessage';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n';
import { useAuth } from './auth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageMessage title={t.common.loading} />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!profile || !profile.active) {
    return (
      <FullPageMessage title={t.auth.noProfileTitle} body={t.auth.noProfileBody}>
        <Button variant="outline" onClick={signOut}>
          {t.common.signOut}
        </Button>
      </FullPageMessage>
    );
  }
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const { profile } = useAuth();
  if (!profile || !roles.includes(profile.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
