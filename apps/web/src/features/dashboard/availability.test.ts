import { describe, expect, it } from 'vitest';
import { cellFor, dateRange } from './availability';

describe('cellFor', () => {
  it('is free with nothing booked', () => {
    expect(cellFor([], false)).toEqual({ state: 'free', shifts: [] });
  });

  it('is full for a full-day booking', () => {
    expect(cellFor(['full_day'], false).state).toBe('full');
  });

  it('lists partial bookings in day order', () => {
    expect(cellFor(['dinner', 'lunch'], false)).toEqual({
      state: 'partial',
      shifts: ['lunch', 'dinner'],
    });
  });

  it('is full when every meal slot is taken separately', () => {
    expect(cellFor(['breakfast', 'lunch', 'high_tea', 'dinner'], false).state).toBe('full');
  });

  it('marks spaces that are not open yet', () => {
    expect(cellFor(['dinner'], true).state).toBe('upcoming');
  });
});

describe('dateRange', () => {
  it('crosses month ends', () => {
    expect(dateRange('2026-10-30', 4)).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
  });
});
