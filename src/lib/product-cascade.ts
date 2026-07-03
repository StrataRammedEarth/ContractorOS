import { supabase } from './supabase-client';
import type { PlumblinkMaterial } from './product-filter';

// The catalogue-backed "Add fitting" cascade reads from a narrower slice of
// plumblink_materials than the template product_filter queries: only rows with
// application, fitting_type, and unit_price_excl_vat all non-null, fitting_type
// not 'Pipe' (pipe stock has its own dedicated builders and isn't a fitting),
// and application in {Drainage, Supply} are cascade-eligible. Sanware (fixtures,
// not fittings) and Waste / Trap (deferred) are excluded at the source, so both
// the fixture-template cascade and the standalone Supply/Drainage sections see a
// clean, fitting-only slice.
export async function fetchCascadeCatalogue(): Promise<PlumblinkMaterial[]> {
  const { data, error } = await supabase
    .from('plumblink_materials')
    .select('*')
    .not('application', 'is', null)
    .not('fitting_type', 'is', null)
    .not('unit_price_excl_vat', 'is', null)
    .neq('fitting_type', 'Pipe')
    .in('application', ['Drainage', 'Supply'])
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
// The canonical rule for Drainage (and any non-Supply application).
export function nominalDiameter(size: string | null): string | null {
  if (!size) return null;
  const m = size.match(/^(\d+)/);
  return m ? `${m[1]}mm` : null;
}

// Nominal size for Supply/compression fittings: the first mm-denominated
// dimension. Skips any leading inch/fraction (e.g. "3/4") and picks the number
// understood as mm, including bare compound dimensions like "22x15x15" (no unit)
// which are mm by convention in this catalogue's Supply section.
// "22x15mm"    -> "22mm"
// "3/4x15mm"   -> "15mm"   (skips the inch component)
// "15x1/2\""   -> "15mm"
// "22x22x1/2"  -> "22mm"
// "22x15x15"   -> "22mm"
// "400kPa"     -> null     (pressure rating, not a dimension — row excluded)
export function supplyNominalSize(size: string | null): string | null {
  if (!size) return null;
  // Reject bare pressure ratings (e.g. "400kPa") outright — no bare-mm fallback
  // for tokens carrying a non-length unit.
  if (/kpa/i.test(size)) return null;
  const stripped = size.replace(/^\d+\/\d+"?x/i, ''); // drop a leading "3/4x" style inch prefix
  const m = stripped.match(/^(\d+)/);
  return m ? `${m[1]}mm` : null;
}

// Size normalisation is application-dependent: Supply mixes mm and inch/BSP
// values in either order and needs supplyNominalSize; everything else (Drainage)
// uses the simpler leading-integer nominalDiameter.
export function nominalSizeFor(size: string | null, application: string): string | null {
  return application === 'Supply' ? supplyNominalSize(size) : nominalDiameter(size);
}

// Distinct nominal sizes for an application, optionally narrowed to a single
// fitting type (for the App -> Fitting Type -> Size fixture cascade). Never
// surfaces a null/"—" entry — a row whose size doesn't normalise to a dimension
// (bare pressure rating, null) is simply unreachable via the cascade. Sorted
// numerically by the leading integer, not lexically — string sort would put
// "110mm" before "40mm".
export function distinctSizes(rows: PlumblinkMaterial[], application: string, fittingType?: string): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.application !== application) continue;
    if (fittingType !== undefined && r.fitting_type !== fittingType) continue;
    const d = nominalSizeFor(r.size, application);
    if (d !== null) set.add(d);
  }
  return [...set].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

// Distinct fitting types for an application, optionally narrowed to a single
// nominal size (for the Size -> Fitting Type standalone cascade). When `size` is
// omitted, returns every fitting type for the application (the App -> Fitting
// Type fixture cascade). Both sides normalise through nominalSizeFor so raw
// case-duplicates (110x45/110X45) collapse into the same bucket automatically.
export function distinctFittingTypes(rows: PlumblinkMaterial[], application: string, size?: string): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.application !== application) continue;
    if (size !== undefined && nominalSizeFor(r.size, application) !== size) continue;
    if (r.fitting_type) set.add(r.fitting_type);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// The terminal cascade step — rows matching application + fitting type + nominal
// size, regardless of which order the two middle steps were resolved in. `size`
// is the normalised value from distinctSizes; the row's raw size goes through
// nominalSizeFor so raw variants collapse consistently.
export function matchingProducts(rows: PlumblinkMaterial[], application: string, fittingType: string, size: string): PlumblinkMaterial[] {
  return rows.filter((r) => r.application === application && r.fitting_type === fittingType && nominalSizeFor(r.size, application) === size);
}
