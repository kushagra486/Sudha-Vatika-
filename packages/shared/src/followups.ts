// Ready-to-send WhatsApp messages for after-booking follow-ups. Warm, short,
// Indian-English with "ji", the way the venue already writes to guests.
import { formatEventDate } from './dates.ts';
import { formatINR } from './money.ts';

const hello = (name: string | null) => (name ? `Namaste ${name} ji,` : 'Namaste,');

export function balanceReminderText(input: {
  guestName: string | null;
  venue: string;
  eventType: string | null;
  eventDate: string; // YYYY-MM-DD
  balance: number;
  upiId?: string | null;
}): string {
  return [
    hello(input.guestName),
    `Thank you for choosing ${input.venue} for your ${input.eventType ?? 'event'} on ${formatEventDate(input.eventDate)}. We are all set to make it special.`,
    `A gentle reminder: the balance of ${formatINR(input.balance)} is due before the event.`,
    input.upiId
      ? `You can pay by UPI to ${input.upiId}, or in cash / bank transfer at the venue. Please share the payment screenshot here.`
      : 'You can pay by UPI, bank transfer or cash at the venue. Please share the payment screenshot here.',
    'Thank you!',
  ].join('\n');
}

export function feedbackRequestText(input: {
  guestName: string | null;
  venue: string;
  eventType: string | null;
  reviewUrl?: string | null;
}): string {
  return [
    hello(input.guestName),
    `Thank you for celebrating your ${input.eventType ?? 'event'} with us at ${input.venue}. We hope you and your family had a wonderful time.`,
    'How was everything? We would love to hear your feedback, good or bad.',
    input.reviewUrl
      ? `If you enjoyed it, a Google review would mean a lot to us 🙏\n${input.reviewUrl}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Days from today to the event, for "in 3 days" style labels. */
export function daysUntil(eventDate: string, today: string): number {
  return Math.round(
    (Date.parse(`${eventDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
}
