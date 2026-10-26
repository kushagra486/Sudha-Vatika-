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

const schema = z.object({ email: z.string().trim().email(t.auth.invalidEmail) });
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { session } = useAuth();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  if (session) return <Navigate to="/dashboard" replace />;

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null);
    const { error: err } = await requireSupabase().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    });
    if (err) setError(loginErrorMessage(err));
    else setSent(true);
  });

  return (
    <FullPageMessage title={`${APP_NAME} · ${t.auth.title}`} body={t.auth.subtitle}>
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
            autoComplete="email"
            inputMode="email"
            placeholder={t.auth.emailPlaceholder}
            aria-invalid={!!form.formState.errors.email}
            {...form.register('email')}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t.auth.sending : t.auth.submit}
          </Button>
        </form>
      )}
    </FullPageMessage>
  );
}
