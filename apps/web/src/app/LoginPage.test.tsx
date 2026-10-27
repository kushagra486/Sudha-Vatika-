import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

const signInWithPassword = vi.fn();
const signInWithOtp = vi.fn();

vi.mock('@/lib/supabase', () => ({
  requireSupabase: () => ({ auth: { signInWithPassword, signInWithOtp } }),
}));
vi.mock('./auth', () => ({ useAuth: () => ({ session: null }) }));

function renderPage() {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    signInWithOtp.mockReset();
  });

  it('sends a magic link by default', async () => {
    const user = userEvent.setup();
    signInWithOtp.mockResolvedValue({ error: null });
    renderPage();

    await user.type(screen.getByLabelText('Work email'), 'owner@example.com');
    await user.click(screen.getByRole('button', { name: 'Send sign-in link' }));

    await waitFor(() => expect(signInWithOtp).toHaveBeenCalled());
    expect(signInWithOtp.mock.calls[0]![0]).toMatchObject({
      email: 'owner@example.com',
      options: { shouldCreateUser: false },
    });
    expect(screen.getByRole('status')).toHaveTextContent('Check your inbox');
  });

  it('signs in with a password', async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ error: null });
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Sign in with a password instead' }));
    await user.type(screen.getByLabelText('Work email'), 'demo@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'demo@example.com',
        password: 'secret-pass',
      }),
    );
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it('asks for a password before calling the server', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Sign in with a password instead' }));
    await user.type(screen.getByLabelText('Work email'), 'demo@example.com');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your password')).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows a plain message for a wrong password', async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials', status: 400 },
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Sign in with a password instead' }));
    await user.type(screen.getByLabelText('Work email'), 'demo@example.com');
    await user.type(screen.getByLabelText('Password'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password.');
  });
});
