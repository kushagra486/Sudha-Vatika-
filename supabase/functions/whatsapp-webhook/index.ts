// Receives WhatsApp messages and delivery receipts from Meta.
// GET  = Meta's one-time verification handshake.
// POST = events, signed with the app secret. Each message is stored once
//        (inbound_events dedupes retries); a new number becomes a guest and a
//        new WhatsApp enquiry; "STOP" opts the guest out (database trigger).
import { adminClient, json } from '../_shared/http.ts';
import { findOrCreateGuest, firstDelivery, openLeadFor } from '../_shared/guests.ts';
import { validSignature } from '../_shared/whatsapp.ts';

type Admin = ReturnType<typeof adminClient>;

interface WaMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  button?: { text: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
}
interface WaStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  errors?: { title: string }[];
}

function messageText(m: WaMessage): string | null {
  return (
    m.text?.body ??
    m.button?.text ??
    m.interactive?.button_reply?.title ??
    m.interactive?.list_reply?.title ??
    (m.type ? `[${m.type}]` : null)
  );
}

async function handleMessage(admin: Admin, orgId: string, m: WaMessage, name: string | null) {
  // Meta retries until it gets a 200, so handle each message id once.
  if (!(await firstDelivery(admin, 'whatsapp', m.id, m))) return;
  const guestId = await findOrCreateGuest(admin, orgId, `+${m.from}`, name);
  if (!guestId) return;
  const leadId = await openLeadFor(admin, orgId, guestId, 'whatsapp');
  await admin.from('messages').insert({
    org_id: orgId,
    guest_id: guestId,
    lead_id: leadId,
    channel: 'whatsapp',
    direction: 'in',
    body: messageText(m),
    provider_message_id: m.id,
    status: 'received',
  });
  await admin
    .from('inbound_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('provider', 'whatsapp')
    .eq('external_id', m.id);
}

async function handleStatus(admin: Admin, s: WaStatus) {
  await admin
    .from('messages')
    .update({ status: s.status, error: s.errors?.[0]?.title ?? null })
    .eq('provider_message_id', s.id);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const ok =
      url.searchParams.get('hub.mode') === 'subscribe' &&
      url.searchParams.get('hub.verify_token') === Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    return ok
      ? new Response(url.searchParams.get('hub.challenge') ?? '')
      : new Response('forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get('X-Hub-Signature-256')))) {
    return new Response('bad signature', { status: 401 });
  }
  const orgId = Deno.env.get('WHATSAPP_ORG_ID');
  if (!orgId) return new Response('not configured', { status: 501 });

  const admin = adminClient();
  const payload = JSON.parse(raw);
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      const names = new Map<string, string>(
        (v.contacts ?? []).map((c: { wa_id: string; profile?: { name?: string } }) => [
          c.wa_id,
          c.profile?.name ?? '',
        ]),
      );
      for (const m of (v.messages ?? []) as WaMessage[]) {
        try {
          await handleMessage(admin, orgId, m, names.get(m.from) || null);
        } catch (e) {
          console.error('whatsapp message failed', m.id, e);
        }
      }
      for (const s of (v.statuses ?? []) as WaStatus[]) await handleStatus(admin, s);
    }
  }
  return json({ ok: true });
});
