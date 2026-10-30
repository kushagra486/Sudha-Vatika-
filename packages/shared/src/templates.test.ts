import { describe, expect, it } from 'vitest';
import { fillTemplate, placeholderCount, templateValues, toTemplateName } from './templates.ts';

describe('templates', () => {
  it('counts placeholders', () => {
    expect(placeholderCount('Hi {{1}}, your {{3}} on {{2}}')).toBe(3);
    expect(placeholderCount('No variables')).toBe(0);
  });

  it('fills placeholders in order and blanks missing ones', () => {
    expect(fillTemplate('Hi {{1}}, see you on {{ 2 }}.{{3}}', ['Riya', '12 Dec'])).toBe(
      'Hi Riya, see you on 12 Dec.',
    );
  });

  it('maps fields to values', () => {
    expect(
      templateValues(['guest_name', 'venue', 'nope'], {
        guest_name: 'Riya',
        venue: 'Sudha Vatika',
      }),
    ).toEqual(['Riya', 'Sudha Vatika', '']);
  });

  it('makes Meta-safe names', () => {
    expect(toTemplateName('Diwali Offer 2026!')).toBe('diwali_offer_2026');
  });
});
