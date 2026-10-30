// The dashboard assistant's knowledge (one snapshot from the
// `assistant_snapshot` RPC) and the built-in answers used when no AI model
// replies: no key, rate limit, timeout, or the phone is offline. The rules
// cover the everyday questions in English and Hinglish; anything else gets a
// short list of what can be asked.
import { extractEnquiryByRules, findDate, PHONE_IN_TEXT } from './ai.ts';
import { addDays, formatEventDate } from './dates.ts';
import { formatINR } from './money.ts';

export interface SnapshotBooking {
  date: string;
  shift: string;
  space: string;
  status: string;
  event?: string;
  guests?: number;
  guest?: string;
  phone?: string;
  total?: number;
  paid?: number;
  balance?: number;
}

export interface SnapshotEnquiry {
  guest?: string;
  phone?: string;
  stage: string;
  source?: string;
  event?: string;
  date?: string;
  guests?: number;
  budget?: number;
  follow_up?: string;
  received?: string;
}

export interface AssistantSnapshot {
  today: string;
  generated_at: string;
  can_see_money: boolean;
  venue: { name: string; min_advance: number; gst_percent: number } | null;
  spaces: {
    name: string;
    kind: string;
    capacity: number | null;
    rooms: number;
    opening_soon: boolean;
  }[];
  bookings: SnapshotBooking[];
  room_stays: {
    space: string;
    check_in: string;
    check_out: string;
    rooms: number;
    status: string;
    guest: string | null;
  }[];
  open_enquiries: SnapshotEnquiry[];
  counts: {
    open_enquiries: number;
    new_today: number;
    new_last_7_days: number;
    follow_ups_overdue: number;
    follow_ups_today: number;
    booked_this_month: number;
  };
  money: {
    collected_this_month: number;
    collected_last_month: number;
    balance_due_upcoming: number;
  } | null;
  services: { name: string; price: number; per: string; group: string | null }[];
  packages: {
    name: string;
    price: number;
    guests_from: number | null;
    guests_to: number | null;
    details: string | null;
  }[];
}

const SHIFT_LABEL: Record<string, string> = {
  full_day: 'full day',
  breakfast: 'breakfast',
  lunch: 'lunch',
  high_tea: 'high tea',
  dinner: 'dinner',
};

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_FULL = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const HINDI_DAYS: Record<string, number> = {
  ravivar: 0,
  somvar: 1,
  mangalvar: 2,
  budhvar: 3,
  guruvar: 4,
  shukravar: 5,
  shanivar: 6,
};

const EVENT_SPACE = (kind: string) => kind !== 'room' && kind !== 'dormitory';

/** A date the question is about: today/aaj, tomorrow/kal, parso, a weekday or a written date. */
export function questionDate(q: string, today: string): string | null {
  const s = q.toLowerCase();
  if (/\b(day after tomorrow|parso|parson)\b/.test(s)) return addDays(today, 2);
  if (/\b(tomorrow|kal)\b/.test(s)) return addDays(today, 1);
  if (/\b(today|aaj|tonight|aj)\b/.test(s)) return today;
  const written = findDate(q, today);
  if (written) return written;
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  for (const [word, n] of [
    ...WEEKDAYS.map((w, i) => [`(?:${w}|${WEEKDAY_FULL[i]})`, i] as const),
    ...Object.entries(HINDI_DAYS),
  ]) {
    if (new RegExp(`\\b${word}\\b`).test(s)) {
      const ahead = (Number(n) - dow + 7) % 7 || 7;
      return addDays(today, /\bnext\b/.test(s) && ahead < 7 ? ahead + 7 : ahead);
    }
  }
  return null;
}

const lines = (xs: string[]) => xs.map((x) => `• ${x}`).join('\n');

function bookingLine(b: SnapshotBooking, money: boolean, withDate = false) {
  const parts = [
    withDate ? formatEventDate(b.date) : null,
    `${b.space} (${SHIFT_LABEL[b.shift] ?? b.shift})`,
    [b.event, b.guest].filter(Boolean).join(' – ') || null,
    b.guests ? `${b.guests} guests` : null,
    b.status === 'tentative' ? 'tentative' : null,
    money && b.balance != null && b.balance > 0 ? `balance ${formatINR(b.balance)}` : null,
  ];
  return parts.filter(Boolean).join(', ');
}

