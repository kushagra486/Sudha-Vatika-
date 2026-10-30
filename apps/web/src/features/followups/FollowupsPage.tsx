import {
  balanceReminderText,
  daysUntil,
  feedbackRequestText,
  formatDateTime,
  formatEventDate,
  formatINR,
  formatPhone,
  todayIST,
} from '@bm/shared';
import { MessageCircle, Phone, Star } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/app/auth';
import { canAddLeads, canRecordPayments, canSeeMoney } from '@/app/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { openInWhatsApp, useSendWhatsApp } from '@/features/messaging/api';
import { useOrgDetails } from '@/features/settings/api';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  useBalanceReminders,
  useFeedbackQueue,
  useLogTouch,
  type BalanceRow,
  type FeedbackRow,
} from './api';

const F = t.followups;
const WINDOWS = [7, 14, 30, 60, 90];
type Tab = 'balance' | 'feedback';

export function FollowupsPage() {
  const { profile } = useAuth();
  const money = !!profile && canSeeMoney(profile.role);
  const [tab, setTab] = useState<Tab>(money ? 'balance' : 'feedback');
  const [days, setDays] = useState(30);
  const tabs: Tab[] = money ? ['balance', 'feedback'] : ['feedback'];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{F.title}</h1>
        <p className="text-sm text-muted-foreground">{F.subtitle}</p>
      </div>
      {tabs.length > 1 && (
        <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {tabs.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                'flex-1 rounded-md px-3 py-2 font-medium',
                tab === k ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              {k === 'balance' ? F.balanceTab : F.feedbackTab}
            </button>
          ))}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{tab === 'balance' ? F.within : F.past}</span>
        <Select
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-auto"
        >
          {WINDOWS.map((d) => (
            <option key={d} value={d}>
              {F.days(d)}
            </option>
          ))}
        </Select>
      </label>
      {tab === 'balance' && money ? <BalanceList days={days} /> : <FeedbackList days={days} />}
    </div>
  );
}

/* --------------------------------------------------------------- balance -- */

