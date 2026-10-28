import {
  addDays,
  formatEventDate,
  formatINR,
  formatPhone,
  todayIST,
  UNIT_KINDS,
  type UnitKind,
} from '@bm/shared';
import { BedDouble, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/app/auth';
import { canEditCatalog, canSeeMoney, canWriteBookings } from '@/app/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  ROOM_KINDS,
  useSaveSpace,
  useSetStayStatus,
  useSpaces,
  useStays,
  type Space,
  type Stay,
} from './api';
import { roomsTakenByNight } from './occupancy';
import { StayDialog } from './StayDialog';

const I = t.inventory;
const DAYS = 14;

export function InventoryPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'spaces' ? 'spaces' : 'rooms';
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="text-xl font-semibold sm:text-2xl">{t.nav.inventory}</h1>
      <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
        {(['rooms', 'spaces'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={cn(
              'flex-1 rounded-md px-3 py-2 font-medium',
              tab === k ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
            onClick={() => setParams(k === 'rooms' ? {} : { tab: k }, { replace: true })}
          >
            {I.tabs[k]}
          </button>
        ))}
      </div>
      {tab === 'rooms' ? <RoomsTab /> : <SpacesTab />}
    </div>
  );
}

// ---------------------------------------------------------------- Rooms & dorms

function RoomsTab() {
  const { profile } = useAuth();
  const canWrite = !!profile && canWriteBookings(profile.role);
  const money = !!profile && canSeeMoney(profile.role);
  const [from, setFrom] = useState(todayIST());
  const to = addDays(from, DAYS);
  const spaces = useSpaces();
  const stays = useStays(from, to);
  const [adding, setAdding] = useState<{ unitId?: string; date?: string } | null>(null);
  const rooms = (spaces.data ?? []).filter((s) => ROOM_KINDS.includes(s.kind) && s.active);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label={I.prev}
            onClick={() => setFrom(addDays(from, -DAYS))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFrom(todayIST())}>
            {I.today}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={I.next}
            onClick={() => setFrom(addDays(from, DAYS))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm text-muted-foreground">
            {formatEventDate(from)} – {formatEventDate(addDays(to, -1))}
          </span>
        </div>
        {canWrite && (
          <Button onClick={() => setAdding({})}>
            <Plus className="h-4 w-4" /> {I.addStay}
          </Button>
        )}
      </div>

      {spaces.isPending || stays.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : stays.isError ? (
        <p className="text-sm text-destructive">{t.common.loadError}</p>
      ) : (
        <>
          {rooms.map((u) => (
            <Card key={u.id} className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <BedDouble className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">{u.name}</p>
                <span className="text-xs text-muted-foreground">{I.roomsOnHand(u.quantity)}</span>
              </div>
              <div className="relative overflow-x-auto">
                <div className="grid min-w-[560px] grid-cols-[repeat(14,minmax(0,1fr))] gap-1">
                  {roomsTakenByNight(stays.data, u.id, from, DAYS).map(({ night, taken }) => {
                    const free = u.quantity - taken;
                    return (
                      <button
                        key={night}
                        type="button"
                        disabled={!canWrite || free <= 0}
                        onClick={() => setAdding({ unitId: u.id, date: night })}
                        aria-label={I.nightLabel(formatEventDate(night), free, u.quantity)}
                        className={cn(
                          'flex flex-col items-center rounded-md border px-0.5 py-1 text-xs tabular-nums',
                          free <= 0
                            ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200'
                            : taken > 0
                              ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
                              : 'bg-background',
                        )}
                      >
                        <span className="text-[10px] text-muted-foreground">{night.slice(8)}</span>
                        <span className="font-semibold">{free}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground">{I.gridHint}</p>
          <StayList stays={stays.data} money={money} canWrite={canWrite} />
        </>
      )}
      {adding && <StayDialog open onOpenChange={(o) => !o && setAdding(null)} prefill={adding} />}
    </div>
  );
}

const STAY_TONES = {
  reserved: 'amber',
  checked_in: 'green',
  checked_out: 'neutral',
  cancelled: 'red',
} as const;

export function StayList({
  stays,
  money,
  canWrite,
}: {
  stays: Stay[];
  money: boolean;
  canWrite: boolean;
}) {
  const setStatus = useSetStayStatus();
  if (stays.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">{I.noStays}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {stays.map((s) => (
        <li key={s.id}>
          <Card className="flex flex-col gap-2 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {s.guest.full_name ?? formatPhone(s.guest.phone_e164)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.unit.name} · {I.roomsCount(s.rooms)} · {formatEventDate(s.check_in)} →{' '}
                  {formatEventDate(s.check_out)} ({I.nights(s.nights)})
                </p>
                {s.booking_id && (
                  <Link to={`/bookings/${s.booking_id}`} className="text-xs text-primary underline">
                    {I.forEvent}
                  </Link>
                )}
                {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={STAY_TONES[s.status]}>{I.statuses[s.status]}</Badge>
                {money && s.amount > 0 && (
                  <span className="text-sm font-semibold tabular-nums">{formatINR(s.amount)}</span>
                )}
              </div>
            </div>
            {canWrite && (s.status === 'reserved' || s.status === 'checked_in') && (
              <div className="flex flex-wrap gap-2">
                {s.status === 'reserved' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus.mutate({ id: s.id, status: 'checked_in' })}
                  >
                    {I.checkIn}
                  </Button>
                )}
                {s.status === 'checked_in' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus.mutate({ id: s.id, status: 'checked_out' })}
                  >
                    {I.checkOut}
                  </Button>
                )}
                {s.status === 'reserved' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStatus.mutate({ id: s.id, status: 'cancelled' })}
                  >
                    {I.cancelStay}
                  </Button>
                )}
              </div>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- Spaces

function SpacesTab() {
  const { profile } = useAuth();
  const canEdit = !!profile && canEditCatalog(profile.role);
  const spaces = useSpaces();
  const [editing, setEditing] = useState<Space | null>(null);

  if (spaces.isPending) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (spaces.isError) return <p className="text-sm text-destructive">{t.common.loadError}</p>;
  return (
    <>
      <p className="text-sm text-muted-foreground">{I.spacesHint}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {spaces.data.map((s) => (
          <li key={s.id}>
            <Card
              className={cn(
                'h-full p-3',
                canEdit && 'cursor-pointer transition-colors hover:bg-muted/50',
              )}
              onClick={canEdit ? () => setEditing(s) : undefined}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{s.name}</p>
                <Badge>{I.kinds[s.kind]}</Badge>
                {s.upcoming && <Badge tone="violet">{I.upcoming}</Badge>}
                {!s.active && <Badge tone="red">{I.closed}</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {[
                  s.floating_capacity ? I.capacity(s.floating_capacity) : null,
                  ROOM_KINDS.includes(s.kind) ? I.roomsOnHand(s.quantity) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {s.description && (
                <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {editing && <SpaceDialog space={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function SpaceDialog({ space, onClose }: { space: Space; onClose: () => void }) {
  const save = useSaveSpace();
  const [form, setForm] = useState({
    name: space.name,
    kind: space.kind,
    floating_capacity: space.floating_capacity ? String(space.floating_capacity) : '',
    quantity: String(space.quantity),
    description: space.description ?? '',
    upcoming: space.upcoming,
    active: space.active,
  });
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const cap = form.floating_capacity.trim() === '' ? null : Number(form.floating_capacity);
    const qty = Number(form.quantity);
    if (!form.name.trim()) return setError(t.bookings.form.required);
    if (
      (cap !== null && !(Number.isInteger(cap) && cap >= 0)) ||
      !(Number.isInteger(qty) && qty > 0)
    )
      return setError(t.catalog.guestsWhole);
    save.mutate(
      {
        id: space.id,
        name: form.name.trim(),
        kind: form.kind,
        floating_capacity: cap,
        quantity: qty,
        description: form.description.trim() || null,
        upcoming: form.upcoming,
        active: form.active,
      },
      { onSuccess: onClose, onError: () => setError(t.common.saveError) },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{I.editSpace}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label={t.catalog.name} htmlFor="sp-name">
            <Input
              id="sp-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={I.kind} htmlFor="sp-kind">
              <Select
                id="sp-kind"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as UnitKind })}
              >
                {UNIT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {I.kinds[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={I.maxGuests} htmlFor="sp-cap">
              <Input
                id="sp-cap"
                inputMode="numeric"
                value={form.floating_capacity}
                onChange={(e) => setForm({ ...form, floating_capacity: e.target.value })}
              />
            </Field>
            <Field label={I.roomCount} htmlFor="sp-qty">
              <Input
                id="sp-qty"
                inputMode="numeric"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t.catalog.description} htmlFor="sp-desc">
            <Textarea
              id="sp-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.upcoming}
              onChange={(e) => setForm({ ...form, upcoming: e.target.checked })}
            />
            {I.upcomingLabel}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            {I.activeLabel}
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
