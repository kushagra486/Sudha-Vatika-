// AI assistant for the venue team. Three actions, all scoped to the caller's
// organization through their own JWT (RLS applies to every read):
//   extract      WhatsApp / call text -> enquiry fields
//   draft_reply  a ready-to-send WhatsApp reply for a lead
//   upsell       services and packages worth offering a lead
// Uses Claude when the ANTHROPIC_API_KEY secret is set (model from AI_MODEL,
// default claude-opus-5-5). Without a key, or if the call fails, the same
// actions run on simple rules so the buttons always do something useful.
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1.3.0/helpers/zod';
import { z } from 'npm:zod@4.6.7';
import {
  draftReplyByRules,
  extractEnquiryByRules,
  spacesThatFit,
  upsellByRules,
  type AiSource,
  type EnquiryExtraction,
  type UpsellIdea,
} from '../../../packages/shared/src/ai.ts';
import { formatEventDate, todayIST } from '../../../packages/shared/src/dates.ts';
import { formatINR } from '../../../packages/shared/src/money.ts';
import { corsHeaders, fail, getCaller, json, type Caller } from '../_shared/http.ts';

const MODEL = Deno.env.get('AI_MODEL') || 'claude-opus-5-5';
const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
const anthropic = apiKey ? new Anthropic({ apiKey, maxRetries: 1, timeout: 45_000 }) : null;

// Stable instructions first so repeated calls reuse the prompt cache.
const SYSTEM = `You assist the staff of an Indian banquet and resort venue. Guests write in English, Hindi or Hinglish, often informally over WhatsApp or as call notes.
Be accurate: never invent facts. Leave a field null when the text doesn't say it.
Money is in Indian rupees. "Lakh" = 100,000; "k" = 1,000. Dates are day-first (12/01 = 12 January).`;

// ------------------------------------------------------------------ schemas

const ExtractionSchema = z.object({
  full_name: z.string().nullable(),
  event_type: z
    .string()
    .nullable()
    .describe('Short English label, e.g. Wedding, Reception, Birthday'),
  event_date: z.string().nullable().describe('YYYY-MM-DD'),
  guest_count: z.number().int().nullable(),
  budget_min: z.number().nullable(),
  budget_max: z.number().nullable(),
  preferred_space: z
    .string()
    .nullable()
    .describe('Exactly one of the venue space names given, or null'),
  services: z
    .array(z.string())
    .describe('Extras asked about: catering, decor, dj, rooms, photography…'),
  summary: z.string().describe('One line for the staff, under 15 words'),
});

const ReplySchema = z.object({ reply: z.string() });

const UpsellSchema = z.object({
  ideas: z
    .array(
      z.object({
        kind: z.enum(['service', 'package']),
        id: z.string().describe('id copied exactly from the catalogue'),
        reason: z.string().describe('One short sentence for the staff'),
      }),
    )
    .max(5),
});

// ------------------------------------------------------------------ Claude

/**
 * One structured call. Returns null on any failure or refusal so the caller
 * falls back to rules; the error is logged for the function logs.
 */
async function ask<T extends z.ZodType>(
  schema: T,
  prompt: string,
  effort: 'low' | 'medium',
): Promise<z.infer<T> | null> {
  if (!anthropic) return null;
  try {
    const res = await anthropic.beta.messages.parse({
      model: MODEL,
      // If a safety classifier declines, the API retries on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      max_tokens: 8000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
      output_config: { effort, format: zodOutputFormat(schema) },
    });
    if (res.stop_reason === 'refusal') {
      console.warn('ai refusal', res.stop_details?.category);
      return null;
    }
    return (res.parsed_output as z.infer<T> | null) ?? null;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) console.warn('ai rate limited');
    else if (e instanceof Anthropic.APIError) console.error('ai api error', e.status, e.message);
    else console.error('ai error', e);
    return null;
  }
}

// ------------------------------------------------------------------ data

async function loadSpaces(c: Caller) {
  const { data } = await c.client
    .from('units')
    .select('id, name, kind, floating_capacity, upcoming')
    .eq('active', true)
    .not('kind', 'in', '(room,dormitory)');
  return (data ?? []) as {
    id: string;
    name: string;
    kind: string;
    floating_capacity: number | null;
    upcoming: boolean;
  }[];
}

