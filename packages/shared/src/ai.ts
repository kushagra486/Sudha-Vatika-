// Shapes shared by the `ai` Edge Function and the web app, plus the rule-based
// fallback used when no LLM key is configured or the model call fails. The
// rules are deliberately simple: they catch the common phrasings in Indian
// banquet enquiries (English and Hinglish) and leave the rest blank.

export interface EnquiryExtraction {
  full_name: string | null;
  event_type: string | null;
  event_date: string | null; // YYYY-MM-DD
  guest_count: number | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_space: string | null; // must match a space name we sent
  services: string[];
  summary: string;
}

export interface UpsellIdea {
  kind: 'service' | 'package';
  id: string;
  reason: string;
}

export type AiSource = 'llm' | 'rules';

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const EVENT_WORDS: [RegExp, string][] = [
  [/\b(wedding|shaadi|shadi|vivah|marriage)\b/i, 'Wedding'],
  [/\b(reception)\b/i, 'Reception'],
  [/\b(engagement|sagai|ring ceremony|roka)\b/i, 'Engagement'],
  [/\b(haldi)\b/i, 'Haldi'],
  [/\b(mehndi|mehendi|mehandi)\b/i, 'Mehendi'],
  [/\b(sangeet)\b/i, 'Sangeet'],
  [/\b(birthday|bday|janamdin)\b/i, 'Birthday'],
  [/\b(anniversary)\b/i, 'Anniversary'],
  [/\b(mundan)\b/i, 'Mundan'],
  [/\b(kitty)\b/i, 'Kitty party'],
  [/\b(conference|seminar|meeting|corporate)\b/i, 'Corporate event'],
  [/\b(party)\b/i, 'Party'],
];

const SERVICE_WORDS: [RegExp, string][] = [
  [/\b(catering|food|khana|plate|veg|non-?veg|buffet)\b/i, 'catering'],
  [/\b(decor|decoration|sajawat|flowers?|stage)\b/i, 'decor'],
  [/\b(dj|music|sound)\b/i, 'dj'],
  [/\b(rooms?|stay|accommodation|dorm|dormitory)\b/i, 'rooms'],
  [/\b(photo|photographer|video)\b/i, 'photography'],
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** First plausible future date in the text, as YYYY-MM-DD. */
export function findDate(text: string, today: string): string | null {
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  const pick = (d: number, m: number, y?: number) => {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    let year = y ?? ty;
    if (year < 100) year += 2000;
    if (!y && (m < tm || (m === tm && d < td))) year += 1; // "12 Jan" in Oct = next year
    return `${year}-${pad(m)}-${pad(d)}`;
  };
  // 12 Dec, 12th December 2026
  let m = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\.?,?\s*(\d{4})?\b/i);
  if (m) {
    const mon = MONTHS[m[2]!.slice(0, 4).toLowerCase()] ?? MONTHS[m[2]!.slice(0, 3).toLowerCase()];
    if (mon) return pick(Number(m[1]), mon, m[3] ? Number(m[3]) : undefined);
  }
  // December 12
  m = text.match(/\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (m) {
    const mon = MONTHS[m[1]!.slice(0, 3).toLowerCase()];
    if (mon) return pick(Number(m[2]), mon);
  }
  // 12/12/2026, 12-12-26, 12.12 (day first, Indian style)
  m = text.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (m) return pick(Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : undefined);
  return null;
}

/** "300 guests", "300 log", "300 pax", "around 250 people". */
export function findGuestCount(text: string): number | null {
  const m = text.match(
    /\b(\d{2,4})\s*(?:\+\s*)?(guests?|people|persons?|pax|log|logon|members|jan|admi)\b/i,
  );
  return m ? Number(m[1]) : null;
}

/** "budget 2 lakh", "1.5-2 lakh", "₹80,000", "50k". Returns rupees. */
export function findBudget(text: string): { min: number | null; max: number | null } {
  const toRupees = (n: string, unit?: string) => {
    const v = Number(n.replace(/,/g, ''));
    const u = (unit ?? '').toLowerCase();
    if (u.startsWith('l')) return Math.round(v * 100_000);
    if (u.startsWith('k')) return Math.round(v * 1000);
    if (u.startsWith('c')) return Math.round(v * 10_000_000);
    return Math.round(v);
  };
  const range = text.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to|se)\s*(\d+(?:\.\d+)?)\s*(lakh|lac|l|k|cr)\b/i,
  );
  if (range) return { min: toRupees(range[1]!, range[3]), max: toRupees(range[2]!, range[3]) };
  const one =
    text.match(
      /(?:budget|₹|rs\.?|inr)\s*(?:of|is|hai|around)?\s*(\d[\d,]*(?:\.\d+)?)\s*(lakh|lac|l|k|cr)?\b/i,
    ) ?? text.match(/\b(\d+(?:\.\d+)?)\s*(lakh|lac|k)\b/i);
  if (one) {
    const v = toRupees(one[1]!, one[2]);
    return v >= 1000 ? { min: null, max: v } : { min: null, max: null };
  }
  return { min: null, max: null };
}

