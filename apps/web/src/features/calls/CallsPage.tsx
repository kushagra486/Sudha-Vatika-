import { formatDateTime, formatEventDate, formatPhone, todayIST, toE164 } from '@bm/shared';
import { ImagePlus, PhoneMissed, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, Textarea } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { StageBadge } from '@/features/leads/LeadBits';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  openLeadOf,
  useDismissCall,
  useImportCalls,
  useInbox,
  usePushCall,
  useRestoreCall,
  type DirectoryCategory,
  type ImportSummary,
  type InboxCall,
  type InboxStatus,
} from './api';
import { ListImportCard } from './ListImportCard';
import { readScreenshot } from './ocr';
import { parseRecentsWords, type RecentCall } from './recents';

const C = t.calls;
const TABS: InboxStatus[] = ['new', 'pushed', 'ignored'];

export function CallsPage() {
  const [tab, setTab] = useState<InboxStatus>('new');
  const inbox = useInbox(tab);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{t.nav.calls}</h1>
        <p className="text-sm text-muted-foreground">{C.subtitle}</p>
      </div>
      <ImportCard />
      <ListImportCard />
      <div role="tablist" className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
        {TABS.map((k) => (
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
            {C.tabs[k]}
          </button>
        ))}
      </div>
      {inbox.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : inbox.isError ? (
        <p className="text-sm text-destructive">{t.common.loadError}</p>
      ) : inbox.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{C.empty[tab]}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {inbox.data.map((c) => (
            <li key={c.id}>{tab === 'new' ? <ReviewCard call={c} /> : <DoneCard call={c} />}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- import -- */

function ImportCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const importCalls = useImportCalls();
  const [progress, setProgress] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setSummary(null);
    try {
      const today = todayIST();
      const calls: RecentCall[] = [];
      for (let i = 0; i < files.length; i++) {
        setProgress(C.reading(i + 1, files.length));
        const { words, width } = await readScreenshot(files[i]!);
        calls.push(...parseRecentsWords(words, width, today));
      }
      setProgress(C.saving);
      if (!calls.length) {
        setError(C.nothingFound);
        return;
      }
      setSummary(await importCalls.mutateAsync(calls));
    } catch {
      setError(C.importError);
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{C.importTitle}</CardTitle>
        <CardDescription>{C.importHint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          id="recents-files"
          onChange={(e) => void onFiles(e.target.files)}
        />
        <Button asChild className="self-start" disabled={!!progress}>
          <label htmlFor="recents-files" className="cursor-pointer">
            <ImagePlus className="h-4 w-4" /> {C.choose}
          </label>
        </Button>
        {progress && (
          <p className="text-sm text-muted-foreground" role="status">
            {progress}
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {summary && (
          <p className="text-sm" role="status">
            {C.summary(summary)}
          </p>
        )}
        <button
          type="button"
          className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
          aria-expanded={showHelp}
          onClick={() => setShowHelp((v) => !v)}
        >
          {C.howTitle}
        </button>
        {showHelp && (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {C.howSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------- review -- */

function Who({ call }: { call: InboxCall }) {
  const name = call.guest?.full_name ?? call.contact_name;
  return (
    <div className="min-w-0">
      <p className={cn('truncate font-medium', call.missed && 'text-red-700 dark:text-red-400')}>
        {name ?? (call.phone_e164 ? formatPhone(call.phone_e164) : '')}
        {call.repeat_count > 1 && (
          <span className="text-muted-foreground"> ({call.repeat_count})</span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {name && call.phone_e164 ? `${formatPhone(call.phone_e164)} · ` : ''}
        {call.call_at
          ? call.call_label?.includes(':')
            ? formatDateTime(call.call_at)
            : // Midnight India time is the previous day in UTC: read the date in IST.
              formatEventDate(todayIST(new Date(call.call_at)))
          : call.call_label}
      </p>
    </div>
  );
}

function ReviewCard({ call }: { call: InboxCall }) {
  const [kind, setKind] = useState<'enquiry' | 'existing' | null>(null);
  const dismiss = useDismissCall();
  const lead = openLeadOf(call);
  const isGuest = !!call.guest;

  return (
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <Who call={call} />
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {call.missed && (
            <Badge tone="red">
              <PhoneMissed className="h-3 w-3" aria-hidden /> {C.missed}
            </Badge>
          )}
          {isGuest ? (
            <Badge tone="green">{C.existingGuest}</Badge>
          ) : call.contact_name ? (
            <Badge>{C.savedContact}</Badge>
          ) : (
            <Badge tone="violet">{C.newNumber}</Badge>
          )}
        </div>
      </div>
      {lead && (
        <Link to={`/leads/${lead.id}`} className="flex items-center gap-2 text-sm text-primary">
          <StageBadge stage={lead.stage} />
          {lead.event_type ?? C.enquiry}
          {lead.event_date ? ` · ${formatEventDate(lead.event_date)}` : ''}
        </Link>
      )}

      {kind ? (
        <PushForm call={call} kind={kind} onCancel={() => setKind(null)} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setKind('enquiry')}>
              {C.isEnquiry}
            </Button>
            {isGuest && (
              <Button size="sm" variant="outline" onClick={() => setKind('existing')}>
                {C.aboutExisting}
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-xs text-muted-foreground">{C.notEnquiry}</span>
            {(['personal', 'staff', 'vendor', 'spam'] as DirectoryCategory[]).map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant="ghost"
                className="h-8 px-2"
                disabled={dismiss.isPending}
                onClick={() => dismiss.mutate({ call, category: cat })}
              >
                {C.categories[cat]}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-muted-foreground"
              disabled={dismiss.isPending}
              onClick={() => dismiss.mutate({ call, category: null })}
            >
              {C.skipOnce}
            </Button>
          </div>
          {dismiss.isError && <p className="text-sm text-destructive">{t.common.saveError}</p>}
        </>
      )}
    </Card>
  );
}

function PushForm({
  call,
  kind,
  onCancel,
}: {
  call: InboxCall;
  kind: 'enquiry' | 'existing';
  onCancel: () => void;
}) {
  const push = usePushCall();
  const [phone, setPhone] = useState(call.phone_e164 ? formatPhone(call.phone_e164) : '');
  const [name, setName] = useState(call.guest?.full_name ?? call.contact_name ?? '');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const e164 = toE164(phone);
    if (!e164) return setError(t.bookings.form.invalidPhone);
    setError(null);
    push.mutate(
      {
        call,
        phone_e164: e164,
        full_name: name.trim() || null,
        kind,
        description: description.trim(),
      },
      { onError: () => setError(t.common.saveError) },
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t.bookings.form.phone}
          htmlFor={`p-${call.id}`}
          hint={call.phone_e164 ? undefined : C.typeNumber}
        >
          <Input
            id={`p-${call.id}`}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <Field label={t.bookings.form.name} htmlFor={`n-${call.id}`}>
          <Input id={`n-${call.id}`} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
      <Field label={C.description} htmlFor={`d-${call.id}`} hint={C.descriptionHint}>
        <Textarea
          id={`d-${call.id}`}
          rows={3}
          placeholder={C.descriptionPlaceholder}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={submit} disabled={push.isPending}>
          <Send className="h-4 w-4" /> {push.isPending ? C.sending : C.send}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={push.isPending}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- done -- */

function DoneCard({ call }: { call: InboxCall }) {
  const restore = useRestoreCall();
  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <Who call={call} />
        {call.status === 'ignored' ? (
          <Badge>{C.categories[call.category as DirectoryCategory] ?? C.skipped}</Badge>
        ) : (
          <Badge tone="green">{C.sent}</Badge>
        )}
      </div>
      {call.description && <p className="text-sm text-muted-foreground">{call.description}</p>}
      <div className="flex flex-wrap gap-2">
        {call.lead_id && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/leads/${call.lead_id}`}>{C.openEnquiry}</Link>
          </Button>
        )}
        {call.status === 'ignored' && (
          <Button
            size="sm"
            variant="ghost"
            disabled={restore.isPending}
            onClick={() => restore.mutate(call)}
          >
            {C.moveBack}
          </Button>
        )}
      </div>
    </Card>
  );
}
