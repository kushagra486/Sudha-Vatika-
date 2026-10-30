import { describe, expect, it } from 'vitest';
import { computeTax, formatINR, toPaise } from './money.ts';

describe('money', () => {
  it('converts numeric strings from PostgREST', () => {
    expect(toPaise('125000.50')).toBe(12500050);
    expect(toPaise(null)).toBe(0);
    expect(toPaise('not a number')).toBe(0);
  });

  it('avoids float drift', () => {
    expect(toPaise(0.1) + toPaise(0.2)).toBe(30);
  });

  it('formats with Indian grouping', () => {
    expect(formatINR(125000)).toBe('₹1,25,000');
    expect(formatINR('1050000.5')).toBe('₹10,50,000.5');
  });

  it('computes GST rounded to the paisa', () => {
    expect(computeTax(100000, 18)).toBe(18000);
    expect(computeTax('999.99', '18')).toBe(180);
    expect(computeTax(1000, 0)).toBe(0);
  });
});
