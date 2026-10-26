import { describe, expect, it } from 'vitest';
import {
  addDays,
  followUpState,
  formatEventDate,
  fromISTInputValue,
  istAt,
  todayIST,
  toISTInputValue,
} from './dates.ts';

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

describe('IST input helpers', () => {
  it('round-trips a datetime-local value through IST', () => {
    const iso = fromISTInputValue('2026-10-27T11:00');
    expect(iso).toBe('2026-10-27T11:00:00+05:30');
    expect(toISTInputValue(iso)).toBe('2026-10-27T11:00');
  });

  it('shows UTC timestamps in IST', () => {
    expect(toISTInputValue('2026-10-27T20:00:00Z')).toBe('2026-10-28T01:30');
  });

  it('builds quick follow-up times', () => {
    const now = new Date('2026-10-26T20:00:00Z'); // already 27 Oct in IST
    expect(istAt(1, 11, now)).toBe('2026-10-28T11:00:00+05:30');
  });
});

describe('followUpState', () => {
  const now = new Date('2026-10-27T06:00:00Z'); // 11:30 IST on 27 Oct
  it.each([
    [null, 'none'],
    ['2026-10-26T12:00:00+05:30', 'overdue'],
    ['2026-10-27T09:00:00+05:30', 'today'],
    ['2026-10-27T23:00:00+05:30', 'today'],
    ['2026-10-28T00:10:00+05:30', 'upcoming'],
  ])('%s → %s', (value, expected) => {
    expect(followUpState(value, now)).toBe(expected);
  });
});
