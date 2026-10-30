// AI assistant for the venue team. Every action is scoped to the caller's
// organization through their own JWT (RLS applies to every read):
//   chat          the dashboard assistant: questions about bookings, enquiries,
//                 follow-ups, money, rooms and prices
//   extract       WhatsApp / call text -> enquiry fields
//   extract_list  typed list or photo of a written page -> customers
//   draft_reply   a ready-to-send WhatsApp reply for a lead
//   upsell        services and packages worth offering a lead
//   analyze       photos / PDFs / documents / screenshots -> enquiries, prices,
//                 payments or bill lines for staff to confirm
//
// Every provider with a key is tried in turn until one answers (AI_PROVIDER
// goes first, otherwise this order):
//   OPENROUTER_API_KEY  OpenRouter (free models)    free Gemma, with backups
//   GROQ_API_KEY        Groq (free tier)            llama-3.3-70b-versatile
//   ANTHROPIC_API_KEY   Claude                       claude-opus-5-5
// AI_MODEL overrides the first provider's model. If no key is set, or every
// provider fails, the same actions run on built-in rules so the buttons
// always do something useful.
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
import {
  answerByRules,
  describeDraft,
  detectAddEnquiry,
  type AssistantSnapshot,
  type EnquiryDraft,
} from '../../../packages/shared/src/assistant.ts';
import {
  analyzeTextByRules,
  type DocumentAnalysis,
} from '../../../packages/shared/src/documents.ts';
import { formatEventDate, todayIST } from '../../../packages/shared/src/dates.ts';
import { formatINR } from '../../../packages/shared/src/money.ts';
import { corsHeaders, fail, getCaller, json, type Caller } from '../_shared/http.ts';

type Provider = 'groq' | 'openrouter' | 'anthropic';

const KEY_NAME: Record<Provider, string> = {
  groq: 'GROQ_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};
const keyFor = (p: Provider) => Deno.env.get(KEY_NAME[p]);

/** Providers that have a key, in the order they are tried. */
const PROVIDERS: Provider[] = (() => {
  const order: Provider[] = ['openrouter', 'groq', 'anthropic'];
  const forced = Deno.env.get('AI_PROVIDER') as Provider | undefined;
  if (forced && order.includes(forced))
    (order.splice(order.indexOf(forced), 1), order.unshift(forced));
  return order.filter((p) => !!keyFor(p));
})();

const DEFAULT_MODELS: Record<Provider, string[]> = {
  // Free models come and go on OpenRouter, so name backups; it tries them in order.
  openrouter: [
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'nvidia/nemotron-3.5-super-vl:free',
  ],
  // Preferred Groq models, best first. Groq retires models, so the list is
  // checked against the models this key can use (see groqModels).
  groq: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'],
  anthropic: ['claude-opus-5-5'],
};
const GROQ_VISION = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
];

let groqAvailable: Promise<string[] | null> | null = null;

