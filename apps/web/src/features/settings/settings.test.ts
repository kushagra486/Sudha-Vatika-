import { describe, expect, it } from 'vitest';
import { teamErrorMessage } from './errors';

describe('teamErrorMessage', () => {
  it('maps Edge Function codes', () => {
    expect(teamErrorMessage(new Error('email_taken'))).toMatch(/already has an account/);
    expect(teamErrorMessage(new Error('weak_password'))).toMatch(/at least 8/);
  });

  it('explains the last-owner rule from the database', () => {
    expect(teamErrorMessage({ message: 'x', hint: 'last_owner' })).toMatch(
      /at least one active owner/,
    );
  });

  it('falls back to a generic message', () => {
    expect(teamErrorMessage(new Error('boom'))).toMatch(/Could not save/);
  });
});
