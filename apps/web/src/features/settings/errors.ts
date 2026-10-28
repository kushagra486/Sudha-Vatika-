import { t } from '@/i18n';

type TeamErrorKey = keyof typeof t.settings.team.errors;

/** Plain message for team-management failures (Edge Function codes or DB hints). */
export function teamErrorMessage(err: unknown): string {
  const e = (err ?? {}) as { message?: string; hint?: string | null };
  const key = (e.hint === 'last_owner' ? 'last_owner' : e.message) as TeamErrorKey | undefined;
  return (key && t.settings.team.errors[key]) || t.settings.team.errors.generic;
}
