import { ROLES, type Role } from '@bm/shared';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '@/app/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Select } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { currentLang, setLang, t, type Lang } from '@/i18n';
import {
  useAddMember,
  useChangeOwnPassword,
  useOrgDetails,
  useResetMemberPassword,
  useSaveVenue,
  useTeam,
  useUpdateMember,
  type TeamMember,
} from './api';
import { teamErrorMessage } from './errors';

const S = t.settings;

export function SettingsPage() {
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold sm:text-2xl">{S.title}</h1>
      <AccountCard />
      <LanguageCard />
      {isOwner && <VenueCard />}
      {isOwner && <TeamCard />}
    </div>
  );
}

function Status({
  ok,
  error,
  children,
}: {
  ok?: boolean;
  error?: string | null;
  children?: ReactNode;
}) {
  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
        {children}
      </p>
    );
  }
  return null;
}

function AccountCard() {
  const { session } = useAuth();
  const change = useChangeOwnPassword();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setError(S.account.tooShort);
    if (pw !== pw2) return setError(S.account.mismatch);
    setError(null);
    change.mutate(pw, {
      onSuccess: () => {
        setPw('');
        setPw2('');
      },
      onError: () => setError(t.common.saveError),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{S.account.title}</CardTitle>
        {session?.user.email && (
          <CardDescription>{S.account.signedInAs(session.user.email)}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={S.account.newPassword} htmlFor="s-pw">
              <Input
                id="s-pw"
                type="password"
                autoComplete="new-password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
            </Field>
            <Field label={S.account.confirmPassword} htmlFor="s-pw2">
              <Input
                id="s-pw2"
                type="password"
                autoComplete="new-password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
              />
            </Field>
          </div>
          <Status ok={change.isSuccess} error={error}>
            {S.account.changed}
          </Status>
          <Button type="submit" className="self-start" disabled={!pw || change.isPending}>
            {change.isPending ? t.common.saving : S.account.change}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function VenueCard() {
  const details = useOrgDetails();
  const save = useSaveVenue();
  const [form, setForm] = useState({
    name: '',
    gst_number: '',
    tax_percent: '',
    min_advance: '',
    address: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!details.data) return;
    const { org, outlet } = details.data;
    setForm({
      name: org.name,
      gst_number: org.gst_number ?? '',
      tax_percent: String(org.tax_percent),
      min_advance: String(org.min_advance),
      address: outlet?.address ?? '',
    });
  }, [details.data]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!details.data) return;
    const tax = Number(form.tax_percent);
    const advance = Number(form.min_advance);
    if (!form.name.trim()) return setError(t.bookings.form.required);
    if (!(tax >= 0 && tax <= 100) || !(advance >= 0)) return setError(t.bookings.form.wholeRupees);
    setError(null);
    save.mutate(
      {
        org: {
          id: details.data.org.id,
          name: form.name.trim(),
          gst_number: form.gst_number.trim() || null,
          tax_percent: tax,
          min_advance: advance,
        },
        outlet: details.data.outlet
          ? { id: details.data.outlet.id, address: form.address.trim() || null }
          : null,
      },
      { onError: () => setError(t.common.saveError) },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{S.venue.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {details.isPending ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={S.venue.name} htmlFor="v-name">
                <Input id="v-name" value={form.name} onChange={set('name')} />
              </Field>
              <Field label={S.venue.gstNumber} htmlFor="v-gst">
                <Input
                  id="v-gst"
                  value={form.gst_number}
                  onChange={set('gst_number')}
                  autoCapitalize="characters"
                />
              </Field>
              <Field label={S.venue.taxPercent} htmlFor="v-tax" hint={S.venue.taxHint}>
                <Input
                  id="v-tax"
                  inputMode="decimal"
                  value={form.tax_percent}
                  onChange={set('tax_percent')}
                />
              </Field>
              <Field label={S.venue.minAdvance} htmlFor="v-adv">
                <Input
                  id="v-adv"
                  inputMode="decimal"
                  value={form.min_advance}
                  onChange={set('min_advance')}
                />
              </Field>
            </div>
            <Field label={S.venue.address} htmlFor="v-addr">
              <Input id="v-addr" value={form.address} onChange={set('address')} />
            </Field>
            <Status ok={save.isSuccess} error={error}>
              {S.venue.saved}
            </Status>
            <Button type="submit" className="self-start" disabled={save.isPending}>
              {save.isPending ? t.common.saving : t.common.save}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function TeamCard() {
  const { profile } = useAuth();
  const team = useTeam();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{S.team.title}</CardTitle>
        <CardDescription>{S.team.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {team.isPending ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {team.data?.map((m) => (
              <MemberRow key={m.id} member={m} isSelf={m.id === profile?.id} />
            ))}
          </ul>
        )}
        <AddMemberForm />
      </CardContent>
    </Card>
  );
}

function MemberRow({ member: m, isSelf }: { member: TeamMember; isSelf: boolean }) {
  const update = useUpdateMember();
  const reset = useResetMemberPassword();
  const [newPw, setNewPw] = useState<string | null>(null);

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{m.full_name}</span>
        {isSelf && <Badge tone="blue">{S.team.you}</Badge>}
        {!m.active && <Badge tone="red">{S.team.inactive}</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label={`${S.team.role}: ${m.full_name}`}
          className="w-auto"
          value={m.role}
          disabled={update.isPending}
          onChange={(e) => update.mutate({ id: m.id, role: e.target.value as Role })}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {t.roles[r]}
            </option>
          ))}
        </Select>
        {!isSelf && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: m.id, active: !m.active })}
            >
              {m.active ? S.team.deactivate : S.team.reactivate}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setNewPw(newPw === null ? '' : null)}>
              {S.team.resetPassword}
            </Button>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{S.team.roleHelp[m.role]}</p>
      {newPw !== null && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            reset.mutate({ user_id: m.id, password: newPw }, { onSuccess: () => setNewPw(null) });
          }}
        >
          <Field label={S.team.tempPassword} htmlFor={`rp-${m.id}`} className="min-w-48 flex-1">
            <Input
              id={`rp-${m.id}`}
              type="text"
              autoComplete="off"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
          </Field>
          <Button type="submit" size="sm" disabled={newPw.length < 8 || reset.isPending}>
            {t.common.save}
          </Button>
        </form>
      )}
      <Status
        ok={reset.isSuccess}
        error={
          update.isError
            ? teamErrorMessage(update.error)
            : reset.isError
              ? teamErrorMessage(reset.error)
              : null
        }
      >
        {S.team.resetDone}
      </Status>
    </li>
  );
}

