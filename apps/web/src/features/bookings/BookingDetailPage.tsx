import {
  computeTax,
  formatDateTime,
  formatEventDate,
  formatINR,
  formatPhone,
  fromISTInputValue,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  SHIFTS,
  todayIST,
  toISTInputValue,
  type PaymentKind,
  type PaymentMethod,
  type Shift,
} from '@bm/shared';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/app/auth';
import { canRecordPayments, canSeeMoney, canWriteBookings } from '@/app/roles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Select } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { BookingStaysCard } from '@/features/inventory/BookingStaysCard';
import { ContactButtons } from '@/features/leads/LeadBits';
import { useEventSpaces } from '@/features/leads/api';
import { t } from '@/i18n';
import {
  netPaid,
  requiredAdvance,
  useBooking,
  useBookingPayments,
  useOrgSettings,
  useRecordPayment,
  useUpdateBooking,
  type BookingRow,
  type Payment,
} from './api';
import { BookingStatusBadge } from './BookingBits';
import { bookingErrorMessage } from './errors';
import { ItemsCard } from './ItemsCard';
import { useBookingItems } from './items';

const D = t.bookings.detail;

export function BookingDetailPage() {
  const { id = '' } = useParams();
  const booking = useBooking(id);

  if (booking.isPending) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (booking.isError) {
    return (
      <div className="flex items-center gap-3 text-sm text-destructive">
        {t.common.loadError}
        <Button variant="outline" size="sm" onClick={() => booking.refetch()}>
          {t.common.retry}
        </Button>
      </div>
    );
  }
  if (!booking.data) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <p className="text-sm">{D.notFound}</p>
      </div>
    );
  }
  return <BookingDetail booking={booking.data} />;
}

function BackLink() {
  return (
    <Link
      to="/bookings"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {D.back}
    </Link>
  );
}

