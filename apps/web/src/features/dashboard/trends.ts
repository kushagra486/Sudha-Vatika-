import { useQuery } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';

export interface PeriodTotals {
  leads: number;
  bookings: number;
  booked_value: number;
  collected: number;
}

export interface MonthPoint {
  m: string; // YYYY-MM-01
  leads: number;
  bookings: number;
  collected: number;
  events: number;
}

export interface RoomTonight {
  id: string;
  name: string;
  kind: 'room' | 'dormitory';
  quantity: number;
  taken: number;
  arriving: number;
  leaving: number;
}

export interface Trends {
  this_month: PeriodTotals;
  last_month_same_days: PeriodTotals;
  months: MonthPoint[];
  rooms_tonight: RoomTonight[];
}

export function useTrends() {
  return useQuery({
    queryKey: ['dashboard', 'trends'],
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('dashboard_trends');
      if (error) throw error;
      const t = data as Trends;
      const num = (p: PeriodTotals) => ({
        ...p,
        booked_value: Number(p.booked_value),
        collected: Number(p.collected),
      });
      return {
        ...t,
        this_month: num(t.this_month),
        last_month_same_days: num(t.last_month_same_days),
        months: t.months.map((m) => ({ ...m, collected: Number(m.collected) })),
      };
    },
  });
}

export type Direction = 'up' | 'down' | 'flat' | 'new';

/** Change from last period to this one, as a whole-number percent. */
export function change(now: number, before: number): { dir: Direction; pct: number | null } {
  if (now === before) return { dir: 'flat', pct: 0 };
  if (before === 0) return { dir: 'new', pct: null };
  const pct = Math.round(((now - before) / before) * 100);
  return { dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', pct: Math.abs(pct) };
}

/** "Oct" for "2026-10-01". */
export function monthLabel(m: string): string {
  return new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' }).format(
    new Date(`${m}T00:00:00Z`),
  );
}
