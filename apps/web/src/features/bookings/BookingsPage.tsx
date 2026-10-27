import { formatEventDate, formatINR, formatPhone } from '@bm/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/auth';
import { canSeeMoney, canWriteBookings } from '@/app/roles';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { useBookings, type BookingFilter } from './api';
import { BookingStatusBadge } from './BookingBits';
import { NewBookingDialog } from './NewBookingDialog';

const FILTERS: BookingFilter[] = ['upcoming', 'tentative', 'past', 'cancelled'];

export function BookingsPage() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState<BookingFilter>('upcoming');
  const [adding, setAdding] = useState(false);
  const bookings = useBookings(filter);
  const showMoney = !!profile && canSeeMoney(profile.role);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold sm:text-2xl">{t.bookings.title}</h1>
        {profile && canWriteBookings(profile.role) && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            {t.bookings.add}
          </Button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t.bookings.title}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'min-h-10 shrink-0 rounded-full border px-4 text-sm',
              filter === f
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            {t.bookings.filters[f]}
          </button>
        ))}
      </div>

      {bookings.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : bookings.isError ? (
        <div className="flex items-center gap-3 text-sm text-destructive">
          {t.common.loadError}
          <Button variant="outline" size="sm" onClick={() => bookings.refetch()}>
            {t.common.retry}
          </Button>
        </div>
      ) : bookings.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t.bookings.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {bookings.data.map((b) => (
            <li key={b.id}>
              <Link to={`/bookings/${b.id}`}>
                <Card className="flex items-start justify-between gap-3 p-3 transition-colors hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {formatEventDate(b.event_date)} · {t.shifts[b.shift]}
                    </p>
                    <p className="truncate text-sm">
                      {b.unit.name}
                      {b.event_type ? ` · ${b.event_type}` : ''}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.guest.full_name ?? formatPhone(b.guest.phone_e164)}
                      {b.guest_count ? ` · ${t.leads.guests(b.guest_count)}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <BookingStatusBadge status={b.status} />
                    {showMoney && (
                      <span className="text-sm font-semibold tabular-nums">
                        {formatINR(b.total)}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NewBookingDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}
