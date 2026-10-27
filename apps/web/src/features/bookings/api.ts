import {
  LIVE_BOOKING_STATUSES,
  todayIST,
  type BookingStatus,
  type PaymentKind,
  type PaymentMethod,
  type Shift,
} from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';

export interface BookingRow {
  id: string;
  event_date: string;
  shift: Shift;
  status: BookingStatus;
  event_type: string | null;
  guest_count: number | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  unit_id: string;
  lead_id: string | null;
  guest: { id: string; full_name: string | null; phone_e164: string; whatsapp_opt_in: boolean };
  unit: { name: string };
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  kind: PaymentKind;
  method: PaymentMethod;
  reference: string | null;
  received_at: string;
}

export interface OrgSettings {
  tax_percent: number;
  min_advance: number;
}

export type BookingFilter = 'upcoming' | 'tentative' | 'past' | 'cancelled';

const COLUMNS =
  'id, event_date, shift, status, event_type, guest_count, subtotal, discount, tax, total, unit_id, lead_id, ' +
  'guest:guests(id, full_name, phone_e164, whatsapp_opt_in), unit:units(name)';

export const bookingKeys = {
  all: ['bookings'] as const,
  list: (f: BookingFilter) => ['bookings', 'list', f] as const,
  detail: (id: string) => ['bookings', 'detail', id] as const,
  payments: (id: string) => ['bookings', 'payments', id] as const,
};

/** Everything a booking change can move: lists, dashboard, leads (booked stage). */
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: bookingKeys.all });
  void qc.invalidateQueries({ queryKey: ['dashboard'] });
  void qc.invalidateQueries({ queryKey: ['leads'] });
  void qc.invalidateQueries({ queryKey: ['payments'] });
}

export function useOrgSettings() {
  return useQuery({
    queryKey: ['org', 'settings'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('organizations')
        .select('tax_percent, min_advance')
        .single();
      if (error) throw error;
      return {
        tax_percent: Number(data.tax_percent),
        min_advance: Number(data.min_advance),
      } as OrgSettings;
    },
  });
}

export function useBookings(filter: BookingFilter) {
  return useQuery({
    queryKey: bookingKeys.list(filter),
    queryFn: async () => {
      const today = todayIST();
      let q = requireSupabase().from('bookings').select(COLUMNS).limit(200);
      if (filter === 'upcoming') {
        q = q
          .in('status', [...LIVE_BOOKING_STATUSES])
          .gte('event_date', today)
          .order('event_date')
          .order('shift');
      } else if (filter === 'tentative') {
        q = q.eq('status', 'tentative').gte('event_date', today).order('event_date');
      } else if (filter === 'past') {
        q = q
          .lt('event_date', today)
          .neq('status', 'cancelled')
          .order('event_date', { ascending: false });
      } else {
        q = q.eq('status', 'cancelled').order('event_date', { ascending: false });
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as BookingRow[];
    },
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: bookingKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('bookings')
        .select(COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as BookingRow | null;
    },
  });
}

export function useBookingPayments(bookingId: string, enabled: boolean) {
  return useQuery({
    queryKey: bookingKeys.payments(bookingId),
    enabled,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('payments')
        .select('id, booking_id, amount, kind, method, reference, received_at')
        .eq('booking_id', bookingId)
        .order('received_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, amount: Number(p.amount) })) as Payment[];
    },
  });
}

export interface NewBookingInput {
  unit_id: string;
  event_date: string;
  shift: Shift;
  lead_id?: string | null;
  phone_e164?: string | null;
  full_name?: string | null;
  event_type?: string | null;
  guest_count?: number | null;
  subtotal: number;
  discount: number;
  tax: number;
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewBookingInput) => {
      const { data, error } = await requireSupabase().rpc('create_booking', {
        p_unit_id: input.unit_id,
        p_event_date: input.event_date,
        p_shift: input.shift,
        p_phone_e164: input.phone_e164 ?? null,
        p_full_name: input.full_name ?? null,
        p_lead_id: input.lead_id ?? null,
        p_event_type: input.event_type ?? null,
        p_guest_count: input.guest_count ?? null,
        p_subtotal: input.subtotal,
        p_discount: input.discount,
        p_tax: input.tax,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export type BookingPatch = Partial<
  Pick<
    BookingRow,
    | 'status'
    | 'event_type'
    | 'guest_count'
    | 'subtotal'
    | 'discount'
    | 'tax'
    | 'event_date'
    | 'shift'
    | 'unit_id'
  >
>;

export function useUpdateBooking(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: BookingPatch) => {
      const { error } = await requireSupabase().from('bookings').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export interface PaymentInput {
  booking_id: string;
  amount: number;
  kind: PaymentKind;
  method: PaymentMethod;
  reference?: string | null;
  received_at?: string;
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PaymentInput) => {
      const { error } = await requireSupabase().from('payments').insert(input);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

/** Net received on a booking: refunds subtract. */
export function netPaid(payments: Payment[]): number {
  return payments.reduce((sum, p) => sum + (p.kind === 'refund' ? -p.amount : p.amount), 0);
}

/** Advance needed to confirm (DECISIONS D21): the minimum, or the full total if smaller. */
export function requiredAdvance(total: number, minAdvance: number): number {
  return total > 0 ? Math.min(minAdvance, total) : minAdvance;
}

/** Shifts already held on a space and date (for the form's warning). */
export function useTakenShifts(unitId: string, date: string) {
  return useQuery({
    queryKey: ['bookings', 'taken', unitId, date],
    enabled: !!unitId && !!date,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('bookings')
        .select('id, shift')
        .eq('unit_id', unitId)
        .eq('event_date', date)
        .in('status', [...LIVE_BOOKING_STATUSES]);
      if (error) throw error;
      return (data ?? []) as { id: string; shift: Shift }[];
    },
  });
}
