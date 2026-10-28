import type { adminClient } from './http.ts';

type Admin = ReturnType<typeof adminClient>;
const OPEN_STAGES = ['new', 'contacted', 'follow_up', 'proposal_sent'];

/** Finds the guest by phone or creates one. Never overwrites a stored name. */
export async function findOrCreateGuest(
  admin: Admin,
  orgId: string,
  phone: string,
  name: string | null,
) {
  await admin
    .from('guests')
    .upsert(
      { org_id: orgId, phone_e164: phone, full_name: name },
      { onConflict: 'org_id,phone_e164', ignoreDuplicates: true },
    );
  const { data } = await admin
    .from('guests')
    .select('id, full_name')
    .eq('org_id', orgId)
    .eq('phone_e164', phone)
    .single();
  if (data && !data.full_name && name)
    await admin.from('guests').update({ full_name: name }).eq('id', data.id);
  return data?.id as string | undefined;
}

/** The guest's newest open enquiry, or a new one from this source due now. */
export async function openLeadFor(
  admin: Admin,
  orgId: string,
  guestId: string,
  source: 'whatsapp' | 'call',
) {
  const { data: open } = await admin
    .from('leads')
    .select('id')
    .eq('guest_id', guestId)
    .in('stage', OPEN_STAGES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open) return open.id as string;
  const { data: outlet } = await admin
    .from('outlets')
    .select('id')
    .eq('org_id', orgId)
    .limit(1)
    .maybeSingle();
  const { data: lead } = await admin
    .from('leads')
    .insert({
      org_id: orgId,
      outlet_id: outlet?.id ?? null,
      guest_id: guestId,
      source,
      next_follow_up_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  return (lead?.id as string | undefined) ?? null;
}

/** Records an inbound event once. False when it was already handled. */
export async function firstDelivery(
  admin: Admin,
  provider: string,
  externalId: string,
  payload: unknown,
) {
  const { error } = await admin
    .from('inbound_events')
    .insert({ provider, external_id: externalId, payload });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}
