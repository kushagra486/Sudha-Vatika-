import { formatINR } from '@bm/shared';
import { FileText, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Select } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { serviceLineQuantity, usePackages, useServices } from '@/features/catalog/api';
import { t } from '@/i18n';
import type { BookingRow } from './api';
import { lineAmount, useAddItem, useAddPackage, useBookingItems, useRemoveItem } from './items';

const Q = t.quote;

export function ItemsCard({ booking: b, canWrite }: { booking: BookingRow; canWrite: boolean }) {
  const items = useBookingItems(b.id);
  const remove = useRemoveItem();
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{Q.items}</CardTitle>
        <Button asChild size="sm" variant="outline">
          <Link to={`/quote/${b.id}`}>
            <FileText className="h-4 w-4" /> {Q.open}
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.isPending ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : items.data?.length ? (
          <ul className="divide-y text-sm">
            {items.data.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  {i.description}
                  <span className="text-muted-foreground">
                    {' '}
                    · {i.quantity} × {formatINR(i.unit_price)}
                    {i.line_discount > 0 ? ` − ${formatINR(i.line_discount)}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="font-medium tabular-nums">{formatINR(lineAmount(i))}</span>
                  {canWrite && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`${Q.remove}: ${i.description}`}
                      onClick={() => remove.mutate(i.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{Q.noItems}</p>
        )}
        {canWrite && <AddItemForm booking={b} />}
      </CardContent>
    </Card>
  );
}

function AddItemForm({ booking: b }: { booking: BookingRow }) {
  const services = useServices();
  const packages = usePackages();
  const add = useAddItem(b.id);
  const addPkg = useAddPackage(b.id);
  const [form, setForm] = useState({
    service_id: '',
    description: '',
    quantity: '1',
    unit_price: '',
    line_discount: '',
  });
  const [error, setError] = useState<string | null>(null);
  const active = (services.data ?? []).filter((s) => s.active);

  const pickService = (id: string) => {
    const s = active.find((x) => x.id === id);
    setForm({
      service_id: id,
      description: s?.name ?? '',
      quantity: String(s ? serviceLineQuantity(s.pricing_unit, b.guest_count) : 1),
      unit_price: s ? String(s.base_price) : '',
      line_discount: '',
    });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const qty = Number(form.quantity);
    const price = Number(form.unit_price || 0);
    const disc = Number(form.line_discount || 0);
    if (!form.description.trim()) return setError(t.bookings.form.required);
    if (!(Number.isInteger(qty) && qty > 0) || !(price >= 0) || !(disc >= 0))
      return setError(t.bookings.form.wholeRupees);
    if (disc > qty * price) return setError(t.bookings.form.discountTooBig);
    setError(null);
    add.mutate(
      {
        service_id: form.service_id || null,
        description: form.description.trim(),
        quantity: qty,
        unit_price: price,
        line_discount: disc,
      },
      {
        onSuccess: () =>
          setForm({
            service_id: '',
            description: '',
            quantity: '1',
            unit_price: '',
            line_discount: '',
          }),
        onError: () => setError(t.common.saveError),
      },
    );
  };

  const applyPackage = (id: string) => {
    const p = packages.data?.find((x) => x.id === id);
    if (!p) return;
    const byId = new Map((services.data ?? []).map((s) => [s.id, s]));
    // A priced package is quoted as one line at its package price. An unpriced
    // one expands into its services at list price.
    if (p.price > 0 || p.items.length === 0) {
      addPkg.mutate([
        {
          service_id: null,
          description: p.name,
          quantity: 1,
          unit_price: p.price,
          line_discount: 0,
        },
      ]);
      return;
    }
    addPkg.mutate(
      p.items
        .map((i) => byId.get(i.service_id))
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => ({
          service_id: s.id,
          description: s.name,
          quantity:
            serviceLineQuantity(s.pricing_unit, b.guest_count) *
            (p.items.find((i) => i.service_id === s.id)?.quantity ?? 1),
          unit_price: s.base_price,
          line_discount: 0,
        })),
    );
  };

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      {!!packages.data?.length && (
        <Field label={Q.addPackage} htmlFor="it-pkg" hint={Q.packageHint}>
          <Select
            id="it-pkg"
            value=""
            onChange={(e) => applyPackage(e.target.value)}
            disabled={addPkg.isPending}
          >
            <option value="">{Q.choose}</option>
            {packages.data
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.price ? ` (${formatINR(p.price)})` : ''}
                </option>
              ))}
          </Select>
        </Field>
      )}
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={Q.fromService} htmlFor="it-svc">
            <Select
              id="it-svc"
              value={form.service_id}
              onChange={(e) => pickService(e.target.value)}
            >
              <option value="">{Q.custom}</option>
              {active.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={Q.description} htmlFor="it-desc">
            <Input
              id="it-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={Q.qty} htmlFor="it-qty">
            <Input
              id="it-qty"
              inputMode="numeric"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          <Field label={Q.price} htmlFor="it-price">
            <Input
              id="it-price"
              inputMode="decimal"
              value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
            />
          </Field>
          <Field label={Q.lineDiscount} htmlFor="it-disc">
            <Input
              id="it-disc"
              inputMode="decimal"
              value={form.line_discount}
              onChange={(e) => setForm({ ...form, line_discount: e.target.value })}
            />
          </Field>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" variant="outline" className="self-start" disabled={add.isPending}>
          {Q.addLine}
        </Button>
        <p className="text-xs text-muted-foreground">{Q.subtotalHint}</p>
      </form>
    </div>
  );
}
