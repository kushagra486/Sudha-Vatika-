import type { BookingStatus, LeadStage, Shift } from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sanitizeSearch } from '@/features/leads/api';
import { requireSupabase } from '@/lib/supabase';

export interface GuestRow {
  id: string;
  full_name: string | null;
  phone_e164: string;
  email: string | null;
  whatsapp_opt_in: boolean;
  notes: string | null;
  created_at: string;
  leads: { count: number }[];
  bookings: { count: number }[];
}

export interface GuestDetail extends Omit<GuestRow, 'leads' | 'bookings'> {
  leads: {
    id: string;
    stage: LeadStage;
    event_type: string | null;
    event_date: string | null;
    created_at: string;
  }[];
  bookings: {
    id: string;
    event_date: string;
    shift: Shift;
    status: BookingStatus;
    event_type: string | null;
    unit: { name: string };
  }[];
  stays: {
    id: string;
    check_in: string;
    check_out: string;
    rooms: number;
    status: string;
    unit: { name: string };
  }[];
}

export function useGuests(search: string) {
  return useQuery({
    queryKey: ['guests', 'list', search],
    queryFn: async () => {
      let q = requireSupabase()
        .from('guests')
        .select(
          'id, full_name, phone_e164, email, whatsapp_opt_in, notes, created_at, leads(count), bookings(count)',
        )
        .order('created_at', { ascending: false })
        .limit(200);
      const term = sanitizeSearch(search);
      if (term) {
        const digits = term.replace(/\D/g, '');
        const parts = [`full_name.ilike.*${term}*`];
        if (digits.length >= 3) parts.push(`phone_e164.like.*${digits}*`);
        q = q.or(parts.join(','));
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as GuestRow[];
    },
  });
}

export function useGuest(id: string) {
  return useQuery({
    queryKey: ['guests', 'detail', id],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('guests')
        .select(
          'id, full_name, phone_e164, email, whatsapp_opt_in, notes, created_at, ' +
            'leads(id, stage, event_type, event_date, created_at), ' +
            'bookings(id, event_date, shift, status, event_type, unit:units(name)), ' +
            'stays:room_stays(id, check_in, check_out, rooms, status, unit:units(name))',
        )
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as GuestDetail | null;
    },
  });
}

export function useUpdateGuest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      patch: Partial<Pick<GuestDetail, 'full_name' | 'email' | 'notes' | 'whatsapp_opt_in'>>,
    ) => {
      const { error } = await requireSupabase().from('guests').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['guests'] }),
  });
}
