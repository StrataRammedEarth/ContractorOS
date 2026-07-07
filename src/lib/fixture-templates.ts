import { supabase } from './supabase-client';
import { isManualLine, parseProductFilter, buildQuery, type PlumblinkMaterial } from './product-filter';

// Matches the live schema (verified via information_schema, 2026-07-01) — column
// names here line up with claude_code_brief_fixture_templates.md exactly, unlike
// plumblink_materials which diverged from its own reference doc.

export interface FixtureTemplate {
  template_id: string;
  fixture_type: string;
  template_name: string;
  template_variant: string;
  scope: 'fixture' | 'system';
}

export interface FixtureTemplateRow {
  id: string;
  template_id: string;
  line_number: number;
  line_type: 'Suggested' | 'Optional';
  application: string;
  system: string | null;
  nominal_size: string | null;
  fitting_type: string;
  product_role: string | null;
  default_material_code: string | null;
  default_qty: number;
  include_by_default: boolean;
  allow_alternatives: boolean;
  product_filter: string;
  initial_validation_grade: 'TemplateSuggested' | 'Placeholder';
  confirmed_validation_grade: 'Sourced' | 'Assumption';
  notes: string | null;
}

export async function fetchFixtureTemplates(): Promise<FixtureTemplate[]> {
  const { data, error } = await supabase.from('fixture_templates').select('*').returns<FixtureTemplate[]>();
  if (error) {
    console.error('❌ Error loading fixture_templates:', error);
    return [];
  }
  return data ?? [];
}

export async function fetchTemplateRows(templateId: string): Promise<FixtureTemplateRow[]> {
  const { data, error } = await supabase
    .from('fixture_template_rows')
    .select('*')
    .eq('template_id', templateId)
    .order('line_number', { ascending: true })
    .returns<FixtureTemplateRow[]>();
  if (error) {
    console.error(`❌ Error loading fixture_template_rows for ${templateId}:`, error);
    return [];
  }
  return data ?? [];
}

// A template's rows never carry their own query — this runs a single row's
// product_filter against plumblink_materials to populate its Product dropdown.
// The Manual/custom line sentinel must never reach the parser: per the brief,
// that row has no queryable product at all, so this short-circuits before
// parseProductFilter/buildQuery ever run (an empty clause list would otherwise
// return the whole 403-row catalog, which is wrong, not just wasteful).
export async function fetchCandidateMaterials(row: Pick<FixtureTemplateRow, 'product_filter'>): Promise<PlumblinkMaterial[]> {
  if (isManualLine(row.product_filter)) return [];

  const clauses = parseProductFilter(row.product_filter);
  const { data, error } = await buildQuery(clauses);
  if (error) {
    console.error(`❌ Error loading candidate materials for filter "${row.product_filter}":`, error);
    return [];
  }
  return data ?? [];
}

// Some templates (currently only Geyser) seed a manual-entry row (empty
// product_filter, per isManualLine) with a real default_material_code — a
// single fixed SKU with nothing to cascade through, but its price/description
// still needs resolving on load like any other row's default. A point lookup
// by code, not a filter query — fetchCandidateMaterials short-circuits to []
// for these rows precisely because there's no filter to run.
export async function fetchMaterialByCode(materialCode: string): Promise<PlumblinkMaterial | null> {
  const { data, error } = await supabase
    .from('plumblink_materials')
    .select('*')
    .eq('material_code', materialCode)
    .returns<PlumblinkMaterial[]>();
  if (error) {
    console.error(`❌ Error loading material "${materialCode}":`, error);
    return null;
  }
  return data?.[0] ?? null;
}

export function findTemplateForFixtureType(templates: FixtureTemplate[], fixtureType: string): FixtureTemplate | undefined {
  return templates.find((t) => t.scope === 'fixture' && t.fixture_type === fixtureType);
}

export function findSystemTemplate(templates: FixtureTemplate[], fixtureType: string): FixtureTemplate | undefined {
  return templates.find((t) => t.scope === 'system' && t.fixture_type === fixtureType);
}
