import { describe, expect, it } from 'vitest';
import { sanitizeSearch } from './api';

describe('sanitizeSearch', () => {
  it('removes PostgREST filter syntax', () => {
    expect(sanitizeSearch('riya,phone_e164.eq.x')).toBe('riya phone_e164.eq.x');
    expect(sanitizeSearch('(a)*%\\:b')).toBe('a b');
  });

  it('keeps ordinary names and numbers', () => {
    expect(sanitizeSearch('  Riya Sharma ')).toBe('Riya Sharma');
    expect(sanitizeSearch('98765')).toBe('98765');
  });
});
