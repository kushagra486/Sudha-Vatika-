import { formatDateTime } from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';

export const REQUEST_KINDS = [
  'reception',
  'housekeeping',
  'food',
  'luggage',
  'maintenance',
  'transport',
  'helpdesk',
  'other',
] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
export type RequestStatus = 'new' | 'in_progress' | 'done' | 'cancelled';

export interface RoomRequest {
  id: string;
  room_number: string;
  guest_name: string;
  kind: RequestKind;
  item: string | null;
  details: string | null;
  status: RequestStatus;
  created_at: string;
  handled_at: string | null;
}

export interface RoomReview {
  id: string;
  room_number: string;
  guest_name: string;
  rating: number;
  ratings: { cleanliness?: number; staff?: number; comfort?: number };
  comment: string | null;
  created_at: string;
}

export interface GuideSettings {
  org_id?: string;
  wifi_name: string | null;
  wifi_password: string | null;
  checkout_time: string | null;
  note: string | null;
}

/** Where the guest page lives: the QR codes in the rooms point here. */
export const GUIDE_URL = 'https://kushagra486.github.io/Sudha-Vatika-/room/';
export const CARD_URL = `${GUIDE_URL}cards/Sudha-Vatika-Room-Card.pdf`;

export type Diet = 'veg' | 'nonveg' | 'mixed';

export interface Restaurant {
  id: string;
  name: string;
  area: string | null;
  cuisine: string | null;
  diet: Diet;
  phone: string | null; // +91..., E.164
  hours: string | null;
  menu_url: string | null;
  note: string | null;
  sort: number;
  active: boolean;
}

const keys = {
  restaurants: ['room-restaurants'] as const,
  requests: ['room-requests'] as const,
  reviews: ['room-reviews'] as const,
  settings: ['room-guide-settings'] as const,
};

/** Newest first. Refreshes every 20 seconds so new requests show up while the page is open. */
export function useRoomRequests() {
  return useQuery({
    queryKey: keys.requests,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('room_requests')
        .select('id, room_number, guest_name, kind, item, details, status, created_at, handled_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as RoomRequest[];
    },
  });
}

export function useSetRequestStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: RequestStatus }) => {
      const { error } = await requireSupabase()
        .from('room_requests')
        .update({ status: input.status })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.requests }),
  });
}

export function useRoomReviews() {
  return useQuery({
    queryKey: keys.reviews,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('room_reviews')
        .select('id, room_number, guest_name, rating, ratings, comment, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as RoomReview[];
    },
  });
}

/** What the guest page shows (WiFi, check-out time, a note). Owners, managers and ops can read it. */
export function useGuideSettings(enabled = true) {
  return useQuery({
    queryKey: keys.settings,
    enabled,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('room_guide_settings')
        .select('org_id, wifi_name, wifi_password, checkout_time, note')
        .maybeSingle();
      if (error) throw error;
      return (data as GuideSettings | null) ?? null;
    },
  });
}

export function useSaveGuideSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { existing: GuideSettings | null; values: GuideSettings }) => {
      const sb = requireSupabase();
      const clean = (v: string | null) => (v && v.trim() ? v.trim() : null);
      const values = {
        wifi_name: clean(input.values.wifi_name),
        wifi_password: clean(input.values.wifi_password),
        checkout_time: clean(input.values.checkout_time),
        note: clean(input.values.note),
      };
      const { error } = input.existing?.org_id
        ? await sb.from('room_guide_settings').update(values).eq('org_id', input.existing.org_id)
        : await sb.from('room_guide_settings').insert(values); // org_id defaults to the caller's
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings }),
  });
}

/** Average of the overall rating, and of each optional category, over the reviews given. */
export function summarize(reviews: RoomReview[]) {
  const avg = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
  return {
    count: reviews.length,
    overall: avg(reviews.map((r) => r.rating)),
    cleanliness: avg(
      reviews.flatMap((r) => (r.ratings.cleanliness ? [r.ratings.cleanliness] : [])),
    ),
    staff: avg(reviews.flatMap((r) => (r.ratings.staff ? [r.ratings.staff] : []))),
    comfort: avg(reviews.flatMap((r) => (r.ratings.comfort ? [r.ratings.comfort] : []))),
  };
}

/** "3 min ago", "2 h ago" for something recent, otherwise the date. */
export function ago(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return formatDateTime(iso);
}

/** "+919876543210" from what a person types: "98765 43210", "+91 98765-43210", "0532 407 0818". */
export function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return null;
}

export function useRestaurants() {
  return useQuery({
    queryKey: keys.restaurants,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('room_restaurants')
        .select('id, name, area, cuisine, diet, phone, hours, menu_url, note, sort, active')
        .order('sort')
        .order('name');
      if (error) throw error;
      return data as Restaurant[];
    },
  });
}

export type RestaurantInput = Omit<Restaurant, 'id'> & { id?: string };

export function useSaveRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: RestaurantInput) => {
      const sb = requireSupabase();
      const { id, ...values } = r;
      const { error } = id
        ? await sb.from('room_restaurants').update(values).eq('id', id)
        : await sb.from('room_restaurants').insert(values); // org_id defaults to the caller's
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.restaurants }),
  });
}

export function useDeleteRestaurant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().from('room_restaurants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.restaurants }),
  });
}