/** Model ids this Groq key can use, fetched once per instance (null if unknown). */
function groqAvailableModels(): Promise<string[] | null> {
  groqAvailable ??= fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${keyFor('groq')}` },
    signal: AbortSignal.timeout(8_000),
  })
    .then(async (r) => (r.ok ? ((await r.json()).data as { id: string }[]).map((m) => m.id) : null))
    .catch(() => null);
  return groqAvailable;
}

/** Preferred Groq models that exist for this key; any chat or vision model if none do. */
async function groqModels(vision: boolean): Promise<string[]> {
  const preferred = vision ? GROQ_VISION : modelsFor('groq');
  const have = await groqAvailableModels();
  if (!have) return preferred;
  const ok = preferred.filter((m) => have.includes(m));
  if (ok.length) return ok;
  const guess = have.filter((m) =>
    vision
      ? /scout|maverick|vision/i.test(m)
      : /gpt-oss|llama|qwen|kimi/i.test(m) && !/guard|whisper|tts|vision/i.test(m),
  );
  return guess.slice(0, 2);
}

function modelsFor(p: Provider): string[] {
  const override = Deno.env.get('AI_MODEL');
  return override && p === PROVIDERS[0] ? [override] : DEFAULT_MODELS[p];
}

// Last model failure on this instance, shown by `status` so owners can see why
// answers fell back to a backup or the rules. Never holds keys.
let lastError: string | null = null;
const note = (p: Provider, msg: string) => {
  lastError = `${p}: ${msg}`.slice(0, 400);
  console.warn('ai', lastError);
};

const anthropic = keyFor('anthropic')
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

const DraftSchema = z.object({
  full_name: z.string().nullable(),
  phone: z.string().nullable().describe('Digits exactly as written'),
  event_type: z.string().nullable().describe('Short English label, e.g. Wedding'),
  event_date: z.string().nullable().describe('YYYY-MM-DD'),
  guest_count: z.number().int().nullable(),
  budget_max: z.number().nullable().describe('Rupees'),
  notes: z.string().nullable(),
});

const AnswerSchema = z.object({
  answer: z.string().describe('The reply shown to the staff member. Plain text, short lines.'),
  add_enquiry: DraftSchema.nullable().describe(
    'Only when the staff member asks to add / create / note a NEW enquiry: its details. Otherwise null.',
  ),
});

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

const AnalyzeSchema = z.object({
  kind: z
    .enum(['enquiries', 'price_list', 'payment', 'invoice', 'event_details', 'other'])
    .describe(
      'enquiries = list of leads / phone numbers / event requests; price_list = menu or rate card; payment = receipt or UPI/bank screenshot; invoice = bill or quotation with lines for one event; event_details = one guest describing their event',
    ),
  summary: z.string().describe('One or two short lines for the staff: what this is'),
  booking_id: z
    .string()
    .nullable()
    .describe('id copied exactly from the bookings list when the document is about one of them'),
  enquiries: ListSchema.shape.customers.describe(
    'People to add as enquiries (also for event_details: the one guest)',
  ),
  services: z
    .array(
      z.object({
        name: z.string(),
        price: z.number().describe('Rupees'),
        pricing_unit: z.enum(['fixed', 'per_guest', 'per_day']).describe('per plate = per_guest'),
        group: z.string().nullable().describe('Section heading, e.g. Catering, Decor'),
      }),
    )
    .max(150),
  payment: z
    .object({
      amount: z.number().describe('Rupees received'),
      method: z.enum(['cash', 'upi', 'card', 'bank', 'other']),
      reference: z.string().nullable().describe('UTR / transaction id / cheque no.'),
      date: z.string().nullable().describe('YYYY-MM-DD'),
      payer: z.string().nullable(),
    })
    .nullable(),
  line_items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().int().min(1),
        unit_price: z.number().describe('Rupees per unit'),
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

interface AskOptions {
  effort: 'low' | 'medium';
  /** data:image/...;base64 URLs: photos, screenshots, scanned PDF pages. */
  images?: string[];
  /** Per-provider time limit; the whole chain can take a multiple of it. */
  timeoutMs?: number;
  maxTokens?: number;
}

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
  o: AskOptions,
): Promise<z.infer<T> | null> {
  const imgs = (o.images ?? []).map(splitDataUrl).filter((x) => !!x);
  const res = await anthropic!.beta.messages.parse(
    {
      model: modelsFor('anthropic')[0]!,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      max_tokens: 8000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: imgs.length
            ? [
                ...imgs.map((img) => ({
                  type: 'image' as const,
                  source: { type: 'base64' as const, media_type: img.mediaType, data: img.data },
                })),
                { type: 'text' as const, text: prompt },
              ]
            : prompt,
        },
      ],
      output_config: { effort: o.effort, format: zodOutputFormat(schema) },
    },
    { timeout: o.timeoutMs ?? 45_000 },
  );
  if (res.stop_reason === 'refusal') {
    note('anthropic', `refusal ${res.stop_details?.category ?? ''}`);
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
  provider: 'groq' | 'openrouter',
  model: string | string[],
  schema: T,
  prompt: string,
  o: AskOptions,
): Promise<z.infer<T> | null> {
  const url =
    provider === 'groq'
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
        content: o.images?.length
          ? [
              { type: 'text', text: prompt },
              ...o.images.map((url) => ({ type: 'image_url', image_url: { url } })),
            ]
          : prompt,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: o.maxTokens ?? (o.images?.length ? 6000 : 4000),
  };
  if (Array.isArray(model)) body.models = model;
  else body.model = model;
  // Some OpenRouter backups "think" first and can spend the whole budget on it.
  if (provider === 'openrouter') body.reasoning = { enabled: false };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${keyFor(provider)}`,
      'Content-Type': 'application/json',
      // OpenRouter shows these on its dashboard; harmless for Groq.
      'HTTP-Referer': 'https://sudha-vatika.netlify.app',
      'X-Title': 'Banquet Manager',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(o.timeoutMs ?? (o.images?.length ? 90_000 : 40_000)),
  });
  if (!res.ok) {
    note(provider, `HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return null;
  }
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  // Some models wrap JSON in prose or code fences; take the outermost object.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    note(provider, `no JSON in reply: ${text.slice(0, 200)}`);
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    note(provider, `bad JSON in reply: ${text.slice(0, 200)}`);
    return null;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    note(
      provider,
      `reply did not match schema: ${JSON.stringify(parsed.error.issues.slice(0, 3))}`,
    );
    return null;
  }
  return parsed.data;
}

async function tryProvider<T extends z.ZodType>(
  p: Provider,
  schema: T,
  prompt: string,
  o: AskOptions,
): Promise<z.infer<T> | null> {
  if (p === 'anthropic') return askClaude(schema, prompt, o);
  if (p === 'openrouter') {
    const models = modelsFor(p);
    return askOpenAiCompatible(p, models.length > 1 ? models : models[0]!, schema, prompt, o);
  }
  // Groq takes one model per call: images need its vision model, otherwise
  // fall through the list (a busy or retired model returns an error).
  for (const m of await groqModels(!!o.images?.length)) {
    const r = await askOpenAiCompatible(p, m, schema, prompt, o);
    if (r) return r;
  }
  return null;
}

/**
 * One structured answer from the first provider that gives one, or null so
 * the caller falls back to rules. `via` names the provider that answered.
 */
async function ask<T extends z.ZodType>(
  schema: T,
  prompt: string,
  o: AskOptions,
): Promise<{ data: z.infer<T>; via: Provider } | null> {
  for (const p of PROVIDERS) {
    try {
      const data = await tryProvider(p, schema, prompt, o);
      if (data) return { data, via: p };
    } catch (e) {
      note(p, e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      if (e instanceof Anthropic.APIError) console.error('ai api error', e.status, e.message);
    }
  }
  return null;
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
    { effort: 'low' },
  ).then((r) => r?.data ?? null);
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
    { effort: 'medium' },
  ).then((r) => r?.data ?? null);
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
    { effort: 'low' },
  ).then((r) => r?.data ?? null);
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
  const llm = (
    await ask(ListSchema, prompt, { effort: 'medium', images: image ? [image] : undefined })
  )?.data;
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

/**
 * Photos, scanned or text PDFs, documents and screenshots -> what to add.
 * The caller's upcoming bookings are listed so a receipt or bill can be
 * matched to its event. Returns null when only an AI model could read it.
 */
async function analyze(
  c: Caller,
  message: string | null,
  text: string | null,
  images: string[],
): Promise<(DocumentAnalysis & { source: AiSource }) | null> {
  const today = todayIST();
  const { data: snap } = await c.client.rpc('assistant_snapshot');
  const s = snap as AssistantSnapshot | null;
  const bookings = (s?.bookings ?? [])
    .filter((b) => b.id && b.date >= today)
    .slice(0, 80)
    .map((b) => ({
      id: b.id,
      date: b.date,
      guest: b.guest,
      phone: b.phone,
      event: b.event,
      space: b.space,
    }));
  const prompt = `Today is ${today}. Venue staff shared ${images.length ? `${images.length} image(s)` : 'a document'}${message ? ` with this note: "${message}"` : ''}.
Work out what it is and pull out everything useful for the venue's records. Copy phone digits, amounts and names exactly as written; use null or empty lists for anything not present. Never invent details.
Upcoming bookings (match booking_id only when the guest name, phone or date clearly matches):
${JSON.stringify(bookings)}
${text ? `\nDocument text:\n"""\n${text.slice(0, 30_000)}\n"""` : ''}`;
  const llm = (
    await ask(AnalyzeSchema, prompt, {
      effort: 'medium',
      images: images.length ? images : undefined,
      maxTokens: 8000,
      timeoutMs: 60_000,
    })
  )?.data;
  const rules = text ? analyzeTextByRules(`${message ?? ''}\n${text}`, today) : null;
  if (!llm) return rules ? { ...rules, source: 'rules' } : null;

  // Keep only a booking we actually listed; fill gaps the rules can read.
  const ids = new Set(bookings.map((b) => b.id));
  const byPhone = new Map((rules?.enquiries ?? []).map((r) => [digits(r.phone), r]));
  return {
    ...llm,
    booking_id: llm.booking_id && ids.has(llm.booking_id) ? llm.booking_id : null,
    enquiries: (llm.enquiries as ListedCustomer[]).map((e) => {
      const r = byPhone.get(digits(e.phone));
      return r ? fillGaps(e, r, ['event_date', 'guest_count', 'budget_max', 'event_type']) : e;
    }),
    source: 'llm',
  };
}

// ------------------------------------------------------------------ chat

const ChatMessage = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

/** The snapshot as compact JSON, trimmed so free models' small limits fit. */
function snapshotForPrompt(s: AssistantSnapshot, budget = 24_000) {
  const copy: AssistantSnapshot = { ...s };
  let text = JSON.stringify(copy);
  // Drop the furthest bookings and the oldest enquiries first.
  for (let n = s.bookings.length; text.length > budget && n > 20;) {
    n = Math.floor(n * 0.75);
    copy.bookings = s.bookings.slice(0, n);
    copy.open_enquiries = s.open_enquiries.slice(0, Math.max(20, Math.floor(n / 2)));
    text = JSON.stringify(copy);
  }
  return text;
}

async function chat(c: Caller, messages: z.infer<typeof ChatMessage>[]) {
  const { data, error } = await c.client.rpc('assistant_snapshot');
  if (error || !data) {
    console.error('assistant_snapshot', error);
    return null;
  }
  const snap = data as AssistantSnapshot;
  const question = messages[messages.length - 1]!.content;
  const draft = detectAddEnquiry(question, snap.today);
  const rules = draft ? describeDraft(draft) : answerByRules(question, snap);
  const weekday = new Date(`${snap.today}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'long',
    timeZone: 'UTC',
  });
  const history = messages
    .slice(-9, -1)
    .map((m) => `${m.role === 'user' ? 'Staff' : 'Assistant'}: ${m.content}`)
    .join('\n');
  const llm = await ask(
    AnswerSchema,
    `You are the venue's dashboard assistant. Answer the staff member's question using ONLY the venue data below.
Today is ${weekday}, ${snap.today} (India). "Kal" means tomorrow when asking ahead. Shifts: full_day blocks a space all day; other shifts (breakfast, lunch, high_tea, dinner) can share a day.
A space is free on a date if no booking for it is listed that day. Bookings listed run from a week ago to about six months ahead; say so if asked outside that range.
${snap.can_see_money ? '' : 'This user may not see money figures: never state amounts.\n'}Reply in the language and style of the question (Hinglish if they wrote Hinglish). Be brief and concrete: names, dates, spaces, amounts in ₹ with Indian commas. Use short lines or "• " bullets, no markdown headings or tables. If the data doesn't answer it, say so and suggest which page to check.
If they ask you to add a new enquiry, fill add_enquiry (null for anything not given) and in answer say in one line what will be added and to check it and tap Add. You cannot change any data yourself; staff confirm every change.

Venue data (JSON):
${snapshotForPrompt(snap)}

Built-in calculation for this question (correct for the data, use it if relevant):
${rules}
${history ? `\nConversation so far:\n${history}\n` : ''}
Question: ${question}`,
    { effort: 'low', timeoutMs: 25_000, maxTokens: 1500 },
  );
  // The rules read explicit dates, numbers and phones reliably: they fill gaps
  // in the model's draft, and stand in when the model missed the request.
  let action: EnquiryDraft | null = llm?.data.add_enquiry ?? null;
  if (action && draft)
    action = fillGaps(action, draft, [
      'full_name',
      'phone',
      'event_type',
      'event_date',
      'guest_count',
      'budget_max',
    ]);
  action = action ?? draft;
  if (action && !action.notes) action = { ...action, notes: question };
  return {
    answer: (llm && (llm.data.add_enquiry || !draft) ? llm.data.answer.trim() : '') || rules,
    source: (llm ? 'llm' : 'rules') as AiSource,
    via: llm?.via ?? null,
    as_of: snap.generated_at,
    action: action ? { type: 'add_enquiry' as const, draft: action } : null,
  };
}

