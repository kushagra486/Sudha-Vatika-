import { istAt, LEAD_SOURCES, fromISTInputValue, toE164, toISTInputValue } from '@bm/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import { useCreateEnquiry, useEventSpaces, useGuestByPhone } from './api';

const L = t.leads.quickAdd;

const schema = z.object({
  phone: z.string().refine((v) => toE164(v) !== null, 'Enter a valid phone number'),
  full_name: z.string().trim().max(120),
  source: z.enum(LEAD_SOURCES),
  event_type: z.string().trim().max(80),
  event_date: z.string(),
  guest_count: z.string().regex(/^\d*$/, 'Whole number only'),
  preferred_unit_id: z.string(),
  follow_up: z.string(),
  note: z.string().max(2000),
});
type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  phone: '',
  full_name: '',
  source: 'call',
  event_type: '',
  event_date: '',
  guest_count: '',
  preferred_unit_id: '',
  follow_up: '',
  note: '',
};

const blankToNull = (v: string) => (v.trim() === '' ? null : v.trim());

export function QuickAddDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const create = useCreateEnquiry();
  const spaces = useEventSpaces();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const { register, handleSubmit, formState, watch, setValue, reset } = form;

  const phoneE164 = toE164(watch('phone') ?? '');
  const existing = useGuestByPhone(phoneE164);

  const close = (next: boolean) => {
    if (!next) {
      reset(DEFAULTS);
      create.reset();
    }
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(async (v) => {
    let leadId: string;
    try {
      leadId = await create.mutateAsync({
        phone_e164: toE164(v.phone)!,
        full_name: blankToNull(v.full_name),
        source: v.source,
        event_type: blankToNull(v.event_type),
        event_date: blankToNull(v.event_date),
        guest_count: v.guest_count ? Number(v.guest_count) : null,
        preferred_unit_id: blankToNull(v.preferred_unit_id),
        next_follow_up_at: v.follow_up ? fromISTInputValue(v.follow_up) : null,
        note: blankToNull(v.note),
      });
    } catch {
      return; // shown below via create.isError
    }
    close(false);
    navigate(`/leads/${leadId}`);
  });

  const quickFollowUps: [string, string][] = [
    [t.leads.quickFollowUps.evening, istAt(0, 18)],
    [t.leads.quickFollowUps.tomorrow, istAt(1, 11)],
    [t.leads.quickFollowUps.threeDays, istAt(3, 11)],
    [t.leads.quickFollowUps.week, istAt(7, 11)],
  ];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{L.title}</DialogTitle>
          <DialogDescription>{L.subtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label={L.phone} htmlFor="qa-phone" error={formState.errors.phone?.message}>
            <Input
              id="qa-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              autoFocus
              placeholder={L.phonePlaceholder}
              {...register('phone')}
            />
          </Field>

          {existing.data && (
            <p
              className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
              role="status"
            >
              {L.existingGuest(
                existing.data.full_name ?? t.leads.unnamed,
                existing.data.openLeadIds.length,
              )}{' '}
              {existing.data.openLeadIds[0] && (
                <Link
                  className="font-medium underline"
                  to={`/leads/${existing.data.openLeadIds[0]}`}
                  onClick={() => close(false)}
                >
                  {L.viewExisting}
                </Link>
              )}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={L.name} htmlFor="qa-name">
              <Input id="qa-name" autoComplete="off" {...register('full_name')} />
            </Field>
            <Field label={L.source} htmlFor="qa-source">
              <Select id="qa-source" {...register('source')}>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {t.leadSources[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={L.eventType} htmlFor="qa-event-type">
              <Input
                id="qa-event-type"
                list="qa-event-types"
                placeholder={L.eventTypePlaceholder}
                {...register('event_type')}
              />
              <datalist id="qa-event-types">
                {t.leads.eventTypes.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </Field>
            <Field label={L.eventDate} htmlFor="qa-event-date">
              <Input id="qa-event-date" type="date" {...register('event_date')} />
            </Field>
            <Field
              label={L.guestCount}
              htmlFor="qa-guests"
              error={formState.errors.guest_count?.message}
            >
              <Input id="qa-guests" inputMode="numeric" {...register('guest_count')} />
            </Field>
            <Field label={L.space} htmlFor="qa-space">
              <Select id="qa-space" {...register('preferred_unit_id')}>
                <option value="">{L.anySpace}</option>
                {spaces.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.upcoming ? ` (${t.leads.detail.upcoming})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label={L.followUp} htmlFor="qa-follow-up">
            <div className="flex flex-wrap gap-2">
              {quickFollowUps.map(([label, iso]) => (
                <Button
                  key={label}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setValue('follow_up', toISTInputValue(iso))}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Input id="qa-follow-up" type="datetime-local" {...register('follow_up')} />
          </Field>

          <Field label={L.note} htmlFor="qa-note">
            <Textarea id="qa-note" placeholder={L.notePlaceholder} {...register('note')} />
          </Field>

          {create.isError && (
            <p className="text-sm text-destructive" role="alert">
              {t.common.saveError}
            </p>
          )}

          <Button type="submit" size="lg" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? t.common.saving : L.submit}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
