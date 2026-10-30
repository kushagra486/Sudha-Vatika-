import { toE164 } from '@bm/shared';
import { Camera, ListPlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { AiSourceNote } from '@/features/ai/AiBadge';
import { t } from '@/i18n';
import { cn } from '@/lib/utils';
import {
  NeedsAiError,
  photoToDataUrl,
  useAddListCustomers,
  useReadList,
  type ListImportResult,
  type ListRow,
} from './list';

const L = t.customerList;

/** Type, paste or photograph a list of customers; review; add as enquiries. */
export function ListImportCard() {
  const read = useReadList();
  const add = useAddListCustomers();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [rows, setRows] = useState<ListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ListImportResult | null>(null);

  const onRead = async (input: { text?: string; image?: string }) => {
    setError(null);
    setDone(null);
    try {
      const r = await read.mutateAsync(input);
      if (!r.customers.length) return setError(L.noneFound);
      setRows(r.customers.map((c) => ({ ...c, include: true })));
    } catch (e) {
      setError(e instanceof NeedsAiError ? L.needsAi : L.readError);
    }
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      await onRead({ image: await photoToDataUrl(file), text: text.trim() || undefined });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const setRow = (i: number, patch: Partial<ListRow>) =>
    setRows((cur) => cur!.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const ready = (rows ?? []).filter((r) => r.include && r.phone && toE164(r.phone));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{L.title}</CardTitle>
        <CardDescription>{L.hint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!rows ? (
          <>
            <Textarea
              aria-label={L.textLabel}
              rows={5}
              placeholder={L.placeholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!text.trim() || read.isPending}
                onClick={() => void onRead({ text: text.trim() })}
              >
                <ListPlus className="h-4 w-4" /> {read.isPending ? L.reading : L.readText}
              </Button>
              <input
                ref={fileRef}
                id="list-photo"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => void onPhoto(e.target.files?.[0])}
              />
              <Button asChild variant="outline" disabled={read.isPending}>
                <label htmlFor="list-photo" className="cursor-pointer">
                  <Camera className="h-4 w-4" /> {L.photo}
                </label>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{L.photoHint}</p>
          </>
        ) : (
          <>
            {read.data && <AiSourceNote source={read.data.source} />}
            <ul className="flex flex-col gap-3">
              {rows.map((r, i) => {
                const phoneOk = !!(r.phone && toE164(r.phone));
                return (
                  <li key={i} className={cn('rounded-md border p-3', !r.include && 'opacity-50')}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={r.include}
                          onChange={(e) => setRow(i, { include: e.target.checked })}
                        />
                        {L.add}
                      </label>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={L.remove}
                        onClick={() => setRows((cur) => cur!.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        aria-label={t.bookings.form.name}
                        placeholder={t.bookings.form.name}
                        value={r.full_name ?? ''}
                        onChange={(e) => setRow(i, { full_name: e.target.value || null })}
                      />
                      <Input
                        aria-label={t.bookings.form.phone}
                        aria-invalid={!phoneOk}
                        placeholder={t.bookings.form.phone}
                        inputMode="tel"
                        className={cn(!phoneOk && 'border-destructive')}
                        value={r.phone ?? ''}
                        onChange={(e) => setRow(i, { phone: e.target.value || null })}
                      />
                      <Input
                        aria-label={t.leads.quickAdd.eventType}
                        placeholder={t.leads.quickAdd.eventType}
                        value={r.event_type ?? ''}
                        onChange={(e) => setRow(i, { event_type: e.target.value || null })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          aria-label={t.leads.quickAdd.eventDate}
                          type="date"
                          value={r.event_date ?? ''}
                          onChange={(e) => setRow(i, { event_date: e.target.value || null })}
                        />
                        <Input
                          aria-label={t.leads.quickAdd.guestCount}
                          placeholder={t.leads.quickAdd.guestCount}
                          inputMode="numeric"
                          value={r.guest_count ?? ''}
                          onChange={(e) =>
                            setRow(i, {
                              guest_count: e.target.value ? Number(e.target.value) || null : null,
                            })
                          }
                        />
                      </div>
                    </div>
                    <Textarea
                      aria-label={L.notes}
                      placeholder={L.notes}
                      rows={2}
                      className="mt-2"
                      value={r.notes ?? ''}
                      onChange={(e) => setRow(i, { notes: e.target.value || null })}
                    />
                    {!phoneOk && <p className="mt-1 text-xs text-destructive">{L.fixPhone}</p>}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!ready.length || add.isPending}
                onClick={() =>
                  add.mutate(rows, {
                    onSuccess: (res) => {
                      setDone(res);
                      setRows(null);
                      setText('');
                    },
                    onError: () => setError(t.common.saveError),
                  })
                }
              >
                {add.isPending ? t.common.saving : L.addAll(ready.length)}
              </Button>
              <Button variant="ghost" onClick={() => setRows(null)} disabled={add.isPending}>
                {t.common.cancel}
              </Button>
            </div>
          </>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="text-sm" role="status">
            {L.done(done)}{' '}
            <Link
              to="/leads"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {L.openLeads}
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
