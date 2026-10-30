// AI assistant for the venue team. Every action is scoped to the caller's
// organization through their own JWT (RLS applies to every read):
//   extract       WhatsApp / call text -> enquiry fields
//   extract_list  typed list or photo of a written page -> customers
//   draft_reply   a ready-to-send WhatsApp reply for a lead
//   upsell        services and packages worth offering a lead
//
// Provider is picked from whichever key is set (or AI_PROVIDER):
//   GROQ_API_KEY        Groq (free tier)            default model openai/gpt-oss-120b
//   OPENROUTER_API_KEY  OpenRouter (free models)    default: free Gemma, with backups
//   ANTHROPIC_API_KEY   Claude                       default claude-opus-5-5
// AI_MODEL overrides the model. Without any key, or if a call fails, the same
// actions run on built-in rules so the buttons always do something useful.
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1.3.0/helpers/zod';
import { z } from 'npm:zod@4.6.7';
import {
  draftReplyByRules,
  extractEnquiryByRules,
  extractListByRules,
  spacesThatFit,
  upsellByRules,
  type AiSource,
  type EnquiryExtraction,
  type ListedCustomer,
  type UpsellIdea,
} from '../../../packages/shared/src/ai.ts';
import { formatEventDate, todayIST } from '../../../packages/shared/src/dates.ts';
import { formatINR } from '../../../packages/shared/src/money.ts';
import { corsHeaders, fail, getCaller, json, type Caller } from '../_shared/http.ts';

type Provider = 'groq' | 'openrouter' | 'anthropic';

function pickProvider(): Provider | null {
  const forced = Deno.env.get('AI_PROVIDER') as Provider | undefined;
  if (forced && keyFor(forced)) return forced;
  if (Deno.env.get('GROQ_API_KEY')) return 'groq';
  if (Deno.env.get('OPENROUTER_API_KEY')) return 'openrouter';
  if (Deno.env.get('ANTHROPIC_API_KEY')) return 'anthropic';
  return null;
}

function keyFor(p: Provider): string | undefined {
  return Deno.env.get(
    p === 'groq' ? 'GROQ_API_KEY' : p === 'openrouter' ? 'OPENROUTER_API_KEY' : 'ANTHROPIC_API_KEY',
  );
}

const PROVIDER = pickProvider();
const DEFAULT_MODELS: Record<Provider, string[]> = {
  groq: ['openai/gpt-oss-120b'],
  // Free models come and go on OpenRouter, so name backups; it tries them in order.
  openrouter: [
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3.5-super-vl:free',
  ],
  anthropic: ['claude-opus-5-5'],
};
const MODELS = PROVIDER
  ? Deno.env.get('AI_MODEL')
    ? [Deno.env.get('AI_MODEL')!]
    : DEFAULT_MODELS[PROVIDER]
  : [];

// Last model failure on this instance, shown by `status` so owners can see why
// answers fell back to the rules (rate limit, bad output…). Never holds keys.
let lastError: string | null = null;

const anthropic =
  PROVIDER === 'anthropic'
    ? new Anthropic({ apiKey: keyFor('anthropic'), maxRetries: 1, timeout: 45_000 })
    : null;