function enquiryLine(e: SnapshotEnquiry) {
  return [
    e.guest ?? e.phone ?? 'Unknown',
    e.event,
    e.date ? formatEventDate(e.date) : null,
    e.guests ? `${e.guests} guests` : null,
    e.phone && e.guest ? e.phone : null,
  ]
    .filter(Boolean)
    .join(', ');
}

function availability(s: AssistantSnapshot, date: string, guests: number | null) {
  const booked = s.bookings.filter((b) => b.date === date);
  const spaces = s.spaces.filter((x) => EVENT_SPACE(x.kind) && !x.opening_soon);
  const free: string[] = [];
  const part: string[] = [];
  for (const sp of spaces) {
    if (guests && sp.capacity && sp.capacity < guests) continue;
    const mine = booked.filter((b) => b.space === sp.name);
    if (!mine.length) free.push(sp.name);
    else if (!mine.some((b) => b.shift === 'full_day'))
      part.push(`${sp.name} (taken: ${mine.map((b) => SHIFT_LABEL[b.shift]).join(', ')})`);
  }
  const head = `${formatEventDate(date)}${guests ? ` for ${guests} guests` : ''}:`;
  const out = [head];
  out.push(free.length ? `Free all day: ${free.join(', ')}` : 'No space is free all day.');
  if (part.length) out.push(`Partly free: ${part.join('; ')}`);
  if (booked.length)
    out.push(`Booked:\n${lines(booked.map((b) => bookingLine(b, s.can_see_money)))}`);
  return out.join('\n');
}

function eventsBetween(s: AssistantSnapshot, from: string, to: string, label: string) {
  const list = s.bookings.filter((b) => b.date >= from && b.date <= to);
  if (!list.length) return `No events ${label}.`;
  return `${list.length} event${list.length > 1 ? 's' : ''} ${label}:\n${lines(
    list.map((b) => bookingLine(b, s.can_see_money, from !== to)),
  )}`;
}

