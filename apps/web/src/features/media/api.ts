import type { MediaKind } from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';

export const MAX_BYTES = 16 * 1024 * 1024; // bucket limit = WhatsApp video limit

export interface MediaAsset {
  id: string;
  kind: MediaKind;
  title: string;
  storage_path: string;
  size_bytes: number | null;
  unit_id: string | null;
  service_id: string | null;
  package_id: string | null;
  created_at: string;
  url: string | null; // signed, short-lived
}

/** photo / video / pdf from a file's MIME type, or null if not allowed. */
export function kindFromMime(mime: string): MediaKind | null {
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return null;
}

/** "<org>/<kind>/<timestamp>-<safe-name>": org prefix is what storage RLS checks. */
export function storagePath(
  orgId: string,
  kind: MediaKind,
  fileName: string,
  now = Date.now(),
): string {
  const dot = fileName.lastIndexOf('.');
  const ext =
    dot > 0
      ? fileName
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : '';
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${orgId}/${kind}/${now}-${base || 'file'}${ext ? `.${ext}` : ''}`;
}

export function useMedia() {
  return useQuery({
    queryKey: ['media'],
    queryFn: async () => {
      const sb = requireSupabase();
      const { data, error } = await sb
        .from('media_assets')
        .select(
          'id, kind, title, storage_path, size_bytes, unit_id, service_id, package_id, created_at',
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data as Omit<MediaAsset, 'url'>[];
      if (!rows.length) return [] as MediaAsset[];
      const signed = await sb.storage.from('media').createSignedUrls(
        rows.map((r) => r.storage_path),
        3600,
      );
      const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
      return rows.map((r) => ({ ...r, url: urls.get(r.storage_path) ?? null }));
    },
    staleTime: 30 * 60_000, // signed URLs last an hour
  });
}

export function useUploadMedia(orgId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; title: string; unit_id?: string | null }) => {
      const kind = kindFromMime(input.file.type);
      if (!kind) throw new Error('bad_type');
      if (input.file.size > MAX_BYTES) throw new Error('too_big');
      if (!orgId) throw new Error('no_org');
      const sb = requireSupabase();
      const path = storagePath(orgId, kind, input.file.name);
      const up = await sb.storage
        .from('media')
        .upload(path, input.file, { contentType: input.file.type });
      if (up.error) throw up.error;
      const { error } = await sb.from('media_assets').insert({
        kind,
        title: input.title.trim() || input.file.name,
        storage_path: path,
        size_bytes: input.file.size,
        unit_id: input.unit_id ?? null,
      });
      if (error) {
        await sb.storage.from('media').remove([path]);
        throw error;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['media'] }),
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Pick<MediaAsset, 'id' | 'storage_path'>) => {
      const sb = requireSupabase();
      const { error } = await sb.from('media_assets').delete().eq('id', m.id);
      if (error) throw error;
      await sb.storage.from('media').remove([m.storage_path]);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['media'] }),
  });
}

/** A week-long link to send a guest (the bucket stays private). */
export async function shareLink(path: string): Promise<string> {
  const { data, error } = await requireSupabase()
    .storage.from('media')
    .createSignedUrl(path, 7 * 24 * 3600);
  if (error) throw error;
  return data.signedUrl;
}
