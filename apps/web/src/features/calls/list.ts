import { istAt, OPEN_LEAD_STAGES, toE164, type AiSource, type ListedCustomer } from '@bm/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';

export interface ListRow extends ListedCustomer {
  include: boolean;
}

/** Shrinks a photo to a JPEG data URL small enough to send (long side 1600px). */
export async function photoToDataUrl(file: Blob, maxSide = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

export class NeedsAiError extends Error {}

export function useReadList() {
  return useMutation({
    mutationFn: async (input: { text?: string; image?: string }) => {
      const { data, error } = await requireSupabase().functions.invoke('ai', {
        body: { action: 'extract_list', text: input.text ?? null, image: input.image ?? null },
      });
      if (error) {
        const status = (error as { context?: Response }).context?.status;
        if (status === 409) throw new NeedsAiError('needs_ai');
        throw error;
      }
      return data as { customers: ListedCustomer[]; source: AiSource };
    },
  });
}

export interface ListImportResult {
  created: number;
  updated: number;
  skipped: number;
}

/**
 * Adds each checked customer: a new enquiry, or, for a guest who already has
 * an open enquiry, a note on it with any missing details filled in.
 */
export function useAddListCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ListRow[]): Promise<ListImportResult> => {
      const sb = requireSupabase();
      const result = { created: 0, updated: 0, skipped: 0 };
      for (const r of rows) {
        const phone = r.phone ? toE164(r.phone) : null;
        if (!r.include || !phone) {
          result.skipped++;
          continue;
        }
        const note = r.notes?.trim() || null;
        const { data: guest } = await sb
          .from('guests')
          .select(
            'id, full_name, leads(id, stage, event_type, event_date, guest_count, budget_max)',
          )
          .eq('phone_e164', phone)
          .maybeSingle();
        const open = (
          (guest?.leads ?? []) as {
            id: string;
            stage: string;
            event_type: string | null;
            event_date: string | null;
            guest_count: number | null;
            budget_max: number | null;
          }[]
        ).find((l) => (OPEN_LEAD_STAGES as readonly string[]).includes(l.stage));

        if (guest && open) {
          const u = await sb
            .from('leads')
            .update({
              event_type: open.event_type ?? r.event_type,
              event_date: open.event_date ?? r.event_date,
              guest_count: open.guest_count ?? r.guest_count,
              budget_max: open.budget_max ?? r.budget_max,
            })
            .eq('id', open.id);
          if (u.error) throw u.error;
          if (note) {
            const m = await sb.from('messages').insert({
              guest_id: guest.id,
              lead_id: open.id,
              channel: 'call_note',
              direction: 'in',
              body: note,
              status: 'received',
            });
            if (m.error) throw m.error;
          }
          if (!guest.full_name && r.full_name)
            await sb.from('guests').update({ full_name: r.full_name }).eq('id', guest.id);
          result.updated++;
          continue;
        }

        const { data: leadId, error } = await sb.rpc('create_enquiry', {
          p_phone_e164: phone,
          p_full_name: r.full_name,
          p_source: 'manual',
          p_event_type: r.event_type,
          p_event_date: r.event_date,
          p_guest_count: r.guest_count,
          p_next_follow_up_at: istAt(1, 11),
          p_note: note,
        });
        if (error) throw error;
        if (r.budget_max)
          await sb
            .from('leads')
            .update({ budget_max: r.budget_max })
            .eq('id', leadId as string);
        result.created++;
      }
      return result;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leads'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['guests'] });
    },
  });
}
