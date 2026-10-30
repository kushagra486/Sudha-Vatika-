import { addDays, toE164 } from '@bm/shared';

// Turns the text rows read from iPhone "Phone → Recents" screenshots into
// calls. Each Recents row shows a name (saved contact) or a number, an
// optional "(2)" repeat count, and on the right a time ("10:42 AM"),
// "Yesterday", a weekday or a date. Missed calls are drawn in red, which the
// OCR step measures as redRatio. The line under each name ("mobile", "India")
// is ignored.

/** One word read from a screenshot, with its box and how red its ink is. */
export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  red: number; // share of the word's ink that is iOS red (0..1)
}

export interface RecentCall {
  phone_e164: string | null;
  contact_name: string | null;
  date: string; // YYYY-MM-DD (India)
  time: string | null; // HH:mm, only shown for today's calls
  label: string; // as shown on screen
  missed: boolean;
  count: number;
  dedupe_key: string;
  call_at: string; // ISO with +05:30
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MISSED_RED = 0.3;

function weekdayDate(today: string, name: string): string {
  const target = WEEKDAYS.findIndex((d) => d.startsWith(name.toLowerCase().slice(0, 3)));
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  const back = (dow - target + 7) % 7 || 7; // Recents uses a weekday only for 2-6 days ago
  return addDays(today, -back);
}

function to24h(t: string): string | null {
  const m = t.match(/^(\d{1,2})[:.](\d{2})\s*([ap]\.?m\.?)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toLowerCase().replace(/\./g, '');
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const TIME = /^\d{1,2}[:.]\d{2}$/;
const AMPM = /^[ap]\.?m\.?$/i;
const DAY =
  /^(yesterday|today|(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?|sun)(?:day)?|\d{1,2}\/\d{1,2}\/\d{2,4})$/i;
const SUBWORD =
  /^(mobile|home|work|main|other|iphone|india|unknown|facetime|audio|video|whatsapp|maybe:?|spam|potential|telemarketer)$/i;

/** "Yesterday", "Monday", "21/10/26" or "10:42 AM" -> date and time. */
export function resolveWhen(
  label: string,
  today: string,
): { date: string; time: string | null } | null {
  const t = label.match(/^(\d{1,2}[:.]\d{2})\s*([ap]\.?m\.?)?$/i);
  if (t) {
    const time = to24h(`${t[1]}${t[2] ? ` ${t[2]}` : ''}`);
    return time ? { date: today, time } : null;
  }
  if (/^yesterday$/i.test(label)) return { date: addDays(today, -1), time: null };
  if (/^today$/i.test(label)) return { date: today, time: null };
  const d = label.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (d) {
    const y = Number(d[3]);
    return {
      date: `${y < 100 ? 2000 + y : y}-${d[2]!.padStart(2, '0')}-${d[1]!.padStart(2, '0')}`,
      time: null,
    };
  }
  if (DAY.test(label)) return { date: weekdayDate(today, label), time: null };
  return null;
}

/**
 * Reads an Indian number even when OCR garbles the country code
 * ("+01 98765 43210", "09876543210", "98765 43210").
 */
export function readPhone(text: string): string | null {
  let digits = text.replace(/\D/g, '');
  if (digits.length === 12 && /^[0-9]1/.test(digits)) digits = `91${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? toE164(`+${digits}`) : null;
}

/** Name side of one Recents row -> who called and the repeat count. */
export function parseWho(
  raw: string,
): { phone: string | null; name: string | null; count: number } | null {
  let text = raw
    .replace(/[|®©@»«“”"'`~*_=]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let count = 1;
  const c = text.match(/\((\d{1,2})\)\s*$/);
  if (c) {
    count = Number(c[1]);
    text = text.slice(0, c.index).trim();
  }
  text = text.replace(/^[^\p{L}\p{N}+]+/u, '').trim();
  // The call-direction arrow sometimes reads as a stray "2" or "»" before a name.
  text = text.replace(/^(?:[^\p{L}\s]{1,2}\s+)+(?=\p{L})/u, '').trim();
  if (!text) return null;
  if ((text.match(/\d/g) ?? []).length >= 8) {
    const phone = readPhone(text);
    return phone ? { phone, name: null, count } : null;
  }
  if (!/\p{L}/u.test(text) || text.length < 2) return null;
  return { phone: null, name: text, count };
}

/**
 * Recents words -> calls. Every row has exactly one time or day on the right,
 * so those are the anchors; name words on the left join the nearest anchor.
 * The grey line under the name ("mobile", "India") and the ⓘ button are
 * dropped.
 */
export function parseRecentsWords(words: OcrWord[], width: number, today: string): RecentCall[] {
  const right = width * 0.55;
  const cy = (w: OcrWord) => (w.y0 + w.y1) / 2;
  const heights = words.map((w) => w.y1 - w.y0).sort((a, b) => a - b);
  const h = heights[Math.floor(heights.length / 2)] ?? 20;

  // 1. Anchors: time ("10:42" + "AM") or day words on the right side.
  const anchors: { y: number; label: string }[] = [];
  const rightWords = words.filter((w) => w.x0 >= right).sort((a, b) => a.x0 - b.x0);
  for (const w of rightWords) {
    const text = w.text.replace(/[^\w:./]/g, '');
    if (TIME.test(text)) {
      const ap = rightWords.find(
        (o) => o !== w && AMPM.test(o.text) && Math.abs(cy(o) - cy(w)) < h && o.x0 > w.x0,
      );
      anchors.push({ y: cy(w), label: ap ? `${text} ${ap.text.toUpperCase()}` : text });
    } else if (DAY.test(text)) {
      anchors.push({ y: cy(w), label: text });
    }
  }
  anchors.sort((a, b) => a.y - b.y);
  if (!anchors.length) return [];
  const gaps = anchors
    .slice(1)
    .map((a, i) => a.y - anchors[i]!.y)
    .sort((a, b) => a - b);
  const reach = (gaps[Math.floor(gaps.length / 2)] ?? h * 4) * 0.6;

  // 2. Name-side words go to the nearest anchor within reach.
  const groups = anchors.map(() => [] as OcrWord[]);
  for (const w of words) {
    if (w.x1 >= right) continue;
    let best = -1;
    let dist = Infinity;
    anchors.forEach((a, i) => {
      const d = Math.abs(a.y - cy(w));
      if (d < dist) [best, dist] = [i, d];
    });
    if (best >= 0 && dist <= reach) groups[best]!.push(w);
  }

  // 3. Each group: the top line is the caller, the line below is the label.
  const out: RecentCall[] = [];
  const seen = new Set<string>();
  anchors.forEach((a, i) => {
    const ws = groups[i]!;
    if (!ws.length) return;
    const top = Math.min(...ws.map(cy));
    const nameWords = ws
      .filter((w) => cy(w) - top < h * 0.9 && !SUBWORD.test(w.text))
      .sort((p, q) => p.x0 - q.x0);
    const who = parseWho(nameWords.map((w) => w.text).join(' '));
    const when = resolveWhen(a.label, today);
    if (!who || !when) return;
    const key = `${who.phone ?? `name:${who.name!.toLowerCase()}`}|${when.date}|${when.time ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      phone_e164: who.phone,
      contact_name: who.name,
      date: when.date,
      time: when.time,
      label: a.label,
      missed: Math.max(...nameWords.map((w) => w.red)) >= MISSED_RED,
      count: who.count,
      dedupe_key: key,
      call_at: `${when.date}T${when.time ?? '00:00'}:00+05:30`,
    });
  });
  return out;
}

/** India's 140-series numbers are registered telemarketers. */
export function isTelemarketer(phone: string | null): boolean {
  return !!phone && /^\+91140\d{7}$/.test(phone);
}

export function directoryKey(c: {
  phone_e164: string | null;
  contact_name: string | null;
}): string {
  return c.phone_e164 ?? `name:${(c.contact_name ?? '').toLowerCase()}`;
}
