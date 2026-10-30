import { describe, expect, it } from 'vitest';
import { change, monthLabel } from './trends';

describe('change', () => {
  it('gives direction and whole percent', () => {
    expect(change(15, 10)).toEqual({ dir: 'up', pct: 50 });
    expect(change(5, 10)).toEqual({ dir: 'down', pct: 50 });
    expect(change(10, 10)).toEqual({ dir: 'flat', pct: 0 });
  });
  it('has no percent when last period was zero', () => {
    expect(change(4, 0)).toEqual({ dir: 'new', pct: null });
    expect(change(0, 0)).toEqual({ dir: 'flat', pct: 0 });
  });
});

describe('monthLabel', () => {
  it('shows the short month', () => {
    expect(monthLabel('2026-10-01')).toBe('Oct');
  });
});
