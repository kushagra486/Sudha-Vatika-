import type { LeadStage, TemplateCategory, TemplateMetaStatus } from '@bm/shared';
import { OPEN_LEAD_STAGES, whatsappHref } from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { config } from '@/config';
import { requireSupabase } from '@/lib/supabase';

// ------------------------------------------------------------------ templates

export interface Template {
  id: string;
  name: string;
  language: string;
  category: TemplateCategory;
  body: string;
  variables: string[];
  meta_status: TemplateMetaStatus;
}

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('message_templates')
        .select('id, name, language, category, body, variables, meta_status')
        .order('name');
      if (error) throw error;
      return data as Template[];
    },
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...row }: Omit<Template, 'id'> & { id?: string }) => {
      const sb = requireSupabase();
      const { error } = id
        ? await sb.from('message_templates').update(row).eq('id', id)
        : await sb.from('message_templates').insert(row);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().from('message_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

// ------------------------------------------------------------------ chats

export interface ChatGuest {
  id: string;
  full_name: string | null;
  phone_e164: string;
  whatsapp_opt_in: boolean;
}

export interface ChatMessage {
  id: string;
  guest_id: string | null;
  lead_id: string | null;
  channel: 'whatsapp' | 'sms' | 'call_note';
  direction: 'in' | 'out';
  body: string | null;
  status: string;
  created_at: string;
  guest: ChatGuest | null;
}

export interface Conversation {
  guest: ChatGuest;
  last: ChatMessage;
  unanswered: boolean;
}

/** Latest message per guest, newest first. Inbound last = waiting on us. */
export function groupConversations(messages: ChatMessage[]): Conversation[] {
  const seen = new Map<string, Conversation>();
  for (const m of messages) {
    if (!m.guest || seen.has(m.guest.id)) continue;
    seen.set(m.guest.id, { guest: m.guest, last: m, unanswered: m.direction === 'in' });
  }
  return [...seen.values()];
}

export function useConversations() {
  return useQuery({
    queryKey: ['chats', 'list'],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('messages')
        .select(
          'id, guest_id, lead_id, channel, direction, body, status, created_at, guest:guests(id, full_name, phone_e164, whatsapp_opt_in)',
        )
        .is('campaign_id', null)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return groupConversations(data as unknown as ChatMessage[]);
    },
  });
}

export interface CallLog {
  id: string;
  direction: string | null;
  started_at: string | null;
  duration_sec: number | null;
  recording_url: string | null;
  ai_summary: string | null;
}

export function useThread(guestId: string) {
  return useQuery({
    queryKey: ['chats', 'thread', guestId],
    refetchInterval: 15_000,
    queryFn: async () => {
      const sb = requireSupabase();
      const [guest, msgs, calls, leads] = await Promise.all([
        sb
          .from('guests')
          .select('id, full_name, phone_e164, whatsapp_opt_in')
          .eq('id', guestId)
          .maybeSingle(),
        sb
          .from('messages')
          .select('id, guest_id, lead_id, channel, direction, body, status, created_at')
          .eq('guest_id', guestId)
          .order('created_at'),
        sb
          .from('call_logs')
          .select('id, direction, started_at, duration_sec, recording_url, ai_summary')
          .eq('guest_id', guestId)
          .order('started_at'),
        sb
          .from('leads')
          .select('id, stage, event_type, event_date, guest_count')
          .eq('guest_id', guestId)
          .order('created_at', { ascending: false }),
      ]);
      for (const r of [guest, msgs, calls, leads]) if (r.error) throw r.error;
      const allLeads = (leads.data ?? []) as {
        id: string;
        stage: LeadStage;
        event_type: string | null;
        event_date: string | null;
        guest_count: number | null;
      }[];
      return {
        guest: guest.data as ChatGuest | null,
        messages: (msgs.data ?? []) as Omit<ChatMessage, 'guest'>[],
        calls: (calls.data ?? []) as CallLog[],
        openLead:
          allLeads.find((l) => (OPEN_LEAD_STAGES as readonly string[]).includes(l.stage)) ??
          allLeads[0] ??
          null,
      };
    },
  });
}

export interface SendInput {
  guest: ChatGuest;
  body: string;
  lead_id?: string | null;
  template_id?: string | null;
  campaign_id?: string | null;
}

/**
 * Sends a WhatsApp message. Without a WhatsApp Business API account the
 * message opens in the WhatsApp app (click-to-chat) and is logged here; with
 * one (VITE_FEATURE_WHATSAPP=true) the send-whatsapp Edge Function sends it.
 * Call open() inside the click handler so pop-up blockers allow it.
 */
export function useSendWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendInput) => {
      const sb = requireSupabase();
      if (config.features.whatsappEnabled) {
        const { error } = await sb.functions.invoke('send-whatsapp', {
          body: {
            guest_id: input.guest.id,
            lead_id: input.lead_id ?? null,
            body: input.body,
            template_id: input.template_id ?? null,
            campaign_id: input.campaign_id ?? null,
          },
        });
        if (error) throw error;
        return;
      }
      const { error } = await sb.from('messages').insert({
        guest_id: input.guest.id,
        lead_id: input.lead_id ?? null,
        channel: 'whatsapp',
        direction: 'out',
        body: input.body,
        status: 'sent',
        template_id: input.template_id ?? null,
        campaign_id: input.campaign_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['chats'] });
      void qc.invalidateQueries({ queryKey: ['campaigns'] });
      void qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

/** Opens WhatsApp with the text when we're in click-to-chat mode. */
export function openInWhatsApp(phone: string, body: string) {
  if (config.features.whatsappEnabled) return;
  window.open(whatsappHref(phone, body), '_blank', 'noopener');
}

/** Records a message the guest sent us on WhatsApp (manual mode). */
export function useLogIncoming() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { guest_id: string; lead_id: string | null; body: string }) => {
      const { error } = await requireSupabase().from('messages').insert({
        guest_id: input.guest_id,
        lead_id: input.lead_id,
        channel: 'whatsapp',
        direction: 'in',
        body: input.body,
        status: 'received',
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['chats'] }),
  });
}

