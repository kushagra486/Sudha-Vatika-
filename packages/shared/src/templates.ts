// WhatsApp templates use numbered placeholders ({{1}}, {{2}}…), as Meta
// requires. Each template stores which field fills each number.

export const TEMPLATE_FIELDS = [
  'guest_name',
  'event_date',
  'event_type',
  'space',
  'venue',
  'total',
  'advance',
  'link',
] as const;
export type TemplateField = (typeof TEMPLATE_FIELDS)[number];

/** Highest placeholder number used in a body ("{{1}} … {{3}}" → 3). */
export function placeholderCount(body: string): number {
  let max = 0;
  for (const m of body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}

/** Replaces {{n}} with values[n-1]; missing values become an empty string. */
export function fillTemplate(body: string, values: readonly (string | null | undefined)[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n: string) => values[Number(n) - 1] ?? '');
}

/** Values for a template from what we know about the guest and event. */
export function templateValues(
  fields: readonly string[],
  context: Partial<Record<TemplateField, string | null>>,
): string[] {
  return fields.map((f) => context[f as TemplateField] ?? '');
}

/** Meta template names: lowercase letters, digits and underscores. */
export function toTemplateName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}
