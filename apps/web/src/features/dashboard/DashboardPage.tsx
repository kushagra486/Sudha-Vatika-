import {
  formatEventDate,
  formatINR,
  formatPhone,
  LEAD_STAGES,
  OPEN_LEAD_STAGES,
  todayIST,
  addDays,
  type LeadStage,
  type Shift,
} from '@bm/shared';
import {
  AlarmClock,
  CalendarCheck,
  IndianRupee,
  MessageCircle,
  Plus,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ContactButtons, FollowUpBadge, StageBadge } from '@/features/leads/LeadBits';
import { useEventSpaces } from '@/features/leads/api';
import { QuickAddDialog } from '@/features/leads/QuickAddDialog';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  useBookingsBetween,
  useDashboardSummary,
  useFollowUpsDue,
  usePaymentsDue,
  useUpcomingBookings,
  type DashboardSummary,
} from './api';
import { cellFor, dateRange, SHIFT_LETTERS, type CellState } from './availability';

const D = t.dashboard;

/** Roles that can read payments (see DECISIONS D7). */
const MONEY_ROLES = ['owner', 'manager', 'ops', 'viewer'] as const;

function greeting(now = new Date()): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  );
  if (hour < 12) return D.greeting.morning;
  if (hour < 17) return D.greeting.afternoon;
  return D.greeting.evening;
}

const shortDay = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** "Today", "Tomorrow", then "Sat 31 Oct" (the year is noise within a month). */
function dayLabel(date: string, today: string): string {
  if (date === today) return D.today;
  if (date === addDays(today, 1)) return D.tomorrow;
  return shortDay.format(new Date(`${date}T00:00:00Z`));
}

export function DashboardPage() {
  const { profile } = useAuth();
  const [adding, setAdding] = useState(false);
  const summary = useDashboardSummary();
  const seesMoney = !!profile && (MONEY_ROLES as readonly string[]).includes(profile.role);
  const canAddLeads = !!profile && ['owner', 'manager', 'sales'].includes(profile.role);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">
            {greeting()}
            {profile ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">{formatEventDate(todayIST())}</p>
        </div>
        {canAddLeads && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            {t.leads.add}
          </Button>
        )}
      </header>

      <Tiles
        summary={summary.data}
        loading={summary.isPending}
        error={summary.isError}
        onRetry={() => summary.refetch()}
        seesMoney={seesMoney}
      />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <FollowUpsCard />
        <UpcomingCard />
      </div>

      <AvailabilityCard />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {seesMoney && <PaymentsDueCard />}
        <PipelineCard summary={summary.data} loading={summary.isPending} />
        <SourcesCard summary={summary.data} loading={summary.isPending} />
      </div>

      {canAddLeads && <QuickAddDialog open={adding} onOpenChange={setAdding} />}
    </div>
  );
}

/* ---------------------------------------------------------------- tiles -- */

type TileTone = 'alert' | 'warn' | 'plain';

