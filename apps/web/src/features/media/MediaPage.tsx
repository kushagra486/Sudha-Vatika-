import { FileText, Film, Share2, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/app/auth';
import { canEditCatalog } from '@/app/roles';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Select } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useSpaces } from '@/features/inventory/api';
import { t } from '@/i18n';
import {
  MAX_BYTES,
  shareLink,
  useDeleteMedia,
  useMedia,
  useUploadMedia,
  type MediaAsset,
} from './api';

const M = t.media;

export function MediaPage() {
  const { profile } = useAuth();
  const canEdit = !!profile && canEditCatalog(profile.role);
  const media = useMedia();
  const spaces = useSpaces();
  const [filter, setFilter] = useState('');
  const names = new Map((spaces.data ?? []).map((s) => [s.id, s.name]));
  const shown = (media.data ?? []).filter((m) => !filter || m.unit_id === filter);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h1 className="text-xl font-semibold sm:text-2xl">{t.nav.media}</h1>
      <p className="text-sm text-muted-foreground">{M.hint}</p>
      {canEdit && <UploadForm orgId={profile?.org_id} spaces={spaces.data ?? []} />}
      <Field label={M.filter} htmlFor="md-filter" className="max-w-xs">
        <Select id="md-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">{M.all}</option>
          {spaces.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      {media.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : media.isError ? (
        <p className="text-sm text-destructive">{t.common.loadError}</p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{M.empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((m) => (
            <MediaTile
              key={m.id}
              m={m}
              space={m.unit_id ? names.get(m.unit_id) : undefined}
              canEdit={canEdit}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaTile({ m, space, canEdit }: { m: MediaAsset; space?: string; canEdit: boolean }) {
  const del = useDeleteMedia();
  const [busy, setBusy] = useState(false);
  // Phone share sheet when available (WhatsApp, email…), else WhatsApp web.
  const share = async () => {
    setBusy(true);
    try {
      const url = await shareLink(m.storage_path);
      const text = `${m.title}\n${url}`;
      if (navigator.share) await navigator.share({ title: m.title, text: m.title, url });
      else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } catch {
      /* share sheet dismissed */
    } finally {
      setBusy(false);
    }
  };
  return (
    <li>
      <Card className="flex h-full flex-col overflow-hidden">
        <a
          href={m.url ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="block aspect-[4/3] bg-muted"
        >
          {m.kind === 'photo' && m.url ? (
            <img src={m.url} alt={m.title} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-muted-foreground">
              {m.kind === 'video' ? <Film className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
            </span>
          )}
        </a>
        <div className="flex flex-1 flex-col gap-1 p-2">
          <p className="line-clamp-2 text-sm font-medium">{m.title}</p>
          {space && <p className="text-xs text-muted-foreground">{space}</p>}
          <div className="mt-auto flex gap-1">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => void share()}
            >
              <Share2 className="h-4 w-4" /> {M.share}
            </Button>
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`${M.remove}: ${m.title}`}
                disabled={del.isPending}
                onClick={() => {
                  if (window.confirm(M.confirmRemove)) del.mutate(m);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}

function UploadForm({ orgId, spaces }: { orgId?: string; spaces: { id: string; name: string }[] }) {
  const upload = useUploadMedia(orgId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return setError(M.pickFile);
    if (file.size > MAX_BYTES) return setError(M.tooBig);
    setError(null);
    upload.mutate(
      { file, title, unit_id: unitId || null },
      {
        onSuccess: () => {
          setTitle('');
          if (fileRef.current) fileRef.current.value = '';
        },
        onError: (err) =>
          setError(
            err.message === 'bad_type'
              ? M.badType
              : err.message === 'too_big'
                ? M.tooBig
                : t.common.saveError,
          ),
      },
    );
  };

  return (
    <Card className="p-4">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[2fr_2fr_1.5fr_auto] sm:items-end">
        <Field label={M.file} htmlFor="md-file">
          <Input id="md-file" ref={fileRef} type="file" accept="image/*,video/*,application/pdf" />
        </Field>
        <Field label={M.title} htmlFor="md-title">
          <Input id="md-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={M.space} htmlFor="md-space">
          <Select id="md-space" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="">{M.general}</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" disabled={upload.isPending}>
          <Upload className="h-4 w-4" /> {upload.isPending ? M.uploading : M.upload}
        </Button>
        {error && (
          <p className="text-sm text-destructive sm:col-span-4" role="alert">
            {error}
          </p>
        )}
      </form>
    </Card>
  );
}
