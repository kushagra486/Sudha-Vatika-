import { formatINR, PRICING_UNITS, type PricingUnit } from '@bm/shared';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/app/auth';
import { canEditCatalog } from '@/app/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import { useCategories, useSaveCategory, useSaveService, useServices, type Service } from './api';

const C = t.catalog;

export function ServicesPage() {
  const { profile } = useAuth();
  const canEdit = !!profile && canEditCatalog(profile.role);
  const services = useServices();
  const categories = useCategories();
  const [editing, setEditing] = useState<Service | 'new' | null>(null);

  const groups = (categories.data ?? []).map((c) => ({
    id: c.id as string | null,
    name: c.name,
    items: (services.data ?? []).filter((s) => s.category_id === c.id),
  }));
  const uncategorised = (services.data ?? []).filter((s) => !s.category_id);
  if (uncategorised.length) groups.push({ id: null, name: C.uncategorised, items: uncategorised });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">{t.nav.services}</h1>
        {canEdit && (
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> {C.addService}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{C.servicesHint}</p>

      {services.isPending || categories.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : services.isError ? (
        <p className="text-sm text-destructive">{t.common.loadError}</p>
      ) : (
        groups
          .filter((g) => g.items.length || canEdit)
          .map((g) => (
            <section key={g.id ?? 'none'} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {g.name}
              </h2>
              {g.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{C.emptyCategory}</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {g.items.map((s) => (
                    <li key={s.id}>
                      <Card
                        className={
                          canEdit ? 'cursor-pointer p-3 transition-colors hover:bg-muted/50' : 'p-3'
                        }
                        onClick={canEdit ? () => setEditing(s) : undefined}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 font-medium">{s.name}</p>
                          <span className="shrink-0 font-semibold tabular-nums">
                            {s.base_price ? formatINR(s.base_price) : C.priceLater}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{C.pricingUnits[s.pricing_unit]}</span>
                          {!s.active && <Badge tone="red">{C.inactive}</Badge>}
                        </div>
                        {s.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                        )}
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))
      )}

      {canEdit && <AddCategory />}
      {editing && (
        <ServiceDialog
          service={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function AddCategory() {
  const save = useSaveCategory();
  const [name, setName] = useState('');
  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) save.mutate(name.trim(), { onSuccess: () => setName('') });
      }}
    >
      <Field label={C.newCategory} htmlFor="cat-name" className="min-w-48 flex-1">
        <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Button type="submit" variant="outline" disabled={!name.trim() || save.isPending}>
        {C.addCategory}
      </Button>
      {save.isError && <p className="w-full text-sm text-destructive">{t.common.saveError}</p>}
    </form>
  );
}

function ServiceDialog({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const categories = useCategories();
  const save = useSaveService();
  const [form, setForm] = useState({
    name: service?.name ?? '',
    description: service?.description ?? '',
    category_id: service?.category_id ?? '',
    base_price: service ? String(service.base_price) : '',
    pricing_unit: (service?.pricing_unit ?? 'fixed') as PricingUnit,
    active: service?.active ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const price = form.base_price.trim() === '' ? 0 : Number(form.base_price);
    if (!form.name.trim()) return setError(t.bookings.form.required);
    if (!(price >= 0)) return setError(t.bookings.form.wholeRupees);
    save.mutate(
      {
        id: service?.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        category_id: form.category_id || null,
        base_price: price,
        pricing_unit: form.pricing_unit,
        active: form.active,
      },
      { onSuccess: onClose, onError: () => setError(t.common.saveError) },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{service ? C.editService : C.addService}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label={C.name} htmlFor="sv-name">
            <Input
              id="sv-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={C.price} htmlFor="sv-price" hint={C.priceHint}>
              <Input
                id="sv-price"
                inputMode="decimal"
                value={form.base_price}
                onChange={(e) => setForm({ ...form, base_price: e.target.value })}
              />
            </Field>
            <Field label={C.pricedBy} htmlFor="sv-unit">
              <Select
                id="sv-unit"
                value={form.pricing_unit}
                onChange={(e) => setForm({ ...form, pricing_unit: e.target.value as PricingUnit })}
              >
                {PRICING_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {C.pricingUnits[u]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={C.category} htmlFor="sv-cat">
            <Select
              id="sv-cat"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              <option value="">{C.uncategorised}</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={C.description} htmlFor="sv-desc">
            <Textarea
              id="sv-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
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