function findPerson(s: AssistantSnapshot, q: string) {
  const digits = q.replace(/\D/g, '');
  const matchPhone = (p?: string) =>
    digits.length >= 6 && !!p && p.replace(/\D/g, '').endsWith(digits.slice(-10));
  const words = q
    .toLowerCase()
    .replace(/[^\p{L}\p{M} ]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  const matchName = (n?: string | null) =>
    !!n && words.some((w) => n.toLowerCase().split(/\s+/).includes(w));
  const bookings = s.bookings.filter((b) => matchPhone(b.phone) || matchName(b.guest));
  const enquiries = s.open_enquiries.filter((e) => matchPhone(e.phone) || matchName(e.guest));
  if (!bookings.length && !enquiries.length) return null;
  const out: string[] = [];
  if (bookings.length)
    out.push(`Bookings:\n${lines(bookings.map((b) => bookingLine(b, s.can_see_money, true)))}`);
  if (enquiries.length)
    out.push(
      `Open enquiries:\n${lines(
        enquiries.map(
          (e) =>
            `${enquiryLine(e)} (${e.stage.replace('_', ' ')}${e.follow_up ? `, follow up ${formatEventDate(e.follow_up)}` : ''})`,
        ),
      )}`,
    );
  return out.join('\n');
}

const STOP = new Set(
  'the and for who what when where which how about with from this that have has any are is was show tell give list find guest guests customer customers booking bookings enquiry enquiries details detail phone number please mujhe batao bata kya kaun kab hai hain wala wali ka ki ke ko se mein me free book booked event events today tomorrow week month new many much due next last all aaj kal parso hall lawn space spaces'.split(
    ' ',
  ),
);

const HELP = `I can answer from the venue's data. Try:
• Is any hall free on 14 Feb? / Kal kya free hai?
• What events are this week?
• Whose follow-ups are due today?
• How many new enquiries this week?
• How much was collected this month?
• Who is staying in the rooms tonight?
• Prices of packages / services
• A guest's name or phone number`;

// Hindi words mapped to the English keywords the rules look for.
const HINDI: [RegExp, string][] = [
  [/परसों/g, 'parso'],
  [/आज\s*रात/g, 'tonight'],
  [/आज/g, 'today'],
  [/कल/g, 'tomorrow'],
  [/सारांश|रिपोर्ट/g, 'summary'],
  [/फ़ॉलो[- ]?अप|फॉलो[- ]?अप/g, 'follow up'],
  [/हफ़्ते|हफ्ते|सप्ताह/g, 'this week'],
  [/महीने|महीना/g, 'this month'],
  [/बाकी|बकाया/g, 'balance'],
  [/पैसा|पैसे|भुगतान|कलेक्शन|कमाई/g, 'collected'],
  [/कमरों|कमरे|कमरा|डॉर्म/g, 'rooms'],
  [/खाली|उपलब्ध/g, 'free'],
  [/रेट|दाम|कीमत|पैकेज/g, 'price'],
  [/पूछताछ|इंक्वायरी/g, 'enquiries'],
  [/नई|नए|नया/g, 'new'],
  [/जोड़ो|जोड़ें|जोड़|डालो|डालें|लिखो|बनाओ/g, 'add'],
  [/हॉल/g, 'hall'],
  [/लॉन/g, 'lawn'],
  [/इवेंट|कार्यक्रम|शादी/g, 'events'],
  [/मेहमानों|मेहमान|लोगों|लोग/g, 'guests'],
];

/** Lower-case, with Hindi keywords turned into the English ones the rules use. */
export function normalizeQuestion(question: string): string {
  let q = question.toLowerCase();
  for (const [re, en] of HINDI) q = q.replace(re, ` ${en} `);
  return q.replace(/\s+/g, ' ').trim();
}

/** Answer a question from the snapshot without any AI model. */
export function answerByRules(rawQuestion: string, s: AssistantSnapshot): string {
  const question = normalizeQuestion(rawQuestion);
  const q = question;
  const today = s.today;
  const guests = q.match(/\b(\d{2,4})\s*(guests?|people|pax|log|persons?)\b/);
  const guestCount = guests ? Number(guests[1]) : null;

  // Someone by phone number first: digits are unambiguous.
  if (/\d{6,}/.test(q.replace(/[\s-]/g, ''))) {
    const p = findPerson(s, question);
    if (p) return p;
  }

  if (/\b(follow[- ]?ups?|call back|callback|remind|pending calls?)\b/.test(q)) {
    const due = s.open_enquiries.filter((e) => e.follow_up && e.follow_up <= today);
    if (!due.length) return 'No follow-ups are due today. 👍';
    return `${s.counts.follow_ups_overdue} overdue, ${s.counts.follow_ups_today} due today:\n${lines(
      due.slice(0, 15).map((e) => `${enquiryLine(e)}${e.follow_up! < today ? ' (overdue)' : ''}`),
    )}`;
  }

  if (
    /\b(collect(ed|ion)?|revenue|earn|income|payment|paisa|paise|kamai|balance|due|pending amount|outstanding|money)\b/.test(
      q,
    )
  ) {
    if (!s.can_see_money || !s.money)
      return 'Payment figures are visible to owners and managers only.';
    if (/\b(balance|due|pending|outstanding|baaki|baki)\b/.test(q)) {
      const owing = s.bookings
        .filter((b) => b.date >= today && (b.balance ?? 0) > 0)
        .slice(0, 10)
        .map((b) => bookingLine(b, true, true));
      return `Balance still to collect on upcoming bookings: ${formatINR(s.money.balance_due_upcoming)}${
        owing.length ? `\n${lines(owing)}` : ''
      }`;
    }
    return `Collected this month: ${formatINR(s.money.collected_this_month)} (last month ${formatINR(
      s.money.collected_last_month,
    )}).\nStill due on upcoming bookings: ${formatINR(s.money.balance_due_upcoming)}.`;
  }

  if (
    /\b(rooms?|dorm|dormitory|stay|staying|check[- ]?in|kamra)\b/.test(q) &&
    !/\bhall|lawn\b/.test(q)
  ) {
    const date = questionDate(question, today) ?? today;
    const stays = s.room_stays.filter((r) => r.check_in <= date && r.check_out > date);
    const totals = s.spaces.filter((x) => !EVENT_SPACE(x.kind));
    const used = (name: string) =>
      stays.filter((r) => r.space === name).reduce((a, r) => a + r.rooms, 0);
    const summary = totals.map((t) => `${t.name}: ${t.rooms - used(t.name)} of ${t.rooms} free`);
    return `Rooms on the night of ${formatEventDate(date)}:\n${lines(summary)}${
      stays.length
        ? `\nStaying:\n${lines(stays.map((r) => `${r.guest ?? 'Guest'} – ${r.rooms} × ${r.space}, out ${formatEventDate(r.check_out)}`))}`
        : ''
    }`;
  }

  if (
    /\b(price|prices|rate|rates|cost|charges?|package|packages|menu|services?|kitna|kitne|daam)\b/.test(
      q,
    )
  ) {
    const pk = s.packages.map(
      (p) =>
        `${p.name}: ${formatINR(p.price)}${p.guests_from || p.guests_to ? ` (${p.guests_from ?? ''}–${p.guests_to ?? ''} guests)` : ''}`,
    );
    const sv = s.services.map((x) => `${x.name}: ${formatINR(x.price)} ${x.per.replace('_', ' ')}`);
    const out: string[] = [];
    if (pk.length && !/\bservices?\b/.test(q)) out.push(`Packages:\n${lines(pk)}`);
    if (sv.length && !/\bpackages?\b/.test(q)) out.push(`Services:\n${lines(sv.slice(0, 25))}`);
    if (s.venue) out.push(`Minimum advance to confirm: ${formatINR(s.venue.min_advance)}.`);
    return out.join('\n') || 'No prices are set up yet (Settings → Services).';
  }

  const person = findPerson(s, question);
  if (person) return person;

  if (/\b(new|naye|nayi|enquir(y|ies)|inquir(y|ies)|leads?)\b/.test(q)) {
    const recent = s.open_enquiries
      .filter((e) => e.received && e.received >= addDays(today, -6))
      .slice(0, 10)
      .map(enquiryLine);
    return `New enquiries: ${s.counts.new_today} today, ${s.counts.new_last_7_days} in the last 7 days. ${s.counts.open_enquiries} are open in total, ${s.counts.booked_this_month} booked this month.${
      recent.length ? `\nLatest:\n${lines(recent)}` : ''
    }`;
  }

  if (/\b(summary|overview|status|how are we|kaisa|report|aaj ka)\b/.test(q) || q.trim() === '') {
    return [
      eventsBetween(s, today, today, 'today'),
      `Follow-ups: ${s.counts.follow_ups_overdue} overdue, ${s.counts.follow_ups_today} today.`,
      `New enquiries: ${s.counts.new_today} today, ${s.counts.new_last_7_days} this week.`,
      s.money ? `Collected this month: ${formatINR(s.money.collected_this_month)}.` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (/\b(this week|is hafte|next 7 days|week)\b/.test(q))
    return eventsBetween(s, today, addDays(today, 6), 'in the next 7 days');
  if (/\b(this month|is mahine|month)\b/.test(q))
    return eventsBetween(s, today, addDays(today, 30), 'in the next 30 days');
  if (/\b(upcoming|next events?|coming)\b/.test(q))
    return eventsBetween(s, today, addDays(today, 30), 'in the next 30 days');

  const date = questionDate(question, today);
  if (date) {
    if (/\b(free|available|availability|khali|khaali|vacant|book|slot)\b/.test(q) || guestCount)
      return availability(s, date, guestCount);
    return eventsBetween(s, date, date, `on ${formatEventDate(date)}`);
  }
  if (/\b(free|available|availability|khali|khaali)\b/.test(q))
    return 'Which date? For example: "Is a hall free on 14 Feb for 300 guests?"';

  if (/\b(hall|lawn|spaces?|capacity|venue)\b/.test(q)) {
    return `Spaces:\n${lines(
      s.spaces.map(
        (x) =>
          `${x.name}${x.capacity ? ` – up to ${x.capacity} guests` : ''}${!EVENT_SPACE(x.kind) ? ` – ${x.rooms} rooms` : ''}${x.opening_soon ? ' (opening soon)' : ''}`,
      ),
    )}`;
  }

  return HELP;
}

// ------------------------------------------------------------------ actions

/** An enquiry the assistant proposes to add. Staff check it and tap Add. */
export interface EnquiryDraft {
  full_name: string | null;
  phone: string | null; // as written; the app turns it into +91…
  event_type: string | null;
  event_date: string | null; // YYYY-MM-DD
  guest_count: number | null;
  budget_max: number | null;
  notes: string | null;
}

const ADD_WORDS = /\b(add|create|save|enter|daalo|dalo|daal|likho|jodo|banao)\b/;
// "new enquiry: Sharma ji…" is a request; "how many new enquiries?" is a question.
const NEW_WORDS = /\b(new|naya|nayi|nai)\b/;
const ASKING = /\?|\b(how|kitn\w*|kaun\w*|which|what|show|list|batao|dikhao)\b/;
const HONORIFIC = /\b((?:mr|mrs|ms|dr|shri|smt)\.?\s+[A-Za-z][A-Za-z.]*)/i;
const ENQUIRY_WORDS = /\b(enquir(y|ies)|inquir(y|ies)|leads?|customers?|guest)\b/;
const MONTH_LIKE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
const NAME =
  /\b(?:for|of|naam|name|customer|guest)\s*[:-]?\s+((?:mr|mrs|ms|dr|shri|smt)\.?\s+)?([A-Za-z][A-Za-z.]*(?:\s+(?!ji\b)[A-Z][A-Za-z.]*)?)(\s+ji)?\b/i;

/** "add enquiry for Sharma ji 14 Feb 300 log 98xxxxxx" -> a draft, or null if not asked. */
export function detectAddEnquiry(question: string, today: string): EnquiryDraft | null {
  const q = normalizeQuestion(question);
  const wantsAdd = ADD_WORDS.test(q) || (NEW_WORDS.test(q) && !ASKING.test(q));
  if (!wantsAdd || !ENQUIRY_WORDS.test(q)) return null;
  const phone = question.match(PHONE_IN_TEXT)?.[0].replace(/[\s-]/g, '') ?? null;
  const rules = extractEnquiryByRules(question, today, []);
  const m = question.match(NAME);
  let name: string | null = null;
  if (m && !MONTH_LIKE.test(m[2]!) && !ENQUIRY_WORDS.test(m[2]!.toLowerCase()))
    name = `${m[1] ?? ''}${m[2]}`.replace(/\s+/g, ' ').trim();
  else name = question.match(HONORIFIC)?.[1]?.replace(/\s+/g, ' ') ?? null;
  return {
    full_name: name ?? rules.full_name,
    phone,
    event_type: rules.event_type,
    event_date: rules.event_date,
    guest_count: rules.guest_count,
    budget_max: rules.budget_max,
    notes: question.trim(),
  };
}

/** One line describing a draft, for the assistant's reply. */
export function describeDraft(d: EnquiryDraft): string {
  const bits = [
    d.full_name,
    d.event_type,
    d.event_date ? formatEventDate(d.event_date) : null,
    d.guest_count ? `${d.guest_count} guests` : null,
    d.budget_max ? `budget ${formatINR(d.budget_max)}` : null,
    d.phone,
  ].filter(Boolean);
  return `New enquiry ready: ${bits.join(', ') || 'no details yet'}.${
    d.phone ? '' : ' Add the phone number,'
  } Check the details below and tap Add.`;
}
