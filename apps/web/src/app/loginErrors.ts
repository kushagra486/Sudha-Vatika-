import { t } from '@/i18n';

/** Plain-language message for Supabase auth errors on the sign-in form. */
export function loginErrorMessage(err: { message: string; status?: number }): string {
  if (/signups? not allowed|user not found/i.test(err.message)) return t.auth.notRegistered;
  if (err.status === 429 || /rate limit|too many/i.test(err.message)) return t.auth.rateLimited;
  return t.auth.sendFailed;
}
