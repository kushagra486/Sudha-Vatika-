import { LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/config';
import { AssistantLauncher } from '@/features/assistant/AssistantPanel';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { useAuth } from './auth';
import { navItemsFor } from './nav';

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  if (!profile) return null;

  const items = navItemsFor(profile.role);

  const nav = (
    <nav className="flex flex-col gap-1 p-2">
      {items.map(({ path, labelKey, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
              isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          {t.nav[labelKey]}
        </NavLink>
      ))}
    </nav>
  );

  const userBlock = (
    <div className="border-t p-3">
      <p className="truncate text-sm font-medium">{profile.full_name}</p>
      <p className="text-xs text-muted-foreground">{t.roles[profile.role]}</p>
      <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={signOut}>
        <LogOut className="h-4 w-4" aria-hidden />
        {t.common.signOut}
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center border-b px-4 font-semibold">{APP_NAME}</div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {userBlock}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label={t.common.closeMenu}
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[80vw] flex-col bg-card shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4 font-semibold">
              {APP_NAME}
              <Button
                variant="ghost"
                size="icon"
                aria-label={t.common.closeMenu}
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {userBlock}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-2 backdrop-blur md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t.common.menu}
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="truncate font-semibold">{APP_NAME}</span>
        </header>
        <main className="flex-1 p-3 pb-36 sm:p-6 sm:pb-36">
          <Outlet />
        </main>
        <AssistantLauncher />
      </div>
    </div>
  );
}
