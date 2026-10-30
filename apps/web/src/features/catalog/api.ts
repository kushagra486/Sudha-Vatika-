import type { PricingUnit } from '@bm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';

export interface Category {
  id: string;
  name: string;
  active: boolean;
}

export interface Service {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  base_price: number;
  pricing_unit: PricingUnit;
  active: boolean;
}

export interface PackageItem {
  service_id: string;
  quantity: number;
}

export interface Pkg {
  id: string;
  name: string;
  description: string | null;
  price: number;
  guest_min: number | null;
  guest_max: number | null;
  active: boolean;
  items: PackageItem[];
}

export const catalogKeys = {
  all: ['catalog'] as const,
  categories: ['catalog', 'categories'] as const,
  services: ['catalog', 'services'] as const,
  packages: ['catalog', 'packages'] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('service_categories')
        .select('id, name, active')
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
  });
}

export function useServices() {
  return useQuery({
    queryKey: catalogKeys.services,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('services')
        .select('id, category_id, name, description, base_price, pricing_unit, active')
        .order('name');
      if (error) throw error;
      return (data as Service[]).map((s) => ({ ...s, base_price: Number(s.base_price) }));
    },
  });
}

export function usePackages() {
  return useQuery({
    queryKey: catalogKeys.packages,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('packages')
        .select(
          'id, name, description, price, guest_min, guest_max, active, items:package_services(service_id, quantity)',
        )
        .order('price');
      if (error) throw error;
      return (data as unknown as Pkg[]).map((p) => ({ ...p, price: Number(p.price) }));
    },
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: catalogKeys.all });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await requireSupabase().from('service_categories').insert({ name });
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export type ServiceInput = Omit<Service, 'id'> & { id?: string };

export function useSaveService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...row }: ServiceInput) => {
      const sb = requireSupabase();
      const { error } = id
        ? await sb.from('services').update(row).eq('id', id)
        : await sb.from('services').insert(row);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

export type PackageInput = Omit<Pkg, 'id'> & { id?: string };

/** Saves the package row, then replaces its service list. */
export function useSavePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, items, ...row }: PackageInput) => {
      const sb = requireSupabase();
      let pkgId = id;
      if (id) {
        const { error } = await sb.from('packages').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from('packages').insert(row).select('id').single();
        if (error) throw error;
        pkgId = data.id as string;
      }
      const del = await sb.from('package_services').delete().eq('package_id', pkgId!);
      if (del.error) throw del.error;
      if (items.length) {
        const ins = await sb.from('package_services').insert(
          items.map((i) => ({
            package_id: pkgId,
            service_id: i.service_id,
            quantity: i.quantity,
          })),
        );
        if (ins.error) throw ins.error;
      }
      return pkgId!;
    },
    onSuccess: () => invalidate(qc),
  });
}

/** What the services in a package would cost if sold separately, for one guest count. */
export function packageListValue(
  items: PackageItem[],
  services: Service[],
  guests: number,
  days = 1,
): number {
  const byId = new Map(services.map((s) => [s.id, s]));
  return items.reduce((sum, i) => {
    const s = byId.get(i.service_id);
    if (!s) return sum;
    const mult = s.pricing_unit === 'per_guest' ? guests : s.pricing_unit === 'per_day' ? days : 1;
    return sum + s.base_price * mult * i.quantity;
  }, 0);
}

/** Line amount for a service: per-guest prices scale with the guest count. */
export function serviceLineQuantity(unit: PricingUnit, guests: number | null): number {
  return unit === 'per_guest' ? Math.max(1, guests ?? 1) : 1;
}
