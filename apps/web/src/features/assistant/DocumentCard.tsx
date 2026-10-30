import {
  formatEventDate,
  formatINR,
  type DocumentAnalysis,
  type LineItemDraft,
  type ServiceDraft,
  type SnapshotBooking,
} from '@bm/shared';
import { CheckCircle2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/app/auth';
import { canAddLeads, canEditCatalog, canRecordPayments, canWriteBookings } from '@/app/roles';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useRecordPayment } from '@/features/bookings/api';
import { useAddPackage } from '@/features/bookings/items';
import { useAddListCustomers, type ListRow } from '@/features/calls/list';
import { useCategories, useSaveService, useServices } from '@/features/catalog/api';
import { t } from '@/i18n';

const D = t.assistant.docs;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-md border bg-card p-3 text-foreground">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Done({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden /> {children}
    </p>
  );
}

const ErrorLine = ({ error }: { error: string | null }) =>
  error ? (
    <p className="text-xs text-destructive" role="alert">
      {error}
    </p>
  ) : null;

/** Everything the assistant read from attached files, each part confirmed separately. */
export function DocumentCard({
  analysis: a,
  bookings,
}: {
  analysis: DocumentAnalysis;
  bookings: SnapshotBooking[];
}) {
  const { profile } = useAuth();
  const role = profile?.role;
  const [bookingId, setBookingId] = useState(a.booking_id ?? '');
  const needsBooking = !!a.payment || a.line_items.length > 0;
  const upcoming = bookings.filter((b) => b.id);
  const empty = !a.enquiries.length && !a.services.length && !a.payment && !a.line_items.length;

  if (empty) return <p className="mt-2 text-xs text-muted-foreground">{D.nothing}</p>;

  return (
    <div className="mt-2 flex flex-col gap-2">
      {a.enquiries.length > 0 && role && canAddLeads(role) && (
        <EnquiriesSection rows={a.enquiries} />
      )}
      {a.services.length > 0 && role && canEditCatalog(role) && (
        <ServicesSection rows={a.services} />
      )}
      {needsBooking && (
        <Section title={D.forBooking}>
          <Select
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            aria-label={D.forBooking}
          >
            <option value="">{D.pickBooking}</option>
            {upcoming.map((b) => (
              <option key={b.id} value={b.id}>
                {[formatEventDate(b.date), b.guest, b.event, b.space].filter(Boolean).join(' · ')}
              </option>
            ))}
          </Select>
          {a.booking_id && bookingId === a.booking_id && (
            <p className="text-xs text-muted-foreground">{D.matched}</p>
          )}
        </Section>
      )}
      {a.payment && role && canRecordPayments(role) && (
        <PaymentSection payment={a.payment} bookingId={bookingId} bookings={upcoming} />
      )}
      {a.line_items.length > 0 && role && canWriteBookings(role) && (
        <LinesSection rows={a.line_items} bookingId={bookingId} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------ enquiries -- */

function EnquiriesSection({ rows: initial }: { rows: DocumentAnalysis['enquiries'] }) {
  const add = useAddListCustomers();
  const [rows, setRows] = useState<ListRow[]>(initial.map((r) => ({ ...r, include: !!r.phone })));
  const [error, setError] = useState<string | null>(null);
  if (add.data)
    return (
      <Section title={D.enquiries(rows.length)}>
        <Done>{t.customerList.done(add.data)}</Done>
      </Section>
    );
  const picked = rows.filter((r) => r.include).length;
  return (
    <Section title={D.enquiries(rows.length)}>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map((r, i) => (
          <li key={i} className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={r.include}
              disabled={!r.phone}
              aria-label={r.full_name ?? r.phone ?? D.row(i + 1)}
              onChange={(e) =>
                setRows((cur) =>
                  cur.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)),
                )
              }
            />
            <span className="min-w-0">
              <span className="font-medium">{r.full_name ?? D.noName}</span>
              {' · '}
              {r.phone ?? <span className="text-destructive">{D.noPhone}</span>}
              <span className="block text-xs text-muted-foreground">
                {[
                  r.event_type,
                  r.event_date ? formatEventDate(r.event_date) : null,
                  r.guest_count ? `${r.guest_count} guests` : null,
                  r.budget_max ? formatINR(r.budget_max) : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <ErrorLine error={error} />
      <Button
        size="sm"
        className="self-start"
        disabled={!picked || add.isPending}
        onClick={() => add.mutate(rows, { onError: () => setError(t.common.saveError) })}
      >
        {add.isPending ? t.common.saving : D.addEnquiries(picked)}
      </Button>
    </Section>
  );
}

/* ------------------------------------------------------------- services -- */

function ServicesSection({ rows: initial }: { rows: ServiceDraft[] }) {
  const existing = useServices();
  const categories = useCategories();
  const save = useSaveService();
  const known = new Set((existing.data ?? []).map((s) => s.name.trim().toLowerCase()));
  const [rows, setRows] = useState(initial.map((r) => ({ ...r, include: true })));
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fresh = (r: ServiceDraft) => !known.has(r.name.trim().toLowerCase());
  const picked = rows.filter((r) => r.include && fresh(r));

  const submit = async () => {
    setError(null);
    const byName = new Map((categories.data ?? []).map((c) => [c.name.toLowerCase(), c.id]));
    try {
      for (const r of picked)
        await save.mutateAsync({
          name: r.name.trim(),
          description: null,
          base_price: r.price,
          pricing_unit: r.pricing_unit,
          category_id: (r.group && byName.get(r.group.toLowerCase())) || null,
          active: true,
        });
      setSaved(picked.length);
    } catch {
      setError(t.common.saveError);
    }
  };

  if (saved !== null)
    return (
      <Section title={D.services(rows.length)}>
        <Done>{D.servicesSaved(saved)}</Done>
      </Section>
    );
  return (
    <Section title={D.services(rows.length)}>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={r.include && fresh(r)}
              disabled={!fresh(r)}
              aria-label={r.name}
              onChange={(e) =>
                setRows((cur) =>
                  cur.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)),
                )
              }
            />
            <span className="min-w-0 flex-1">
              {r.name}
              {r.group && <span className="text-xs text-muted-foreground"> · {r.group}</span>}
              {!fresh(r) && <span className="text-xs text-muted-foreground"> · {D.known}</span>}
            </span>
            <Input
              className="h-8 w-24 text-right"
              inputMode="decimal"
              aria-label={`${r.name}: ${D.price}`}
              value={String(r.price)}
              onChange={(e) =>
                setRows((cur) =>
                  cur.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) || 0 } : x)),
                )
              }
            />
            <span className="w-16 text-xs text-muted-foreground">{D.per[r.pricing_unit]}</span>
          </li>
        ))}
      </ul>
      <ErrorLine error={error} />
      <Button size="sm" className="self-start" disabled={!picked.length} onClick={submit}>
        {D.addServices(picked.length)}
      </Button>
    </Section>
  );
}

