import { addDays, formatPhone, todayIST, SHIFTS } from '@bm/shared';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOrgSettings } from '@/features/bookings/api';
import { t } from '@/i18n';
import { useDashboardSummary, useUpcomingBookings, type UpcomingBooking } from './api';
import { useTrends } from './trends';

const V = t.tv;

/**
 * Reception screen: open on a TV or tablet and leave it. Large type, dark
 * background, refreshes itself, no buttons needed. Shows names and events but
 * no money, so it is safe in a public area.
 */
export function TvPage() {
  const org = useOrgSettings();
  const events = useUpcomingBookings(2);
  const summary = useDashboardSummary();
  const trends = useTrends();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const today = todayIST(now);
  const tomorrow = addDays(today, 1);
  const byDay = (d: string) =>
    (events.data ?? [])
      .filter((b) => b.event_date === d)
      .sort((a, b) => SHIFTS.indexOf(a.shift) - SHIFTS.indexOf(b.shift));
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);
  const date = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  return (
    <div className="min-h-dvh bg-neutral-950 p-6 text-neutral-50 sm:p-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
          <h1 className="text-3xl font-semibold sm:text-5xl">{org.data?.name ?? ''}</h1>
          <p className="mt-1 text-lg text-neutral-400 sm:text-2xl">{date}</p>
        </div>
        <p className="text-5xl font-light tabular-nums sm:text-7xl">{time}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-8">
          <EventList title={V.today} items={byDay(today)} />
          <EventList title={V.tomorrow} items={byDay(tomorrow)} muted />
        </div>
        <aside className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 text-xl font-medium text-neutral-400 sm:text-2xl">{V.rooms}</h2>
            <ul className="flex flex-col gap-3">
              {(trends.data?.rooms_tonight ?? []).map((r) => (
                <li key={r.id} className="rounded-xl bg-neutral-900 p-4">
                  <p className="text-lg sm:text-xl">{r.name}</p>
                  <p className="text-3xl font-semibold tabular-nums sm:text-4xl">
                    {V.free(Math.max(r.quantity - r.taken, 0), r.quantity)}
                  </p>
                  {(r.arriving > 0 || r.leaving > 0) && (
                    <p className="text-neutral-400">{t.insights.moves(r.arriving, r.leaving)}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <section className="grid grid-cols-2 gap-3">
            <Big label={V.newToday} value={summary.data?.new_leads.today} />
            <Big
              label={V.followUps}
              value={
                (summary.data?.follow_ups.today ?? 0) + (summary.data?.follow_ups.overdue ?? 0)
              }
            />
          </section>
        </aside>
      </div>
      <Link
        to="/dashboard"
        className="fixed bottom-3 right-4 text-sm text-neutral-600 hover:text-neutral-300"
      >
        {V.exit}
      </Link>
    </div>
  );
}

function EventList({
  title,
  items,
  muted,
}: {
  title: string;
  items: UpcomingBooking[];
  muted?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-medium text-neutral-400 sm:text-2xl">{title}</h2>
      {items.length === 0 ? (
        <p className="text-xl text-neutral-500 sm:text-2xl">{V.none}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((b) => (
            <li
              key={b.id}
              className={`grid grid-cols-[8rem_1fr] items-baseline gap-4 rounded-xl p-4 sm:grid-cols-[11rem_1fr] ${muted ? 'bg-neutral-900/60' : 'bg-neutral-900'}`}
            >
              <span className="text-lg text-amber-300 sm:text-2xl">{t.shifts[b.shift]}</span>
              <div className="min-w-0">
                <p className="truncate text-2xl font-semibold sm:text-3xl">
                  {b.event_type ?? V.event} · {b.unit.name}
                </p>
                <p className="truncate text-lg text-neutral-400 sm:text-xl">
                  {b.guest.full_name ?? formatPhone(b.guest.phone_e164)}
                  {b.guest_count ? ` · ${t.leads.guests(b.guest_count)}` : ''}
                  {b.status === 'tentative' ? ` · ${t.bookingStatuses.tentative}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Big({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl bg-neutral-900 p-4">
      <p className="text-4xl font-semibold tabular-nums">{value ?? '–'}</p>
      <p className="text-neutral-400">{label}</p>
    </div>
  );
}
