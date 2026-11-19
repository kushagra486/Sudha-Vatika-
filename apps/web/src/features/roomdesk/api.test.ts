import { describe, expect, it } from 'vitest';
import { ago, summarize, toE164, type RoomReview } from './api';

const review = (rating: number, ratings: RoomReview['ratings'] = {}): RoomReview => ({
  id: String(Math.random()),
  room_number: '101',
  guest_name: 'Guest',
  rating,
  ratings,
  comment: null,
  created_at: '2026-11-19T10:00:00Z',
});

describe('summarize', () => {
  it('is empty with no reviews', () => {
    expect(summarize([])).toEqual({
      count: 0,
      overall: null,
      cleanliness: null,
      staff: null,
      comfort: null,
    });
  });

  it('averages the overall rating and only the categories that were given', () => {
    const s = summarize([
      review(5, { cleanliness: 5, staff: 4 }),
      review(4, { cleanliness: 3 }),
      review(3),
    ]);
    expect(s.count).toBe(3);
    expect(s.overall).toBe(4);
    expect(s.cleanliness).toBe(4);
    expect(s.staff).toBe(4);
    expect(s.comfort).toBeNull();
  });
});

describe('ago', () => {
  const now = new Date('2026-11-19T12:00:00Z').getTime();
  it('says how long ago for recent requests', () => {
    expect(ago('2026-11-19T11:59:40Z', now)).toBe('just now');
    expect(ago('2026-11-19T11:54:00Z', now)).toBe('6 min ago');
    expect(ago('2026-11-19T09:00:00Z', now)).toBe('3 h ago');
  });
  it('shows the date after a day', () => {
    expect(ago('2026-11-17T09:00:00Z', now)).toMatch(/Nov/);
  });
});

describe('toE164', () => {
  it('turns what people type into +91 numbers', () => {
    expect(toE164('98765 43210')).toBe('+919876543210');
    expect(toE164('+91 98765-43210')).toBe('+919876543210');
    expect(toE164('919876543210')).toBe('+919876543210');
    expect(toE164('0532 407 0818')).toBe('+915324070818');
  });
  it('refuses what it cannot read', () => {
    expect(toE164('')).toBeNull();
    expect(toE164('12345')).toBeNull();
  });
});
