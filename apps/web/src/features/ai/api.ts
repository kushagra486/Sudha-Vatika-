import type { AiSource, EnquiryExtraction, UpsellIdea } from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';

async function callAi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke('ai', { body });
  if (error) throw error;
  return data as T;
}

/** Whether Claude is connected (otherwise the rule-based helper answers). */
export function useAiStatus() {
  return useQuery({
    queryKey: ['ai', 'status'],
    staleTime: 30 * 60_000,
    retry: false,
    queryFn: () => callAi<{ llm: boolean; model: string | null }>({ action: 'status' }),
  });
}

export interface ExtractResult {
  extraction: EnquiryExtraction;
  preferred_unit_id: string | null;
  source: AiSource;
}

export function useExtract() {
  return useMutation({
    mutationFn: (text: string) => callAi<ExtractResult>({ action: 'extract', text }),
  });
}

export function useDraftReply() {
  return useMutation({
    mutationFn: (input: { lead_id: string; instruction?: string }) =>
      callAi<{ text: string; source: AiSource }>({ action: 'draft_reply', ...input }),
  });
}

export function useUpsellIdeas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { lead_id?: string; booking_id?: string }) =>
      callAi<{ ideas: (UpsellIdea & { name: string })[]; source: AiSource }>({
        action: 'upsell',
        ...input,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['upsell'] }),
  });
}

export type UpsellStatus = 'suggested' | 'sent' | 'accepted' | 'declined';

export interface UpsellRow {
  id: string;
  lead_id: string;
  reason: string | null;
  status: UpsellStatus;
  created_at: string;
  service: { name: string; base_price: number } | null;
  package: { name: string; price: number } | null;
  lead: {
    id: string;
    event_type: string | null;
    event_date: string | null;
    guest: { full_name: string | null; phone_e164: string; whatsapp_opt_in: boolean };
  };
}

export function useUpsellList(status: UpsellStatus | 'open') {
  return useQuery({
    queryKey: ['upsell', status],
    queryFn: async () => {
      let q = requireSupabase()
        .from('upsell_suggestions')
        .select(
          'id, lead_id, reason, status, created_at, service:services(name, base_price), package:packages(name, price), ' +
            'lead:leads!inner(id, event_type, event_date, guest:guests(full_name, phone_e164, whatsapp_opt_in))',
        )
        .order('created_at', { ascending: false })
        .limit(200);
      q = status === 'open' ? q.in('status', ['suggested', 'sent']) : q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as UpsellRow[];
    },
  });
}

export function useSetUpsellStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: UpsellStatus }) => {
      const { error } = await requireSupabase()
        .from('upsell_suggestions')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['upsell'] }),
  });
}
