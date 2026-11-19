// Public endpoint behind the room guide (the QR page in each room). Guests do not sign in: they give a
// room number and a name. Deploy with verify_jwt off. Actions (POST JSON, field "action"):
//   request  a service request (reception, housekeeping, food, luggage, ...)
//   review   a stay review
//   info     WiFi, check-out time and the nearby restaurants the venue wants guests to see
//   mine     the guest's own recent requests and where they stand
// Spam guards: hidden honeypot field, minimum time on the page, per-connection and daily caps.
import { z } from 'npm:zod@4.6.7';
import { emailConfigured, roomRequestMail, sendMail } from '../_shared/email.ts';
import { adminClient } from '../_shared/http.ts';

const DASHBOARD_URL = Deno.env.get('DASHBOARD_URL') ?? 'https://sudha-vatika.vercel.app';
const ALLOWED = ['https://kushagra486.github.io', 'http://localhost:8766', 'http://127.0.0.1:8766'];
const PER_HOUR = 30;
const PER_DAY = 1500;
const KINDS = [
  'reception',
  'housekeeping',
  'food',
  'luggage',
  'maintenance',
  'transport',
  'helpdesk',
  'other',
] as const;

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0]!,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const room = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[A-Za-z0-9 \-\/]+$/);
const name = z.string().trim().min(1).max(80);
const Who = z.object({ room, name });

const Request = Who.extend({
  action: z.literal('request'),
  kind: z.enum(KINDS),
  item: z.string().trim().max(200).optional(),
  details: z.string().trim().max(500).optional(),
  company: z.string().max(0).optional(), // honeypot
  started_at: z.number(),
});
const Review = Who.extend({
  action: z.literal('review'),
  rating: z.number().int().min(1).max(5),
  ratings: z
    .object({
      cleanliness: z.number().int().min(1).max(5).optional(),
      staff: z.number().int().min(1).max(5).optional(),
      comfort: z.number().int().min(1).max(5).optional(),
    })
    .optional(),
  comment: z.string().trim().max(1000).optional(),
  company: z.string().max(0).optional(),
  started_at: z.number(),
});
const Info = Who.extend({ action: z.literal('info') });
const Mine = Who.extend({ action: z.literal('mine') });
const Body = z.discriminatedUnion('action', [Request, Review, Info, Mine]);

async function hash(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)]
    .slice(0, 12)
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return reply(
      { error: 'invalid', fields: parsed.error.issues.map((i) => i.path.join('.')) },
      400,
    );
  const f = parsed.data;
  const admin = adminClient();

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .order('created_at')
    .limit(1)
    .single();
  if (!org) return reply({ error: 'not_configured' }, 500);
  const orgId = org.id as string;
  const roomNo = f.room.replace(/\s+/g, ' ');

  if (f.action === 'info') {
    const { data } = await admin
      .from('room_guide_settings')
      .select('wifi_name, wifi_password, checkout_time, note')
      .eq('org_id', orgId)
      .maybeSingle();
    const { data: restaurants } = await admin
      .from('room_restaurants')
      .select('name, area, cuisine, diet, phone, hours, menu_url, note')
      .eq('org_id', orgId)
      .eq('active', true)
      .order('sort')
      .order('name');
    return reply({ ok: true, info: data ?? {}, restaurants: restaurants ?? [] });
  }

  if (f.action === 'mine') {
    const since = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { data } = await admin
      .from('room_requests')
      .select('id, kind, item, status, created_at, guest_name')
      .eq('org_id', orgId)
      .ilike('room_number', roomNo)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(12);
    const mine = (data ?? [])
      .filter((r) => r.guest_name.trim().toLowerCase() === f.name.trim().toLowerCase())
      .map(({ guest_name: _n, ...r }) => r);
    return reply({ ok: true, requests: mine });
  }

  // Writes: bots fill the hidden field or submit instantly. Pretend success, store nothing.
  if (f.company || Date.now() - f.started_at < 1500) return reply({ ok: true });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const who = await hash(`${ip}|${Deno.env.get('SUPABASE_URL')}`);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [{ count: mine }, { count: today }] = await Promise.all([
    admin
      .from('inbound_events')
      .select('id', { count: 'exact', head: true })
      .eq('provider', 'room')
      .gte('received_at', hourAgo)
      .eq('payload->>who', who),
    admin
      .from('inbound_events')
      .select('id', { count: 'exact', head: true })
      .eq('provider', 'room')
      .gte('received_at', dayAgo),
  ]);
  if ((mine ?? 0) >= PER_HOUR || (today ?? 0) >= PER_DAY) return reply({ error: 'too_many' }, 429);
  await admin.from('inbound_events').insert({
    provider: 'room',
    external_id: crypto.randomUUID(),
    payload: { who, action: f.action },
  });

  if (f.action === 'review') {
    const { error } = await admin.from('room_reviews').insert({
      org_id: orgId,
      room_number: roomNo,
      guest_name: f.name,
      rating: f.rating,
      ratings: f.ratings ?? {},
      comment: f.comment || null,
    });
    if (error) return reply({ error: 'save_failed' }, 500);
    return reply({ ok: true });
  }

  const { data: row, error } = await admin
    .from('room_requests')
    .insert({
      org_id: orgId,
      room_number: roomNo,
      guest_name: f.name,
      kind: f.kind,
      item: f.item || null,
      details: f.details || null,
    })
    .select('id')
    .single();
  if (error || !row) return reply({ error: 'save_failed' }, 500);

  // Tell the team by email when email is set up. Best effort: the request is already saved.
  if (emailConfigured()) {
    const failure = await sendMail(
      roomRequestMail({
        room: roomNo,
        name: f.name,
        kind: f.kind,
        item: f.item,
        details: f.details,
        url: `${DASHBOARD_URL}/room-desk`,
      }),
    );
    if (failure) console.error('room request email failed', failure);
  }
  return reply({ ok: true, id: row.id });
});
