// Meta WhatsApp Cloud API. Configured with Supabase secrets:
//   WHATSAPP_TOKEN        permanent access token
//   WHATSAPP_PHONE_ID     phone number id of the venue's WhatsApp number
//   WHATSAPP_APP_SECRET   app secret, to verify webhook signatures
//   WHATSAPP_VERIFY_TOKEN any string, entered again in Meta's webhook setup
//   WHATSAPP_ORG_ID       organization that owns this number
const GRAPH = 'https://graph.facebook.com/v21.0';

export function whatsappConfigured(): boolean {
  return !!(Deno.env.get('WHATSAPP_TOKEN') && Deno.env.get('WHATSAPP_PHONE_ID'));
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

async function post(payload: unknown): Promise<SendResult> {
  const res = await fetch(`${GRAPH}/${Deno.env.get('WHATSAPP_PHONE_ID')}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('WHATSAPP_TOKEN')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data?.error?.message ?? `HTTP ${res.status}` };
  return { ok: true, id: data?.messages?.[0]?.id };
}

/** Free-form text. Meta only delivers it within 24h of the guest's last message. */
export function sendText(toE164: string, body: string) {
  return post({
    messaging_product: 'whatsapp',
    to: toE164.replace('+', ''),
    type: 'text',
    text: { body },
  });
}

/** Approved template, any time. Params fill {{1}}, {{2}}… in order. */
export function sendTemplate(toE164: string, name: string, language: string, params: string[]) {
  return post({
    messaging_product: 'whatsapp',
    to: toE164.replace('+', ''),
    type: 'template',
    template: {
      name,
      language: { code: language },
      components: params.length
        ? [
            {
              type: 'body',
              parameters: params.map((text) => ({ type: 'text', text: text || '-' })),
            },
          ]
        : [],
    },
  });
}

/** Constant-time check of Meta's X-Hub-Signature-256 header. */
export async function validSignature(rawBody: string, header: string | null): Promise<boolean> {
  const secret = Deno.env.get('WHATSAPP_APP_SECRET');
  if (!secret || !header?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)),
  );
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
  const got = header.slice(7);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