async function loadLead(c: Caller, leadId: string) {
  const { data } = await c.client
    .from('leads')
    .select(
      'id, stage, event_type, event_date, guest_count, budget_min, budget_max, preferred_unit:units(name), guest:guests(full_name, phone_e164)',
    )
    .eq('id', leadId)
    .maybeSingle();
  return data as unknown as {
    id: string;
    stage: string;
    event_type: string | null;
    event_date: string | null;
    guest_count: number | null;
    budget_min: number | null;
    budget_max: number | null;
    preferred_unit: { name: string } | null;
    guest: { full_name: string | null; phone_e164: string };
  } | null;
}

async function freeSpacesOn(c: Caller, date: string | null, guests: number | null) {
  const spaces = (await loadSpaces(c)).filter((s) => !s.upcoming);
  if (!date) return spacesThatFit(spaces, guests).map((s) => s.name);
  const { data } = await c.client
    .from('bookings')
    .select('unit_id, shift')
    .eq('event_date', date)
    .in('status', ['tentative', 'confirmed']);
  const fullDay = new Set((data ?? []).filter((b) => b.shift === 'full_day').map((b) => b.unit_id));
  const anyBooking = new Set((data ?? []).map((b) => b.unit_id));
  // Free = nothing booked that day; partly booked spaces are mentioned as such.
  return spacesThatFit(spaces, guests)
    .filter((s) => !fullDay.has(s.id))
    .map((s) => (anyBooking.has(s.id) ? `${s.name} (part of the day)` : s.name));
}

// ------------------------------------------------------------------ actions

async function extract(c: Caller, text: string) {
  const today = todayIST();
  const spaces = await loadSpaces(c);
  const names = spaces.map((s) => s.name);
  const llm = await ask(
    ExtractionSchema,
    `Today is ${today}. Venue spaces: ${names.join(', ')}.\n\nExtract the enquiry details from this message:\n"""\n${text}\n"""`,
    'low',
  );
  const extraction: EnquiryExtraction = llm
    ? {
        ...llm,
        preferred_space: names.includes(llm.preferred_space ?? '') ? llm.preferred_space : null,
      }
    : extractEnquiryByRules(text, today, names);
  const space = spaces.find((s) => s.name === extraction.preferred_space);
  return {
    extraction,
    preferred_unit_id: space?.id ?? null,
    source: (llm ? 'llm' : 'rules') as AiSource,
  };
}

