import { istAt, toE164, type EnquiryDraft } from '@bm/shared';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/auth';
import { canAddLeads } from '@/app/roles';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useCreateEnquiry, useGuestByPhone } from '@/features/leads/api';
import { t } from '@/i18n';
import { requireSupabase } from '@/lib/supabase';

const A = t.assistant.action;

/**
 * The enquiry the assistant read from a request. Nothing is saved until staff
 * check the details and tap Add: the assistant never changes data on its own.
 */
export function AddEnquiryCard({ draft, onDone }: { draft: EnquiryDraft; onDone?: () => void }) {
  const { profile } = useAuth();
  const create = useCreateEnquiry();
  const setBudget = useMutation({
    mutationFn: async (v: { id: string; budget: number }) => {
      const { error } = await requireSupabase()
        .from('leads')
        .update({ budget_max: v.budget })
        .eq('id', v.id);
      if (error) throw error;
    },
  });
  const [form, setForm] = useState({
    full_name: draft.full_name ?? '',
    phone: draft.phone ?? '',
    event_type: draft.event_type ?? '',
    event_date: draft.event_date ?? '',
    guest_count: draft.guest_count ? String(draft.guest_count) : '',
  });
  const [error, setError] = useState<string | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const phone = toE164(form.phone);
  const existing = useGuestByPhone(phone);

  if (!profile || !canAddLeads(profile.role))
    return <p className="mt-2 text-xs text-muted-foreground">{A.notAllowed}</p>;

  if (leadId)
    return (
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden /> {A.added}
        <Link to={`/leads/${leadId}`} onClick={onDone} className="font-medium underline">
          {A.open}
        </Link>
      </p>
    );

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!phone) return setError(t.bookings.form.invalidPhone);
    const guests = form.guest_count ? Number(form.guest_count) : null;
    if (guests !== null && !(Number.isInteger(guests) && guests > 0))
      return setError(t.bookings.form.wholeRupees);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return setError(A.offline);
    setError(null);
    create.mutate(
      {
        phone_e164: phone,
        full_name: form.full_name.trim() || null,
        source: 'manual',
        event_type: form.event_type.trim() || null,
        event_date: form.event_date || null,
        guest_count: guests,
        next_follow_up_at: istAt(1, 11),
        note: draft.notes,
      },
      {
        onSuccess: (id) => {
          if (draft.budget_max) setBudget.mutate({ id, budget: draft.budget_max });
          setLeadId(id);
        },
        onError: () => setError(t.common.saveError),
      },
    );
  };

  return (
    <form
      onSubmit={submit}
      className="mt-2 flex flex-col gap-2 rounded-md border bg-card p-3 text-foreground"
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label={A.name} htmlFor="ae-name">
          <Input id="ae-name" value={form.full_name} onChange={set('full_name')} />
        </Field>
        <Field label={A.phone} htmlFor="ae-phone">
          <Input
            id="ae-phone"
            inputMode="tel"
            value={form.phone}
            onChange={set('phone')}
            autoFocus={!form.phone}
          />
        </Field>
        <Field label={A.event} htmlFor="ae-event">
          <Input id="ae-event" value={form.event_type} onChange={set('event_type')} />
        </Field>
        <Field label={A.guests} htmlFor="ae-guests">
          <Input
            id="ae-guests"
            inputMode="numeric"
            value={form.guest_count}
            onChange={set('guest_count')}
          />
        </Field>
        <Field label={A.date} htmlFor="ae-date">
          <Input id="ae-date" type="date" value={form.event_date} onChange={set('event_date')} />
        </Field>
      </div>
      {existing.data && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          {t.leads.quickAdd.existingGuest(
            existing.data.full_name ?? form.phone,
            existing.data.openLeadIds.length,
          )}
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{A.followUp}</p>
      <Button type="submit" size="sm" className="self-start" disabled={create.isPending}>
        <UserPlus className="h-4 w-4" /> {create.isPending ? t.common.saving : A.add}
      </Button>
    </form>
  );
}
