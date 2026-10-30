import {
  formatDateTime,
  formatEventDate,
  formatINR,
  formatPhone,
  fromISTInputValue,
  todayIST,
} from '@bm/shared';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Payment } from '@/features/bookings/api';
import { t } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';

interface PaymentRow extends Payment {
  booking: {
    id: string;
    event_date: string;
    guest: { full_name: string | null; phone_e164: string };
    unit: { name: string };
  };
}

function usePayments() {
  return useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('payments')
        .select(
          'id, booking_id, amount, kind, method, reference, received_at, ' +
            'booking:bookings(id, event_date, guest:guests(full_name, phone_e164), unit:units(name))',
        )
        .order('received_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as unknown as PaymentRow[]).map((p) => ({ ...p, amount: Number(p.amount) }));
    },
  });
}

export function PaymentsPage() {
  const q = usePayments();
  const monthStart = fromISTInputValue(`${todayIST().slice(0, 8)}01T00:00`);
  const monthTotal = (q.data ?? [])
    .filter((p) => new Date(p.received_at) >= new Date(monthStart))
    .reduce((s, p) => s + (p.kind === 'refund' ? -p.amount : p.amount), 0);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <h1 className="text-xl font-semibold sm:text-2xl">{t.payments.title}</h1>
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">{t.payments.thisMonth}</p>
        <p className="text-2xl font-semibold tabular-nums">{formatINR(monthTotal)}</p>
      </Card>

      {q.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : q.isError ? (
        <div className="flex items-center gap-3 text-sm text-destructive">
          {t.common.loadError}
          <Button variant="outline" size="sm" onClick={() => q.refetch()}>
            {t.common.retry}
          </Button>
        </div>
      ) : q.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t.payments.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {q.data.map((p) => (
            <li key={p.id}>
              <Link to={`/bookings/${p.booking.id}`}>
                <Card className="flex items-start justify-between gap-3 p-3 transition-colors hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {p.booking.guest.full_name ?? formatPhone(p.booking.guest.phone_e164)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.paymentKinds[p.kind]} · {t.paymentMethods[p.method]} ·{' '}
                      {formatDateTime(p.received_at)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.payments.forBooking}: {formatEventDate(p.booking.event_date)} ·{' '}
                      {p.booking.unit.name}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {p.kind === 'refund' ? '− ' : ''}
                    {formatINR(p.amount)}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
