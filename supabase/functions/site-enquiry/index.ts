// Enquiry form on the public website (sudhavatika.netlify.app/enquiry.html).
// Public endpoint (no login): deploy with verify_jwt off. Each submission
// becomes a "web" lead in the dashboard (or a note on the guest's open one),
// due for a call back right away. Spam guards: a hidden honeypot field, a
// minimum time on the form, and per-connection / daily caps.
import { z } from 'npm:zod@4.6.7';
import { findOrCreateGuest, openLeadFor } from '../_shared/guests.ts';
import { enquiryMail, sendMail } from '../_shared/email.ts';
import { adminClient } from '../_shared/http.ts';

// Where staff open the lead from the email. Override with the DASHBOARD_URL secret.
const DASHBOARD_URL = Deno.env.get('DASHBOARD_URL') ?? 'https://sudha-vatika.netlify.app';
const ALLOWED = [
  'https://kushagra486.github.io',
  'https://sudhavatika.netlify.app',
  'http://localhost:8765',
  'http://127.0.0.1:8765',
];
const PER_HOUR = 5;
const PER_DAY = 300;

function cors(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0]!,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

const Form = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(8).max(20),
  // WhatsApp number; empty or "same" = the phone number above.
  whatsapp_same: z.boolean().optional(),
  whatsapp: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  event_type: z.string().trim().max(40),
  event_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('')),
  flexible_date: z.boolean().optional(),
  guests: z.coerce.number().int().min(1).max(5000).optional().or(z.literal('')),
  budget: z.coerce.number().min(0).max(100_000_000).optional().or(z.literal('')),
  space: z.string().trim().max(60).optional(),
  time_of_day: z.string().trim().max(30).optional(),
  rooms: z.string().trim().max(40).optional(),
  services: z.array(z.string().trim().max(30)).max(10).optional(),
  heard_from: z.string().trim().max(40).optional(),
  call_time: z.string().trim().max(40).optional(),
  site_visit: z.boolean().optional(),
  questions: z.string().trim().max(1500).optional(),
  // Spam guards
  company: z.string().max(0).optional(), // honeypot: real people never see it
  started_at: z.number(),
});

function indianPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10 && /^[6-9]/.test(d)) return `+91${d}`;
  if (d.length === 11 && d.startsWith('0')) return indianPhone(d.slice(1));
  if (d.length === 12 && d.startsWith('91')) return indianPhone(d.slice(2));
  return null;
}

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

  const parsed = Form.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return reply(
      { error: 'invalid', fields: parsed.error.issues.map((i) => i.path.join('.')) },
      400,
    );
  const f = parsed.data;
  // Bots fill the hidden field or submit instantly: pretend success, store nothing.
  if (f.company || Date.now() - f.started_at < 4000) return reply({ ok: true });
  const phone = indianPhone(f.phone);
  if (!phone) return reply({ error: 'invalid', fields: ['phone'] }, 400);

  const sameWhatsapp = f.whatsapp_same !== false || !f.whatsapp;
  const whatsapp = sameWhatsapp ? phone : indianPhone(f.whatsapp!);
  if (!whatsapp) return reply({ error: 'invalid', fields: ['whatsapp'] }, 400);

  const admin = adminClient();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const who = await hash(`${ip}|${Deno.env.get('SUPABASE_URL')}`);
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [{ count: mine }, { count: today }] = await Promise.all([
    admin
      .from('inbound_events')
      .select('id', { count: 'exact', head: true })
      .eq('provider', 'site')
      .gte('received_at', hourAgo)
      .eq('payload->>who', who),
    admin
      .from('inbound_events')
      .select('id', { count: 'exact', head: true })
      .eq('provider', 'site')
      .gte('received_at', dayAgo),
  ]);
  if ((mine ?? 0) >= PER_HOUR || (today ?? 0) >= PER_DAY) return reply({ error: 'too_many' }, 429);

  const { data: org } = await admin
    .from('organizations')
    .select('id')
    .order('created_at')
    .limit(1)
    .single();
  if (!org) return reply({ error: 'not_configured' }, 500);
  const orgId = org.id as string;

  await admin.from('inbound_events').insert({
    provider: 'site',
    external_id: crypto.randomUUID(),
    payload: { who, phone_last4: phone.slice(-4) },
  });

  const guestId = await findOrCreateGuest(admin, orgId, phone, f.name);
  if (!guestId) return reply({ error: 'save_failed' }, 500);
  if (f.email)
    await admin.from('guests').update({ email: f.email }).eq('id', guestId).is('email', null);
  // The number they want WhatsApp messages on (the dashboard's WhatsApp buttons use it).
  await admin
    .from('guests')
    .update({ whatsapp_e164: whatsapp === phone ? null : whatsapp })
    .eq('id', guestId);
  const leadId = await openLeadFor(admin, orgId, guestId, 'web');
  if (!leadId) return reply({ error: 'save_failed' }, 500);

  // Fill details the open enquiry doesn't have yet; never overwrite staff edits.
  const { data: lead } = await admin
    .from('leads')
    .select(
      'event_type, event_date, guest_count, budget_max, preferred_unit_id, interested_services',
    )
    .eq('id', leadId)
    .single();
  let unitId: string | null = null;
  if (f.space && f.space !== 'Not sure') {
    const { data: u } = await admin
      .from('units')
      .select('id')
      .eq('org_id', orgId)
      .eq('name', f.space)
      .maybeSingle();
    unitId = (u?.id as string | undefined) ?? null;
  }
  await admin
    .from('leads')
    .update({
      event_type: lead?.event_type ?? (f.event_type || null),
      event_date: lead?.event_date ?? (f.event_date || null),
      guest_count: lead?.guest_count ?? (f.guests === '' ? null : (f.guests ?? null)),
      budget_max: lead?.budget_max ?? (f.budget === '' || !f.budget ? null : f.budget),
      preferred_unit_id: lead?.preferred_unit_id ?? unitId,
      interested_services: [
        ...new Set([...(lead?.interested_services ?? []), ...(f.services ?? [])]),
      ],
      next_follow_up_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  const lines = [
    'Website enquiry',
    `Name: ${f.name}`,
    whatsapp === phone ? 'WhatsApp: same as phone' : `WhatsApp: ${whatsapp}`,
    `Event: ${f.event_type}${f.event_date ? ` on ${f.event_date}` : ''}${f.flexible_date ? ' (date flexible)' : ''}`,
    f.guests ? `Guests: about ${f.guests}` : null,
    f.budget ? `Budget in mind: Rs ${Number(f.budget).toLocaleString('en-IN')}` : null,
    f.space ? `Space: ${f.space}` : null,
    f.time_of_day ? `Time: ${f.time_of_day}` : null,
    f.rooms ? `Stay needed: ${f.rooms}` : null,
    f.services?.length ? `Interested in: ${f.services.join(', ')}` : null,
    f.site_visit ? 'Would like a site visit' : null,
    f.call_time ? `Best time to call: ${f.call_time}` : null,
    f.heard_from ? `Heard about us: ${f.heard_from}` : null,
    f.email ? `Email: ${f.email}` : null,
    f.questions ? `Questions: ${f.questions}` : null,
  ].filter(Boolean);
  await admin.from('messages').insert({
    org_id: orgId,
    guest_id: guestId,
    lead_id: leadId,
    channel: 'call_note',
    direction: 'in',
    body: lines.join('\n'),
    status: 'received',
  });

  // Tell the team by email. Best effort: the enquiry is already saved, and a
  // failure is recorded (inbound_events 'site_email') so it can be seen and fixed.
  const row = (k: string, v: string | number | null | undefined): [string, string][] =>
    v === null || v === undefined || v === '' ? [] : [[k, String(v)]];
  const mail = enquiryMail({
    name: f.name,
    phone,
    whatsapp,
    email: f.email || undefined,
    rows: [
      ...row('Event', f.event_type),
      ...row(
        'Date',
        f.event_date
          ? `${f.event_date}${f.flexible_date ? ' (flexible)' : ''}`
          : f.flexible_date
            ? 'Flexible'
            : '',
      ),
      ...row('Guests', f.guests ? `about ${f.guests}` : ''),
      ...row('Budget in mind', f.budget ? `Rs ${Number(f.budget).toLocaleString('en-IN')}` : ''),
      ...row('Space', f.space && f.space !== 'Not sure' ? f.space : ''),
      ...row('Time of day', f.time_of_day),
      ...row('Stay', f.rooms),
      ...row('Interested in', f.services?.join(', ')),
      ...row('Site visit', f.site_visit ? 'Yes, would like to visit' : ''),
      ...row('Best time to call', f.call_time),
      ...row('Heard about us', f.heard_from),
    ],
    questions: f.questions || undefined,
    leadUrl: `${DASHBOARD_URL}/leads/${leadId}`,
  });
  const failure = await sendMail(mail, f.email || undefined);
  await admin.from('inbound_events').insert({
    provider: 'site_email',
    external_id: `${leadId}:${Date.now()}`,
    payload: { to_count: 2, ok: !failure },
    error: failure,
    processed_at: new Date().toISOString(),
  });
  if (failure) console.error('enquiry email failed', failure);
  return reply({ ok: true });
});
