import {
  addDays,
  fromISTInputValue,
  LIVE_BOOKING_STATUSES,
  OPEN_LEAD_STAGES,
  todayIST,
  type BookingStatus,
  type LeadSource,
  type LeadStage,
  type Shift,
} from '@bm/shared';
import { useQuery } from '@tanstack/react-query';
import type { LeadListItem } from '@/features/leads/api';
import { requireSupabase } from '@/lib/supabase';

export interface DashboardSummary {
  today: string;
  open_total: number;
  open_by_stage: Partial<Record<LeadStage, number>>;
  follow_ups: { overdue: number; today: number };
  new_leads: { today: number; last_7_days: number };
  unreplied_whatsapp: number;
  events: { today: number; next_7_days: number; tentative_upcoming: number };
  money: { collected_this_month: number; pending_upcoming: number };
  sources_30_days: { source: LeadSource; leads: number; booked: number }[];
}

export interface UpcomingBooking {
  id: string;
  event_date: string;
  shift: Shift;
  status: BookingStatus;
  event_type: string | null;
  guest_count: number | null;
  total: number;
  guest: { full_name: string | null; phone_e164: string };
  unit: { name: string };
}

export interface PaymentDue extends UpcomingBooking {
  paid: number;
  balance: number;
}

// Refresh every few minutes so a reception screen stays current.
const LIVE = { refetchInterval: 5 * 60_000, refetchOnWindowFocus: true } as const;

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    ...LIVE,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('dashboard_summary');
      if (error) throw error;
      return data as DashboardSummary;
    },
  });
}

/** Open leads whose follow-up is overdue or due today (India date). */
export function useFollowUpsDue() {
  return useQuery({
    queryKey: ['dashboard', 'follow-ups'],
    ...LIVE,
    queryFn: async () => {
      const endOfToday = fromISTInputValue(`${addDays(todayIST(), 1)}T00:00`);
      const { data, error } = await requireSupabase()
        .from('leads')
        .select(
          'id, stage, source, event_type, event_date, guest_count, next_follow_up_at, created_at, ' +
            'guest:guests!inner(id, full_name, phone_e164, whatsapp_opt_in), preferred_unit:units(id, name)',
        )
        .in('stage', [...OPEN_LEAD_STAGES])
        .lt('next_follow_up_at', endOfToday)
        .order('next_follow_up_at')
        .limit(20);
      if (error) throw error;
      return data as unknown as LeadListItem[];
    },
  });
}

const BOOKING_COLUMNS =
  'id, event_date, shift, status, event_type, guest_count, total, ' +
  'guest:guests(full_name, phone_e164), unit:units(name)';

/** Live bookings from today for the next `days` days, soonest first. */
export function useUpcomingBookings(days: number) {
  return useQuery({
    queryKey: ['dashboard', 'upcoming', days],
    ...LIVE,
    queryFn: async () => {
      const today = todayIST();
      const { data, error } = await requireSupabase()
        .from('bookings')
        .select(BOOKING_COLUMNS)
        .in('status', [...LIVE_BOOKING_STATUSES])
        .gte('event_date', today)
        .lte('event_date', addDays(today, days - 1))
        .order('event_date')
        .order('shift');
      if (error) throw error;
      return data as unknown as UpcomingBooking[];
    },
  });
}

/** Bookings in the next 30 days that still have money to collect. */
export function usePaymentsDue(enabled: boolean) {
  const upcoming = useUpcomingBookings(30);
  const ids = (upcoming.data ?? []).map((b) => b.id);
  const balances = useQuery({
    queryKey: ['dashboard', 'balances', ids],
    enabled: enabled && ids.length > 0,
    ...LIVE,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('booking_balances')
        .select('booking_id, paid, balance')
        .in('booking_id', ids)
        .gt('balance', 0);
      if (error) throw error;
      return data as { booking_id: string; paid: number; balance: number }[];
    },
  });

  const byId = new Map((balances.data ?? []).map((b) => [b.booking_id, b]));
  const rows: PaymentDue[] = (upcoming.data ?? []).flatMap((b) => {
    const bal = byId.get(b.id);
    return bal ? [{ ...b, paid: Number(bal.paid), balance: Number(bal.balance) }] : [];
  });

  return {
    data: rows,
    isPending: upcoming.isPending || (ids.length > 0 && balances.isPending),
    isError: upcoming.isError || balances.isError,
    refetch: () => {
      void upcoming.refetch();
      void balances.refetch();
    },
  };
}

/** Live bookings between two dates, for the availability grid. */
export function useBookingsBetween(from: string, to: string) {
  return useQuery({
    queryKey: ['dashboard', 'availability', from, to],
    ...LIVE,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('bookings')
        .select('id, unit_id, event_date, shift, status')
        .in('status', [...LIVE_BOOKING_STATUSES])
        .gte('event_date', from)
        .lte('event_date', to);
      if (error) throw error;
      return data as {
        id: string;
        unit_id: string;
        event_date: string;
        shift: Shift;
        status: BookingStatus;
      }[];
    },
  });
}
