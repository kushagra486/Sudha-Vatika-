import { describe, expect, it } from 'vitest';
import { answerByRules, questionDate, type AssistantSnapshot } from './assistant.ts';

const snap: AssistantSnapshot = {
  today: '2026-10-30', // a Friday
  generated_at: '2026-10-30T05:00:00Z',
  can_see_money: true,
  venue: { name: 'Sudha Vatika', min_advance: 51000, gst_percent: 18 },
  spaces: [
    { name: 'Ashoka Hall', kind: 'hall', capacity: 500, rooms: 1, opening_soon: false },
    { name: 'Rose Lawn', kind: 'lawn', capacity: 1000, rooms: 1, opening_soon: false },
    { name: 'Mini Hall', kind: 'hall', capacity: 100, rooms: 1, opening_soon: false },
    { name: 'Deluxe Rooms', kind: 'room', capacity: null, rooms: 10, opening_soon: false },
  ],
  bookings: [
    {
      date: '2026-10-31',
      shift: 'dinner',
      space: 'Ashoka Hall',
      status: 'confirmed',
      event: 'Wedding',
      guest: 'Rahul Sharma',
      phone: '+919812345678',
      guests: 400,
      total: 300000,
      paid: 100000,
      balance: 200000,
    },
    {
      date: '2027-02-14',
      shift: 'full_day',
      space: 'Rose Lawn',
      status: 'tentative',
      event: 'Reception',
      guest: 'Neha Gupta',
      phone: '+919900011122',
      guests: 800,
    },
  ],
  room_stays: [
    {
      space: 'Deluxe Rooms',
      check_in: '2026-10-30',
      check_out: '2026-11-01',
      rooms: 3,
      status: 'reserved',
      guest: 'Rahul Sharma',
    },
  ],
  open_enquiries: [
    {
      guest: 'Mr Khan',
      phone: '+919811100000',
      stage: 'follow_up',
      event: 'Birthday',
      follow_up: '2026-10-29',
      received: '2026-10-28',
    },
    {
      guest: 'Priya',
      phone: '+919822200000',
      stage: 'new',
      follow_up: '2026-11-05',
      received: '2026-10-30',
    },
  ],
  counts: {
    open_enquiries: 2,
    new_today: 1,
    new_last_7_days: 2,
    follow_ups_overdue: 1,
    follow_ups_today: 0,
    booked_this_month: 1,
  },
  money: {
    collected_this_month: 100000,
    collected_last_month: 50000,
    balance_due_upcoming: 200000,
  },
  services: [{ name: 'Veg plate', price: 650, per: 'per_plate', group: 'Catering' }],
  packages: [{ name: 'Silver', price: 250000, guests_from: 200, guests_to: 400, details: null }],
};

describe('questionDate', () => {
  it('reads relative days, Hinglish and weekdays', () => {
    expect(questionDate('kal kya hai', snap.today)).toBe('2026-10-31');
    expect(questionDate('parso free?', snap.today)).toBe('2026-11-01');
    expect(questionDate('events today', snap.today)).toBe('2026-10-30');
    expect(questionDate('free on sunday?', snap.today)).toBe('2026-11-01');
    expect(questionDate('14 feb', snap.today)).toBe('2027-02-14');
    expect(questionDate('how much money', snap.today)).toBeNull();
  });
});

describe('answerByRules', () => {
  it('answers availability with guest count', () => {
    const a = answerByRules('Is any hall free tomorrow for 300 guests?', snap);
    expect(a).toContain('Free all day: Rose Lawn');
    expect(a).not.toContain('Mini Hall'); // too small
    expect(a).toContain('Ashoka Hall (taken: dinner)');
  });
  it('lists follow-ups with overdue marker', () => {
    expect(answerByRules('whose follow ups are due?', snap)).toMatch(/Mr Khan.*overdue/);
  });
  it('gives money only to those who may see it', () => {
    expect(answerByRules('how much collected this month', snap)).toContain('₹1,00,000');
    expect(
      answerByRules('how much collected', { ...snap, can_see_money: false, money: null }),
    ).toMatch(/owners/);
  });
  it('finds a guest by phone or name', () => {
    expect(answerByRules('9812345678', snap)).toContain('Ashoka Hall');
    expect(answerByRules('Neha ki booking', snap)).toContain('Rose Lawn');
  });
  it('reports rooms tonight', () => {
    expect(answerByRules('rooms tonight?', snap)).toContain('Deluxe Rooms: 7 of 10 free');
  });
  it('lists prices and the week', () => {
    expect(answerByRules('package prices', snap)).toContain('Silver');
    expect(answerByRules('events this week', snap)).toContain('Rahul Sharma');
  });
  it('falls back to help', () => {
    expect(answerByRules('what is the meaning of life', snap)).toContain('I can answer');
  });
});

describe('Hindi questions', () => {
  it('understands Devanagari keywords', () => {
    expect(answerByRules('आज किसका फ़ॉलो-अप है?', snap)).toContain('Mr Khan');
    expect(answerByRules('इस महीने कितना पैसा आया?', snap)).toContain('₹1,00,000');
    expect(answerByRules('कल 300 लोगों के लिए कौन सा हॉल खाली है?', snap)).toContain('Rose Lawn');
    expect(answerByRules('आज रात कमरों में कौन है?', snap)).toContain('7 of 10 free');
    expect(answerByRules('आज का सारांश', snap)).toContain('Follow-ups');
  });
});

it('summary for today is a summary, not just events', () => {
  expect(answerByRules('Summary for today', snap)).toContain('Follow-ups');
});
