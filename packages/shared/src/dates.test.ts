import { describe, expect, it } from 'vitest';
import { addDays, formatEventDate, todayIST } from './dates.ts';

describe('dates', () => {
  it('uses IST for today, not UTC', () => {
    // 20:00 UTC on 31 Dec is already 1 Jan in India.
    expect(todayIST(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
    expect(todayIST(new Date('2026-12-31T10:00:00Z'))).toBe('2026-12-31');
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('formats event dates without shifting the day', () => {
    expect(formatEventDate('2026-12-05')).toBe('5 Dec 2026');
  });
});
