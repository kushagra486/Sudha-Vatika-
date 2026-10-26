import { describe, expect, it } from 'vitest';
import { formatPhone, isE164, toE164 } from './phone.ts';

describe('toE164', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['098765-43210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['0091 98765 43210', '+919876543210'],
    ['+1 415 555 0100', '+14155550100'],
  ])('normalizes %s', (input, expected) => {
    expect(toE164(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '12345', '+0123456789', '+1234567890123456'])(
    'rejects %j',
    (input) => {
      expect(toE164(input)).toBeNull();
    },
  );

  it('always returns a value matching the DB check constraint', () => {
    const out = toE164('98765 43210');
    expect(out && isE164(out)).toBe(true);
  });
});

describe('formatPhone', () => {
  it('groups Indian numbers', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
  });
  it('leaves other numbers alone', () => {
    expect(formatPhone('+14155550100')).toBe('+14155550100');
  });
});
