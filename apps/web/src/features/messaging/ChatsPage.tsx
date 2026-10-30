import { formatDateTime, formatEventDate, formatPhone } from '@bm/shared';
import { ArrowLeft, Phone } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/form';
import { useOrgSettings } from '@/features/bookings/api';
import { ContactButtons, StageBadge } from '@/features/leads/LeadBits';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import { ComposeBox } from './ComposeBox';
import { useConversations, useLogIncoming, useThread } from './api';

const C = t.chats;

export function ChatsPage() {
  const list = useConversations();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold sm:text-2xl">{t.nav.chats}</h1>
      <p className="text-sm text-muted-foreground">{C.hint}</p>
      {list.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : list.isError ? (
        <p className="text-sm text-destructive">{t.common.loadError}</p>
      ) : list.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{C.empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data.map((c) => (
            <li key={c.guest.id}>
              <Link to={`/chats/${c.guest.id}`}>
                <Card className="flex items-start justify-between gap-3 p-3 hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {c.guest.full_name ?? formatPhone(c.guest.phone_e164)}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {c.last.direction === 'out' ? `${C.you}: ` : ''}
                      {c.last.body ?? C.noText}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(c.last.created_at)}
                    </span>
                    {c.unanswered && <Badge tone="amber">{C.reply}</Badge>}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChatThreadPage() {
  const { guestId = '' } = useParams();
  const thread = useThread(guestId);
  const org = useOrgSettings();
  const logIn = useLogIncoming();
  const [incoming, setIncoming] = useState('');
  const [showLog, setShowLog] = useState(false);

  if (thread.isPending) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;
  if (thread.isError || !thread.data.guest)
    return <p className="text-sm text-destructive">{t.common.loadError}</p>;
  const { guest, messages, calls, openLead } = thread.data;

  const items = [
    ...messages.map((m) => ({ kind: 'msg' as const, at: m.created_at, m })),
    ...calls.map((c) => ({ kind: 'call' as const, at: c.started_at ?? '', c })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        to="/chats"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t.nav.chats}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {guest.full_name ?? formatPhone(guest.phone_e164)}
          </h1>
          <p className="text-sm text-muted-foreground">{formatPhone(guest.phone_e164)}</p>
          {openLead && (
            <Link
              to={`/leads/${openLead.id}`}
              className="mt-1 inline-flex items-center gap-2 text-sm text-primary"
            >
              <StageBadge stage={openLead.stage} />
              {openLead.event_type ?? C.lead}
              {openLead.event_date ? ` · ${formatEventDate(openLead.event_date)}` : ''}
            </Link>
          )}
        </div>
        <ContactButtons
          phone={guest.phone_e164}
          whatsappAllowed={guest.whatsapp_opt_in}
          size="sm"
        />
      </div>

      <Card className="flex flex-col gap-2 p-3">
        {items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{C.noMessages}</p>
        )}
        {items.map((it) =>
          it.kind === 'call' ? (
            <div
              key={it.c.id}
              className="mx-auto flex max-w-[90%] flex-col items-center gap-1 rounded-md bg-muted px-3 py-2 text-xs"
            >
              <span className="flex items-center gap-1 font-medium">
                <Phone className="h-3 w-3" />{' '}
                {C.call(it.c.direction === 'outbound', it.c.duration_sec ?? 0)} ·{' '}
                {it.c.started_at ? formatDateTime(it.c.started_at) : ''}
              </span>
              {it.c.ai_summary && <span className="text-muted-foreground">{it.c.ai_summary}</span>}
              {it.c.recording_url && (
                <a
                  href={it.c.recording_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  {C.recording}
                </a>
              )}
            </div>
          ) : (
            <div
              key={it.m.id}
              className={cn(
                'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                it.m.channel === 'call_note'
                  ? 'mx-auto bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50'
                  : it.m.direction === 'out'
                    ? 'ml-auto bg-emerald-100 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-50'
                    : 'mr-auto bg-muted',
              )}
            >
              {it.m.channel === 'call_note' && <p className="text-xs font-medium">{C.note}</p>}
              <p className="whitespace-pre-wrap">{it.m.body}</p>
              <p className="mt-1 text-right text-[10px] opacity-70">
                {formatDateTime(it.m.created_at)}
                {it.m.direction === 'out' && it.m.channel === 'whatsapp'
                  ? ` · ${C.statuses[it.m.status as keyof typeof C.statuses] ?? it.m.status}`
                  : ''}
              </p>
            </div>
          ),
        )}
      </Card>

      <Card className="p-3">
        <ComposeBox
          guest={guest}
          leadId={openLead?.id ?? null}
          context={{
            guest_name: guest.full_name,
            event_type: openLead?.event_type ?? null,
            event_date: openLead?.event_date ? formatEventDate(openLead.event_date) : null,
            venue: org.data?.name ?? null,
          }}
        />
      </Card>

      <div>
        <Button variant="ghost" size="sm" onClick={() => setShowLog((v) => !v)}>
          {C.logIncoming}
        </Button>
        {showLog && (
          <div className="mt-2 flex flex-col gap-2">
            <Textarea
              aria-label={C.theyWrote}
              placeholder={C.theyWrote}
              value={incoming}
              onChange={(e) => setIncoming(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              className="self-start"
              disabled={!incoming.trim() || logIn.isPending}
              onClick={() =>
                logIn.mutate(
                  { guest_id: guest.id, lead_id: openLead?.id ?? null, body: incoming.trim() },
                  { onSuccess: () => setIncoming('') },
                )
              }
            >
              {t.common.save}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
