/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_FEATURE_WHATSAPP?: string;
  readonly VITE_FEATURE_AI_EXTRACTION?: string;
  readonly VITE_FEATURE_CALL_CAPTURE?: string;
  readonly VITE_FEATURE_PAYMENT_GATEWAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
