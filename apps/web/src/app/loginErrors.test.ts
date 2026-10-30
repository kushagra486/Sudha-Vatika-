import { describe, expect, it } from 'vitest';
import { loginErrorMessage } from './loginErrors';

describe('loginErrorMessage', () => {
  it('explains unregistered emails', () => {
    expect(loginErrorMessage({ message: 'Signups not allowed for otp', status: 422 })).toBe(
      'This email is not registered. Ask the owner to add you.',
    );
  });

  it('explains a wrong password', () => {
    expect(loginErrorMessage({ message: 'Invalid login credentials', status: 400 })).toBe(
      'Wrong email or password.',
    );
  });

  it('explains rate limits', () => {
    expect(loginErrorMessage({ message: 'email rate limit exceeded', status: 429 })).toMatch(
      /Too many/,
    );
  });

  it('never shows raw server text', () => {
    expect(loginErrorMessage({ message: 'upstream connect error', status: 502 })).toMatch(
      /Could not send/,
    );
  });
});
