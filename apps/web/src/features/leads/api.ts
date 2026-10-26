import {
  LIVE_BOOKING_STATUSES,
  OPEN_LEAD_STAGES,
  type LeadSource,
  type LeadStage,
  type Shift,
  type UnitKind,
} from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/auth';
import { requireSupabase } from '@/lib/supabase';

export interface LeadGuest {
  id: string;
  full_name: string | null;
  phone_e164: string;
  whatsapp_opt_in: boolean;
}

export interface LeadListItem {
  id: string;
  stage: LeadStage;
  source: LeadSource;
  event_type: string | null;
  event_date: string | null;
  guest_count: number | null;
  next_follow_up_at: string | null;
  created_at: string;
  guest: LeadGuest;
  preferred_unit: { id: string; name: string } | null;
}

export interface Lead extends LeadListItem {
  budget_min: number | null;
  budget_max: number | null;
  preferred_unit_id: string | null;
  lost_reason: string | null;
  owner_id: string | null;
}

export interface LeadNote {
  id: string;
  channel: 'whatsapp' | 'sms' | 'call_note';
  direction: 'in' | 'out';
  body: string | null;
  created_at: string;
  sent_by: string | null;
}

export interface Unit {
  id: string;
  name: string;
  kind: UnitKind;
  floating_capacity: number | null;
  upcoming: boolean;
}

/** 'open' = every stage still in play. */
export type StageFilter = 'open' | 'all' | LeadStage;

export interface LeadFilters {
  stage: StageFilter;
  source: LeadSource | 'any';
  search: string;
}

const LIST_COLUMNS =
  'id, stage, source, event_type, event_date, guest_count, next_follow_up_at, created_at, ' +
  'guest:guests!inner(id, full_name, phone_e164, whatsapp_opt_in), preferred_unit:units(id, name)';

const DETAIL_COLUMNS = `${LIST_COLUMNS}, budget_min, budget_max, preferred_unit_id, lost_reason, owner_id`;

/** Strip characters that have meaning in PostgREST filter syntax. */
export function sanitizeSearch(raw: string): string {
  return raw
    .replace(/[,()*%\\:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const leadKeys = {
  all: ['leads'] as const,
  list: (f: LeadFilters) => ['leads', 'list', f] as const,
  detail: (id: string) => ['leads', 'detail', id] as const,
  notes: (id: string) => ['leads', 'notes', id] as const,
};

export function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: leadKeys.list(filters),
    queryFn: async () => {
      let q = requireSupabase().from('leads').select(LIST_COLUMNS).limit(200);

      if (filters.stage === 'open') q = q.in('stage', [...OPEN_LEAD_STAGES]);
      else if (filters.stage !== 'all') q = q.eq('stage', filters.stage);
      if (filters.source !== 'any') q = q.eq('source', filters.source);

      const term = sanitizeSearch(filters.search);
      if (term) {
        const digits = term.replace(/\D/g, '');
        const parts = [`full_name.ilike.*${term}*`];
        if (digits.length >= 3) parts.push(`phone_e164.like.*${digits}*`);
        q = q.or(parts.join(','), { referencedTable: 'guests' });
      }

      // Most urgent first: earliest follow-up, then newest enquiry.
      q = q
        .order('next_follow_up_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as LeadListItem[];
    },
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: leadKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('leads')
        .select(DETAIL_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Lead | null;
    },
  });
}

export function useLeadNotes(leadId: string) {
  return useQuery({
    queryKey: leadKeys.notes(leadId),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('messages')
        .select('id, channel, direction, body, created_at, sent_by')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LeadNote[];
    },
  });
}

/** Event spaces (rooms and dorms are booked per night, not per shift). */
export function useEventSpaces() {
  return useQuery({
    queryKey: ['units', 'event-spaces'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('units')
        .select('id, name, kind, floating_capacity, upcoming')
        .eq('active', true)
        .not('kind', 'in', '(room,dormitory)')
        .order('upcoming')
        .order('name');
      if (error) throw error;
      return data as Unit[];
    },
  });
}

/** Live bookings on a date, for the availability panel. */
export function useBookingsOnDate(date: string | null) {
  return useQuery({
    queryKey: ['bookings', 'on-date', date],
    enabled: !!date,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('bookings')
        .select('id, unit_id, shift, status')
        .eq('event_date', date!)
        .in('status', [...LIVE_BOOKING_STATUSES]);
      if (error) throw error;
      return data as { id: string; unit_id: string; shift: Shift; status: string }[];
    },
  });
}

/** Existing guest with this phone, and how many of their leads are still open. */
export function useGuestByPhone(phoneE164: string | null) {
  return useQuery({
    queryKey: ['guests', 'by-phone', phoneE164],
    enabled: !!phoneE164,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('guests')
        .select('id, full_name, phone_e164, leads(id, stage)')
        .eq('phone_e164', phoneE164!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const leads = (data.leads ?? []) as { id: string; stage: LeadStage }[];
      const open = leads.filter((l) => (OPEN_LEAD_STAGES as readonly string[]).includes(l.stage));
      return {
        id: data.id as string,
        full_name: data.full_name as string | null,
        openLeadIds: open.map((l) => l.id),
      };
    },
  });
}

export interface EnquiryInput {
  phone_e164: string;
  full_name?: string | null;
  source: LeadSource;
  event_type?: string | null;
  event_date?: string | null;
  guest_count?: number | null;
  preferred_unit_id?: string | null;
  next_follow_up_at?: string | null;
  note?: string | null;
}

export function useCreateEnquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EnquiryInput) => {
      const { data, error } = await requireSupabase().rpc('create_enquiry', {
        p_phone_e164: input.phone_e164,
        p_full_name: input.full_name ?? null,
        p_source: input.source,
        p_event_type: input.event_type ?? null,
        p_event_date: input.event_date ?? null,
        p_guest_count: input.guest_count ?? null,
        p_preferred_unit_id: input.preferred_unit_id ?? null,
        p_next_follow_up_at: input.next_follow_up_at ?? null,
        p_note: input.note ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: leadKeys.all }),
  });
}

export type LeadPatch = Partial<
  Pick<
    Lead,
    | 'stage'
    | 'event_type'
    | 'event_date'
    | 'guest_count'
    | 'budget_min'
    | 'budget_max'
    | 'preferred_unit_id'
    | 'next_follow_up_at'
    | 'lost_reason'
  >
>;

export function useUpdateLead(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: LeadPatch) => {
      const { error } = await requireSupabase().from('leads').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: leadKeys.all }),
  });
}

export function useAddNote(lead: Pick<Lead, 'id' | 'guest'>) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await requireSupabase()
        .from('messages')
        .insert({
          guest_id: lead.guest.id,
          lead_id: lead.id,
          channel: 'call_note',
          direction: 'out',
          body,
          status: 'sent',
          sent_by: profile?.id ?? null,
        });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: leadKeys.notes(lead.id) }),
  });
}
