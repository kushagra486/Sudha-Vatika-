import { addDays, formatINR, toE164, todayIST } from '@bm/shared';
import { useState, type FormEvent } from 'react';
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
import { ROOM_KINDS, stayErrorMessage, useCreateStay, useSpaces } from './api';
import { nightsBetween } from './occupancy';

const I = t.inventory;

export interface StayPrefill {
  unitId?: string;
  date?: string;
  bookingId?: string;
  guestName?: string;
  guestCount?: number | null;
}

export function StayDialog({
  open,
  onOpenChange,
  prefill = {},
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prefill?: StayPrefill;
}) {
  const spaces = useSpaces();
  const create = useCreateStay();
  const rooms = (spaces.data ?? []).filter((s) => ROOM_KINDS.includes(s.kind) && s.active);
  const checkIn = prefill.date ?? todayIST();
  const [form, setForm] = useState({
    unit_id: prefill.unitId ?? '',
    check_in: checkIn,
    check_out: addDays(checkIn, 1),
    rooms: '1',
    phone: '',
    full_name: '',
    guest_count: prefill.guestCount ? String(prefill.guestCount) : '',
    rate: '',
    notes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const unitId = form.unit_id || rooms[0]?.id || '';
  const nights = nightsBetween(form.check_in, form.check_out);
  const total = nights > 0 ? nights * Number(form.rooms || 0) * Number(form.rate || 0) : 0;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const phone = prefill.bookingId ? null : toE164(form.phone);
    const roomsN = Number(form.rooms);
    if (!unitId) return setError(t.bookings.form.required);
    if (!prefill.bookingId && !phone) return setError(t.bookings.form.invalidPhone);
    if (!(nights > 0)) return setError(I.datesOrder);
    if (!(Number.isInteger(roomsN) && roomsN > 0)) return setError(t.catalog.guestsWhole);
    setError(null);
    create.mutate(
      {
        unit_id: unitId,
        check_in: form.check_in,
        check_out: form.check_out,
        rooms: roomsN,
        phone_e164: phone,
        full_name: form.full_name.trim() || null,
        booking_id: prefill.bookingId ?? null,
        guest_count: form.guest_count ? Number(form.guest_count) : null,
        rate: Number(form.rate || 0),
        notes: form.notes.trim() || null,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) =>
          setError(
            stayErrorMessage(err, {
              full: I.full,
              notRoom: I.notRoom,
              generic: t.common.saveError,
            }),
          ),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{I.addStay}</DialogTitle>
          {prefill.guestName && <DialogDescription>{prefill.guestName}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Field label={I.roomType} htmlFor="st-unit">
            <Select id="st-unit" value={unitId} onChange={set('unit_id')}>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({I.roomsOnHand(r.quantity)})
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={I.checkInDate} htmlFor="st-in">
              <Input id="st-in" type="date" value={form.check_in} onChange={set('check_in')} />
            </Field>
            <Field label={I.checkOutDate} htmlFor="st-out">
              <Input
                id="st-out"
                type="date"
                value={form.check_out}
                min={addDays(form.check_in, 1)}
                onChange={set('check_out')}
              />
            </Field>
            <Field label={I.roomCount} htmlFor="st-rooms">
              <Input id="st-rooms" inputMode="numeric" value={form.rooms} onChange={set('rooms')} />
            </Field>
            <Field label={I.people} htmlFor="st-people">
              <Input
                id="st-people"
                inputMode="numeric"
                value={form.guest_count}
                onChange={set('guest_count')}
              />
            </Field>
          </div>
          {!prefill.bookingId && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t.bookings.form.phone} htmlFor="st-phone">
                <Input
                  id="st-phone"
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={set('phone')}
                />
              </Field>
              <Field label={t.bookings.form.name} htmlFor="st-name">
                <Input id="st-name" value={form.full_name} onChange={set('full_name')} />
              </Field>
            </div>
          )}
          <Field
            label={I.rate}
            htmlFor="st-rate"
            hint={nights > 0 ? I.totalHint(I.nights(nights), formatINR(total)) : undefined}
          >
            <Input id="st-rate" inputMode="decimal" value={form.rate} onChange={set('rate')} />
          </Field>
          <Field label={I.notes} htmlFor="st-notes">
            <Textarea id="st-notes" value={form.notes} onChange={set('notes')} />
          </Field>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? t.common.saving : I.addStay}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
