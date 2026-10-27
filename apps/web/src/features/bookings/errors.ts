import { t } from '@/i18n';

interface DbError {
  code?: string;
  message?: string;
  hint?: string | null;
}

/** Plain-language message for errors from booking and payment writes. */
export function bookingErrorMessage(err: unknown): string {
  const e = (err ?? {}) as DbError;
  if (e.code === '23P01') return t.bookings.errors.clash;
  if (e.hint === 'advance_required') return t.bookings.errors.advance;
  if (e.code === '42501') return t.bookings.errors.notAllowed;
  if (e.code === '23514') return t.bookings.errors.invalid;
  return t.common.saveError;
}
