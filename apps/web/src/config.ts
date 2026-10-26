// Runtime configuration. Everything here comes from VITE_* env vars so builds
// for different deployments don't need code changes.

function flag(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1';
}

const env = import.meta.env;

export const config = {
  appName: env.VITE_APP_NAME || 'Banquet Manager',
  supabaseUrl: env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY ?? '',
  features: {
    whatsappEnabled: flag(env.VITE_FEATURE_WHATSAPP),
    aiExtractionEnabled: flag(env.VITE_FEATURE_AI_EXTRACTION),
    callCaptureEnabled: flag(env.VITE_FEATURE_CALL_CAPTURE),
    paymentGatewayEnabled: flag(env.VITE_FEATURE_PAYMENT_GATEWAY),
  },
} as const;

export const APP_NAME = config.appName;

export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);

export type FeatureFlag = keyof typeof config.features;
