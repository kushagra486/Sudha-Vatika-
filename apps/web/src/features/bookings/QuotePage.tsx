import { formatEventDate, formatINR, formatPhone, todayIST, whatsappHref } from '@bm/shared';
import { ArrowLeft, MessageCircle, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '@/app/auth';
import { canSeeMoney } from '@/app/roles';
import { Button } from '@/components/ui/button';
import { useOrgDetails } from '@/features/settings/api';
import { t } from '@/i18n';
import { netPaid, requiredAdvance, useBooking, useBookingPayments } from './api';
import { lineAmount, quoteText, useBookingItems } from './items';

const Q = t.quote;

/** Printable quotation. Browser "Save as PDF" makes the file to send. */
export function QuotePage() {
  const { id = '' } = useParams();
  const { profile } = useAuth();
  const money = !!profile && canSeeMoney(profile.role);
  const booking = useBooking(id);
  const items = useBookingItems(id);
  const org = useOrgDetails();
  const payments = useBookingPayments(id, money);

  if (booking.isPending || items.isPending || org.isPending)
    return <p className="p-6 text-sm text-muted-foreground">{t.common.loading}</p>;
  if (!booking.data || !org.data)
    return <p className="p-6 text-sm text-destructive">{t.common.loadError}</p>;

  const b = booking.data;
  const { org: o, outlet } = org.data;
  const paid = money && payments.data ? netPaid(payments.data) : null;
  const advance = requiredAdvance(Number(b.total), o.min_advance);
  const lines = items.data ?? [];
  const text = quoteText({
    venue: o.name,
    guestName: b.guest.full_name,
    eventDate: b.event_date,
    shift: b.shift,
    shiftLabel: t.shifts[b.shift],
    space: b.unit.name,
    eventType: b.event_type,
    guestCount: b.guest_count,
    items: lines,
    subtotal: Number(b.subtotal),
    discount: Number(b.discount),
    tax: Number(b.tax),
    total: Number(b.total),
    advance,
    paid,
  });

  return (
    <div className="min-h-dvh bg-muted/40 py-4 print:bg-white print:py-0">
      <div className="mx-auto mb-3 flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 print:hidden">
        <Link
          to={`/bookings/${b.id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {Q.back}
        </Link>
        <div className="flex gap-2">
          {b.guest.whatsapp_opt_in && (
            <Button asChild variant="outline" size="sm">
              <a href={whatsappHref(b.guest.phone_e164, text)} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> {Q.share}
              </a>
            </Button>
          )}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> {Q.print}
          </Button>
        </div>
      </div>

      <article className="mx-auto max-w-3xl bg-white p-6 text-sm text-neutral-900 shadow-sm sm:p-10 print:max-w-none print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-semibold">{o.name}</h1>
            {outlet?.address && <p className="text-neutral-600">{outlet.address}</p>}
            {o.gst_number && <p className="text-neutral-600">GSTIN {o.gst_number}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{Q.title}</p>
            <p className="text-neutral-600">{formatEventDate(todayIST())}</p>
            <p className="text-xs text-neutral-500">#{b.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </header>

        <section className="grid gap-4 border-b py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-neutral-500">{Q.billTo}</p>
            <p className="font-medium">{b.guest.full_name ?? t.leads.unnamed}</p>
            <p>{formatPhone(b.guest.phone_e164)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-neutral-500">{Q.event}</p>
            <p className="font-medium">{b.event_type ?? Q.eventFallback}</p>
            <p>
              {formatEventDate(b.event_date)} · {t.shifts[b.shift]} · {b.unit.name}
            </p>
            {b.guest_count && <p>{t.leads.guests(b.guest_count)}</p>}
          </div>
        </section>

        <table className="my-4 w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-neutral-500">
              <th className="py-2 font-medium">{Q.description}</th>
              <th className="py-2 text-right font-medium">{Q.qty}</th>
              <th className="py-2 text-right font-medium">{Q.rate}</th>
              <th className="py-2 text-right font-medium">{Q.amount}</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr className="border-b">
                <td className="py-2">{`${b.unit.name} · ${t.shifts[b.shift]}`}</td>
                <td className="py-2 text-right">1</td>
                <td className="py-2 text-right tabular-nums">{formatINR(b.subtotal)}</td>
                <td className="py-2 text-right tabular-nums">{formatINR(b.subtotal)}</td>
              </tr>
            ) : (
              lines.map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="py-2">
                    {i.description}
                    {i.line_discount > 0 && (
                      <span className="block text-xs text-neutral-500">
                        {Q.lineDiscount}: −{formatINR(i.line_discount)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">{i.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{formatINR(i.unit_price)}</td>
                  <td className="py-2 text-right tabular-nums">{formatINR(lineAmount(i))}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <dl className="ml-auto flex max-w-xs flex-col gap-1">
          <Total label={Q.subtotal} value={formatINR(b.subtotal)} />
          {Number(b.discount) > 0 && (
            <Total label={Q.discount} value={`−${formatINR(b.discount)}`} />
          )}
          {Number(b.tax) > 0 && <Total label={Q.gst} value={formatINR(b.tax)} />}
          <Total label={Q.total} value={formatINR(b.total)} strong />
          {paid !== null && paid > 0 && (
            <>
              <Total label={Q.received} value={formatINR(paid)} />
              <Total label={Q.balance} value={formatINR(Number(b.total) - paid)} strong />
            </>
          )}
        </dl>

        <footer className="mt-8 border-t pt-4 text-xs text-neutral-600">
          <p>{Q.terms(formatINR(advance))}</p>
          <p className="mt-1">{Q.validity}</p>
        </footer>
      </article>
    </div>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={
        strong ? 'flex justify-between border-t pt-1 font-semibold' : 'flex justify-between'
      }
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
