import type { LeadStage } from '@bm/shared';
import { OPEN_LEAD_STAGES } from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExtractResult } from '@/features/ai/api';
import { requireSupabase } from '@/lib/supabase';
import { directoryKey, isTelemarketer, type RecentCall } from './recents';

export type InboxStatus = 'new' | 'pushed' | 'ignored';
export type DirectoryCategory = 'personal' | 'staff' | 'vendor' | 'spam';

export interface InboxCall {
  id: string;
  phone_e164: string | null;
  contact_name: string | null;
  call_at: string | null;
  call_label: string | null;
  missed: boolean;
  repeat_count: number;
  status: InboxStatus;
  category: string | null;
  description: string | null;
  lead_id: string | null;
  guest: {
    id: string;
    full_name: string | null;
    leads: { id: string; stage: LeadStage; event_type: string | null; event_date: string | null }[];
  } | null;
}

export interface ImportSummary {
  found: number;
  added: number;
  known: number; // family, staff, vendors, spam: filed away automatically
  duplicates: number;
}

const keys = { inbox: (s: InboxStatus) => ['calls', 'inbox', s] as const };

export function useInbox(status: InboxStatus) {
  return useQuery({
    queryKey: keys.inbox(status),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('call_inbox')
        .select(
          'id, phone_e164, contact_name, call_at, call_label, missed, repeat_count, status, category, description, lead_id, ' +
            'guest:guests(id, full_name, leads(id, stage, event_type, event_date))',
        )
        .eq('status', status)
        .order('call_at', { ascending: false, nullsFirst: false })
        .limit(status === 'new' ? 300 : 100);
      if (error) throw error;
      return data as unknown as InboxCall[];
    },
  });
}

export function useNewCallCount() {
  return useQuery({
    queryKey: ['calls', 'count'],
    queryFn: async () => {
      const { count, error } = await requireSupabase()
        .from('call_inbox')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new');
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** Files read calls into the inbox. Known contacts and spam are put away at once. */
export function useImportCalls() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (calls: RecentCall[]): Promise<ImportSummary> => {
      const sb = requireSupabase();
      if (!calls.length) return { found: 0, added: 0, known: 0, duplicates: 0 };
      const dirKeys = [...new Set(calls.map(directoryKey))];
      const phones = [...new Set(calls.map((c) => c.phone_e164).filter((p): p is string => !!p))];
      const [dir, guests] = await Promise.all([
        sb.from('phone_directory').select('key, category').in('key', dirKeys),
        phones.length
          ? sb.from('guests').select('id, phone_e164').in('phone_e164', phones)
          : Promise.resolve({ data: [] as { id: string; phone_e164: string }[], error: null }),
      ]);
      if (dir.error) throw dir.error;
      if (guests.error) throw guests.error;
      const category = new Map(
        (dir.data ?? []).map((d) => [d.key as string, d.category as string]),
      );
      const guestId = new Map(
        (guests.data ?? []).map((g) => [g.phone_e164 as string, g.id as string]),
      );

      const rows = calls.map((c) => {
        const cat = category.get(directoryKey(c)) ?? (isTelemarketer(c.phone_e164) ? 'spam' : null);
        return {
          dedupe_key: c.dedupe_key,
          phone_e164: c.phone_e164,
          contact_name: c.contact_name,
          call_at: c.call_at,
          call_label: c.label,
          missed: c.missed,
          repeat_count: c.count,
          status: cat ? 'ignored' : 'new',
          category: cat,
          guest_id: c.phone_e164 ? (guestId.get(c.phone_e164) ?? null) : null,
        };
      });
      const { data, error } = await sb
        .from('call_inbox')
        .upsert(rows, { onConflict: 'org_id,dedupe_key', ignoreDuplicates: true })
        .select('id, status');
      if (error) throw error;
      const inserted = data ?? [];
      return {
        found: calls.length,
        added: inserted.filter((r) => r.status === 'new').length,
        known: inserted.filter((r) => r.status === 'ignored').length,
        duplicates: calls.length - inserted.length,
      };
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['calls'] }),
  });
}