function BalanceList({ days }: { days: number }) {
  const list = useBalanceReminders(days);
  const org = useOrgDetails();
  if (list.isPending) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (list.isError) return <p className="text-sm text-destructive">{F.error}</p>;
  const rows = list.data;
  const total = rows.reduce((a, r) => a + r.balance, 0);
  return (
    <div className="flex flex-col gap-3">
      {org.data && !org.data.org.upi_id && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          {F.noUpi}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{F.noBalances}</p>
      ) : (
        <>
          <p className="text-sm font-medium">{F.totalDue(formatINR(total), rows.length)}</p>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.booking_id}>
                <BalanceCard
                  row={r}
                  venue={org.data?.org.name ?? ''}
                  upi={org.data?.org.upi_id ?? null}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function BalanceCard({
  row: r,
  venue,
  upi,
}: {
  row: BalanceRow;
  venue: string;
  upi: string | null;
}) {
  const { profile } = useAuth();
  const send = useSendWhatsApp();
  const log = useLogTouch();
  const left = daysUntil(r.event_date, todayIST());
  const canSend = !!profile && canRecordPayments(profile.role);

  const remind = () => {
    const body = balanceReminderText({
      guestName: r.guest_name,
      venue,
      eventType: r.event_type,
      eventDate: r.event_date,
      balance: r.balance,
      upiId: upi,
    });
    openInWhatsApp(r.phone_e164, body); // inside the click, so pop-up blockers allow it
    send.mutate({
      guest: {
        id: r.guest_id,
        full_name: r.guest_name,
        phone_e164: r.phone_e164,
        whatsapp_opt_in: true,
      },
      body,
    });
    log.mutate({ booking_id: r.booking_id, kind: 'balance_reminder' });
  };

  return (
    <Card className="flex flex-col gap-2 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/bookings/${r.booking_id}`} className="font-medium hover:underline">
            {r.guest_name ?? formatPhone(r.phone_e164)}
          </Link>
          <p className="text-sm text-muted-foreground">
            {[r.event_type, formatEventDate(r.event_date), r.space].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Badge tone={left <= 3 ? 'red' : left <= 7 ? 'amber' : 'neutral'}>{F.inDays(left)}</Badge>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{formatINR(r.balance)}</p>
          <p className="text-xs text-muted-foreground">
            {F.paid(formatINR(r.paid), formatINR(r.total))}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {r.last_reminded_at
            ? F.reminded(formatDateTime(r.last_reminded_at), r.reminders)
            : F.neverReminded}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canSend && (
          <Button size="sm" onClick={remind} disabled={log.isPending}>
            <MessageCircle className="h-4 w-4" />
            {r.reminders ? F.remindAgain : F.remind}
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <a href={`tel:${r.phone_e164}`}>
            <Phone className="h-4 w-4" /> {formatPhone(r.phone_e164)}
          </a>
        </Button>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- feedback -- */

function FeedbackList({ days }: { days: number }) {
  const list = useFeedbackQueue(days);
  const org = useOrgDetails();
  if (list.isPending) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (list.isError) return <p className="text-sm text-destructive">{F.error}</p>;
  return (
    <div className="flex flex-col gap-3">
      {org.data && !org.data.org.google_review_url && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          {F.noReviewLink}
        </p>
      )}
      {list.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{F.noFeedback}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data.map((r) => (
            <li key={r.booking_id}>
              <FeedbackCard
                row={r}
                venue={org.data?.org.name ?? ''}
                reviewUrl={org.data?.org.google_review_url ?? null}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stars({ value, onPick }: { value: number; onPick?: (n: number) => void }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={F.stars(value)}>
      {[1, 2, 3, 4, 5].map((n) =>
        onPick ? (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            aria-label={F.stars(n)}
            aria-pressed={n <= value}
            className="rounded p-1 hover:bg-muted"
          >
            <Star
              className={cn(
                'h-6 w-6',
                n <= value ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground',
              )}
            />
          </button>
        ) : (
          <Star
            key={n}
            aria-hidden
            className={cn(
              'h-4 w-4',
              n <= value ? 'fill-amber-400 text-amber-500' : 'text-muted-foreground',
            )}
          />
        ),
      )}
    </span>
  );
}

function FeedbackCard({
  row: r,
  venue,
  reviewUrl,
}: {
  row: FeedbackRow;
  venue: string;
  reviewUrl: string | null;
}) {
  const { profile } = useAuth();
  const send = useSendWhatsApp();
  const log = useLogTouch();
  const [recording, setRecording] = useState(false);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const canAct = !!profile && (canAddLeads(profile.role) || canRecordPayments(profile.role));

  const ask = () => {
    const body = feedbackRequestText({
      guestName: r.guest_name,
      venue,
      eventType: r.event_type,
      reviewUrl,
    });
    openInWhatsApp(r.phone_e164, body);
    send.mutate({
      guest: {
        id: r.guest_id,
        full_name: r.guest_name,
        phone_e164: r.phone_e164,
        whatsapp_opt_in: true,
      },
      body,
    });
    log.mutate({ booking_id: r.booking_id, kind: 'feedback_request' });
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    log.mutate(
      { booking_id: r.booking_id, kind: 'feedback', rating, note: note.trim() || null },
      { onSuccess: () => setRecording(false) },
    );
  };

  return (
    <Card className="flex flex-col gap-2 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/bookings/${r.booking_id}`} className="font-medium hover:underline">
            {r.guest_name ?? formatPhone(r.phone_e164)}
          </Link>
          <p className="text-sm text-muted-foreground">
            {[r.event_type, formatEventDate(r.event_date), r.space].filter(Boolean).join(' · ')}
          </p>
        </div>
        {r.rating ? (
          <Stars value={r.rating} />
        ) : (
          <Badge tone={r.asked_at ? 'blue' : 'amber'}>
            {r.asked_at ? F.asked(formatDateTime(r.asked_at)) : F.notAsked}
          </Badge>
        )}
      </div>
      {r.feedback_note && <p className="text-sm italic">“{r.feedback_note}”</p>}
      {canAct && !recording && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={r.asked_at ? 'outline' : 'default'} onClick={ask}>
            <MessageCircle className="h-4 w-4" />
            {r.asked_at ? F.askAgain : F.askFeedback}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRecording(true)}>
            <Star className="h-4 w-4" /> {F.recordFeedback}
          </Button>
        </div>
      )}
      {recording && (
        <form onSubmit={save} className="flex flex-col gap-2 border-t pt-2">
          <span className="text-sm font-medium">{F.rating}</span>
          <Stars value={rating} onPick={setRating} />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={F.feedbackNote}
            aria-label={F.feedbackNote}
            maxLength={1000}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!rating || log.isPending}>
              {F.save}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRecording(false)}>
              {t.common.cancel}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
