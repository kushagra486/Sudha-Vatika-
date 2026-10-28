import { formatINR } from '@bm/shared';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/app/auth';
import { canEditCatalog } from '@/app/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import { usePackages, useSavePackage, useServices, type PackageItem, type Pkg } from './api';

const C = t.catalog;

function guestRange(p: Pick<Pkg, 'guest_min' | 'guest_max'>): string | null {
  if (p.guest_min && p.guest_max) return C.guestRange(p.guest_min, p.guest_max);
  if (p.guest_min) return C.guestMin(p.guest_min);
  if (p.guest_max) return C.guestMax(p.guest_max);
  return null;
}

export function PackagesPage() {
  const { profile } = useAuth();
  const canEdit = !!profile && canEditCatalog(profile.role);
  const packages = usePackages();
  const services = useServices();
  const [editing, setEditing] = useState<Pkg | 'new' | null>(null);
  const names = new Map((services.data ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">{t.nav.packages}</h1>
        {canEdit && (
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> {C.addPackage}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{C.packagesHint}</p>

      {packages.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : packages.isError ? (
        <p className="text-sm text-destructive">{t.common.loadError}</p>
      ) : packages.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{C.noPackages}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {packages.data.map((p) => (
            <li key={p.id}>
              <Card
                className={
                  canEdit
                    ? 'h-full cursor-pointer p-4 transition-colors hover:bg-muted/50'
                    : 'h-full p-4'
                }
                onClick={canEdit ? () => setEditing(p) : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-semibold">{p.name}</p>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {p.price ? formatINR(p.price) : C.priceLater}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {guestRange(p) && <span>{guestRange(p)}</span>}
                  {!p.active && <Badge tone="red">{C.inactive}</Badge>}
                </div>
                {p.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
                )}
                {p.items.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {p.items.map((i) => (
                      <li key={i.service_id}>
                        <Badge>
                          {names.get(i.service_id) ?? '…'}
                          {i.quantity > 1 ? ` × ${i.quantity}` : ''}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <PackageDialog pkg={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function PackageDialog({ pkg, onClose }: { pkg: Pkg | null; onClose: () => void }) {
  const services = useServices();
  const save = useSavePackage();
  const [form, setForm] = useState({
    name: pkg?.name ?? '',
    description: pkg?.description ?? '',
    price: pkg ? String(pkg.price) : '',
    guest_min: pkg?.guest_min ? String(pkg.guest_min) : '',
    guest_max: pkg?.guest_max ? String(pkg.guest_max) : '',
    active: pkg?.active ?? true,
  });
  const [items, setItems] = useState<PackageItem[]>(pkg?.items ?? []);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string, on: boolean) =>
    setItems((cur) =>
      on ? [...cur, { service_id: id, quantity: 1 }] : cur.filter((i) => i.service_id !== id),
    );
  const setQty = (id: string, q: number) =>
    setItems((cur) =>
      cur.map((i) => (i.service_id === id ? { ...i, quantity: Math.max(1, q || 1) } : i)),
    );

  const int = (v: string) => (v.trim() === '' ? null : Number(v));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const price = form.price.trim() === '' ? 0 : Number(form.price);
    const min = int(form.guest_min);
    const max = int(form.guest_max);
    if (!form.name.trim()) return setError(t.bookings.form.required);
    if (!(price >= 0)) return setError(t.bookings.form.wholeRupees);
    if ((min !== null && !Number.isInteger(min)) || (max !== null && !Number.isInteger(max)))
      return setError(C.guestsWhole);
    if (min !== null && max !== null && min > max) return setError(C.guestOrder);
    save.mutate(
      {
        id: pkg?.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
        guest_min: min,
        guest_max: max,
        active: form.active,
        items,
      },
      { onSuccess: onClose, onError: () => setError(t.common.saveError) },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{pkg ? C.editPackage : C.addPackage}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label={C.name} htmlFor="pk-name">
            <Input
              id="pk-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={C.price} htmlFor="pk-price">
              <Input
                id="pk-price"
                inputMode="decimal"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
            <Field label={C.minGuests} htmlFor="pk-min">
              <Input
                id="pk-min"
                inputMode="numeric"
                value={form.guest_min}
                onChange={(e) => setForm({ ...form, guest_min: e.target.value })}
              />
            </Field>
            <Field label={C.maxGuests} htmlFor="pk-max">
              <Input
                id="pk-max"
                inputMode="numeric"
                value={form.guest_max}
                onChange={(e) => setForm({ ...form, guest_max: e.target.value })}
              />
            </Field>
          </div>
          <Field label={C.description} htmlFor="pk-desc">
            <Textarea
              id="pk-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{C.included}</legend>
            {services.data?.map((s) => {
              const item = items.find((i) => i.service_id === s.id);
              return (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    id={`pk-s-${s.id}`}
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!item}
                    onChange={(e) => toggle(s.id, e.target.checked)}
                  />
                  <label htmlFor={`pk-s-${s.id}`} className="min-w-0 flex-1">
                    {s.name}
                  </label>
                  {item && (
                    <Input
                      aria-label={`${C.quantity}: ${s.name}`}
                      className="h-8 w-16"
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(e) => setQty(s.id, Number(e.target.value))}
                    />
                  )}
                </div>
              );
            })}
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            {C.activeLabel}
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t.common.saving : t.common.save}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
