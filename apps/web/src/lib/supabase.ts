import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from '@/config';

// Null when env vars are missing so the app can render a setup screen
// instead of crashing on load.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}