// ------------------------------------------------------------------ handler

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }),
  z.object({ action: z.literal('chat'), messages: z.array(ChatMessage).min(1).max(20) }),
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
    action: z.literal('analyze'),
    message: z.string().max(2000).nullish(),
    text: z.string().max(60_000).nullish(),
    images: z
      .array(
        z
          .string()
          .max(6_000_000)
          .regex(/^data:image\/(jpeg|png|webp|gif);base64,/),
      )
      .max(4)
      .default([]),
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

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail('bad_request', 400);
  const b = parsed.data;
  // Viewers may ask questions (they see what RLS lets them) but not write.
  if (caller.role === 'viewer' && b.action !== 'chat' && b.action !== 'status')
    return fail('not_allowed', 403);

  switch (b.action) {
    case 'status':
      return json({
        llm: PROVIDERS.length > 0,
        provider: PROVIDERS[0] ?? null,
        providers: PROVIDERS,
        model: PROVIDERS[0] ? modelsFor(PROVIDERS[0])[0] : null,
        last_error: caller.role === 'owner' ? lastError : undefined,
        groq_models:
          caller.role === 'owner' && keyFor('groq')
            ? { using: await groqModels(false), vision: await groqModels(true) }
            : undefined,
      });
    case 'chat': {
      if (b.messages[b.messages.length - 1]!.role !== 'user') return fail('bad_request', 400);
      const r = await chat(caller, b.messages);
      return r ? json(r) : fail('no_data', 500);
    }
    case 'extract':
      return json(await extract(caller, b.text));
    case 'extract_list': {
      if (!b.text?.trim() && !b.image) return fail('bad_request', 400);
      const r = await extractList(b.text?.trim() || null, b.image ?? null);
      return r ? json(r) : fail('needs_ai', 409);
    }
    case 'analyze': {
      if (!b.text?.trim() && !b.images.length) return fail('bad_request', 400);
      const r = await analyze(caller, b.message?.trim() || null, b.text?.trim() || null, b.images);
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