async function draftReply(c: Caller, leadId: string, instruction: string | null) {
  const lead = await loadLead(c, leadId);
  if (!lead) return null;
  const [{ data: org }, { data: msgs }] = await Promise.all([
    c.client.from('organizations').select('name, min_advance').single(),
    c.client
      .from('messages')
      .select('direction, body, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(12),
  ]);
  const free = await freeSpacesOn(c, lead.event_date, lead.guest_count);
  const venue = org?.name ?? 'our venue';
  const advance = formatINR(org?.min_advance ?? 0);
  const history = (msgs ?? [])
    .reverse()
    .map((m) => `${m.direction === 'in' ? 'Guest' : 'Venue'}: ${m.body ?? ''}`)
    .join('\n');

  const llm = await ask(
    ReplySchema,
    `Write the venue's next WhatsApp reply to this guest.
Venue: ${venue}. Minimum advance to confirm: ${advance}.
Guest: ${lead.guest.full_name ?? 'unknown name'}.
Enquiry: ${lead.event_type ?? 'event not stated'}, date ${lead.event_date ?? 'not given'}, ${lead.guest_count ?? 'unknown'} guests, preferred space ${lead.preferred_unit?.name ?? 'none'}.
Spaces that fit and are free that day: ${free.join(', ') || 'none free'}.
Conversation so far (oldest first):
${history || '(no messages yet)'}
${instruction ? `Staff instruction: ${instruction}\n` : ''}
Rules: reply in the guest's language and tone (Hinglish if they wrote Hinglish). Warm, short (under 70 words), WhatsApp style, no markdown headings. Do not quote prices; offer a quotation or a visit. Ask for any missing date or guest count.`,
    'medium',
  );
  const text =
    llm?.reply ??
    draftReplyByRules({
      guestName: lead.guest.full_name,
      venue,
      eventType: lead.event_type,
      eventDate: lead.event_date ? formatEventDate(lead.event_date) : null,
      guestCount: lead.guest_count,
      freeSpaces: free,
      minAdvance: advance,
    });
  return { text, source: (llm ? 'llm' : 'rules') as AiSource };
}

async function upsell(c: Caller, leadId: string | null, bookingId: string | null) {
  let eventType: string | null = null;
  let guests: number | null = null;
  const have = new Set<string>();
  if (bookingId) {
    const { data: b } = await c.client
      .from('bookings')
      .select('event_type, guest_count, items:booking_items(service_id)')
      .eq('id', bookingId)
      .maybeSingle();
    if (!b) return null;
    eventType = b.event_type;
    guests = b.guest_count;
    for (const i of (b.items ?? []) as { service_id: string | null }[])
      if (i.service_id) have.add(i.service_id);
  } else if (leadId) {
    const lead = await loadLead(c, leadId);
    if (!lead) return null;
    eventType = lead.event_type;
    guests = lead.guest_count;
  }
  const [{ data: services }, { data: packages }] = await Promise.all([
    c.client
      .from('services')
      .select('id, name, description, base_price, pricing_unit')
      .eq('active', true),
    c.client
      .from('packages')
      .select('id, name, description, price, guest_min, guest_max')
      .eq('active', true),
  ]);
  const catalog = [
    ...(services ?? []).map((s) => ({ kind: 'service' as const, ...s })),
    ...(packages ?? []).map((p) => ({ kind: 'package' as const, ...p })),
  ];
  const ids = new Set(catalog.map((x) => x.id));

  const llm = await ask(
    UpsellSchema,
    `Event: ${eventType ?? 'not stated'}, ${guests ?? 'unknown'} guests.
Already included (skip these ids): ${[...have].join(', ') || 'nothing'}.
Catalogue (JSON):
${JSON.stringify(catalog.map(({ kind, id, name, description }) => ({ kind, id, name, description })))}
Pick up to 5 items this guest would most plausibly add, most valuable first. Only use ids from the catalogue.`,
    'low',
  );
  const ideas: UpsellIdea[] = llm
    ? llm.ideas.filter((i) => ids.has(i.id) && !have.has(i.id))
    : upsellByRules(eventType, catalog, guests, have);

  // Remember suggestions on the lead so the Upsell page can track them.
  if (leadId && ideas.length) {
    await c.client.from('upsell_suggestions').insert(
      ideas.map((i) => ({
        lead_id: leadId,
        service_id: i.kind === 'service' ? i.id : null,
        package_id: i.kind === 'package' ? i.id : null,
        reason: i.reason,
      })),
    );
  }
  const names = new Map(catalog.map((x) => [x.id, x.name]));
  return {
    ideas: ideas.map((i) => ({ ...i, name: names.get(i.id) ?? '' })),
    source: (llm ? 'llm' : 'rules') as AiSource,
  };
}

// ------------------------------------------------------------------ handler

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }),
  z.object({ action: z.literal('extract'), text: z.string().min(1).max(8000) }),
  z.object({
    action: z.literal('draft_reply'),
    lead_id: z.string().uuid(),
    instruction: z.string().max(500).nullish(),
  }),
  z.object({
    action: z.literal('upsell'),
    lead_id: z.string().uuid().nullish(),
    booking_id: z.string().uuid().nullish(),
  }),
]);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('method_not_allowed', 405);
  const caller = await getCaller(req);
  if (!caller) return fail('not_signed_in', 401);
  if (caller.role === 'viewer') return fail('not_allowed', 403);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('bad_request', 400);
  const b = parsed.data;

  switch (b.action) {
    case 'status':
      return json({ llm: !!anthropic, model: anthropic ? MODEL : null });
    case 'extract':
      return json(await extract(caller, b.text));
    case 'draft_reply': {
      const r = await draftReply(caller, b.lead_id, b.instruction ?? null);
      return r ? json(r) : fail('not_found', 404);
    }
    case 'upsell': {
      if (!b.lead_id && !b.booking_id) return fail('bad_request', 400);
      const r = await upsell(caller, b.lead_id ?? null, b.booking_id ?? null);
      return r ? json(r) : fail('not_found', 404);
    }
  }
});