function BookingDetail({ booking: b }: { booking: BookingRow }) {
  const { profile } = useAuth();
  const role = profile?.role;
  const seesMoney = !!role && canSeeMoney(role);
  const payments = useBookingPayments(b.id, seesMoney);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold sm:text-2xl">
              {formatEventDate(b.event_date)} · {t.shifts[b.shift]}
            </h1>
            <BookingStatusBadge status={b.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {b.unit.name}
            {b.event_type ? ` · ${b.event_type}` : ''}
            {b.guest_count ? ` · ${t.leads.guests(b.guest_count)}` : ''}
          </p>
          <p className="text-sm">
            {b.guest.full_name ?? t.leads.unnamed} · {formatPhone(b.guest.phone_e164)}
            {b.lead_id && (
              <>
                {' · '}
                <Link
                  className="font-medium text-primary hover:underline"
                  to={`/leads/${b.lead_id}`}
                >
                  {D.lead}
                </Link>
              </>
            )}
          </p>
        </div>
        <ContactButtons
          phone={b.guest.phone_e164}
          whatsappAllowed={b.guest.whatsapp_opt_in}
          size="sm"
        />
      </div>

      {role && canWriteBookings(role) && (
        <StatusActions booking={b} payments={payments.data} seesMoney={seesMoney} />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {seesMoney && <MoneyCard booking={b} payments={payments.data ?? []} />}
        {seesMoney && (
          <PaymentsCard
            booking={b}
            payments={payments.data ?? []}
            canRecord={!!role && canRecordPayments(role)}
          />
        )}
        {seesMoney && (
          <ItemsCard
            booking={b}
            canWrite={!!role && canWriteBookings(role) && b.status !== 'cancelled'}
          />
        )}
        {role && canWriteBookings(role) && b.status !== 'cancelled' && <EditCard booking={b} />}
        <BookingStaysCard
          booking={b}
          canWrite={!!role && canWriteBookings(role) && b.status !== 'cancelled'}
          money={seesMoney}
        />
      </div>
    </div>
  );
}

function StatusActions({
  booking: b,
  payments,
  seesMoney,
}: {
  booking: BookingRow;
  payments: Payment[] | undefined;
  seesMoney: boolean;
}) {
  const update = useUpdateBooking(b.id);
  const org = useOrgSettings();
  const [askCancel, setAskCancel] = useState(false);

  const needed = requiredAdvance(Number(b.total), org.data?.min_advance ?? 0);
  const paid = payments ? netPaid(payments) : 0;
  // Sales cannot see payments; let them try and let the database decide.
  const advanceIn = !seesMoney || paid >= needed;
  const eventPassed = b.event_date <= todayIST();

  return (
    <Card className="flex flex-col gap-3 p-4">
      {b.status === 'tentative' && seesMoney && (
        <p className="text-sm">
          {advanceIn ? D.advanceDone : D.advance(formatINR(paid), formatINR(needed))}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {b.status === 'tentative' && (
          <Button
            disabled={!advanceIn || update.isPending}
            onClick={() => update.mutate({ status: 'confirmed' })}
          >
            {D.confirm}
          </Button>
        )}
        {b.status === 'confirmed' && eventPassed && (
          <Button
            variant="secondary"
            disabled={update.isPending}
            onClick={() => update.mutate({ status: 'completed' })}
          >
            {D.complete}
          </Button>
        )}
        {(b.status === 'tentative' || b.status === 'confirmed') && !askCancel && (
          <Button variant="outline" onClick={() => setAskCancel(true)}>
            {D.cancel}
          </Button>
        )}
      </div>
      {askCancel && (
        <div className="flex flex-col gap-2 rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">
          <p>{D.cancelAsk}</p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({ status: 'cancelled' }, { onSuccess: () => setAskCancel(false) })
              }
            >
              {D.cancelYes}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAskCancel(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      )}
      {update.isError && (
        <p className="text-sm text-destructive" role="alert">
          {bookingErrorMessage(update.error)}
        </p>
      )}
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'text-base font-semibold tabular-nums' : 'tabular-nums'}>
        {value}
      </span>
    </div>
  );
}

function MoneyCard({ booking: b, payments }: { booking: BookingRow; payments: Payment[] }) {
  const paid = netPaid(payments);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{D.money}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <div className="pb-2">
          <Row label={D.price} value={formatINR(b.subtotal)} />
          {Number(b.discount) > 0 && (
            <Row label={D.discount} value={`− ${formatINR(b.discount)}`} />
          )}
          {Number(b.tax) > 0 && <Row label={D.gst} value={formatINR(b.tax)} />}
          <Row label={D.total} value={formatINR(b.total)} strong />
        </div>
        <div className="pt-2">
          <Row label={D.paid} value={formatINR(paid)} />
          <Row label={D.balance} value={formatINR(Number(b.total) - paid)} strong />
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentsCard({
  booking: b,
  payments,
  canRecord,
}: {
  booking: BookingRow;
  payments: Payment[];
  canRecord: boolean;
}) {
  const record = useRecordPayment();
  const blank = {
    amount: '',
    kind: (payments.length === 0 ? 'advance' : 'part') as PaymentKind,
    method: 'upi' as PaymentMethod,
    reference: '',
    received: toISTInputValue(new Date()),
  };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError(t.bookings.form.wholeRupees);
      return;
    }
    setError(null);
    record.mutate(
      {
        booking_id: b.id,
        amount,
        kind: form.kind,
        method: form.method,
        reference: form.reference.trim() || null,
        received_at: fromISTInputValue(form.received),
      },
      { onSuccess: () => setForm({ ...blank, kind: 'part' }) },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{D.payments}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{D.noPayments}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {payments.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span>
                  {t.paymentKinds[p.kind]} · {t.paymentMethods[p.method]}
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(p.received_at)}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </span>
                </span>
                <span className="font-semibold tabular-nums">
                  {p.kind === 'refund' ? '− ' : ''}
                  {formatINR(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {canRecord && b.status !== 'cancelled' && (
          <form onSubmit={submit} className="flex flex-col gap-3 border-t pt-4">
            <p className="text-sm font-medium">{D.record}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={D.amount} htmlFor="p-amount">
                <Input
                  id="p-amount"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={set('amount')}
                />
              </Field>
              <Field label={D.kind} htmlFor="p-kind">
                <Select id="p-kind" value={form.kind} onChange={set('kind')}>
                  {PAYMENT_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {t.paymentKinds[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={D.method} htmlFor="p-method">
                <Select id="p-method" value={form.method} onChange={set('method')}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {t.paymentMethods[m]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={D.receivedAt} htmlFor="p-received">
                <Input
                  id="p-received"
                  type="datetime-local"
                  value={form.received}
                  onChange={set('received')}
                />
              </Field>
            </div>
            <Field label={D.reference} htmlFor="p-ref">
              <Input id="p-ref" value={form.reference} onChange={set('reference')} />
            </Field>
            {(error || record.isError) && (
              <p className="text-sm text-destructive" role="alert">
                {error ?? bookingErrorMessage(record.error)}
              </p>
            )}
            <Button
              type="submit"
              disabled={record.isPending || !form.amount}
              className="self-start"
            >
              {record.isPending ? t.common.saving : D.record}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

interface EditForm {
  unit_id: string;
  event_date: string;
  shift: Shift;
  event_type: string;
  guest_count: string;
  subtotal: string;
  discount: string;
  gst: boolean;
}

function toForm(b: BookingRow): EditForm {
  return {
    unit_id: b.unit_id,
    event_date: b.event_date,
    shift: b.shift,
    event_type: b.event_type ?? '',
    guest_count: b.guest_count?.toString() ?? '',
    subtotal: String(Number(b.subtotal)),
    discount: String(Number(b.discount)),
    gst: Number(b.tax) > 0,
  };
}

function EditCard({ booking: b }: { booking: BookingRow }) {
  const update = useUpdateBooking(b.id);
  const spaces = useEventSpaces();
  const org = useOrgSettings();
  const items = useBookingItems(b.id);
  const itemised = (items.data?.length ?? 0) > 0;
  const [form, setForm] = useState<EditForm>(() => toForm(b));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setForm(toForm(b)), [b]);

  const set = (k: keyof EditForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(b));
  const rate = org.data?.tax_percent ?? 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const subtotal = Number(form.subtotal || 0);
    const discount = Number(form.discount || 0);
    const guests = form.guest_count ? Number(form.guest_count) : null;
    if (
      ![subtotal, discount].every((n) => Number.isFinite(n) && n >= 0) ||
      (guests !== null && !(guests >= 0))
    ) {
      setError(t.bookings.form.wholeRupees);
      return;
    }
    if (discount > subtotal) {
      setError(t.bookings.form.discountTooBig);
      return;
    }
    setError(null);
    // Keep the stored GST if the price didn't change, so a rate change in
    // settings never silently rewrites an old booking.
    const priceChanged = subtotal !== Number(b.subtotal) || discount !== Number(b.discount);
    const tax = !form.gst
      ? 0
      : priceChanged || Number(b.tax) === 0
        ? computeTax(subtotal - discount, rate)
        : Number(b.tax);
    update.mutate({
      unit_id: form.unit_id,
      event_date: form.event_date,
      shift: form.shift,
      event_type: form.event_type.trim() || null,
      guest_count: guests,
      subtotal,
      discount,
      tax,
    });
  };

  const F = t.bookings.form;
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">{D.edit}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={F.space} htmlFor="e-space">
              <Select id="e-space" value={form.unit_id} onChange={set('unit_id')}>
                {spaces.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={F.date} htmlFor="e-date">
              <Input id="e-date" type="date" value={form.event_date} onChange={set('event_date')} />
            </Field>
            <Field label={F.shift} htmlFor="e-shift">
              <Select id="e-shift" value={form.shift} onChange={set('shift')}>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {t.shifts[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={F.guests} htmlFor="e-guests">
              <Input
                id="e-guests"
                inputMode="numeric"
                value={form.guest_count}
                onChange={set('guest_count')}
              />
            </Field>
            <Field label={F.eventType} htmlFor="e-type">
              <Input id="e-type" value={form.event_type} onChange={set('event_type')} />
            </Field>
            <Field
              label={F.subtotal}
              htmlFor="e-subtotal"
              hint={itemised ? t.quote.itemised : undefined}
            >
              <Input
                id="e-subtotal"
                inputMode="decimal"
                value={form.subtotal}
                disabled={itemised}
                onChange={set('subtotal')}
              />
            </Field>
            <Field label={F.discount} htmlFor="e-discount">
              <Input
                id="e-discount"
                inputMode="decimal"
                value={form.discount}
                onChange={set('discount')}
              />
            </Field>
            <label className="flex min-h-11 items-center gap-3 self-end text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[hsl(var(--primary))]"
                checked={form.gst}
                onChange={(e) => setForm((f) => ({ ...f, gst: e.target.checked }))}
              />
              {F.gst(rate)}
            </label>
          </div>
          {(error || update.isError) && (
            <p className="text-sm text-destructive" role="alert">
              {error ?? bookingErrorMessage(update.error)}
            </p>
          )}
          <Button type="submit" disabled={!dirty || update.isPending} className="self-start">
            {update.isPending ? t.common.saving : t.common.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