// ------------------------------------------------------------------ campaigns

export interface Audience {
  stages: LeadStage[];
  event_from: string | null;
  event_to: string | null;
  past_guests: boolean; // everyone who has had a booking
}

export interface Campaign {
  id: string;
  name: string;
  template_id: string | null;
  audience: Audience;
  status: 'draft' | 'ready' | 'running' | 'done' | 'cancelled';
  created_at: string;
  sent: { count: number }[];
}

export const EMPTY_AUDIENCE: Audience = {
  stages: [],
  event_from: null,
  event_to: null,
  past_guests: false,
};

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('campaigns')
        .select('id, name, template_id, audience, status, created_at, sent:messages(count)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as Campaign[]).map((c) => ({
        ...c,
        audience: { ...EMPTY_AUDIENCE, ...c.audience },
      }));
    },
  });
}

export function useSaveCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...row
    }: Pick<Campaign, 'name' | 'template_id' | 'audience' | 'status'> & { id?: string }) => {
      const sb = requireSupabase();
      if (id) {
        const { error } = await sb.from('campaigns').update(row).eq('id', id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await sb.from('campaigns').insert(row).select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export interface Recipient extends ChatGuest {
  event_type: string | null;
  event_date: string | null;
}

/** Opted-in guests matching the audience, one entry per guest. */
export function useAudience(audience: Audience, enabled = true) {
  return useQuery({
    queryKey: ['campaigns', 'audience', audience],
    enabled,
    queryFn: async () => {
      const sb = requireSupabase();
      const out = new Map<string, Recipient>();
      if (audience.stages.length || audience.event_from || audience.event_to) {
        let q = sb
          .from('leads')
          .select(
            'event_type, event_date, guest:guests!inner(id, full_name, phone_e164, whatsapp_opt_in)',
          )
          .eq('guest.whatsapp_opt_in', true)
          .limit(2000);
        if (audience.stages.length) q = q.in('stage', audience.stages);
        if (audience.event_from) q = q.gte('event_date', audience.event_from);
        if (audience.event_to) q = q.lte('event_date', audience.event_to);
        const { data, error } = await q;
        if (error) throw error;
        for (const r of data as unknown as {
          event_type: string | null;
          event_date: string | null;
          guest: ChatGuest;
        }[])
          out.set(r.guest.id, { ...r.guest, event_type: r.event_type, event_date: r.event_date });
      }
      if (audience.past_guests) {
        const { data, error } = await sb
          .from('bookings')
          .select(
            'event_type, event_date, guest:guests!inner(id, full_name, phone_e164, whatsapp_opt_in)',
          )
          .eq('guest.whatsapp_opt_in', true)
          .neq('status', 'cancelled')
          .limit(2000);
        if (error) throw error;
        for (const r of data as unknown as {
          event_type: string | null;
          event_date: string;
          guest: ChatGuest;
        }[])
          if (!out.has(r.guest.id))
            out.set(r.guest.id, { ...r.guest, event_type: r.event_type, event_date: r.event_date });
      }
      return [...out.values()];
    },
  });
}

export function useCampaignSentGuests(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaigns', 'sent', campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('messages')
        .select('guest_id')
        .eq('campaign_id', campaignId!);
      if (error) throw error;
      return new Set((data as { guest_id: string }[]).map((r) => r.guest_id));
    },
  });
}
