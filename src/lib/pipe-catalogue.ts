import { supabase } from './supabase-client';
import type { PlumblinkMaterial } from './product-filter';
import { nominalDiameter } from './product-cascade';

// Live-fetched drainage pipe rows (SV PVC / UG PVC), replacing the old
// hardcoded fake-merged "PVC" PIPE_LOOKUP rows. Solid and slotted pipe are NOT
// split into separate materials — both sub_categories below feed into the same
// two buckets, disambiguated by description/code in the Product step
// (multiple products can share a diameter, e.g. UG 110mm's two duty grades).
export type DrainagePipeMaterial = 'SV PVC' | 'UG PVC';

export interface DrainagePipeRow {
  code: string;
  type: DrainagePipeMaterial;
  diameter: number;
  use: 'drainage';
  packLength: number;
  packPrice: number;
  perMetre: number;
  grade: string;
  source: string;
  description: string;
}

// SV PVC = PVC SV Pipes (solid) + PVC Drainage rows tagged Soil & Vent (slotted).
// UG PVC = PVC UG Pipes (solid) + PVC Drainage rows tagged Underground Drainage.
// Rows with system IS NULL are excluded from both buckets — not backfilled here
// (tracked as a separate future data-cleanup brief).
function materialFor(row: PlumblinkMaterial): DrainagePipeMaterial | null {
  if (row.system === null) return null;
  if (row.sub_category === 'PVC SV Pipes') return 'SV PVC';
  if (row.sub_category === 'PVC UG Pipes') return 'UG PVC';
  if (row.sub_category === 'PVC Drainage') {
    if (row.system === 'Soil & Vent') return 'SV PVC';
    if (row.system === 'Underground Drainage') return 'UG PVC';
  }
  return null;
}

// Pack length (metres) a pipe's unit_price_excl_vat actually buys. Most rows
// carry it directly in `unit` ("6m"); the one roll-packaged row (HDPE, 50m)
// only carries it in the size string ("110x50m") since `unit` is just "roll".
function parsePackLength(unit: string | null, size: string | null): number {
  const fromUnit = unit?.match(/^(\d+(?:\.\d+)?)m$/i);
  if (fromUnit) return parseFloat(fromUnit[1]);
  const fromSize = size?.match(/x(\d+(?:\.\d+)?)m$/i);
  if (fromSize) return parseFloat(fromSize[1]);
  return 1;
}

export async function fetchDrainagePipeCatalogue(): Promise<DrainagePipeRow[]> {
  const { data, error } = await supabase
    .from('plumblink_materials')
    .select('*')
    .eq('fitting_type', 'Pipe')
    .eq('application', 'Drainage')
    .in('sub_category', ['PVC SV Pipes', 'PVC UG Pipes', 'PVC Drainage'])
    .not('system', 'is', null)
    .not('unit_price_excl_vat', 'is', null)
    .returns<PlumblinkMaterial[]>();
  if (error) {
    console.error('❌ Error loading drainage pipe catalogue:', error);
    return [];
  }

  const rows: DrainagePipeRow[] = [];
  for (const r of data ?? []) {
    const material = materialFor(r);
    if (!material) continue;
    const diameterStr = nominalDiameter(r.size);
    if (!diameterStr) continue;
    const packLength = parsePackLength(r.unit, r.size);
    const packPrice = r.unit_price_excl_vat ?? 0;
    rows.push({
      code: r.material_code,
      type: material,
      diameter: parseInt(diameterStr, 10),
      use: 'drainage',
      packLength,
      packPrice,
      perMetre: packLength > 0 ? packPrice / packLength : 0,
      grade: 'Sourced',
      source: 'Plumblink',
      description: r.description ?? '',
    });
  }
  return rows;
}
