import { computeTax, formatINR, SHIFTS, toE164, type Shift } from '@bm/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useEventSpaces } from '@/features/leads/api';
import { t } from '@/i18n';
import { useCreateBooking, useOrgSettings, useTakenShifts } from './api';
import { bookingErrorMessage } from './errors';

const F = t.bookings.form;

export interface BookingPrefill {
  lead?: { id: string; guestName: string };
  unitId?: string;
  date?: string;
  shift?: Shift;
  eventType?: string | null;
  guestCount?: number | null;
}

const money = z.string().regex(/^\d*(\.\d{0,2})?$/, F.wholeRupees);

function buildSchema(needsGuest: boolean) {
  return z
    .object({
      phone: z.string(),
      full_name: z.string().trim().max(120),
      unit_id: z.string().min(1, F.required),
      event_date: z.string().min(1, F.required),
      shift: z.enum(SHIFTS),
      event_type: z.string().trim().max(80),
      guest_count: z.string().regex(/^\d*$/, F.wholeRupees),
      subtotal: money,
      discount: money,
      gst: z.boolean(),
    })
    .refine((v) => !needsGuest || toE164(v.phone) !== null, {
      message: F.invalidPhone,
      path: ['phone'],
    })
    .refine((v) => Number(v.discount || 0) <= Number(v.subtotal || 0), {
      message: F.discountTooBig,
      path: ['discount'],
    });
}
type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function NewBookingDialog({
  open,
  onOpenChange,
  prefill = {},
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: BookingPrefill;
}) {
  const navigate = useNavigate();
  const create = useCreateBooking();
  const spaces = useEventSpaces();
  const org = useOrgSettings();
  const needsGuest = !prefill.lead;

  const defaults: FormValues = {
    phone: '',
    full_name: '',
    unit_id: prefill.unitId ?? '',
    event_date: prefill.date ?? '',
    shift: prefill.shift ?? 'dinner',
    event_type: prefill.eventType ?? '',
    guest_count: prefill.guestCount?.toString() ?? '',
    subtotal: '',
    discount: '',
    gst: false,
  };
  const form = useForm<FormValues>({
    resolver: zodResolver(buildSchema(needsGuest)),
    values: defaults,
    resetOptions: { keepDirtyValues: false },
  });
  const { register, handleSubmit, formState, watch } = form;

  const [unitId, date, subtotal, discount, gst] = watch([
    'unit_id',
    'event_date',
    'subtotal',
    'discount',
    'gst',
  ]);
  const taken = useTakenShifts(unitId, date);
  const rate = org.data?.tax_percent ?? 0;
  const taxable = Math.max(0, Number(subtotal || 0) - Number(discount || 0));
  const tax = gst ? computeTax(taxable, rate) : 0;
  const total = taxable + tax;

  const close = (next: boolean) => {
    if (!next) create.reset();
    onOpenChange(next);
  };

  const onSubmit = handleSubmit(async (v) => {
    let id: string;
    try {
      id = await create.mutateAsync({
        unit_id: v.unit_id,
        event_date: v.event_date,
        shift: v.shift,
        lead_id: prefill.lead?.id ?? null,
        phone_e164: needsGuest ? toE164(v.phone) : null,
        full_name: needsGuest ? v.full_name.trim() || null : null,
        event_type: v.event_type.trim() || null,
        guest_count: v.guest_count ? Number(v.guest_count) : null,
        subtotal: Number(v.subtotal || 0),
        discount: Number(v.discount || 0),
        tax,
      });
    } catch {
      return; // message shown below from create.error
    }
    close(false);
    navigate(`/bookings/${id}`);
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{F.title}</DialogTitle>
          <DialogDescription>
            {prefill.lead ? F.forGuest(prefill.lead.guestName) + '. ' : ''}
            {F.subtitle}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {needsGuest && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={F.phone} htmlFor="nb-phone" error={formState.errors.phone?.message}>
                <Input
                  id="nb-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  {...register('phone')}
                />
              </Field>
              <Field label={F.name} htmlFor="nb-name">
                <Input id="nb-name" autoComplete="off" {...register('full_name')} />
              </Field>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={F.space} htmlFor="nb-space" error={formState.errors.unit_id?.message}>
              <Select id="nb-space" {...register('unit_id')}>
                <option value="">{F.pickSpace}</option>
                {spaces.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.upcoming ? ` (${t.leads.detail.upcoming})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={F.date} htmlFor="nb-date" error={formState.errors.event_date?.message}>
              <Input id="nb-date" type="date" {...register('event_date')} />
            </Field>
            <Field label={F.shift} htmlFor="nb-shift">
              <Select id="nb-shift" {...register('shift')}>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {t.shifts[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={F.guests}
              htmlFor="nb-guests"
              error={formState.errors.guest_count?.message}
            >
              <Input id="nb-guests" inputMode="numeric" {...register('guest_count')} />
            </Field>
          </div>

          {taken.data && taken.data.length > 0 && (
            <p
              className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
              role="status"
            >
              {F.takenOn(taken.data.map((b) => t.shifts[b.shift]).join(', '))}
            </p>
          )}

          <Field label={F.eventType} htmlFor="nb-event-type">
            <Input id="nb-event-type" list="nb-event-types" {...register('event_type')} />
            <datalist id="nb-event-types">
              {t.leads.eventTypes.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={F.subtotal}
              htmlFor="nb-subtotal"
              error={formState.errors.subtotal?.message}
            >
              <Input id="nb-subtotal" inputMode="decimal" {...register('subtotal')} />
            </Field>
            <Field
              label={F.discount}
              htmlFor="nb-discount"
              error={formState.errors.discount?.message}
            >
              <Input id="nb-discount" inputMode="decimal" {...register('discount')} />
            </Field>
          </div>

          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[hsl(var(--primary))]"
              {...register('gst')}
            />
            {F.gst(rate)}
          </label>

          <p className="flex items-baseline justify-between rounded-md bg-muted p-3 text-sm">
            <span>{F.total}</span>
            <span className="text-lg font-semibold tabular-nums">{formatINR(total)}</span>
          </p>

          {create.isError && (
            <p className="text-sm text-destructive" role="alert">
              {bookingErrorMessage(create.error)}
            </p>
          )}

          <Button type="submit" size="lg" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? t.common.saving : F.submit}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
