import { describe, expect, it } from 'vitest';
import { balanceReminderText, daysUntil, feedbackRequestText } from './followups.ts';

describe('follow-up messages', () => {
  it('balance reminder names the amount, date and UPI id', () => {
    const t = balanceReminderText({
      guestName: 'Riya',
      venue: 'Sudha Vatika',
      eventType: 'Wedding',
      eventDate: '2026-12-12',
      balance: 230400,
      upiId: 'sv@okaxis',
    });
    expect(t).toContain('Namaste Riya ji');
    expect(t).toContain('₹2,30,400');
    expect(t).toContain('12 Dec 2026');
    expect(t).toContain('sv@okaxis');
  });
  it('feedback request includes the review link only when set', () => {
    const base = { guestName: null, venue: 'Sudha Vatika', eventType: 'Birthday' };
    expect(feedbackRequestText({ ...base, reviewUrl: 'https://g.page/r/x/review' })).toContain(
      'https://g.page/r/x/review',
    );
    expect(feedbackRequestText(base)).not.toContain('Google');
    expect(feedbackRequestText(base)).toMatch(/^Namaste,/);
  });
  it('counts days to the event', () => {
    expect(daysUntil('2026-11-02', '2026-10-30')).toBe(3);
    expect(daysUntil('2026-10-30', '2026-10-30')).toBe(0);
  });
});
