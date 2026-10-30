import { formatEventDate, formatINR, type Shift } from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';

export interface BookingItem {
  id: string;
  booking_id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_discount: number;
}

export const lineAmount = (i: Pick<BookingItem, 'quantity' | 'unit_price' | 'line_discount'>) =>
  i.quantity * i.unit_price - i.line_discount;

export function useBookingItems(bookingId: string) {
  return useQuery({
    queryKey: ['bookings', 'items', bookingId],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('booking_items')
        .select('id, booking_id, service_id, description, quantity, unit_price, line_discount')
        .eq('booking_id', bookingId)
        .order('description');
      if (error) throw error;
      return (data as BookingItem[]).map((i) => ({
        ...i,
        unit_price: Number(i.unit_price),
        line_discount: Number(i.line_discount),
      }));
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  // Items change the booking's subtotal and GST in the database.
  return () => {
    void qc.invalidateQueries({ queryKey: ['bookings'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useAddItem(bookingId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (item: Omit<BookingItem, 'id' | 'booking_id'>) => {
      const { error } = await requireSupabase()
        .from('booking_items')
        .insert({ ...item, booking_id: bookingId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useRemoveItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireSupabase().from('booking_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

/** Adds every service in a package as lines, priced for the guest count. */
export function useAddPackage(bookingId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (rows: Omit<BookingItem, 'id' | 'booking_id'>[]) => {
      if (!rows.length) return;
      const { error } = await requireSupabase()
        .from('booking_items')
        .insert(rows.map((r) => ({ ...r, booking_id: bookingId })));
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export interface QuoteSummary {
  venue: string;
  guestName: string | null;
  eventDate: string;
  shift: Shift;
  shiftLabel: string;
  space: string;
  eventType: string | null;
  guestCount: number | null;
  items: Pick<BookingItem, 'description' | 'quantity' | 'unit_price' | 'line_discount'>[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  advance: number;
  paid: number | null;
}

/** Plain-text quote for WhatsApp. WhatsApp renders *bold*. */
export function quoteText(q: QuoteSummary): string {
  const lines = [
    `*${q.venue}: quotation*`,
    q.guestName ? `For ${q.guestName}` : null,
    `${q.eventType ? `${q.eventType}, ` : ''}${formatEventDate(q.eventDate)} (${q.shiftLabel}) at ${q.space}`,
    q.guestCount ? `Guests: ${q.guestCount}` : null,
    '',
    ...q.items.map(
      (i) =>
        `• ${i.description}${i.quantity > 1 ? ` × ${i.quantity}` : ''}: ${formatINR(i.quantity * i.unit_price - i.line_discount)}`,
    ),
    q.items.length ? '' : null,
    `Subtotal: ${formatINR(q.subtotal)}`,
    q.discount > 0 ? `Discount: −${formatINR(q.discount)}` : null,
    q.tax > 0 ? `GST: ${formatINR(q.tax)}` : null,
    `*Total: ${formatINR(q.total)}*`,
    q.paid !== null && q.paid > 0
      ? `Received: ${formatINR(q.paid)} · Balance: ${formatINR(q.total - q.paid)}`
      : null,
    '',
    `Advance of ${formatINR(q.advance)} confirms the date.`,
  ];
  return lines.filter((l) => l !== null).join('\n');
}
