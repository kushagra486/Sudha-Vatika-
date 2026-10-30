// Zod schemas for writes coming from the web app or Edge Functions.
// The database enforces the same rules; these give early, friendly errors.
import { z } from 'zod';
import {
  BOOKING_STATUSES,
  LEAD_SOURCES,
  LEAD_STAGES,
  MEDIA_KINDS,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  PRICING_UNITS,
  ROLES,
  SHIFTS,
  TEMPLATE_CATEGORIES,
  UNIT_KINDS,
} from './enums.ts';
import { toE164 } from './phone.ts';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const money = z.coerce.number().min(0).max(9_999_999_999.99);
const count = z.coerce.number().int().min(0);

/** Accepts any reasonable phone input and outputs E.164. */
export const phoneSchema = z.string().transform((value, ctx) => {
  const e164 = toE164(value);
  if (!e164) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid phone number' });
    return z.NEVER;
  }
  return e164;
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(1),
  phone_e164: phoneSchema.optional(),
  role: z.enum(ROLES),
  outlet_id: z.string().uuid().nullable().optional(),
});

export const unitSchema = z.object({
  outlet_id: z.string().uuid(),
  name: z.string().trim().min(1),
  kind: z.enum(UNIT_KINDS).default('hall'),
  floating_capacity: count.nullable().optional(),
  seating_capacity: count.nullable().optional(),
  active: z.boolean().default(true),
});

export const guestSchema = z.object({
  full_name: z.string().trim().min(1).nullable().optional(),
  phone_e164: phoneSchema,
  email: z.string().email().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const leadSchema = z
  .object({
    outlet_id: z.string().uuid().nullable().optional(),
    guest_id: z.string().uuid(),
    source: z.enum(LEAD_SOURCES),
    stage: z.enum(LEAD_STAGES).default('new'),
    owner_id: z.string().uuid().nullable().optional(),
    event_type: z.string().trim().nullable().optional(),
    event_date: isoDate.nullable().optional(),
    guest_count: count.nullable().optional(),
    budget_min: money.nullable().optional(),
    budget_max: money.nullable().optional(),
    preferred_unit_id: z.string().uuid().nullable().optional(),
    interested_services: z.array(z.string()).default([]),
    next_follow_up_at: z.string().datetime({ offset: true }).nullable().optional(),
    lost_reason: z.string().nullable().optional(),
  })
  .refine((l) => l.budget_min == null || l.budget_max == null || l.budget_min <= l.budget_max, {
    message: 'Minimum budget cannot exceed maximum',
    path: ['budget_max'],
  })
  .refine((l) => l.stage !== 'lost' || !!l.lost_reason?.trim(), {
    message: 'Give a reason when marking a lead lost',
    path: ['lost_reason'],
  });

export const serviceSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  base_price: money.default(0),
  pricing_unit: z.enum(PRICING_UNITS).default('fixed'),
  active: z.boolean().default(true),
});

export const packageSchema = z
  .object({
    name: z.string().trim().min(1),
    description: z.string().nullable().optional(),
    price: money.default(0),
    guest_min: count.nullable().optional(),
    guest_max: count.nullable().optional(),
    active: z.boolean().default(true),
  })
  .refine((p) => p.guest_min == null || p.guest_max == null || p.guest_min <= p.guest_max, {
    message: 'Minimum guests cannot exceed maximum',
    path: ['guest_max'],
  });

export const mediaAssetSchema = z.object({
  unit_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid().nullable().optional(),
  package_id: z.string().uuid().nullable().optional(),
  kind: z.enum(MEDIA_KINDS),
  title: z.string().trim().min(1),
  storage_path: z.string().min(1),
});

export const bookingSchema = z.object({
  outlet_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  guest_id: z.string().uuid(),
  event_type: z.string().trim().nullable().optional(),
  event_date: isoDate,
  shift: z.enum(SHIFTS),
  guest_count: count.nullable().optional(),
  status: z.enum(BOOKING_STATUSES).default('tentative'),
  subtotal: money.default(0),
  discount: money.default(0),
  tax: money.default(0),
});

export const bookingItemSchema = z.object({
  booking_id: z.string().uuid(),
  service_id: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive().default(1),
  unit_price: money,
  line_discount: money.default(0),
});

export const paymentSchema = z.object({
  booking_id: z.string().uuid(),
  amount: z.coerce.number().positive().max(9_999_999_999.99),
  kind: z.enum(PAYMENT_KINDS),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().nullable().optional(),
  received_at: z.string().datetime({ offset: true }).optional(),
});

export const messageTemplateSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9_]+$/, 'Meta template names use lowercase letters, digits and underscores'),
  language: z.string().min(2).default('en'),
  category: z.enum(TEMPLATE_CATEGORIES),
  body: z.string().min(1),
  variables: z.array(z.string()).default([]),
  header_media_asset_id: z.string().uuid().nullable().optional(),
});

export type ProfileInput = z.input<typeof profileSchema>;
export type UnitInput = z.input<typeof unitSchema>;
export type GuestInput = z.input<typeof guestSchema>;
export type LeadInput = z.input<typeof leadSchema>;
export type ServiceInput = z.input<typeof serviceSchema>;
export type PackageInput = z.input<typeof packageSchema>;
export type MediaAssetInput = z.input<typeof mediaAssetSchema>;
export type BookingInput = z.input<typeof bookingSchema>;
export type BookingItemInput = z.input<typeof bookingItemSchema>;
export type PaymentInput = z.input<typeof paymentSchema>;
export type MessageTemplateInput = z.input<typeof messageTemplateSchema>;
