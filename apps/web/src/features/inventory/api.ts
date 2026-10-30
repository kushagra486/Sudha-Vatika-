import type { UnitKind } from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';
import type { StayStatus } from './occupancy';

export interface Space {
  id: string;
  name: string;
  kind: UnitKind;
  floating_capacity: number | null;
  seating_capacity: number | null;
  quantity: number;
  upcoming: boolean;
  active: boolean;
  description: string | null;
}

export interface Stay {
  id: string;
  unit_id: string;
  check_in: string;
  check_out: string;
  rooms: number;
  guest_count: number | null;
  rate: number;
  nights: number;
  amount: number;
  status: StayStatus;
  notes: string | null;
  booking_id: string | null;
  guest: { id: string; full_name: string | null; phone_e164: string };
  unit: { name: string };
}

export const ROOM_KINDS: readonly UnitKind[] = ['room', 'dormitory'];

export function useSpaces() {
  return useQuery({
    queryKey: ['units', 'all'],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('units')
        .select(
          'id, name, kind, floating_capacity, seating_capacity, quantity, upcoming, active, description',
        )
        .order('upcoming')
        .order('name');
      if (error) throw error;
      return data as Space[];
    },
  });
}

export function useSaveSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Space> & { id: string }) => {
      const { error } = await requireSupabase().from('units').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['units'] }),
  });
}

const STAY_COLUMNS =
  'id, unit_id, check_in, check_out, rooms, guest_count, rate, nights, amount, status, notes, booking_id, ' +
  'guest:guests(id, full_name, phone_e164), unit:units(name)';

/** Live and recent stays that touch [from, to). */
export function useStays(from: string, to: string) {
  return useQuery({
    queryKey: ['stays', from, to],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('room_stays')
        .select(STAY_COLUMNS)
        .lt('check_in', to)
        .gt('check_out', from)
        .order('check_in')
        .limit(500);
      if (error) throw error;
      return (data as unknown as Stay[]).map((s) => ({
        ...s,
        rate: Number(s.rate),
        amount: Number(s.amount),
      }));
    },
  });
}

export function useBookingStays(bookingId: string) {
  return useQuery({
    queryKey: ['stays', 'booking', bookingId],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('room_stays')
        .select(STAY_COLUMNS)
        .eq('booking_id', bookingId)
        .order('check_in');
      if (error) throw error;
      return (data as unknown as Stay[]).map((s) => ({
        ...s,
        rate: Number(s.rate),
        amount: Number(s.amount),
      }));
    },
  });
}

export interface StayInput {
  unit_id: string;
  check_in: string;
  check_out: string;
  rooms: number;
  phone_e164?: string | null;
  full_name?: string | null;
  booking_id?: string | null;
  guest_count?: number | null;
  rate?: number;
  notes?: string | null;
}

export function useCreateStay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: StayInput) => {
      const { data, error } = await requireSupabase().rpc('create_room_stay', {
        p_unit_id: s.unit_id,
        p_check_in: s.check_in,
        p_check_out: s.check_out,
        p_rooms: s.rooms,
        p_phone_e164: s.phone_e164 ?? null,
        p_full_name: s.full_name ?? null,
        p_booking_id: s.booking_id ?? null,
        p_guest_count: s.guest_count ?? null,
        p_rate: s.rate ?? 0,
        p_notes: s.notes ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stays'] }),
  });
}

export function useSetStayStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StayStatus }) => {
      const { error } = await requireSupabase().from('room_stays').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stays'] }),
  });
}

/** Turns DB errors into plain language: full nights, wrong unit kind. */
export function stayErrorMessage(
  err: unknown,
  msgs: { full: string; notRoom: string; generic: string },
) {
  const e = (err ?? {}) as { hint?: string; message?: string };
  if (e.hint === 'rooms_full') return `${msgs.full} ${e.message ?? ''}`.trim();
  if (e.hint === 'not_a_room') return msgs.notRoom;
  return msgs.generic;
}
