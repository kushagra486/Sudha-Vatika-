// Mirrors the Postgres enums and check constraints in supabase/migrations.
// Keep both in sync: a mismatch shows up as a failing test in enums.test.ts.

export const ROLES = ['owner', 'manager', 'sales', 'ops', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const UNIT_KINDS = [
  'hall',
  'lawn',
  'room',
  'other',
  'pandaal',
  'pool',
  'restaurant',
  'dormitory',
] as const;
export type UnitKind = (typeof UNIT_KINDS)[number];

export const SHIFTS = ['full_day', 'breakfast', 'lunch', 'high_tea', 'dinner'] as const;
export type Shift = (typeof SHIFTS)[number];

export const LEAD_SOURCES = ['call', 'whatsapp', 'web', 'walk_in', 'manual'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STAGES = [
  'new',
  'contacted',
  'follow_up',
  'proposal_sent',
  'booked',
  'lost',
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

/** Stages where a lead still needs attention. */
export const OPEN_LEAD_STAGES = [
  'new',
  'contacted',
  'follow_up',
  'proposal_sent',
] as const satisfies readonly LeadStage[];

export const PRICING_UNITS = ['fixed', 'per_guest', 'per_day'] as const;
export type PricingUnit = (typeof PRICING_UNITS)[number];

export const MEDIA_KINDS = ['photo', 'video', 'pdf'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const BOOKING_STATUSES = ['tentative', 'confirmed', 'cancelled', 'completed'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that hold a slot in the inventory calendar. */
export const LIVE_BOOKING_STATUSES = [
  'tentative',
  'confirmed',
] as const satisfies readonly BookingStatus[];

export const PAYMENT_KINDS = ['advance', 'part', 'final', 'refund'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank', 'gateway', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MESSAGE_CHANNELS = ['whatsapp', 'sms', 'call_note'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const MESSAGE_DIRECTIONS = ['in', 'out'] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const MESSAGE_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
  'received',
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const TEMPLATE_CATEGORIES = ['marketing', 'utility', 'authentication'] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_META_STATUSES = ['draft', 'pending', 'approved', 'rejected'] as const;
export type TemplateMetaStatus = (typeof TEMPLATE_META_STATUSES)[number];

export const CAMPAIGN_STATUSES = ['draft', 'ready', 'running', 'done', 'cancelled'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const AUTOMATION_JOB_KINDS = [
  'send_template',
  'send_media',
  'follow_up_reminder',
  'campaign_send',
] as const;
export type AutomationJobKind = (typeof AUTOMATION_JOB_KINDS)[number];

export const AUTOMATION_JOB_STATUSES = [
  'pending',
  'running',
  'done',
  'failed',
  'cancelled',
] as const;
export type AutomationJobStatus = (typeof AUTOMATION_JOB_STATUSES)[number];

export const UPSELL_STATUSES = ['suggested', 'sent', 'accepted', 'declined'] as const;
export type UpsellStatus = (typeof UPSELL_STATUSES)[number];

/** Roles that can see every lead in the org, not just their own. */
export const ALL_LEADS_ROLES = ['owner', 'manager'] as const satisfies readonly Role[];
