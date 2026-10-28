// Owners add staff accounts and reset their passwords. Signup is closed
// (DECISIONS D11), and creating auth users needs the service role, which must
// never reach the browser, so this runs server-side and checks the caller is
// an active owner of the same organization.
import { adminClient, corsHeaders, fail, getCaller, json } from '../_shared/http.ts';

const ROLES = ['owner', 'manager', 'sales', 'ops', 'viewer'] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body =
  | { action: 'create'; email: string; full_name: string; role: string; password: string }
  | { action: 'reset_password'; user_id: string; password: string };

function validPassword(p: unknown): p is string {
  return typeof p === 'string' && p.length >= 8 && p.length <= 72;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('method_not_allowed', 405);

  const caller = await getCaller(req);
  if (!caller) return fail('not_signed_in', 401);
  if (caller.role !== 'owner') return fail('owners_only', 403);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail('bad_request', 400);
  }

  const admin = adminClient();

  if (body.action === 'create') {
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    const fullName = String(body.full_name ?? '').trim();
    if (!EMAIL.test(email)) return fail('invalid_email', 400);
    if (!fullName) return fail('name_required', 400);
    if (!(ROLES as readonly string[]).includes(body.role)) return fail('invalid_role', 400);
    if (!validPassword(body.password)) return fail('weak_password', 400);

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !created.user) {
      const exists = /already|registered|exists/i.test(error?.message ?? '');
      return fail(exists ? 'email_taken' : 'create_failed', exists ? 409 : 500);
    }

    const { error: profileError } = await admin.from('profiles').insert({
      id: created.user.id,
      org_id: caller.org_id,
      outlet_id: caller.outlet_id,
      full_name: fullName,
      role: body.role,
    });
    if (profileError) {
      // Don't leave a login that belongs to no organization.
      await admin.auth.admin.deleteUser(created.user.id);
      return fail('create_failed', 500);
    }
    return json({ user_id: created.user.id });
  }

  if (body.action === 'reset_password') {
    if (!validPassword(body.password)) return fail('weak_password', 400);
    // The target must be in the caller's organization.
    const { data: target } = await admin
      .from('profiles')
      .select('id, org_id')
      .eq('id', body.user_id)
      .maybeSingle();
    if (!target || target.org_id !== caller.org_id) return fail('not_found', 404);
    const { error } = await admin.auth.admin.updateUserById(target.id, { password: body.password });
    if (error) return fail('update_failed', 500);
    return json({ ok: true });
  }

  return fail('unknown_action', 400);
});