/* -------------------------------------------------------------- payment -- */

function PaymentSection({
  payment,
  bookingId,
  bookings,
}: {
  payment: NonNullable<DocumentAnalysis['payment']>;
  bookingId: string;
  bookings: SnapshotBooking[];
}) {
  const record = useRecordPayment();
  const [amount, setAmount] = useState(String(payment.amount));
  const [method, setMethod] = useState(payment.method);
  const [reference, setReference] = useState(payment.reference ?? '');
  const [error, setError] = useState<string | null>(null);
  const booking = bookings.find((b) => b.id === bookingId);

  if (record.isSuccess)
    return (
      <Section title={D.payment}>
        <Done>{D.paymentSaved(formatINR(Number(amount)))}</Done>
      </Section>
    );

  const submit = () => {
    const n = Number(amount);
    if (!bookingId) return setError(D.pickBookingFirst);
    if (!(n > 0)) return setError(t.bookings.form.wholeRupees);
    setError(null);
    record.mutate(
      {
        booking_id: bookingId,
        amount: n,
        // The first money in is the advance; anything later is a part payment.
        kind: booking && !booking.paid ? 'advance' : 'part',
        method,
        reference: reference.trim() || null,
        received_at: payment.date ? `${payment.date}T12:00:00+05:30` : undefined,
      },
      { onError: () => setError(t.common.saveError) },
    );
  };

  return (
    <Section title={D.payment}>
      <div className="grid grid-cols-2 gap-2">
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label={D.amount}
        />
        <Select
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
          aria-label={D.method}
        >
          {(['upi', 'cash', 'bank', 'card', 'other'] as const).map((m) => (
            <option key={m} value={m}>
              {t.paymentMethods[m]}
            </option>
          ))}
        </Select>
        <Input
          className="col-span-2"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={D.reference}
          aria-label={D.reference}
        />
      </div>
      {(payment.payer || payment.date) && (
        <p className="text-xs text-muted-foreground">
          {[payment.payer, payment.date ? formatEventDate(payment.date) : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      <ErrorLine error={error} />
      <Button size="sm" className="self-start" onClick={submit} disabled={record.isPending}>
        {record.isPending ? t.common.saving : D.recordPayment}
      </Button>
    </Section>
  );
}

/* ---------------------------------------------------------------- lines -- */

function LinesSection({ rows: initial, bookingId }: { rows: LineItemDraft[]; bookingId: string }) {
  const add = useAddPackage(bookingId);
  const [rows, setRows] = useState(initial.map((r) => ({ ...r, include: true })));
  const [error, setError] = useState<string | null>(null);
  const picked = rows.filter((r) => r.include);
  const total = picked.reduce((s, r) => s + r.quantity * r.unit_price, 0);

  if (add.isSuccess)
    return (
      <Section title={D.lines(rows.length)}>
        <Done>{D.linesSaved(picked.length)}</Done>
      </Section>
    );

  const submit = () => {
    if (!bookingId) return setError(D.pickBookingFirst);
    setError(null);
    add.mutate(
      picked.map((r) => ({
        service_id: null,
        description: r.description,
        quantity: r.quantity,
        unit_price: r.unit_price,
        line_discount: 0,
      })),
      { onError: () => setError(t.common.saveError) },
    );
  };

  return (
    <Section title={D.lines(rows.length)}>
      <ul className="flex flex-col gap-1 text-sm">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={r.include}
              aria-label={r.description}
              onChange={(e) =>
                setRows((cur) =>
                  cur.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)),
                )
              }
            />
            <span className="min-w-0 flex-1">{r.description}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {r.quantity} × {formatINR(r.unit_price)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm font-medium">{D.linesTotal(formatINR(total))}</p>
      <ErrorLine error={error} />
      <Button
        size="sm"
        className="self-start"
        onClick={submit}
        disabled={!picked.length || add.isPending}
      >
        {add.isPending ? t.common.saving : D.addLines(picked.length)}
      </Button>
    </Section>
  );
}
