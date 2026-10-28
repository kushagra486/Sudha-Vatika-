import { describe, expect, it } from 'vitest';
import { lineAmount, quoteText } from './items';

describe('lineAmount', () => {
  it('is quantity × price minus the line discount', () => {
    expect(lineAmount({ quantity: 300, unit_price: 800, line_discount: 4000 })).toBe(236000);
  });
});

describe('quoteText', () => {
  const base = {
    venue: 'Sudha Vatika',
    guestName: 'Riya',
    eventDate: '2026-12-12',
    shift: 'dinner' as const,
    shiftLabel: 'Dinner',
    space: 'Lawn',
    eventType: 'Wedding',
    guestCount: 300,
    items: [{ description: 'Veg plate', quantity: 300, unit_price: 800, line_discount: 0 }],
    subtotal: 240000,
    discount: 10000,
    tax: 41400,
    total: 271400,
    advance: 21000,
    paid: null,
  };

  it('lists items, GST, total and the advance rule', () => {
    const txt = quoteText(base);
    expect(txt).toContain('*Sudha Vatika: quotation*');
    expect(txt).toContain('Veg plate × 300');
    expect(txt).toContain('GST:');
    expect(txt).toContain('*Total: ₹2,71,400');
    expect(txt).toContain('Advance of ₹21,000');
    expect(txt).not.toContain('Balance');
  });

  it('omits GST when not charged and shows balance when paid', () => {
    const txt = quoteText({ ...base, tax: 0, total: 230000, paid: 21000 });
    expect(txt).not.toContain('GST');
    expect(txt).toContain('Balance: ₹2,09,000');
  });
});