export interface PushInput {
  call: InboxCall;
  phone_e164: string;
  full_name: string | null;
  kind: 'enquiry' | 'existing';
  description: string;
}

/**
 * Sends a flagged call to the dashboard: creates or updates the guest and
 * enquiry, then lets the AI fill empty enquiry fields from the description.
 */
export function usePushCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PushInput) => {
      const sb = requireSupabase();
      const { data, error } = await sb.rpc('push_call', {
        p_inbox_id: input.call.id,
        p_phone_e164: input.phone_e164,
        p_full_name: input.full_name,
        p_kind: input.kind,
        p_description: input.description || null,
      });
      if (error) throw error;
      const result = data as { guest_id: string; lead_id: string; new_lead: boolean };

      if (input.description.trim()) {
        // Best effort: a failed AI call never undoes the push.
        try {
          const ai = await sb.functions.invoke('ai', {
            body: { action: 'extract', text: input.description },
          });
          const x = (ai.data as ExtractResult | null)?.extraction;
          if (x) {
            const { data: lead } = await sb
              .from('leads')
              .select(
                'event_type, event_date, guest_count, budget_min, budget_max, preferred_unit_id',
              )
              .eq('id', result.lead_id)
              .single();
            if (lead) {
              await sb
                .from('leads')
                .update({
                  event_type: lead.event_type ?? x.event_type,
                  event_date: lead.event_date ?? x.event_date,
                  guest_count: lead.guest_count ?? x.guest_count,
                  budget_min: lead.budget_min ?? x.budget_min,
                  budget_max: lead.budget_max ?? x.budget_max,
                  preferred_unit_id:
                    lead.preferred_unit_id ?? (ai.data as ExtractResult).preferred_unit_id ?? null,
                })
                .eq('id', result.lead_id);
            }
            if (x.full_name && !input.full_name) {
              await sb
                .from('guests')
                .update({ full_name: x.full_name })
                .eq('id', result.guest_id)
                .is('full_name', null);
            }
          }
        } catch {
          /* rules or AI unavailable: the enquiry still exists with the note */
        }
      }
      return result;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['calls'] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Puts a call away; with a category, remembers the number for next time. */
export function useDismissCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      call,
      category,
    }: {
      call: InboxCall;
      category: DirectoryCategory | null;
    }) => {
      const sb = requireSupabase();
      const { error } = await sb
        .from('call_inbox')
        .update({ status: 'ignored', category: category ?? 'other' })
        .eq('id', call.id);
      if (error) throw error;
      if (category) {
        const label = call.contact_name ?? call.guest?.full_name ?? null;
        const d = await sb
          .from('phone_directory')
          .upsert({ key: directoryKey(call), category, label }, { onConflict: 'org_id,key' });
        if (d.error) throw d.error;
        // Same person's other waiting calls go too.
        const other = call.phone_e164
          ? sb
              .from('call_inbox')
              .update({ status: 'ignored', category })
              .eq('status', 'new')
              .eq('phone_e164', call.phone_e164)
          : sb
              .from('call_inbox')
              .update({ status: 'ignored', category })
              .eq('status', 'new')
              .eq('contact_name', call.contact_name!);
        const o = await other;
        if (o.error) throw o.error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['calls'] }),
  });
}

/** Moves a put-away call back to the inbox and forgets its directory entry. */
export function useRestoreCall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (call: InboxCall) => {
      const sb = requireSupabase();
      const r = await sb
        .from('call_inbox')
        .update({ status: 'new', category: null })
        .eq('id', call.id);
      if (r.error) throw r.error;
      const d = await sb.from('phone_directory').delete().eq('key', directoryKey(call));
      if (d.error) throw d.error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['calls'] }),
  });
}

export function openLeadOf(call: InboxCall) {
  return (
    call.guest?.leads.find((l) => (OPEN_LEAD_STAGES as readonly string[]).includes(l.stage)) ?? null
  );
}
