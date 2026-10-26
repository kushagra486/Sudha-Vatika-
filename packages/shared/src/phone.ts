// Phone numbers are stored in E.164. Indian 10-digit mobiles are the common input,
// so a bare 10-digit number is assumed to be +91.

export const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

const DEFAULT_COUNTRY_CODE = '91';

export function isE164(value: string): boolean {
  return E164_PATTERN.test(value);
}

/**
 * Normalize user-typed or provider-sent phone numbers to E.164.
 * Returns null when the input cannot be a valid number.
 *
 * Accepts: "98765 43210", "098765-43210", "+91 98765 43210", "919876543210",
 * "0091 98765 43210", "+1 415 555 0100".
 */
export function toE164(raw: string, defaultCountryCode = DEFAULT_COUNTRY_CODE): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  let candidate: string;
  if (hasPlus) {
    candidate = `+${digits}`;
  } else if (digits.startsWith('00')) {
    candidate = `+${digits.slice(2)}`;
  } else {
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    if (digits.length === 10) {
      candidate = `+${defaultCountryCode}${digits}`;
    } else if (
      digits.startsWith(defaultCountryCode) &&
      digits.length === defaultCountryCode.length + 10
    ) {
      candidate = `+${digits}`;
    } else {
      return null;
    }
  }

  return isE164(candidate) ? candidate : null;
}

/** Display format: "+91 98765 43210" for Indian numbers, raw E.164 otherwise. */
export function formatPhone(e164: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return match ? `+91 ${match[1]} ${match[2]}` : e164;
}
