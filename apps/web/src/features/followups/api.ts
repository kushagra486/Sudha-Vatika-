import type { Shift } from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';

export interface BalanceRow {
  booking_id: string;
  event_date: string;
  shift: Shift;
  space: string;
  event_type: string | null;
  status: 'tentative' | 'confirmed';
  guest_id: string;
  guest_name: string | null;
  phone_e164: string;
  total: number;
  paid: number;
  balance: number;
  last_reminded_at: string | null;
  reminders: number;
}

export interface FeedbackRow {
  booking_id: string;
  event_date: string;
  space: string;
  event_type: string | null;
  guest_id: string;
  guest_name: string | null;
  phone_e164: string;
  asked_at: string | null;
  rating: number | null;
  feedback_note: string | null;
  feedback_at: string | null;
}

const keys = {
  all: ['followups'] as const,
  balances: (days: number) => ['followups', 'balances', days] as const,
  feedback: (days: number) => ['followups', 'feedback', days] as const,
};

/** Upcoming events with money still due (owner, manager, ops, viewer). */
export function useBalanceReminders(days: number, enabled = true) {
  return useQuery({
    queryKey: keys.balances(days),
    enabled,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('balance_reminders', { p_days: days });
      if (error) throw error;
      return (data as BalanceRow[]).map((r) => ({
        ...r,
        total: Number(r.total),
        paid: Number(r.paid),
        balance: Number(r.balance),
      }));
    },
  });
}

/** Recent events, newest first, with where feedback stands. */
export function useFeedbackQueue(days: number) {
  return useQuery({
    queryKey: keys.feedback(days),
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('feedback_queue', { p_days: days });
      if (error) throw error;
      return data as FeedbackRow[];
    },
  });
}

type TouchInput =
  | { booking_id: string; kind: 'balance_reminder' | 'feedback_request' }
  | { booking_id: string; kind: 'feedback'; rating: number; note: string | null };

/** Records that a reminder or request went out, or what the guest said. */
export function useLogTouch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TouchInput) => {
      const row: Record<string, unknown> = { ...input };
      const { error } = await requireSupabase().from('booking_touches').insert(row);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}
