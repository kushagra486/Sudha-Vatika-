import type { Role } from '@bm/shared';

// Mirrors the RLS rules in supabase/migrations/*_rls.sql (DECISIONS D7).
// The database enforces them; these only decide what the UI offers.

export const canSeeMoney = (role: Role) => ['owner', 'manager', 'ops', 'viewer'].includes(role);
export const canRecordPayments = (role: Role) => ['owner', 'manager', 'ops'].includes(role);
export const canWriteBookings = (role: Role) => ['owner', 'manager', 'ops', 'sales'].includes(role);
export const canAddLeads = (role: Role) => ['owner', 'manager', 'sales'].includes(role);
