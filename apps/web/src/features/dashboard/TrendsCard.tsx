import { formatINR } from '@bm/shared';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { change, monthLabel, useTrends, type MonthPoint } from './trends';

const T = t.insights;

/** This month so far vs the same days last month, plus a six-month view. */
export function TrendsCard({ seesMoney }: { seesMoney: boolean }) {
  const q = useTrends();
  if (q.isPending) return <Card className="h-48 animate-pulse bg-muted/40" aria-busy />;
  if (q.isError || !q.data) return null;
  const { this_month: now, last_month_same_days: before, months } = q.data;

  const stats = [
    { label: T.leads, now: now.leads, before: before.leads, fmt: String },
    { label: T.bookings, now: now.bookings, before: before.bookings, fmt: String },
    ...(seesMoney
      ? [
          {
            label: T.bookedValue,
            now: now.booked_value,
            before: before.booked_value,
            fmt: formatINR,
          },
          { label: T.collected, now: now.collected, before: before.collected, fmt: formatINR },
        ]
      : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{T.title}</CardTitle>
        <CardDescription>{T.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <Stat key={s.label} {...s} />
          ))}
        </dl>
        {/* Small multiples: one measure per chart, each on its own axis. */}
        <div className={cn('grid gap-4', seesMoney ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
          <MiniBars title={T.leads} data={months} pick={(m) => m.leads} fmt={String} />
          <MiniBars title={T.bookings} data={months} pick={(m) => m.bookings} fmt={String} />
          {seesMoney && (
            <MiniBars title={T.collected} data={months} pick={(m) => m.collected} fmt={formatINR} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  now,
  before,
  fmt,
}: {
  label: string;
  now: number;
  before: number;
  fmt: (n: number) => string;
}) {
  const c = change(now, before);
  const Icon =
    c.dir === 'up'
      ? ArrowUpRight
      : c.dir === 'down'
        ? ArrowDownRight
        : c.dir === 'new'
          ? Sparkles
          : ArrowRight;
  const text =
    c.dir === 'new'
      ? T.vsNone
      : c.dir === 'flat'
        ? T.same
        : T.vs(c.dir === 'up' ? '▲' : '▼', c.pct ?? 0);
  return (
    <div className="min-w-0 rounded-lg border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-xl font-semibold tabular-nums">{fmt(now)}</dd>
      <dd className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            c.dir === 'up' && 'text-emerald-600 dark:text-emerald-400',
            c.dir === 'down' && 'text-red-600 dark:text-red-400',
          )}
          aria-hidden
        />
        <span>
          {text} <span className="sr-only">{T.lastWas(fmt(before))}</span>
        </span>
      </dd>
    </div>
  );
}

function MiniBars({
  title,
  data,
  pick,
  fmt,
}: {
  title: string;
  data: MonthPoint[];
  pick: (m: MonthPoint) => number;
  fmt: (n: number) => string;
}) {
  const values = data.map(pick);
  const max = Math.max(1, ...values);
  const last = values.length - 1;
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{T.sixMonths}</span>
      </figcaption>
      <div className="flex h-24 items-end gap-0.5 border-b border-border" role="list">
        {data.map((m, i) => {
          const v = values[i]!;
          return (
            <div
              key={m.m}
              role="listitem"
              tabIndex={0}
              aria-label={`${monthLabel(m.m)}: ${fmt(v)}`}
              title={`${monthLabel(m.m)}: ${fmt(v)}`}
              className="group relative flex h-full flex-1 items-end justify-center focus-visible:outline-none"
            >
              <div
                className={cn(
                  'w-full max-w-8 rounded-t-[4px] transition-opacity',
                  i === last ? 'bg-primary' : 'bg-primary/45',
                  'group-hover:opacity-80 group-focus-visible:ring-2 group-focus-visible:ring-ring',
                )}
                style={{ height: v ? `${Math.max(4, (v / max) * 100)}%` : '0%' }}
              />
              <span className="pointer-events-none absolute -top-6 hidden whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[11px] text-background group-hover:block group-focus-visible:block">
                {fmt(v)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-0.5 text-[11px] text-muted-foreground">
        {data.map((m) => (
          <span key={m.m} className="flex-1 text-center">
            {monthLabel(m.m)}
          </span>
        ))}
      </div>
    </figure>
  );
}