export function findName(text: string): string | null {
  const m = text.match(
    /\b(?:i am|i'm|this is|my name is|mera naam|naam)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
  );
  return m ? m[1]! : null;
}

export function extractEnquiryByRules(
  text: string,
  today: string,
  spaceNames: string[],
): EnquiryExtraction {
  const event = EVENT_WORDS.find(([re]) => re.test(text))?.[1] ?? null;
  const space =
    spaceNames.find((n) =>
      new RegExp(`\\b${n.split(/\s+/)[0]!.replace(/[^a-z]/gi, '')}\\b`, 'i').test(text),
    ) ?? null;
  const budget = findBudget(text);
  const extraction: EnquiryExtraction = {
    full_name: findName(text),
    event_type: event,
    event_date: findDate(text, today),
    guest_count: findGuestCount(text),
    budget_min: budget.min,
    budget_max: budget.max,
    preferred_space: space,
    services: SERVICE_WORDS.filter(([re]) => re.test(text)).map(([, s]) => s),
    summary: '',
  };
  extraction.summary = [
    extraction.event_type,
    extraction.event_date,
    extraction.guest_count ? `${extraction.guest_count} guests` : null,
    extraction.preferred_space,
  ]
    .filter(Boolean)
    .join(', ');
  return extraction;
}

/** Spaces big enough for the party, smallest first (the closest fit). */
export function spacesThatFit<T extends { name: string; floating_capacity: number | null }>(
  spaces: T[],
  guests: number | null,
): T[] {
  if (!guests) return spaces;
  return spaces
    .filter((s) => (s.floating_capacity ?? 0) >= guests)
    .sort((a, b) => (a.floating_capacity ?? 0) - (b.floating_capacity ?? 0));
}

export function draftReplyByRules(input: {
  guestName: string | null;
  venue: string;
  eventType: string | null;
  eventDate: string | null; // already formatted for display
  guestCount: number | null;
  freeSpaces: string[];
  minAdvance: string;
}): string {
  const hello = input.guestName ? `Namaste ${input.guestName} ji,` : 'Namaste,';
  const what = [
    input.eventType ?? 'your event',
    input.eventDate ? `on ${input.eventDate}` : null,
    input.guestCount ? `for ${input.guestCount} guests` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const avail = input.eventDate
    ? input.freeSpaces.length
      ? `${input.freeSpaces.join(', ')} ${input.freeSpaces.length === 1 ? 'is' : 'are'} available that day.`
      : 'That date is busy, but we can suggest nearby dates.'
    : 'Please share your preferred date so we can check availability.';
  return [
    hello,
    `Thank you for considering ${input.venue} for ${what}.`,
    avail,
    `You are welcome to visit and see the venue. An advance of ${input.minAdvance} confirms the booking.`,
    'Shall we share a quotation?',
  ].join('\n');
}

const UPSELL_RULES: [RegExp, RegExp, string][] = [
  // [event matcher, service/package name matcher, reason]
  [
    /wedding|reception|engagement|sangeet|haldi|mehendi/i,
    /decor|stage|flower/i,
    'Wedding functions usually need stage and floral decor.',
  ],
  [/wedding|reception|sangeet/i, /dj|music|sound/i, 'Music for the baraat and sangeet.'],
  [/wedding|reception/i, /room|stay|dorm/i, 'Out-of-town family and the baraat need rooms.'],
  [/./, /veg|catering|plate|buffet/i, 'Every event needs food; quote catering per plate.'],
  [
    /birthday|anniversary|party|kitty/i,
    /decor|balloon|theme/i,
    'Theme decor makes small parties feel special.',
  ],
  [
    /corporate|conference|meeting|seminar/i,
    /projector|sound|tea|snack/i,
    'Corporate events need AV and tea breaks.',
  ],
];

export function upsellByRules(
  eventType: string | null,
  catalog: {
    kind: 'service' | 'package';
    id: string;
    name: string;
    guest_min?: number | null;
    guest_max?: number | null;
  }[],
  guests: number | null,
  alreadyHave: Set<string>,
): UpsellIdea[] {
  const ideas: UpsellIdea[] = [];
  const ev = eventType ?? '';
  for (const item of catalog) {
    if (alreadyHave.has(item.id)) continue;
    if (item.kind === 'package') {
      const fits =
        guests && (item.guest_min ?? 0) <= guests && guests <= (item.guest_max ?? Infinity);
      if (fits)
        ideas.push({ kind: 'package', id: item.id, reason: `${item.name} fits ${guests} guests.` });
      continue;
    }
    const rule = UPSELL_RULES.find(([evRe, nameRe]) => evRe.test(ev) && nameRe.test(item.name));
    if (rule) ideas.push({ kind: 'service', id: item.id, reason: rule[2] });
  }
  return ideas.slice(0, 5);
}

export interface ListedCustomer {
  full_name: string | null;
  phone: string | null; // as written; the app normalises it
  event_type: string | null;
  event_date: string | null; // YYYY-MM-DD
  guest_count: number | null;
  budget_max: number | null;
  notes: string | null;
}

export const PHONE_IN_TEXT = /(?:\+?91[\s-]?)?0?[6-9]\d{4}[\s-]?\d{5}\b/;

/**
 * A typed list of customers -> one entry per customer. Each line (or each
 * block separated by a blank line) that holds a phone number is a customer:
 * the words before the number are the name, the rest is read for the event.
 */
export function extractListByRules(text: string, today: string): ListedCustomer[] {
  const chunks = text.includes('\n\n') ? text.split(/\n\s*\n/) : text.split(/\n/);
  const out: ListedCustomer[] = [];
  for (const raw of chunks) {
    const chunk = raw.replace(/\s+/g, ' ').trim();
    const m = chunk.match(PHONE_IN_TEXT);
    if (!m) continue;
    const before = chunk
      .slice(0, m.index)
      .replace(/^[\d.)\-–•*\s]+/, '') // list numbering "1." "2)"
      .replace(/[,:;\-–|]+\s*$/, '')
      .trim();
    const after = chunk
      .slice(m.index! + m[0].length)
      .replace(/^[,:;\-–|\s]+/, '')
      .trim();
    const x = extractEnquiryByRules(after, today, []);
    out.push({
      full_name: /\p{L}/u.test(before) ? before : (x.full_name ?? null),
      phone: m[0].replace(/[\s-]/g, ''),
      event_type: x.event_type,
      event_date: x.event_date,
      guest_count: x.guest_count,
      budget_max: x.budget_max,
      notes: after || null,
    });
  }
  return out;
}
