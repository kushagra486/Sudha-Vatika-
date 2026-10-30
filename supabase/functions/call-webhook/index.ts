// Call capture from a cloud telephony provider (Exotel, Knowlarity, MyOperator…).
// Point the provider's "call ended" webhook at
//   https://<project>.supabase.co/functions/v1/call-webhook?org=<org id>
// with header  X-Webhook-Secret: <CALL_WEBHOOK_SECRET>.
// Fields are read from JSON or form posts under common names, so most
// providers work without code changes. Each call is stored once; a caller
// with no open enquiry gets a new "call" lead to follow up.
import { findOrCreateGuest, firstDelivery, openLeadFor } from '../_shared/guests.ts';
import { adminClient, json } from '../_shared/http.ts';

function pick(src: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = src[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

/** Indian numbers arrive as 09812345678, 9812345678 or +919812345678. */
export function normalizeIndianPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (raw.trim().startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const secret = Deno.env.get('CALL_WEBHOOK_SECRET');
  if (!secret || req.headers.get('X-Webhook-Secret') !== secret)
    return new Response('forbidden', { status: 403 });
  const orgId = new URL(req.url).searchParams.get('org');
  if (!orgId) return new Response('org required', { status: 400 });

  const type = req.headers.get('content-type') ?? '';
  const body: Record<string, unknown> = type.includes('json')
    ? await req.json()
    : Object.fromEntries((await req.formData()).entries());

  const callId = pick(body, ['call_id', 'CallSid', 'callSid', 'uuid', 'id']);
  if (!callId) return new Response('call id required', { status: 400 });
  const direction = (pick(body, ['direction', 'Direction', 'call_type']) ?? 'inbound')
    .toLowerCase()
    .includes('out')
    ? 'outbound'
    : 'inbound';
  const phone = normalizeIndianPhone(
    pick(
      body,
      direction === 'inbound'
        ? ['from', 'From', 'caller', 'CallFrom', 'customer_number']
        : ['to', 'To', 'CallTo', 'customer_number'],
    ),
  );
  const duration =
    Number(pick(body, ['duration', 'Duration', 'DialCallDuration', 'call_duration']) ?? 0) || 0;
  const startedAt =
    pick(body, ['start_time', 'StartTime', 'started_at', 'Created']) ?? new Date().toISOString();
  const recording = pick(body, ['recording_url', 'RecordingUrl', 'recording']);

  const admin = adminClient();
  if (!(await firstDelivery(admin, 'call', callId, body)))
    return json({ ok: true, duplicate: true });

  const guestId = phone ? await findOrCreateGuest(admin, orgId, phone, null) : undefined;
  // Missed or answered, an inbound caller is someone to follow up.
  const leadId =
    guestId && direction === 'inbound' ? await openLeadFor(admin, orgId, guestId, 'call') : null;

  await admin.from('call_logs').insert({
    org_id: orgId,
    provider: pick(body, ['provider']) ?? 'webhook',
    provider_call_id: callId,
    direction,
    caller_phone_e164: phone,
    guest_id: guestId ?? null,
    lead_id: leadId,
    started_at: new Date(startedAt).toISOString(),
    duration_sec: duration,
    recording_url: recording,
    raw: body,
  });
  await admin
    .from('inbound_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('external_id', callId);
  return json({ ok: true, lead_id: leadId });
});
