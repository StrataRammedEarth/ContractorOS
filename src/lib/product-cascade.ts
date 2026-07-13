import { supabase } from './supabase-client';
import type { PlumblinkMaterial } from './product-filter';

// The catalogue-backed "Add fitting" cascade reads from a narrower slice of
// plumblink_materials than the template product_filter queries: only rows with
// application, fitting_type, and unit_price_excl_vat all non-null, fitting_type
// not 'Pipe' (pipe stock has its own dedicated builders and isn't a fitting),
// and application in {Drainage, Supply, Waste / Trap} are cascade-eligible.
// Sanware (fixtures, not fittings) is excluded at the source. Waste / Trap rows
// are fetched here (shared with Drainage/Supply) but use a size-less cascade
// (matchingProductsNoSize) — see Wastes & Traps brief 1; nothing renders them
// yet (brief 2).
export async function fetchCascadeCatalogue(): Promise<PlumblinkMaterial[]> {
  const { data, error } = await supabase
    .from('plumblink_materials')
    .select('*')
    .not('application', 'is', null)
    .not('fitting_type', 'is', null)
    .not('unit_price_excl_vat', 'is', null)
    .neq('fitting_type', 'Pipe')
    .in('application', ['Drainage', 'Supply', 'Waste / Trap'])
    .returns<PlumblinkMaterial[]>();
  if (error) {
    console.error('❌ Error loading cascade catalogue:', error);
    return [];
  }
  return data ?? [];
}

// Distinct applications for the generic Application -> Fitting Type -> Size ->
// Product cascade (CatalogFittingRow). Excludes 'Waste / Trap': that family has
// no Size step (owner decision — see Wastes & Traps brief) and gets its own
// dedicated Fitting Type -> Product cascade (matchingProductsNoSize) built for
// it in a later brief, not this generic 4-step one. Keeps this brief's fetch
// unblock free of any UI-visible change ahead of that dedicated cascade landing.
export function distinctApplications(rows: PlumblinkMaterial[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.application && r.application !== 'Waste / Trap') set.add(r.application);
  return [...set].sort((a, b) => a.localeCompare(b));
}

// Drainage-only Material step (SV PVC / UG PVC), inserted ahead of Size in the
// standalone Drainage Fittings cascade. Keyed on sub_category rather than the
// `system` column: system has null gaps on 6 PVC Pressure Fittings rows that
// are SV by description but would otherwise silently drop out of the SV PVC
// bucket. sub_category has no such gaps for the two fitting sub_categories.
export type DrainageFittingMaterial = 'SV PVC' | 'UG PVC';

const SV_PVC_FITTING_SUB_CATEGORIES = ['PVC Pressure Fittings', 'PVC SV Fittings'];
const UG_PVC_FITTING_SUB_CATEGORIES = ['PVC UG Fittings'];

function matchesMaterial(row: PlumblinkMaterial, material?: DrainageFittingMaterial): boolean {
  if (!material) return true;
  const subCategories = material === 'SV PVC' ? SV_PVC_FITTING_SUB_CATEGORIES : UG_PVC_FITTING_SUB_CATEGORIES;
  return row.sub_category !== null && subCategories.includes(row.sub_category);
}

// Distinct materials available for an application — currently only meaningful
// for Drainage. Fixed SV-then-UG order (not alphabetical, which happens to
// coincide here, but the order is driven by which sub_category groups are
// actually present, not derived incidentally from string sort).
export function distinctMaterials(rows: PlumblinkMaterial[], application: string): DrainageFittingMaterial[] {
  const order: DrainageFittingMaterial[] = ['SV PVC', 'UG PVC'];
  return order.filter((material) => rows.some((r) => r.application === application && matchesMaterial(r, material)));
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
export function distinctSizes(rows: PlumblinkMaterial[], application: string, fittingType?: string, material?: DrainageFittingMaterial): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.application !== application) continue;
    if (fittingType !== undefined && r.fitting_type !== fittingType) continue;
    if (!matchesMaterial(r, material)) continue;
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
export function distinctFittingTypes(rows: PlumblinkMaterial[], application: string, size?: string, material?: DrainageFittingMaterial): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.application !== application) continue;
    if (size !== undefined && nominalSizeFor(r.size, application) !== size) continue;
    if (!matchesMaterial(r, material)) continue;
    if (r.fitting_type) set.add(r.fitting_type);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// The terminal cascade step — rows matching application + fitting type + nominal
// size, regardless of which order the two middle steps were resolved in. `size`
// is the normalised value from distinctSizes; the row's raw size goes through
// nominalSizeFor so raw variants collapse consistently.
export function matchingProducts(rows: PlumblinkMaterial[], application: string, fittingType: string, size: string, material?: DrainageFittingMaterial): PlumblinkMaterial[] {
  return rows.filter((r) => r.application === application && r.fitting_type === fittingType && nominalSizeFor(r.size, application) === size && matchesMaterial(r, material));
}

// Terminal cascade step for families with NO size dimension (Wastes & Traps).
// Matches application + fitting_type only. Size is display-only for these rows,
// never a filter — see owner decision (traps have inconsistent/null sizes).
export function matchingProductsNoSize(
  rows: PlumblinkMaterial[],
  application: string,
  fittingType: string,
): PlumblinkMaterial[] {
  return rows.filter(
    (r) => r.application === application && r.fitting_type === fittingType,
  );
}

// fixture_tags is a semicolon-delimited string, e.g. "Basin;Kitchen Sink;General".
// Returns rows whose tag list contains `tag` (case-insensitive, trimmed). A null
// `tag` (ungrouped — no linked fixture) returns rows unchanged (show-all fallback).
export function filterByFixtureTag(
  rows: PlumblinkMaterial[],
  tag: string | null,
): PlumblinkMaterial[] {
  if (!tag) return rows;
  const want = tag.trim().toLowerCase();
  return rows.filter((r) =>
    (r.fixture_tags ?? '')
      .split(';')
      .map((t) => t.trim().toLowerCase())
      .includes(want),
  );
}
