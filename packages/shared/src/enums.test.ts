// Guards against the TypeScript enums drifting from the SQL migrations.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as enums from './enums.ts';

const migrationsDir = join(import.meta.dirname, '../../../supabase/migrations');
const sql = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
  .join('\n');

function quotedList(body: string): string[] {
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

function sqlEnum(name: string): string[] {
  const match = new RegExp(`create type public\\.${name} as enum \\(([^)]*)\\)`).exec(sql);
  if (!match) throw new Error(`enum ${name} not found in migrations`);
  return quotedList(match[1]!);
}

function sqlCheck(column: string): string[] {
  const match = new RegExp(
    `${column} text not null(?: default '[^']*')? check \\(${column} in \\(([^)]*)\\)`,
  ).exec(sql);
  if (!match) throw new Error(`check constraint on ${column} not found in migrations`);
  return quotedList(match[1]!);
}

describe('enums match the database', () => {
  it.each([
    ['unit_kind', enums.UNIT_KINDS],
    ['shift_code', enums.SHIFTS],
    ['lead_source', enums.LEAD_SOURCES],
    ['lead_stage', enums.LEAD_STAGES],
    ['pricing_unit', enums.PRICING_UNITS],
    ['media_kind', enums.MEDIA_KINDS],
    ['booking_status', enums.BOOKING_STATUSES],
    ['message_direction', enums.MESSAGE_DIRECTIONS],
  ])('enum %s', (name, values) => {
    expect(sqlEnum(name)).toEqual([...values]);
  });

  it.each([
    ['role', enums.ROLES],
    ['kind', enums.PAYMENT_KINDS],
    ['method', enums.PAYMENT_METHODS],
    ['channel', enums.MESSAGE_CHANNELS],
    ['category', enums.TEMPLATE_CATEGORIES],
    ['meta_status', enums.TEMPLATE_META_STATUSES],
  ])('check constraint on %s', (column, values) => {
    expect(sqlCheck(column)).toEqual([...values]);
  });
});
