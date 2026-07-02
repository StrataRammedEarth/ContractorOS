import { supabase } from './supabase-client';
import type { PlumblinkMaterial } from './product-filter';

// The catalogue-backed "Add fitting" cascade (Application → Size → Fitting
// Type → Product) reads from a narrower slice of plumblink_materials than the
// template product_filter queries: only rows with application, fitting_type,
// and unit_price_excl_vat all non-null, and fitting_type not 'Pipe' (pipe
// stock has its own dedicated builders and isn't a fitting), are
// cascade-eligible.
export async function fetchCascadeCatalogue(): Promise<PlumblinkMaterial[]> {
  const { data, error } = await supabase
    .from('plumblink_materials')
    .select('*')
    .not('application', 'is', null)
    .not('fitting_type', 'is', null)
    .not('unit_price_excl_vat', 'is', null)
    .neq('fitting_type', 'Pipe')
    .returns<PlumblinkMaterial[]>();
  if (error) {
    console.error('❌ Error loading cascade catalogue:', error);
    return [];
  }
  return data ?? [];
}

export function distinctApplications(rows: PlumblinkMaterial[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.application) set.add(r.application);
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Nominal bore/diameter = leading integer of the raw supplier size string.
// "110mm" | "110x87" | "110mm x6m" -> "110mm"; null / no-leading-digit -> null.
export function nominalDiameter(size: string | null): string | null {
  if (!size) return null;
  const m = size.match(/^(\d+)/);
  return m ? `${m[1]}mm` : null;
}

// Distinct nominal diameters for an application — never surfaces a null/"—"
// entry; a row with no leading-digit dimension (e.g. a bare pressure rating)
// is simply unreachable via the cascade. Sorted numerically by the leading
// integer, not lexically — string sort would put "110mm" before "40mm".
export function distinctSizes(rows: PlumblinkMaterial[], application: string): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.application !== application) continue;
    const d = nominalDiameter(r.size);
    if (d !== null) set.add(d);
  }
  return [...set].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

// diameter is the normalised value from distinctSizes (e.g. "110mm") — both
// sides go through nominalDiameter so raw case-duplicates (110x45/110X45)
// collapse into the same bucket automatically.
export function distinctFittingTypes(rows: PlumblinkMaterial[], application: string, diameter: string | null): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.application === application && nominalDiameter(r.size) === diameter && r.fitting_type) set.add(r.fitting_type);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function matchingProducts(rows: PlumblinkMaterial[], application: string, diameter: string | null, fittingType: string): PlumblinkMaterial[] {
  return rows.filter((r) => r.application === application && nominalDiameter(r.size) === diameter && r.fitting_type === fittingType);
}
