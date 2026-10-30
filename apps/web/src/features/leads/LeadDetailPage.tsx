import {
  formatDateTime,
  formatPhone,
  fromISTInputValue,
  istAt,
  LEAD_STAGES,
  SHIFTS,
  toISTInputValue,
  type LeadStage,
  type Shift,
} from '@bm/shared';
import { ArrowLeft, CalendarPlus } from 'lucide-react';
import { useAuth } from '@/app/auth';
import { canWriteBookings } from '@/app/roles';
import { NewBookingDialog } from '@/features/bookings/NewBookingDialog';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Select, Textarea } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  useAddNote,
  useBookingsOnDate,
  useEventSpaces,
  useLead,
  useLeadNotes,
  useUpdateLead,
  type Lead,
} from './api';
import { LeadAssistCard } from '@/features/ai/LeadAssistCard';
import { ContactButtons, FollowUpBadge } from './LeadBits';
import { STAGE_TONES } from './stageTones';

const D = t.leads.detail;

export function LeadDetailPage() {
  const { id = '' } = useParams();
  const lead = useLead(id);

  if (lead.isPending) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (lead.isError) {
    return (
      <div className="flex items-center gap-3 text-sm text-destructive">
        {t.common.loadError}
        <Button variant="outline" size="sm" onClick={() => lead.refetch()}>
          {t.common.retry}
        </Button>
      </div>
    );
  }
  if (!lead.data) {
    return (
      <div className="flex flex-col gap-3">
        <BackLink />
        <p className="text-sm">{D.notFound}</p>
      </div>
    );
  }

  return <LeadDetail lead={lead.data} />;
}

function BackLink() {
  return (
    <Link
      to="/leads"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {D.back}
    </Link>
  );
}

