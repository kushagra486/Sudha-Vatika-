import { describe, expect, it } from 'vitest';
import { netPaid, requiredAdvance, type Payment } from './api';
import { bookingErrorMessage } from './errors';

const pay = (amount: number, kind: Payment['kind'] = 'part'): Payment => ({
  id: String(amount),
  booking_id: 'b',
  amount,
  kind,
  method: 'upi',
  reference: null,
  received_at: '2026-10-27T10:00:00Z',
});

describe('booking money', () => {
  it('subtracts refunds from what was paid', () => {
    expect(netPaid([pay(21000, 'advance'), pay(10000), pay(5000, 'refund')])).toBe(26000);
  });

  it('needs ₹21,000, or the full total for small bookings', () => {
    expect(requiredAdvance(500000, 21000)).toBe(21000);
    expect(requiredAdvance(15000, 21000)).toBe(15000);
    expect(requiredAdvance(0, 21000)).toBe(21000);
  });
});

describe('bookingErrorMessage', () => {
  it('explains clashes, missing advance and permissions', () => {
    expect(bookingErrorMessage({ code: '23P01' })).toMatch(/already booked/);
    expect(bookingErrorMessage({ code: 'P0001', hint: 'advance_required' })).toMatch(/advance/);
    expect(bookingErrorMessage({ code: '42501' })).toMatch(/not allowed/);
  });

  it('never shows raw database text', () => {
    expect(bookingErrorMessage({ code: 'XX000', message: 'internal error' })).toMatch(
      /Could not save/,
    );
  });
});
