import { describe, expect, it } from 'vitest';
import { groupConversations, type ChatMessage } from './api';

const g = (id: string) => ({
  id,
  full_name: id,
  phone_e164: '+919800000000',
  whatsapp_opt_in: true,
});
const m = (id: string, guest: string, direction: 'in' | 'out'): ChatMessage => ({
  id,
  guest_id: guest,
  lead_id: null,
  channel: 'whatsapp',
  direction,
  body: id,
  status: 'sent',
  created_at: '',
  guest: g(guest),
});

describe('groupConversations', () => {
  it('keeps the newest message per guest and flags ones waiting on us', () => {
    const list = groupConversations([m('3', 'a', 'in'), m('2', 'b', 'out'), m('1', 'a', 'out')]);
    expect(list.map((c) => [c.guest.id, c.last.id, c.unanswered])).toEqual([
      ['a', '3', true],
      ['b', '2', false],
    ]);
  });
});
