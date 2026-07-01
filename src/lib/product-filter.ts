import { supabase } from './supabase-client';

// Grammar and field mapping per product_filter_grammar_spec.md — derived from all
// 61 real filter values in fixture_template_rows, not assumed. Do not add tolerance
// for forms not in that spec (e.g. spaced "Application = Supply") unless new live
// data actually contains them.

export type ClauseField =
  | 'Application' | 'System' | 'NominalSize' | 'FittingType'
  | 'FixtureTags' | 'IsSelectable' | 'Description';

export type Clause =
  | { field: ClauseField; op: 'equals'; value: string }
  | { field: ClauseField; op: 'contains'; value: string }
  | { field: ClauseField; op: 'in'; values: string[] };

export const MANUAL_LINE_SENTINEL = 'Manual/custom line';

// Matches the live plumblink_materials schema (verified via information_schema,
// 2026-07-01) — column names diverge from the brief's reference doc in places
// (material_code not code, unit_price_excl_vat not price, confidence not grade).
export interface PlumblinkMaterial {
  material_code: string;
  supplier_sku: string | null;
  section: string | null;
  sub_category: string | null;
  description: string | null;
  size: string | null;
  unit: string | null;
  brand: string | null;
  unit_price_excl_vat: number | null;
  price_date: string | null;
  confidence: string | null;
  source: string | null;
  status: string | null;
  notes: string | null;
  supplier_role: string;
  unit_price_incl_vat: number | null;
  fixture_tags: string | null;
  application: string | null;
  fitting_type: string | null;
  system: string | null;
}

// IsSelectable has no backing column — 61/61 live occurrences are TRUE, so it's
// treated as a no-op rather than built out for a condition that's never varied.
export const FIELD_TO_COLUMN: Record<Exclude<ClauseField, 'IsSelectable'>, string> = {
  Application: 'application',
  System: 'system',
  NominalSize: 'size',
  FittingType: 'fitting_type',
  FixtureTags: 'fixture_tags',
  Description: 'description',
};

export function isManualLine(filter: string): boolean {
  return filter.trim() === MANUAL_LINE_SENTINEL || !filter.includes('=');
}

export function parseProductFilter(filter: string): Clause[] {
  if (isManualLine(filter)) return [];

  return filter.split(';').map((raw) => {
    const clause = raw.trim();

    // Check "in" and "contains" before bare "=" — both are space-delimited
    // keywords, and checking them first avoids mis-tokenizing on a naive split.
    const inMatch = clause.match(/^(\w+)\s+in\s+(.+)$/);
    if (inMatch) {
      const [, field, valueList] = inMatch;
      return { field: field as ClauseField, op: 'in', values: valueList.split(',').map((v) => v.trim()) };
    }

    const containsMatch = clause.match(/^(\w+)\s+contains\s+(.+)$/);
    if (containsMatch) {
      const [, field, value] = containsMatch;
      return { field: field as ClauseField, op: 'contains', value: value.trim() };
    }

    const equalsMatch = clause.match(/^(\w+)=(.+)$/);
    if (equalsMatch) {
      const [, field, value] = equalsMatch;
      return { field: field as ClauseField, op: 'equals', value: value.trim() };
    }

    throw new Error(`Unparseable product_filter clause: "${clause}"`);
  });
}

export function buildQuery(clauses: Clause[]) {
  let query = supabase.from('plumblink_materials').select('*');
  for (const c of clauses) {
    if (c.field === 'IsSelectable') continue; // no-op, always true
    const column = FIELD_TO_COLUMN[c.field];
    if (c.op === 'equals') query = query.eq(column, c.value);
    if (c.op === 'contains') query = query.ilike(column, `%${c.value}%`);
    if (c.op === 'in') query = query.in(column, c.values);
  }
  return query.returns<PlumblinkMaterial[]>();
}