function Tile({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'plain',
  to,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: TileTone;
  to?: string;
}) {
  const body = (
    <Card
      className={cn(
        'flex h-full min-h-[104px] flex-col justify-between gap-2 p-3 sm:p-4',
        to && 'transition-colors hover:bg-muted/50',
        tone === 'alert' && 'border-red-300 dark:border-red-900',
        tone === 'warn' && 'border-amber-300 dark:border-amber-900',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium leading-tight text-muted-foreground sm:text-sm">
          {label}
        </span>
        <Icon
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground',
            tone === 'alert' && 'text-red-600 dark:text-red-400',
            tone === 'warn' && 'text-amber-600 dark:text-amber-400',
          )}
          aria-hidden
        />
      </div>
      <div>
        <p className="text-2xl font-semibold tabular-nums leading-none sm:text-3xl">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Card>
  );
  return to ? (
    <Link
      to={to}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

function Tiles({
  summary: s,
  loading,
  error,
  onRetry,
  seesMoney,
}: {
  summary: DashboardSummary | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  seesMoney: boolean;
}) {
  if (error) {
    return (
      <Card className="flex items-center gap-3 p-4 text-sm text-destructive">
        {t.common.loadError}
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t.common.retry}
        </Button>
      </Card>
    );
  }
  const count = seesMoney ? 6 : 4;
  if (loading || !s) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3" aria-busy="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <Tile
        label={D.tiles.overdue}
        value={String(s.follow_ups.overdue)}
        sub={`${s.follow_ups.today} ${D.tiles.dueToday.toLowerCase()}`}
        icon={AlarmClock}
        tone={s.follow_ups.overdue > 0 ? 'alert' : s.follow_ups.today > 0 ? 'warn' : 'plain'}
        to="/leads"
      />
      <Tile
        label={D.tiles.newLeads}
        value={String(s.new_leads.today)}
        sub={D.tiles.newLeadsSub(s.new_leads.last_7_days)}
        icon={UserPlus}
        to="/leads"
      />
      <Tile
        label={D.tiles.events}
        value={String(s.events.next_7_days)}
        sub={D.tiles.eventsSub(s.events.today)}
        icon={CalendarCheck}
        to="/bookings"
      />
      <Tile
        label={D.tiles.unreplied}
        value={String(s.unreplied_whatsapp)}
        sub={D.tiles.unrepliedSub}
        icon={MessageCircle}
        tone={s.unreplied_whatsapp > 0 ? 'warn' : 'plain'}
        to="/chats"
      />
      {seesMoney && (
        <>
          <Tile
            label={D.tiles.collected}
            value={formatINR(s.money.collected_this_month)}
            icon={IndianRupee}
            to="/payments"
          />
          <Tile
            label={D.tiles.pending}
            value={formatINR(s.money.pending_upcoming)}
            sub={D.tiles.pendingSub}
            icon={Wallet}
            to="/payments"
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- sections -- */

function Section({
  title,
  sub,
  action,
  children,
  className,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex items-baseline justify-between gap-2 p-4 pb-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        {action}
      </div>
      <div className="flex-1 px-4 pb-4">{children}</div>
    </Card>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 text-sm text-destructive">
      {t.common.loadError}
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t.common.retry}
      </Button>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function SeeAll({ to }: { to: string }) {
  return (
    <Link to={to} className="text-sm font-medium text-primary hover:underline">
      {D.seeAll}
    </Link>
  );
}

function FollowUpsCard() {
  const q = useFollowUpsDue();
  return (
    <Section title={D.followUps} action={<SeeAll to="/leads" />}>
      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <LoadError onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <Empty>{D.followUpsEmpty}</Empty>
      ) : (
        <ul className="flex flex-col divide-y">
          {q.data.map((lead) => (
            <li key={lead.id} className="flex items-center gap-3 py-2">
              <Link to={`/leads/${lead.id}`} className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">
                    {lead.guest.full_name ?? t.leads.unnamed}
                  </span>
                  <StageBadge stage={lead.stage} />
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {formatPhone(lead.guest.phone_e164)}
                  {lead.event_type ? ` · ${lead.event_type}` : ''}
                  {lead.event_date ? ` · ${formatEventDate(lead.event_date)}` : ''}
                </span>
                <FollowUpBadge at={lead.next_follow_up_at} />
              </Link>
              <ContactButtons
                phone={lead.guest.phone_e164}
                whatsappAllowed={lead.guest.whatsapp_opt_in}
                className="shrink-0"
              />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function UpcomingCard() {
  const q = useUpcomingBookings(7);
  const today = todayIST();
  return (
    <Section title={D.upcoming} sub={D.upcomingSub} action={<SeeAll to="/bookings" />}>
      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <LoadError onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <Empty>{D.upcomingEmpty}</Empty>
      ) : (
        <ul className="flex flex-col divide-y">
          {q.data.map((b) => (
            <li key={b.id} className="flex items-start gap-3 py-2">
              <div className="w-24 shrink-0">
                <p
                  className={cn('text-sm font-semibold', b.event_date === today && 'text-primary')}
                >
                  {dayLabel(b.event_date, today)}
                </p>
                <p className="text-xs text-muted-foreground">{t.shifts[b.shift]}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {b.unit.name}
                  {b.event_type ? ` · ${b.event_type}` : ''}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {b.guest.full_name ?? formatPhone(b.guest.phone_e164)}
                  {b.guest_count ? ` · ${t.leads.guests(b.guest_count)}` : ''}
                </p>
              </div>
              <Badge tone={b.status === 'confirmed' ? 'green' : 'amber'}>
                {t.bookingStatuses[b.status]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* --------------------------------------------------------- availability -- */

const CELL_STYLES: Record<CellState, string> = {
  free: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  partial: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  full: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  upcoming: 'bg-muted text-muted-foreground',
};

function AvailabilityCard() {
  const DAYS = 14;
  const today = todayIST();
  const dates = dateRange(today, DAYS);
  const spaces = useEventSpaces();
  const bookings = useBookingsBetween(today, dates[DAYS - 1]!);

  const booked = new Map<string, Shift[]>();
  for (const b of bookings.data ?? []) {
    const key = `${b.unit_id}|${b.event_date}`;
    booked.set(key, [...(booked.get(key) ?? []), b.shift]);
  }

  const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'short', timeZone: 'UTC' });
  const dayNum = new Intl.DateTimeFormat('en-IN', { day: 'numeric', timeZone: 'UTC' });

  return (
    <Section title={D.availability} sub={D.availabilitySub}>
      <ul
        className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
        aria-label="Legend"
      >
        {(['free', 'partial', 'full', 'upcoming'] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={cn('inline-block h-3 w-3 rounded-sm', CELL_STYLES[s])} aria-hidden />
            {D.legend[s]}
          </li>
        ))}
        <li>{D.legend.letters}</li>
      </ul>

      {spaces.isPending || bookings.isPending ? (
        <ListSkeleton rows={4} />
      ) : spaces.isError || bookings.isError ? (
        <LoadError
          onRetry={() => {
            void spaces.refetch();
            void bookings.refetch();
          }}
        />
      ) : (
        // The grid scrolls sideways inside the card on phones; the page itself never does.
        <div className="relative -mx-4 overflow-x-auto px-4">
          <table className="w-full border-separate border-spacing-0.5 text-xs">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-card pr-2 text-left font-medium">
                  <span className="sr-only">Space</span>
                </th>
                {dates.map((d) => {
                  const date = new Date(`${d}T00:00:00Z`);
                  return (
                    <th
                      key={d}
                      scope="col"
                      className={cn('min-w-9 font-normal', d === today && 'text-primary')}
                    >
                      <span className="block text-[10px] uppercase text-muted-foreground">
                        {weekday.format(date)}
                      </span>
                      <span className="block font-semibold">{dayNum.format(date)}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {spaces.data?.map((u) => (
                <tr key={u.id}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-28 truncate bg-card pr-2 text-left text-xs font-medium sm:max-w-none"
                    title={u.name}
                  >
                    {u.name}
                  </th>
                  {dates.map((d) => {
                    const cell = cellFor(booked.get(`${u.id}|${d}`) ?? [], u.upcoming);
                    const letters =
                      cell.state === 'full'
                        ? SHIFT_LETTERS.full_day
                        : cell.shifts.map((s) => SHIFT_LETTERS[s]).join('');
                    const description =
                      cell.state === 'partial'
                        ? cell.shifts.map((s) => t.shifts[s]).join(', ') + ' booked'
                        : D.legend[cell.state];
                    return (
                      <td
                        key={d}
                        className={cn(
                          'h-9 rounded text-center font-semibold',
                          CELL_STYLES[cell.state],
                        )}
                        title={`${u.name}, ${formatEventDate(d)}: ${description}`}
                      >
                        <span aria-hidden>
                          {cell.state === 'free' ? '' : cell.state === 'upcoming' ? '–' : letters}
                        </span>
                        <span className="sr-only">{description}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------- payments -- */

function PaymentsDueCard() {
  const q = usePaymentsDue(true);
  const today = todayIST();
  return (
    <Section title={D.paymentsDue} sub={D.paymentsDueSub} action={<SeeAll to="/payments" />}>
      {q.isPending ? (
        <ListSkeleton />
      ) : q.isError ? (
        <LoadError onRetry={q.refetch} />
      ) : q.data.length === 0 ? (
        <Empty>{D.paymentsDueEmpty}</Empty>
      ) : (
        <ul className="flex flex-col divide-y">
          {q.data.map((b) => (
            <li key={b.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {b.guest.full_name ?? formatPhone(b.guest.phone_e164)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {dayLabel(b.event_date, today)} · {b.unit.name}
                </p>
                {b.status === 'tentative' && b.paid === 0 && (
                  <Badge tone="amber" className="mt-1">
                    {D.belowAdvance}
                  </Badge>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{formatINR(b.balance)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {D.paid(formatINR(b.paid))}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ----------------------------------------------------------------- bars -- */

/** Single-series horizontal bars, value labelled on every row (few rows). */
function Bars({
  rows,
}: {
  rows: { key: string; label: ReactNode; value: number; note?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">{r.value}</span>
              {r.note && <span className="ml-1 text-xs text-muted-foreground">· {r.note}</span>}
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? '0.5rem' : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function PipelineCard({
  summary,
  loading,
}: {
  summary: DashboardSummary | undefined;
  loading: boolean;
}) {
  const open = OPEN_LEAD_STAGES as readonly LeadStage[];
  const rows = LEAD_STAGES.filter((s) => open.includes(s)).map((s) => ({
    key: s,
    label: t.leadStages[s],
    value: summary?.open_by_stage[s] ?? 0,
  }));
  return (
    <Section
      title={D.pipeline}
      sub={summary ? `${summary.open_total} ${D.tiles.openLeads.toLowerCase()}` : undefined}
      action={<SeeAll to="/leads" />}
    >
      {loading ? (
        <ListSkeleton rows={4} />
      ) : summary?.open_total ? (
        <Bars rows={rows} />
      ) : (
        <Empty>{D.pipelineEmpty}</Empty>
      )}
    </Section>
  );
}

function SourcesCard({
  summary,
  loading,
}: {
  summary: DashboardSummary | undefined;
  loading: boolean;
}) {
  const rows = (summary?.sources_30_days ?? []).map((s) => ({
    key: s.source,
    label: t.leadSources[s.source],
    value: s.leads,
    note: D.booked(s.booked),
  }));
  return (
    <Section title={D.sources} sub={D.sourcesSub}>
      {loading ? (
        <ListSkeleton rows={4} />
      ) : rows.length ? (
        <Bars rows={rows} />
      ) : (
        <Empty>{D.sourcesEmpty}</Empty>
      )}
    </Section>
  );
}