function AddMemberForm() {
  const add = useAddMember();
  const blank = { full_name: '', email: '', role: 'sales' as Role, password: '' };
  const [form, setForm] = useState(blank);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      className="flex flex-col gap-3 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate(
          { ...form, email: form.email.trim(), full_name: form.full_name.trim() },
          { onSuccess: () => setForm(blank) },
        );
      }}
    >
      <p className="text-sm font-medium">{S.team.add}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={S.team.fullName} htmlFor="m-name">
          <Input id="m-name" value={form.full_name} onChange={set('full_name')} />
        </Field>
        <Field label={S.team.email} htmlFor="m-email">
          <Input
            id="m-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={form.email}
            onChange={set('email')}
          />
        </Field>
        <Field label={S.team.role} htmlFor="m-role" hint={S.team.roleHelp[form.role]}>
          <Select id="m-role" value={form.role} onChange={set('role')}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t.roles[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={S.team.tempPassword} htmlFor="m-pw" hint={S.team.tempHint}>
          <Input
            id="m-pw"
            type="text"
            autoComplete="off"
            value={form.password}
            onChange={set('password')}
          />
        </Field>
      </div>
      <Status ok={add.isSuccess} error={add.isError ? teamErrorMessage(add.error) : null}>
        {S.team.created}
      </Status>
      <Button
        type="submit"
        className="self-start"
        disabled={
          add.isPending || !form.full_name.trim() || !form.email.trim() || form.password.length < 8
        }
      >
        {add.isPending ? t.common.saving : S.team.create}
      </Button>
    </form>
  );
}

function LanguageCard() {
  const lang = currentLang();
  const options: [Lang, string][] = [
    ['en', 'English'],
    ['hi', 'हिन्दी'],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{S.language.title}</CardTitle>
        <CardDescription>{S.language.hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        {options.map(([code, label]) => (
          <Button
            key={code}
            variant={lang === code ? 'default' : 'outline'}
            aria-pressed={lang === code}
            lang={code}
            onClick={() => lang !== code && setLang(code)}
          >
            {label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
