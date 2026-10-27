import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { z } from 'zod';
import { FullPageMessage } from '@/components/FullPageMessage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { APP_NAME } from '@/config';
import { t } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';
import { useAuth } from './auth';
import { loginErrorMessage } from './loginErrors';

type Mode = 'link' | 'password';

const schema = z.object({
  email: z.string().trim().email(t.auth.invalidEmail),
  password: z.string(),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>('link');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  if (session) return <Navigate to="/dashboard" replace />;

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError(null);
    const auth = requireSupabase().auth;

    if (mode === 'password') {
      if (!password) {
        form.setError('password', { message: t.auth.passwordRequired });
        return;
      }
      // On success the auth listener sets the session and this page redirects.
      const { error: err } = await auth.signInWithPassword({ email, password });
      if (err) setError(loginErrorMessage(err));
      return;
    }

    const { error: err } = await auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    });
    if (err) setError(loginErrorMessage(err));
    else setSent(true);
  });

  const switchMode = () => {
    setError(null);
    form.clearErrors();
    setMode((m) => (m === 'link' ? 'password' : 'link'));
  };

  const busy = form.formState.isSubmitting;

  return (
    <FullPageMessage
      title={`${APP_NAME} · ${t.auth.title}`}
      body={mode === 'link' ? t.auth.subtitle : undefined}
    >
      {sent ? (
        <p className="text-sm" role="status">
          {t.auth.sent}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <label htmlFor="email" className="text-sm font-medium">
            {t.auth.emailLabel}
          </label>
          <Input
            id="email"
            type="email"
            autoComplete={mode === 'password' ? 'username' : 'email'}
            inputMode="email"
            placeholder={t.auth.emailPlaceholder}
            aria-invalid={!!form.formState.errors.email}
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}

          {mode === 'password' && (
            <>
              <label htmlFor="password" className="text-sm font-medium">
                {t.auth.passwordLabel}
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!form.formState.errors.password}
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {mode === 'password'
              ? busy
                ? t.auth.signingIn
                : t.auth.signIn
              : busy
                ? t.auth.sending
                : t.auth.submit}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={switchMode}>
            {mode === 'link' ? t.auth.usePassword : t.auth.useLink}
          </Button>
        </form>
      )}
    </FullPageMessage>
  );
}
