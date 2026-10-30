import type { Role } from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';

export interface OrgDetails {
  id: string;
  name: string;
  gst_number: string | null;
  tax_percent: number;
  min_advance: number;
  google_review_url: string | null;
  upi_id: string | null;
}

export interface OutletDetails {
  id: string;
  name: string;
  address: string | null;
}

export interface TeamMember {
  id: string;
  full_name: string;
  role: Role;
  active: boolean;
  created_at: string;
}

export function useOrgDetails() {
  return useQuery({
    queryKey: ['org', 'details'],
    queryFn: async () => {
      const sb = requireSupabase();
      const [org, outlets] = await Promise.all([
        sb
          .from('organizations')
          .select('id, name, gst_number, tax_percent, min_advance, google_review_url, upi_id')
          .single(),
        sb.from('outlets').select('id, name, address').order('created_at').limit(1),
      ]);
      if (org.error) throw org.error;
      if (outlets.error) throw outlets.error;
      return {
        org: {
          ...org.data,
          tax_percent: Number(org.data.tax_percent),
          min_advance: Number(org.data.min_advance),
        } as OrgDetails,
        outlet: (outlets.data?.[0] ?? null) as OutletDetails | null,
      };
    },
  });
}

export function useSaveVenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      org: Pick<
        OrgDetails,
        | 'id'
        | 'name'
        | 'gst_number'
        | 'tax_percent'
        | 'min_advance'
        | 'google_review_url'
        | 'upi_id'
      >;
      outlet: Pick<OutletDetails, 'id' | 'address'> | null;
    }) => {
      const sb = requireSupabase();
      const { id, ...orgPatch } = input.org;
      const r1 = await sb.from('organizations').update(orgPatch).eq('id', id);
      if (r1.error) throw r1.error;
      if (input.outlet) {
        const r2 = await sb
          .from('outlets')
          .update({ address: input.outlet.address })
          .eq('id', input.outlet.id);
        if (r2.error) throw r2.error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['org'] });
    },
  });
}

export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('profiles')
        .select('id, full_name, role, active, created_at')
        .order('created_at');
      if (error) throw error;
      return data as TeamMember[];
    },
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; role?: Role; active?: boolean }) => {
      const { error } = await requireSupabase().from('profiles').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['team'] }),
  });
}

/** Calls the manage-staff Edge Function; throws Error(code) on failure. */
async function manageStaff(body: Record<string, unknown>) {
  const { data, error } = await requireSupabase().functions.invoke('manage-staff', { body });
  if (error) {
    let code = 'generic';
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === 'function') {
      try {
        code = ((await res.json()) as { error?: string }).error ?? code;
      } catch {
        /* keep generic */
      }
    }
    throw new Error(code);
  }
  return data;
}

export function useAddMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; full_name: string; role: Role; password: string }) =>
      manageStaff({ action: 'create', ...input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['team'] }),
  });
}

export function useResetMemberPassword() {
  return useMutation({
    mutationFn: (input: { user_id: string; password: string }) =>
      manageStaff({ action: 'reset_password', ...input }),
  });
}

export function useChangeOwnPassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await requireSupabase().auth.updateUser({ password });
      if (error) throw error;
    },
  });
}
