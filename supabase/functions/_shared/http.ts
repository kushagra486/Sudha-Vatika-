// Small helpers shared by every Edge Function: CORS, JSON replies, and the
// signed-in caller's profile (resolved with their own JWT, so RLS applies).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Error reply with a stable code the web app maps to plain language. */
export function fail(code: string, status: number, detail?: string): Response {
  return json({ error: code, detail }, status);
}

export interface Caller {
  id: string;
  org_id: string;
  outlet_id: string | null;
  role: 'owner' | 'manager' | 'sales' | 'ops' | 'viewer';
  client: SupabaseClient; // acts as the caller, RLS applies
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

/** The signed-in, active caller, or null. */
export async function getCaller(req: Request): Promise<Caller | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return null;
  const { data: profile } = await client
    .from('profiles')
    .select('id, org_id, outlet_id, role, active')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (!profile || !profile.active) return null;
  return { ...profile, client } as Caller;
}

/** Service-role client. Bypasses RLS: every use must check org_id itself. */
export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
}