function LeadDetail({ lead }: { lead: Lead }) {
  const { profile } = useAuth();
  const [booking, setBooking] = useState(false);
  const canBook = !!profile && canWriteBookings(profile.role);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold sm:text-2xl">
            {lead.guest.full_name ?? t.leads.unnamed}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatPhone(lead.guest.phone_e164)} · {t.leadSources[lead.source]} · {D.created}{' '}
            {formatDateTime(lead.created_at)}
          </p>
          {lead.guest.whatsapp_e164 && lead.guest.whatsapp_e164 !== lead.guest.phone_e164 && (
            <p className="text-sm text-muted-foreground">
              {D.whatsappNumber}: {formatPhone(lead.guest.whatsapp_e164)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <ContactButtons
            phone={lead.guest.phone_e164}
            whatsapp={lead.guest.whatsapp_e164}
            whatsappAllowed={lead.guest.whatsapp_opt_in}
            size="sm"
          />
          {canBook && (
            <Button size="sm" onClick={() => setBooking(true)}>
              <CalendarPlus className="h-4 w-4" />
              {t.bookings.fromLead}
            </Button>
          )}
        </div>
      </div>
      {canBook && (
        <NewBookingDialog
          open={booking}
          onOpenChange={setBooking}
          prefill={{
            lead: {
              id: lead.id,
              guestName: lead.guest.full_name ?? formatPhone(lead.guest.phone_e164),
            },
            unitId: lead.preferred_unit_id ?? undefined,
            date: lead.event_date ?? undefined,
            eventType: lead.event_type,
            guestCount: lead.guest_count,
          }}
        />
      )}

      <StagePicker lead={lead} />

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4">
          <DetailsCard lead={lead} />
          <AvailabilityCard date={lead.event_date} />
        </div>
        <div className="flex flex-col gap-4">
          <NotesCard lead={lead} />
          {profile && profile.role !== 'viewer' && <LeadAssistCard lead={lead} />}
        </div>
      </div>
    </div>
  );
}

function StagePicker({ lead }: { lead: Lead }) {
  const update = useUpdateLead(lead.id);
  const [pendingLost, setPendingLost] = useState(false);
  const [reason, setReason] = useState('');

  const choose = (stage: LeadStage) => {
    if (stage === lead.stage) return;
    if (stage === 'lost') {
      setPendingLost(true);
      return;
    }
    setPendingLost(false);
    update.mutate({ stage, lost_reason: null });
  };

  const confirmLost = (e: FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    update.mutate(
      { stage: 'lost', lost_reason: reason.trim(), next_follow_up_at: null },
      { onSuccess: () => setPendingLost(false) },
    );
  };

  return (
    <Card className="p-3">
      <p className="mb-2 text-sm font-medium">{D.stage}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={D.stage}>
        {LEAD_STAGES.map((stage) => {
          const active = stage === lead.stage || (stage === 'lost' && pendingLost);
          return (
            <button
              key={stage}
              type="button"
              role="radio"
              aria-checked={stage === lead.stage}
              disabled={update.isPending}
              onClick={() => choose(stage)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                active ? 'border-transparent ring-2 ring-ring' : 'hover:bg-muted',
              )}
            >
              <Badge tone={STAGE_TONES[stage]} className="pointer-events-none bg-transparent p-0">
                {t.leadStages[stage]}
              </Badge>
            </button>
          );
        })}
      </div>

      {lead.stage === 'lost' && lead.lost_reason && !pendingLost && (
        <p className="mt-2 text-sm text-muted-foreground">
          {D.lostReason} {lead.lost_reason}
        </p>
      )}

      {pendingLost && (
        <form onSubmit={confirmLost} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <Field label={D.lostReason} htmlFor="lost-reason" className="flex-1">
            <Input
              id="lost-reason"
              list="lost-reasons"
              autoFocus
              placeholder={D.lostReasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <datalist id="lost-reasons">
              {t.leads.lostReasons.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              disabled={!reason.trim() || update.isPending}
            >
              {t.leadStages.lost}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPendingLost(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      )}

      {update.isError && <p className="mt-2 text-sm text-destructive">{t.common.saveError}</p>}
    </Card>
  );
}

interface DetailsForm {
  event_type: string;
  event_date: string;
  guest_count: string;
  budget_min: string;
  budget_max: string;
  preferred_unit_id: string;
  follow_up: string;
}

function toForm(lead: Lead): DetailsForm {
  return {
    event_type: lead.event_type ?? '',
    event_date: lead.event_date ?? '',
    guest_count: lead.guest_count?.toString() ?? '',
    budget_min: lead.budget_min?.toString() ?? '',
    budget_max: lead.budget_max?.toString() ?? '',
    preferred_unit_id: lead.preferred_unit_id ?? '',
    follow_up: lead.next_follow_up_at ? toISTInputValue(lead.next_follow_up_at) : '',
  };
}

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v));

function DetailsCard({ lead }: { lead: Lead }) {
  const update = useUpdateLead(lead.id);
  const spaces = useEventSpaces();
  const [form, setForm] = useState<DetailsForm>(() => toForm(lead));
  const [error, setError] = useState<string | null>(null);

  // Pick up fresh server data after a save or refetch.
  useEffect(() => setForm(toForm(lead)), [lead]);

  const set = (key: keyof DetailsForm) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(lead));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const budgetMin = numOrNull(form.budget_min);
    const budgetMax = numOrNull(form.budget_max);
    const guests = numOrNull(form.guest_count);
    if ([budgetMin, budgetMax, guests].some((n) => n !== null && (!Number.isFinite(n) || n < 0))) {
      setError('Use positive numbers only');
      return;
    }
    if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
      setError('Minimum budget cannot exceed maximum');
      return;
    }
    setError(null);
    update.mutate({
      event_type: form.event_type.trim() || null,
      event_date: form.event_date || null,
      guest_count: guests,
      budget_min: budgetMin,
      budget_max: budgetMax,
      preferred_unit_id: form.preferred_unit_id || null,
      next_follow_up_at: form.follow_up ? fromISTInputValue(form.follow_up) : null,
    });
  };

  const quickFollowUps: [string, string][] = [
    [t.leads.quickFollowUps.tomorrow, istAt(1, 11)],
    [t.leads.quickFollowUps.threeDays, istAt(3, 11)],
    [t.leads.quickFollowUps.week, istAt(7, 11)],
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{D.details}</CardTitle>
        <FollowUpBadge at={lead.next_follow_up_at} />
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.leads.quickAdd.eventType} htmlFor="d-event-type">
              <Input
                id="d-event-type"
                list="d-event-types"
                value={form.event_type}
                onChange={set('event_type')}
              />
              <datalist id="d-event-types">
                {t.leads.eventTypes.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </Field>
            <Field label={t.leads.quickAdd.eventDate} htmlFor="d-event-date">
              <Input
                id="d-event-date"
                type="date"
                value={form.event_date}
                onChange={set('event_date')}
              />
            </Field>
            <Field label={t.leads.quickAdd.guestCount} htmlFor="d-guests">
              <Input
                id="d-guests"
                inputMode="numeric"
                value={form.guest_count}
                onChange={set('guest_count')}
              />
            </Field>
            <Field label={t.leads.quickAdd.space} htmlFor="d-space">
              <Select
                id="d-space"
                value={form.preferred_unit_id}
                onChange={set('preferred_unit_id')}
              >
                <option value="">{t.leads.quickAdd.anySpace}</option>
                {spaces.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.upcoming ? ` (${D.upcoming})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={D.budgetMin} htmlFor="d-budget-min">
              <Input
                id="d-budget-min"
                inputMode="numeric"
                value={form.budget_min}
                onChange={set('budget_min')}
              />
            </Field>
            <Field label={D.budgetMax} htmlFor="d-budget-max">
              <Input
                id="d-budget-max"
                inputMode="numeric"
                value={form.budget_max}
                onChange={set('budget_max')}
              />
            </Field>
          </div>

          <Field label={t.leads.quickAdd.followUp} htmlFor="d-follow-up">
            <div className="flex flex-wrap gap-2">
              {quickFollowUps.map(([label, iso]) => (
                <Button
                  key={label}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, follow_up: toISTInputValue(iso) }))}
                >
                  {label}
                </Button>
              ))}
              {form.follow_up && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setForm((f) => ({ ...f, follow_up: '' }))}
                >
                  {D.clearFollowUp}
                </Button>
              )}
            </div>
            <Input
              id="d-follow-up"
              type="datetime-local"
              value={form.follow_up}
              onChange={set('follow_up')}
            />
          </Field>

          {(error || update.isError) && (
            <p className="text-sm text-destructive" role="alert">
              {error ?? t.common.saveError}
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

function AvailabilityCard({ date }: { date: string | null }) {
  const spaces = useEventSpaces();
  const bookings = useBookingsOnDate(date);

  const bookedShifts = (unitId: string): Shift[] =>
    (bookings.data ?? []).filter((b) => b.unit_id === unitId).map((b) => b.shift);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{D.availability}</CardTitle>
      </CardHeader>
      <CardContent>
        {!date ? (
          <p className="text-sm text-muted-foreground">{D.availabilityNoDate}</p>
        ) : spaces.isPending || bookings.isPending ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {spaces.data?.map((u) => {
              const shifts = bookedShifts(u.id);
              const fullDay = shifts.includes('full_day');
              return (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    {u.name}
                    {u.floating_capacity ? (
                      <span className="text-muted-foreground"> · {u.floating_capacity}</span>
                    ) : null}
                  </span>
                  {u.upcoming ? (
                    <Badge>{D.upcoming}</Badge>
                  ) : shifts.length === 0 ? (
                    <Badge tone="green">{D.free}</Badge>
                  ) : fullDay ? (
                    <Badge tone="red">
                      {D.booked} · {t.shifts.full_day}
                    </Badge>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {SHIFTS.filter((s) => s !== 'full_day' && shifts.includes(s)).map((s) => (
                        <Badge key={s} tone="red">
                          {t.shifts[s]}
                        </Badge>
                      ))}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function NotesCard({ lead }: { lead: Lead }) {
  const notes = useLeadNotes(lead.id);
  const add = useAddNote(lead);
  const [body, setBody] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    add.mutate(text, { onSuccess: () => setBody('') });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{D.notes}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Textarea
            aria-label={D.addNote}
            placeholder={D.notePlaceholder}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          {add.isError && <p className="text-sm text-destructive">{t.common.saveError}</p>}
          <Button
            type="submit"
            size="sm"
            disabled={!body.trim() || add.isPending}
            className="self-start"
          >
            {D.addNote}
          </Button>
        </form>

        {notes.isPending ? (
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        ) : notes.data?.length ? (
          <ol className="flex flex-col gap-3">
            {notes.data.map((n) => (
              <li key={n.id} className="rounded-md bg-muted/60 p-3 text-sm">
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.channel === 'call_note' ? t.common.call : t.common.whatsapp} ·{' '}
                  {formatDateTime(n.created_at)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{D.noNotes}</p>
        )}
      </CardContent>
    </Card>
  );
}
