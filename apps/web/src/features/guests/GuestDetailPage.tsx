import { formatDateTime, formatEventDate, formatPhone } from '@bm/shared';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Textarea } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { BookingStatusBadge } from '@/features/bookings/BookingBits';
import { ContactButtons, StageBadge } from '@/features/leads/LeadBits';
import { t } from '@/i18n';
import { useGuest, useUpdateGuest, type GuestDetail } from './api';

const G = t.guests;

export function GuestDetailPage() {
  const { id = '' } = useParams();
  const guest = useGuest(id);
  if (guest.isPending) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (guest.isError) return <p className="text-sm text-destructive">{t.common.loadError}</p>;
  if (!guest.data) return <p className="text-sm text-muted-foreground">{G.notFound}</p>;
  return <Detail g={guest.data} />;
}

function Detail({ g }: { g: GuestDetail }) {
  const bookings = [...g.bookings].sort((a, b) => b.event_date.localeCompare(a.event_date));
  const leads = [...g.leads].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link
        to="/guests"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t.nav.guests}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">{g.full_name ?? t.leads.unnamed}</h1>
          <p className="text-sm text-muted-foreground">
            {formatPhone(g.phone_e164)} · {G.since(formatDateTime(g.created_at))}
          </p>
        </div>
        <ContactButtons
          phone={g.phone_e164}
          whatsapp={g.whatsapp_e164}
          whatsappAllowed={g.whatsapp_opt_in}
          size="sm"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{G.bookingsTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {bookings.length === 0 && <p className="text-sm text-muted-foreground">{G.none}</p>}
            {bookings.map((b) => (
              <Link
                key={b.id}
                to={`/bookings/${b.id}`}
                className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted/50"
              >
                <span className="min-w-0 text-sm">
                  {formatEventDate(b.event_date)} · {t.shifts[b.shift]} · {b.unit.name}
                  {b.event_type ? ` · ${b.event_type}` : ''}
                </span>
                <BookingStatusBadge status={b.status} />
              </Link>
            ))}
            {g.stays.map((s) => (
              <p key={s.id} className="px-2 text-sm text-muted-foreground">
                {s.unit.name} · {t.inventory.roomsCount(s.rooms)} · {formatEventDate(s.check_in)} →{' '}
                {formatEventDate(s.check_out)}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{G.enquiriesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {leads.length === 0 && <p className="text-sm text-muted-foreground">{G.none}</p>}
            {leads.map((l) => (
              <Link
                key={l.id}
                to={`/leads/${l.id}`}
                className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted/50"
              >
                <span className="min-w-0 text-sm">
                  {l.event_type ?? G.enquiry}
                  {l.event_date ? ` · ${formatEventDate(l.event_date)}` : ''}
                </span>
                <StageBadge stage={l.stage} />
              </Link>
            ))}
          </CardContent>
        </Card>
        <EditGuest g={g} />
      </div>
    </div>
  );
}

function EditGuest({ g }: { g: GuestDetail }) {
  const update = useUpdateGuest(g.id);
  const [form, setForm] = useState({ full_name: '', email: '', notes: '', whatsapp_opt_in: true });
  useEffect(
    () =>
      setForm({
        full_name: g.full_name ?? '',
        email: g.email ?? '',
        notes: g.notes ?? '',
        whatsapp_opt_in: g.whatsapp_opt_in,
      }),
    [g],
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({
      full_name: form.full_name.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      whatsapp_opt_in: form.whatsapp_opt_in,
    });
  };
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">{G.details}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.catalog.name} htmlFor="g-name">
              <Input
                id="g-name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </Field>
            <Field label={G.email} htmlFor="g-email">
              <Input
                id="g-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>
          <Field label={G.notes} htmlFor="g-notes" hint={G.notesHint}>
            <Textarea
              id="g-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={form.whatsapp_opt_in}
              onChange={(e) => setForm({ ...form, whatsapp_opt_in: e.target.checked })}
            />
            {G.optIn}
          </label>
          {update.isError && <p className="text-sm text-destructive">{t.common.saveError}</p>}
          {update.isSuccess && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">{G.saved}</p>
          )}
          <Button type="submit" className="self-start" disabled={update.isPending}>
            {update.isPending ? t.common.saving : t.common.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
