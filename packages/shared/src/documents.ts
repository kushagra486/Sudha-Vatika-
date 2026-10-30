// What the assistant reads out of a photo, PDF, document or screenshot. The
// model fills this shape; staff review each part and tap to save it. Nothing
// is written until they confirm.
import { extractListByRules, type ListedCustomer } from './ai.ts';

export type DocumentKind =
  | 'enquiries' // a list of leads / phone numbers / event requests
  | 'price_list' // menu, rate card, service price list
  | 'payment' // receipt, UPI / bank screenshot
  | 'invoice' // bill or quotation with line items for an event
  | 'event_details' // one guest's event request or requirements
  | 'other';

export interface ServiceDraft {
  name: string;
  price: number;
  pricing_unit: 'fixed' | 'per_guest' | 'per_day';
  group: string | null;
}

export interface PaymentDraft {
  amount: number;
  method: 'cash' | 'upi' | 'card' | 'bank' | 'other';
  reference: string | null;
  date: string | null; // YYYY-MM-DD
  payer: string | null;
}

export interface LineItemDraft {
  description: string;
  quantity: number;
  unit_price: number;
}

export interface DocumentAnalysis {
  kind: DocumentKind;
  summary: string;
  /** Upcoming booking the document belongs to, from the ids we listed. */
  booking_id: string | null;
  enquiries: ListedCustomer[];
  services: ServiceDraft[];
  payment: PaymentDraft | null;
  line_items: LineItemDraft[];
}

// "Veg plate - 650 per plate", "DJ: Rs 15,000", "Stage decor ₹25000"
const PRICE_LINE =
  /^\s*[-•*\d.)]*\s*([A-Za-z][\w &/()'.-]{1,60}?)\s*[:\-–=]?\s*(?:rs\.?|₹|inr)?\s*([\d,]{2,9})(?:\s*\/?-?\s*(per\s*(plate|guest|person|head|pax|day)|\/\s*(plate|guest|person|head|pax|day)))?\s*$/i;

/** Rate-card lines in plain text -> services. */
export function priceListByRules(text: string): ServiceDraft[] {
  const out: ServiceDraft[] = [];
  for (const line of text.split(/\n/)) {
    const m = line.match(PRICE_LINE);
    if (!m) continue;
    const per = (m[4] ?? m[5] ?? '').toLowerCase();
    out.push({
      name: m[1]!.trim(),
      price: Number(m[2]!.replace(/,/g, '')),
      pricing_unit: per === 'day' ? 'per_day' : per ? 'per_guest' : 'fixed',
      group: null,
    });
  }
  return out;
}

/** Without an AI model, typed or pasted text is still read for customers and prices. */
export function analyzeTextByRules(text: string, today: string): DocumentAnalysis {
  const enquiries = extractListByRules(text, today);
  const services = enquiries.length ? [] : priceListByRules(text);
  return {
    kind: enquiries.length ? 'enquiries' : services.length ? 'price_list' : 'other',
    summary: enquiries.length
      ? `${enquiries.length} customer${enquiries.length > 1 ? 's' : ''} found.`
      : services.length
        ? `${services.length} price${services.length > 1 ? 's' : ''} found.`
        : 'Nothing could be read without the AI model.',
    booking_id: null,
    enquiries,
    services,
    payment: null,
    line_items: [],
  };
}
