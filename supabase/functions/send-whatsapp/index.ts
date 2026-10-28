// Sends a WhatsApp message from the venue's Business number and logs it.
// The log row is inserted as the caller, so RLS (may they message this lead?)
// and the opt-out trigger apply; the service role then records Meta's result.
import { adminClient, corsHeaders, fail, getCaller, json } from '../_shared/http.ts';
import { sendTemplate, sendText, whatsappConfigured } from '../_shared/whatsapp.ts';

interface Body {
  guest_id: string;
  lead_id?: string | null;
  body: string;
  template_id?: string | null;
  campaign_id?: string | null;
  params?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('method_not_allowed', 405);
  if (!whatsappConfigured()) return fail('not_configured', 501);

  const caller = await getCaller(req);
  if (!caller) return fail('not_signed_in', 401);
  if (!['owner', 'manager', 'sales'].includes(caller.role)) return fail('not_allowed', 403);

  let input: Body;
  try {
    input = await req.json();
  } catch {
    return fail('bad_request', 400);
  }
  if (!input.guest_id || !input.body?.trim()) return fail('bad_request', 400);

  // Insert as the caller: RLS decides whether they may message this lead, and
  // the opt-out trigger refuses guests who said STOP.
  const { data: msg, error: insertError } = await caller.client
    .from('messages')
    .insert({
      guest_id: input.guest_id,
      lead_id: input.lead_id ?? null,
      channel: 'whatsapp',
      direction: 'out',
      body: input.body,
      status: 'queued',
      template_id: input.template_id ?? null,
      campaign_id: input.campaign_id ?? null,
      sent_by: caller.id,
    })
    .select('id, guest:guests(phone_e164)')
    .single();
  if (insertError || !msg) {
    const optedOut = insertError?.hint === 'whatsapp_opted_out';
    return fail(optedOut ? 'opted_out' : 'not_allowed', optedOut ? 409 : 403, insertError?.message);
  }

  const phone = (msg.guest as unknown as { phone_e164: string }).phone_e164;
  let result;
  if (input.template_id) {
    const { data: tpl } = await caller.client
      .from('message_templates')
      .select('name, language, meta_status')
      .eq('id', input.template_id)
      .single();
    // Only Meta-approved templates may be sent outside the 24h window.
    result =
      tpl?.meta_status === 'approved'
        ? await sendTemplate(phone, tpl.name, tpl.language, input.params ?? [])
        : await sendText(phone, input.body);
  } else {
    result = await sendText(phone, input.body);
  }

  await adminClient()
    .from('messages')
    .update(
      result.ok
        ? { status: 'sent', provider_message_id: result.id ?? null }
        : { status: 'failed', error: result.error ?? 'unknown' },
    )
    .eq('id', msg.id);

  return result.ok ? json({ id: msg.id }) : fail('send_failed', 502, result.error);
});