// Stable instructions first so repeated calls reuse the prompt cache.
const SYSTEM = `You assist the staff of an Indian banquet and resort venue. Guests write in English, Hindi or Hinglish, often informally over WhatsApp or as call notes.
Be accurate: never invent facts. Leave a field null when the text doesn't say it.
Dates: when a day and month are written ("14 Feb", "12/03", "8 Dec") give the next such date after today as YYYY-MM-DD. Vague times like "next month" or "after Diwali" stay null and go in the notes.
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

const ListSchema = z.object({
  customers: z
    .array(
      z.object({
        full_name: z.string().nullable(),
        phone: z.string().nullable().describe('Digits exactly as written'),
        event_type: z.string().nullable().describe('Short English label, e.g. Wedding'),
        event_date: z.string().nullable().describe('YYYY-MM-DD'),
        guest_count: z.number().int().nullable(),
        budget_max: z.number().nullable().describe('Rupees'),
        notes: z.string().nullable().describe('Anything else written about this customer'),
      }),
    )
    .max(100),
});

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

// ------------------------------------------------------------------ model calls

/** "data:image/jpeg;base64,..." -> media type and base64 data. */
function splitDataUrl(url: string) {
  const m = url.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  return m
    ? { mediaType: m[1] as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: m[2]! }
    : null;
}

/** Claude: structured outputs, with the server-side refusal fallback. */
async function askClaude<T extends z.ZodType>(
  schema: T,
  prompt: string,
  effort: 'low' | 'medium',
  image?: string,
): Promise<z.infer<T> | null> {
  const img = image ? splitDataUrl(image) : null;
  const res = await anthropic!.beta.messages.parse({
    model: MODELS[0]!,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    max_tokens: 8000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [
      {
        role: 'user',
        content: img
          ? [
              {
                type: 'image',
                source: { type: 'base64', media_type: img.mediaType, data: img.data },
              },
              { type: 'text', text: prompt },
            ]
          : prompt,
      },
    ],
    output_config: { effort, format: zodOutputFormat(schema) },
  });
  if (res.stop_reason === 'refusal') {
    console.warn('ai refusal', res.stop_details?.category);
    return null;
  }
  return (res.parsed_output as z.infer<T> | null) ?? null;
}

/**
 * Groq and OpenRouter speak the OpenAI chat format. We ask for a JSON object,
 * describe the shape with a JSON Schema, then validate with Zod ourselves:
 * free models don't all honour schemas strictly.
 */
async function askOpenAiCompatible<T extends z.ZodType>(
  schema: T,
  prompt: string,
  image?: string,
): Promise<z.infer<T> | null> {
  const url =
    PROVIDER === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';
  const body: Record<string, unknown> = {
    messages: [
      {
        role: 'system',
        content: `${SYSTEM}\n\nReply with only a JSON object matching this JSON Schema:\n${JSON.stringify(z.toJSONSchema(schema))}`,
      },
      {
        role: 'user',
        content: image
          ? [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: image } },
            ]
          : prompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: image ? 6000 : 4000,
  };
  if (PROVIDER === 'openrouter') {
    // Free models are often busy, so OpenRouter tries the list in order. Some
    // backups "think" first and can spend the whole budget on it: turn that off.
    body.reasoning = { enabled: false };
    if (MODELS.length > 1) body.models = MODELS;
    else body.model = MODELS[0];
  } else body.model = MODELS[0];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${keyFor(PROVIDER!)}`,
      'Content-Type': 'application/json',
      // OpenRouter shows these on its dashboard; harmless for Groq.
      'HTTP-Referer': 'https://sudha-vatika.netlify.app',
      'X-Title': 'Banquet Manager',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(image ? 90_000 : 40_000),
  });
  if (!res.ok) {
    lastError = `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
    console.error('ai http', lastError);
    return null;
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  // Some models wrap JSON in prose or code fences; take the outermost object.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    lastError = `no JSON in reply: ${text.slice(0, 200)}`;
    return null;
  }
  const parsed = schema.safeParse(JSON.parse(text.slice(start, end + 1)));
  if (!parsed.success) {
    lastError = `reply did not match schema: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`;
    console.warn('ai', lastError);
    return null;
  }
  return parsed.data;
}

/** One structured answer, or null so the caller falls back to rules. */
async function ask<T extends z.ZodType>(
  schema: T,
  prompt: string,
  effort: 'low' | 'medium',
  image?: string,
): Promise<z.infer<T> | null> {
  if (!PROVIDER) return null;
  try {
    return PROVIDER === 'anthropic'
      ? await askClaude(schema, prompt, effort, image)
      : await askOpenAiCompatible(schema, prompt, image);
  } catch (e) {
    lastError = e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : String(e);
    if (e instanceof Anthropic.APIError) console.error('ai api error', e.status, e.message);
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

/**
 * Free models sometimes leave out a field that is plainly written. The rules
 * read explicit dates, guest counts and budgets reliably, so they fill gaps.
 */
function fillGaps<T extends object>(llm: T, rules: Partial<T>, keys: (keyof T)[]): T {
  const out = { ...llm };
  for (const k of keys) if (out[k] == null && rules[k] != null) out[k] = rules[k] as T[keyof T];
  return out;
}

const digits = (p: string | null) => (p ?? '').replace(/\D/g, '').slice(-10);

async function extract(c: Caller, text: string) {
  const today = todayIST();
  const spaces = await loadSpaces(c);
  const names = spaces.map((s) => s.name);
  const llm = await ask(
    ExtractionSchema,
    `Today is ${today}. Venue spaces: ${names.join(', ')}.\n\nExtract the enquiry details from this message:\n"""\n${text}\n"""`,
    'low',
  );
  const rules = extractEnquiryByRules(text, today, names);
  const extraction: EnquiryExtraction = llm
    ? fillGaps(
        {
          ...llm,
          preferred_space: names.includes(llm.preferred_space ?? '') ? llm.preferred_space : null,
        },
        rules,
        ['event_date', 'guest_count', 'budget_min', 'budget_max', 'preferred_space', 'event_type'],
      )
    : rules;
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

/** A typed or photographed list of customers -> one entry per customer. */
async function extractList(text: string | null, image: string | null) {
  const today = todayIST();
  const prompt = `Today is ${today}. Venue staff wrote this list of customers (typed or handwritten, English or Hindi).
Return one entry per customer. Copy each phone number's digits exactly as written. Use null for anything not written.${text ? `\n\n"""\n${text}\n"""` : ''}`;
  const llm = await ask(ListSchema, prompt, 'medium', image ?? undefined);
  const rules = text ? extractListByRules(text, today) : [];
  if (llm) {
    const byPhone = new Map(rules.map((r) => [digits(r.phone), r]));
    const customers = (llm.customers as ListedCustomer[]).map((c) => {
      const r = byPhone.get(digits(c.phone));
      return r ? fillGaps(c, r, ['event_date', 'guest_count', 'budget_max', 'event_type']) : c;
    });
    return { customers, source: 'llm' as AiSource };
  }
  if (!text) return null; // a photo can only be read by an AI model
  return { customers: rules, source: 'rules' as AiSource };
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
    action: z.literal('extract_list'),
    text: z.string().max(20000).nullish(),
    image: z
      .string()
      .max(8_000_000)
      .regex(/^data:image\/(jpeg|png|webp|gif);base64,/)
      .nullish(),
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
      return json({
        llm: !!PROVIDER,
        provider: PROVIDER,
        model: MODELS[0] ?? null,
        last_error: caller.role === 'owner' ? lastError : undefined,
      });
    case 'extract':
      return json(await extract(caller, b.text));
    case 'extract_list': {
      if (!b.text?.trim() && !b.image) return fail('bad_request', 400);
      const r = await extractList(b.text?.trim() || null, b.image ?? null);
      return r ? json(r) : fail('needs_ai', 409);
    }
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
