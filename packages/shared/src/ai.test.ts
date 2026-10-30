import { describe, expect, it } from 'vitest';
import {
  draftReplyByRules,
  extractListByRules,
  extractEnquiryByRules,
  findBudget,
  findDate,
  findGuestCount,
  spacesThatFit,
  upsellByRules,
} from './ai.ts';

const TODAY = '2026-10-28';

describe('findDate', () => {
  it('reads day-month words and rolls past months into next year', () => {
    expect(findDate('shaadi on 12th Dec', TODAY)).toBe('2026-12-12');
    expect(findDate('event 5 Jan', TODAY)).toBe('2027-01-05');
    expect(findDate('December 3 please', TODAY)).toBe('2026-12-03');
  });
  it('reads Indian numeric dates (day first)', () => {
    expect(findDate('date 14/02/2027', TODAY)).toBe('2027-02-14');
    expect(findDate('14-2-27 ko', TODAY)).toBe('2027-02-14');
  });
  it('returns null without a date', () => {
    expect(findDate('hello, rates?', TODAY)).toBeNull();
  });
});

describe('findGuestCount and findBudget', () => {
  it('reads guest counts in English and Hindi', () => {
    expect(findGuestCount('approx 300 guests')).toBe(300);
    expect(findGuestCount('500 log aayenge')).toBe(500);
    expect(findGuestCount('no number')).toBeNull();
  });
  it('reads lakh, k and ranges', () => {
    expect(findBudget('budget 2 lakh')).toEqual({ min: null, max: 200000 });
    expect(findBudget('1.5-2 lakh tak')).toEqual({ min: 150000, max: 200000 });
    expect(findBudget('around 80k')).toEqual({ min: null, max: 80000 });
    expect(findBudget('₹75,000')).toEqual({ min: null, max: 75000 });
  });
});

describe('extractEnquiryByRules', () => {
  it('pulls the common fields from a Hinglish WhatsApp message', () => {
    const x = extractEnquiryByRules(
      'Hi, my name is Rahul Verma. Shaadi hai 12 Dec ko, 400 log, lawn chahiye. Budget 3 lakh. Decor aur DJ bhi.',
      TODAY,
      ['Lawn', 'Ashoka Hall', 'Pandaal'],
    );
    expect(x).toMatchObject({
      full_name: 'Rahul Verma',
      event_type: 'Wedding',
      event_date: '2026-12-12',
      guest_count: 400,
      budget_max: 300000,
      preferred_space: 'Lawn',
    });
    expect(x.services).toEqual(expect.arrayContaining(['decor', 'dj']));
    expect(x.summary).toContain('400 guests');
  });
});

describe('spacesThatFit', () => {
  it('keeps spaces big enough, closest fit first', () => {
    const s = [
      { name: 'Pandaal', floating_capacity: 1500 },
      { name: 'Lawn', floating_capacity: 300 },
      { name: 'Restaurant', floating_capacity: 50 },
    ];
    expect(spacesThatFit(s, 250).map((x) => x.name)).toEqual(['Lawn', 'Pandaal']);
  });
});

describe('draftReplyByRules and upsellByRules', () => {
  it('drafts a polite reply with availability and advance', () => {
    const r = draftReplyByRules({
      guestName: 'Riya',
      venue: 'Sudha Vatika',
      eventType: 'Wedding',
      eventDate: '12 Dec',
      guestCount: 300,
      freeSpaces: ['Lawn'],
      minAdvance: '₹21,000',
    });
    expect(r).toContain('Namaste Riya ji');
    expect(r).toContain('Lawn is available');
    expect(r).toContain('₹21,000');
  });

  it('suggests matching services and fitting packages, skipping ones already added', () => {
    const ideas = upsellByRules(
      'Wedding',
      [
        { kind: 'service', id: 'd', name: 'Stage decor' },
        { kind: 'service', id: 'dj', name: 'DJ' },
        { kind: 'service', id: 'r', name: 'Hotel room' },
        { kind: 'package', id: 'p', name: 'Gold', guest_min: 200, guest_max: 400 },
        { kind: 'package', id: 'p2', name: 'Small', guest_min: 10, guest_max: 50 },
      ],
      300,
      new Set(['dj']),
    );
    expect(ideas.map((i) => i.id)).toEqual(['d', 'r', 'p']);
  });
});

describe('extractListByRules', () => {
  it('reads one customer per line', () => {
    const list = extractListByRules(
      `1. Rahul Verma 98765 43210 shaadi 12 Dec 400 log
2) Neha - +91 70071-22334 - engagement 5 Jan, 150 guests, budget 2 lakh
random line without number
Amit 09935100221`,
      '2026-10-30',
    );
    expect(list).toHaveLength(3);
    expect(list[0]).toMatchObject({
      full_name: 'Rahul Verma',
      phone: '9876543210',
      event_type: 'Wedding',
      event_date: '2026-12-12',
      guest_count: 400,
    });
    expect(list[1]).toMatchObject({
      full_name: 'Neha',
      phone: '+917007122334',
      event_type: 'Engagement',
      event_date: '2027-01-05',
      guest_count: 150,
      budget_max: 200000,
    });
    expect(list[2]).toMatchObject({ full_name: 'Amit', phone: '09935100221', notes: null });
  });

  it('treats blank-line separated blocks as one customer each', () => {
    const list = extractListByRules(
      'Priya Sharma\n98111 22233\nbirthday 20 Nov\n\nKaran\n9822233344',
      '2026-10-30',
    );
    expect(list.map((c) => c.full_name)).toEqual(['Priya Sharma', 'Karan']);
    expect(list[0]!.event_type).toBe('Birthday');
  });
});
