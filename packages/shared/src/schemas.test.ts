import { describe, expect, it } from 'vitest';
import { bookingSchema, guestSchema, leadSchema, paymentSchema } from './schemas.ts';

const uuid = '00000000-0000-4000-8000-000000000001';

describe('schemas', () => {
  it('normalizes guest phone to E.164', () => {
    const g = guestSchema.parse({ phone_e164: '98765 43210' });
    expect(g.phone_e164).toBe('+919876543210');
  });

  it('rejects invalid phones', () => {
    expect(guestSchema.safeParse({ phone_e164: '123' }).success).toBe(false);
  });

  it('requires a lost reason for lost leads', () => {
    const base = { guest_id: uuid, source: 'call' as const, stage: 'lost' as const };
    expect(leadSchema.safeParse(base).success).toBe(false);
    expect(leadSchema.safeParse({ ...base, lost_reason: 'Budget' }).success).toBe(true);
  });

  it('rejects inverted budget ranges', () => {
    const r = leadSchema.safeParse({
      guest_id: uuid,
      source: 'web',
      budget_min: 500000,
      budget_max: 100000,
    });
    expect(r.success).toBe(false);
  });

  it('validates booking shifts and dates', () => {
    const base = { outlet_id: uuid, unit_id: uuid, guest_id: uuid, event_date: '2026-12-05' };
    expect(bookingSchema.safeParse({ ...base, shift: 'dinner' }).success).toBe(true);
    expect(bookingSchema.safeParse({ ...base, shift: 'midnight' }).success).toBe(false);
    expect(
      bookingSchema.safeParse({ ...base, shift: 'lunch', event_date: '5/12/2026' }).success,
    ).toBe(false);
  });

  it('rejects zero or negative payments', () => {
    const base = { booking_id: uuid, kind: 'advance', method: 'upi' };
    expect(paymentSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...base, amount: '25000' }).success).toBe(true);
  });
});
