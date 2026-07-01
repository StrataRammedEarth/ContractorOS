import { supabase } from './supabase-client';
import type { PlumblinkMaterial } from './product-filter';

// The catalogue-backed "Add fitting" cascade (Application → Size → Fitting
// Type → Product) reads from a narrower slice of plumblink_materials than the
// template product_filter queries: only rows with application, fitting_type,
// and unit_price_excl_vat all non-null are cascade-eligible (~197 of 403 rows
// live). The rest — geyser spares, compression fittings already served by the
// General Fittings builder, pipe & fixtures, and a handful of untagged
// valves/PVC-pressure rows — are unreachable via this cascade by design.
export async function fetchCascadeCatalogue(): Promise<PlumblinkMaterial[]> {
  const { data, error } = await supabase
    .from('plumblink_materials')
    .select('*')
    .not('application', 'is', null)
    .not('fitting_type', 'is', null)
    .not('unit_price_excl_vat', 'is', null)
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

// Surfaces a `null` entry (rendered by the caller as "—") whenever any
// cascade-eligible row for this application has no size — sizes are raw,
// un-normalised supplier text, sorted naturally rather than alphabetically.
export function distinctSizes(rows: PlumblinkMaterial[], application: string): (string | null)[] {
  const set = new Set<string | null>();
  for (const r of rows) if (r.application === application) set.add(r.size);
  return [...set].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });
}

export function distinctFittingTypes(rows: PlumblinkMaterial[], application: string, size: string | null): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.application === application && r.size === size && r.fitting_type) set.add(r.fitting_type);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function matchingProducts(rows: PlumblinkMaterial[], application: string, size: string | null, fittingType: string): PlumblinkMaterial[] {
  return rows.filter((r) => r.application === application && r.size === size && r.fitting_type === fittingType);
}
