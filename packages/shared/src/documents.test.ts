import { describe, expect, it } from 'vitest';
import { analyzeTextByRules, priceListByRules } from './documents.ts';

describe('documents by rules', () => {
  it('reads a rate card', () => {
    const s = priceListByRules(
      'Veg plate - 650 per plate\nDJ: Rs 15,000\nStage decor ₹25000\nRoom 2,500/day\nThank you',
    );
    expect(s).toEqual([
      { name: 'Veg plate', price: 650, pricing_unit: 'per_guest', group: null },
      { name: 'DJ', price: 15000, pricing_unit: 'fixed', group: null },
      { name: 'Stage decor', price: 25000, pricing_unit: 'fixed', group: null },
      { name: 'Room', price: 2500, pricing_unit: 'per_day', group: null },
    ]);
  });
  it('treats a list with phone numbers as enquiries', () => {
    const a = analyzeTextByRules('Sharma ji 9876500011 shaadi 14 feb 350 log', '2026-10-30');
    expect(a.kind).toBe('enquiries');
    expect(a.enquiries[0]).toMatchObject({ phone: '9876500011', guest_count: 350 });
    expect(a.services).toEqual([]);
  });
  it('says when nothing can be read', () => {
    expect(analyzeTextByRules('hello there', '2026-10-30').kind).toBe('other');
  });
});

describe('list reading fixes', () => {
  it('does not read "22 Jan" as 22 guests, and reads split phone numbers', () => {
    const a = analyzeTextByRules(
      '1. Neha Agarwal 98390 12345 - engagement 22 Jan, 150 people\n3. Pooja Singh 7007 123456 shaadi 5 March 2027 400 log',
      '2026-10-30',
    );
    expect(a.enquiries).toHaveLength(2);
    expect(a.enquiries[0]).toMatchObject({ guest_count: 150, event_date: '2027-01-22' });
    expect(a.enquiries[1]).toMatchObject({ phone: '7007123456', guest_count: 400 });
  });
});
