/**
 * src/lib/geyser-assembly.ts
 *
 * ContractorOS — Geyser Replacement Assembly
 *
 * A FIXED-COMPOSITION assembly (selected by size), distinct from the
 * baseline-and-scale plumbing engine. Stores TRUE COST inputs; the commercial
 * ladder in EstimatePage (applyLadder) re-applies waste/risk/contingency/margin.
 *
 * Grade ceiling: ASSUMPTION (flagged) until contractor confirms buy-prices.
 * Source evidence: Vissi Plumbing Solutions quotes (Hermanus, 2022–2026).
 *
 * Governance: never store sell-side lines as cost (would double-count margin).
 *
 * Pricing source: fetchGeyserPricing() reads live prices from Supabase
 * (plumblink_materials, builders_materials, geyser_components) — the same
 * tables that were the source of the *_FALLBACK constants below. The build
 * functions stay synchronous and pure; they take pricing as a parameter
 * instead of reading module-level constants, so callers fetch once (see
 * EstimatePage's geyserPricing state) rather than each build call awaiting
 * its own round trip. If the fetch fails or a table returns incomplete data
 * for a size/brand the code needs, fetchGeyserPricing fills the gap from the
 * *_FALLBACK constants — a geyser estimate must never silently show R0.
 */

import { supabase } from './supabase-client';

export type GeyserBrand = 'Kwikot' | 'Ariston';
export type GeyserSize = 50 | 100 | 150 | 200 | 250;
export type GeyserJobType = 'burst_replacement' | 'element_repair' | 'new_installation';
export type Grade =
  | 'Validated'
  | 'Sourced'
  | 'Derived'
  | 'Assumption'
  | 'Placeholder';

export interface CostLine {
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number; // TRUE cost, excl VAT, excl margin
  total: number;
  grade: Grade;
  // Buy-list grouping (Brief 2b) — plumblink_materials.section / builders_materials
  // .category / geyser_components.category+sub_category for the underlying live
  // catalogue row, where one exists. null when no live match is available.
  category?: string | null;
  subCategory?: string | null;
  writingMode:
    | 'Supply'
    | 'Install'
    | 'Remove & Replace'
    | 'Repair'
    | 'Service & Maintain'
    | 'Allowance';
}

export interface GeyserAssembly {
  jobType: GeyserJobType;
  size: GeyserSize;
  brand: GeyserBrand;
  lines: CostLine[];
  materialCost: number; // sum of material lines (true cost)
  labourCost: number; // true labour cost (ladder marks up)
  grade: Grade; // weakest-input cap
  flags: string[];
}

// ─── FIXED REPLACEMENT KIT (same for every size) — Sourced (Builders 2026) ─────
// VR-08 CLOSED: real Builders Warehouse price (2026-06-26, excl VAT). The geyser
// SKU already bundles TP valve + drain cock ("inc TP&DC"), so the kit covers only
// the all-in installation kit (600kPa PCV + 2× vacuum breakers) plus the drip
// tray = R867.83 Sourced (was ~R1,070 Assumption — the estimate ran ~19% high).
// Fallback only — fetchGeyserPricing() reads the live price from
// builders_materials (BLD-GK07 / BLD-GK08) and overrides unitCost below.
// category: 'Geyser Kit' is BLD-GK07/BLD-GK08's real builders_materials.category
// value, re-verified directly against Supabase 2026-07-10 (Brief 2b Step 0) —
// builders_materials has no sub_category column, so subCategory stays null.
const REPLACEMENT_KIT_FALLBACK: Omit<CostLine, 'total'>[] = [
  { code: 'BLD-GEY-KIT', description: 'Geyser installation kit (600kPa PCV + 2× vacuum breakers)', unit: 'ea', quantity: 1, unitCost: 668.70, grade: 'Sourced', category: 'Geyser Kit', subCategory: null, writingMode: 'Install' },
  { code: 'BLD-GEY-DRT', description: 'Kwikot DRT1600 drip tray', unit: 'ea', quantity: 1, unitCost: 199.13, grade: 'Sourced', category: 'Geyser Kit', subCategory: null, writingMode: 'Install' },
];

// ─── GEYSER UNIT COST BY SIZE × BRAND — Sourced (Plumblink 2026, excl VAT) ─────
// VR-07 CLOSED: real screenshot-confirmed Plumblink prices, all sizes both brands.
// Kwikot and Ariston are identical at 100/150L but diverge at 50/200/250L.
// Fallback only — fetchGeyserPricing() reads live prices from plumblink_materials
// (section='Geysers') and overrides these per size/brand cell.
const GEYSER_UNIT_COST_FALLBACK: Record<GeyserSize, Record<GeyserBrand, number>> = {
  50:  { Kwikot: 4694.78,  Ariston: 4520.87 },
  100: { Kwikot: 4173.04,  Ariston: 4173.04 },
  150: { Kwikot: 4173.04,  Ariston: 4173.04 },
  200: { Kwikot: 7086.09,  Ariston: 6694.78 },
  250: { Kwikot: 14199.13, Ariston: 13042.61 },
};
// section/sub_category for every live plumblink_materials row where
// section='Geysers' — verified uniform across all 12 rows (PLB-PL-GY01..12),
// direct query, Brief 2b Step 0 (2026-07-10). fetchGeyserPricing() re-derives
// this from the live rows it already fetches; this is the fallback only.
const GEYSER_UNIT_CATEGORY_FALLBACK = { category: 'Geysers', subCategory: 'Geysers' } as const;

// ─── LABOUR BLOCK BY SIZE — Assumption grade (crew-derived) ───────────────────
// VR-09: confirm against actual crew hours. 50L assumed same as 100L (small unit).
// Not part of this pricing swap — no Supabase table holds crew-labour costs;
// this stays hardcoded until VR-09 is resolved with real crew-hour data.
const GEYSER_LABOUR_COST: Record<GeyserSize, number> = {
  50:  1400,
  100: 1400,
  150: 1750,
  200: 1600,
  250: 1400,
};

// ─── ELEMENT REPAIR KITS — Sourced (contractor check-list, stale 2022) ────────
// Fallback only — fetchGeyserPricing() reads live prices from geyser_components
// (PLB-GEY-006/007/008) and overrides cost below.
// category/subCategory: geyser_components' real category='Geyser Component',
// sub_category='Element Kit' for all three codes, re-verified directly against
// Supabase 2026-07-10 (Brief 2b Step 0).
const ELEMENT_KITS_FALLBACK: Record<
  GeyserSize,
  { description: string; cost: number; category: string | null; subCategory: string | null } | null
> = {
  50:  null, // not in check-list — falls back to component build
  100: { description: 'Extreme element 2KW + thermostat (no flange)', cost: 700, category: 'Geyser Component', subCategory: 'Element Kit' },
  150: { description: 'Extreme element 3KW + thermostat (no flange)', cost: 720, category: 'Geyser Component', subCategory: 'Element Kit' },
  200: { description: 'Extreme element 4KW + thermostat (no flange rubber)', cost: 750, category: 'Geyser Component', subCategory: 'Element Kit' },
  250: null, // not in check-list — flag
};

// ─── ELEMENT-REPAIR FALLBACK COMPONENTS (used when ELEMENT_KITS has no kit for
// the size, i.e. 50L/250L) — Sourced (geyser_components: PLB-GEY-003/001/005).
// category='Geyser Component' for all three; subCategory per-component
// (Element/Thermostat/Flange) — re-verified directly against Supabase
// 2026-07-10 (Brief 2b Step 0).
const ELEMENT_COMPONENTS_FALLBACK = {
  element:    { cost: 400, category: 'Geyser Component' as string | null, subCategory: 'Element' as string | null },
  thermostat: { cost: 280, category: 'Geyser Component' as string | null, subCategory: 'Thermostat' as string | null },
  flange:     { cost: 100, category: 'Geyser Component' as string | null, subCategory: 'Flange' as string | null },
};

const SUPPORTED_SIZES: GeyserSize[] = [50, 100, 150, 200, 250];
const GEYSER_BRANDS: GeyserBrand[] = ['Kwikot', 'Ariston'];

// ─── NEW INSTALLATION — "New Point" connection charge — Assumption grade ──────
// Sole evidence: Vissi Plumbing Solutions quote, job 7174 "Villa Blu" (new-build
// construction site, Designer Construction, 2026-06-25) — "1 X Geyser Point
// R4,500.00" under a "New Points" heading, alongside kitchen sink/water feature
// new points billed the same way. This is Vissi's SELL price for running a new
// supply/drain/electrical connection and hanging the unit at a location with no
// existing point — NOT true cost, and NOT split into material/labour. Stored
// here as a flat labour-cost stand-in (same pattern already used for element-
// repair's flat R700/R900 sell-side rates, VR-10) rather than back-derived,
// because no true-cost breakdown of this line exists. Flagged in the assembly's
// output; caps the whole New Installation assembly at Assumption grade.
// Does not vary by size — the only real data point is a single flat quote line.
const NEW_POINT_CONNECTION_COST = 4500;

export interface GeyserPricingData {
  unitCostBySize: Record<GeyserSize, Partial<Record<GeyserBrand, number>>>;
  // Brief 2b: not size/brand-keyed — confirmed uniform across every live
  // section='Geysers' row (Step 0), so one pair covers the whole unit line.
  unitCategory: string | null;
  unitSubCategory: string | null;
  replacementKit: Omit<CostLine, 'total'>[];
  elementKits: Record<GeyserSize, { description: string; cost: number; category: string | null; subCategory: string | null } | null>;
  elementComponents: {
    element: { cost: number; category: string | null; subCategory: string | null };
    thermostat: { cost: number; category: string | null; subCategory: string | null };
    flange: { cost: number; category: string | null; subCategory: string | null };
  };
}

/**
 * Live Supabase prices for the Geyser fixed-composition engine, with a
 * per-cell fallback to the hardcoded *_FALLBACK constants above whenever a
 * query errors or a table is missing a size/brand/kit the code needs.
 */
export async function fetchGeyserPricing(): Promise<GeyserPricingData> {
  const unitCostBySize: Record<GeyserSize, Partial<Record<GeyserBrand, number>>> =
    { 50: {}, 100: {}, 150: {}, 200: {}, 250: {} };
  let unitCategory: string | null = null;
  let unitSubCategory: string | null = null;

  const { data: unitRows, error: unitsError } = await supabase
    .from('plumblink_materials')
    .select('brand, size, unit_price_excl_vat, section, sub_category')
    .eq('section', 'Geysers')
    .neq('size', '450L');
  if (unitsError) {
    console.error('❌ Error loading geyser unit prices, using fallback:', unitsError);
  }
  for (const row of unitRows ?? []) {
    const size = Number(String(row.size).replace(/L$/i, '')) as GeyserSize;
    const brand = row.brand as GeyserBrand;
    if (!SUPPORTED_SIZES.includes(size) || !GEYSER_BRANDS.includes(brand)) continue;
    if (row.unit_price_excl_vat != null) unitCostBySize[size][brand] = Number(row.unit_price_excl_vat);
    if (unitCategory === null && row.section != null) { unitCategory = row.section; unitSubCategory = row.sub_category ?? null; }
  }
  for (const size of SUPPORTED_SIZES) {
    for (const brand of GEYSER_BRANDS) {
      if (unitCostBySize[size][brand] == null) unitCostBySize[size][brand] = GEYSER_UNIT_COST_FALLBACK[size][brand];
    }
  }
  if (unitCategory === null) { unitCategory = GEYSER_UNIT_CATEGORY_FALLBACK.category; unitSubCategory = GEYSER_UNIT_CATEGORY_FALLBACK.subCategory; }

  let replacementKit = REPLACEMENT_KIT_FALLBACK;
  const { data: kitRows, error: kitError } = await supabase
    .from('builders_materials')
    .select('material_code, unit_price_excl_vat, category')
    .in('material_code', ['BLD-GK07', 'BLD-GK08']);
  if (kitError) {
    console.error('❌ Error loading geyser kit prices, using fallback:', kitError);
  } else {
    const kit = kitRows?.find(r => r.material_code === 'BLD-GK07');
    const drt = kitRows?.find(r => r.material_code === 'BLD-GK08');
    if (kit?.unit_price_excl_vat != null && drt?.unit_price_excl_vat != null) {
      const priceByCode: Record<string, number> = {
        'BLD-GEY-KIT': Number(kit.unit_price_excl_vat),
        'BLD-GEY-DRT': Number(drt.unit_price_excl_vat),
      };
      const categoryByCode: Record<string, string | null> = {
        'BLD-GEY-KIT': kit.category ?? null,
        'BLD-GEY-DRT': drt.category ?? null,
      };
      replacementKit = REPLACEMENT_KIT_FALLBACK.map(line => ({
        ...line,
        unitCost: priceByCode[line.code] ?? line.unitCost,
        category: categoryByCode[line.code] ?? line.category,
      }));
    }
  }

  const elementKits: GeyserPricingData['elementKits'] = { ...ELEMENT_KITS_FALLBACK };
  const elementComponents = { ...ELEMENT_COMPONENTS_FALLBACK };
  const { data: componentRows, error: componentsError } = await supabase
    .from('geyser_components')
    .select('material_code, unit_price_excl_vat, category, sub_category')
    .in('material_code', ['PLB-GEY-001', 'PLB-GEY-003', 'PLB-GEY-005', 'PLB-GEY-006', 'PLB-GEY-007', 'PLB-GEY-008']);
  if (componentsError) {
    console.error('❌ Error loading geyser component prices, using fallback:', componentsError);
  } else {
    const rowOf = (code: string) => componentRows?.find(r => r.material_code === code);
    const kitSizeByCode: Record<string, GeyserSize> = { 'PLB-GEY-006': 100, 'PLB-GEY-007': 150, 'PLB-GEY-008': 200 };
    for (const [code, size] of Object.entries(kitSizeByCode)) {
      const row = rowOf(code);
      const existing = elementKits[size];
      if (row?.unit_price_excl_vat != null && existing) {
        elementKits[size] = { ...existing, cost: Number(row.unit_price_excl_vat), category: row.category ?? existing.category, subCategory: row.sub_category ?? existing.subCategory };
      }
    }
    const elementRow = rowOf('PLB-GEY-003');
    const thermostatRow = rowOf('PLB-GEY-001');
    const flangeRow = rowOf('PLB-GEY-005');
    if (elementRow?.unit_price_excl_vat != null) elementComponents.element = { cost: Number(elementRow.unit_price_excl_vat), category: elementRow.category ?? elementComponents.element.category, subCategory: elementRow.sub_category ?? elementComponents.element.subCategory };
    if (thermostatRow?.unit_price_excl_vat != null) elementComponents.thermostat = { cost: Number(thermostatRow.unit_price_excl_vat), category: thermostatRow.category ?? elementComponents.thermostat.category, subCategory: thermostatRow.sub_category ?? elementComponents.thermostat.subCategory };
    if (flangeRow?.unit_price_excl_vat != null) elementComponents.flange = { cost: Number(flangeRow.unit_price_excl_vat), category: flangeRow.category ?? elementComponents.flange.category, subCategory: flangeRow.sub_category ?? elementComponents.flange.subCategory };
  }

  return { unitCostBySize, unitCategory, unitSubCategory, replacementKit, elementKits, elementComponents };
}

/**
 * Build a burst geyser replacement assembly (true-cost inputs).
 */
export function buildGeyserReplacement(
  size: GeyserSize,
  brand: GeyserBrand,
  pricing: GeyserPricingData
): GeyserAssembly {
  const flags: string[] = [];

  const unitCost = pricing.unitCostBySize[size][brand] ?? GEYSER_UNIT_COST_FALLBACK[size][brand];
  const geyserLine: CostLine = {
    code: `PLB-GEY-${size}`,
    description: `${size}L ${brand} B-rated geyser, inc TP&DC (5yr warranty)`,
    unit: 'ea',
    quantity: 1,
    unitCost,
    total: unitCost,
    grade: 'Sourced', // VR-07 CLOSED — real Plumblink 2026 price
    category: pricing.unitCategory,
    subCategory: pricing.unitSubCategory,
    writingMode: 'Remove & Replace',
  };

  const kitLines: CostLine[] = pricing.replacementKit.map((l) => ({
    ...l,
    total: l.unitCost * l.quantity,
  }));

  const lines = [geyserLine, ...kitLines];
  const materialCost = lines.reduce((s, l) => s + l.total, 0);
  const labourCost = GEYSER_LABOUR_COST[size];

  flags.push('Labour block crew-derived — confirm vs actual crew hours [VR-09]');
  if (size === 150) flags.push('150L sell sits ~18% under Vissi 2024 market quote — inputs confirmed, so gap is margin or labour, not data [VR-11]');

  return {
    jobType: 'burst_replacement',
    size,
    brand,
    lines,
    materialCost,
    labourCost,
    // Unit (VR-07) and kit (VR-08) both Sourced -> assembly is Sourced end-to-end
    // and client-issuable through the normal gate. Labour stays crew-derived but,
    // per owner decision, does not cap the grade (flagged for confirmation, VR-09).
    grade: 'Sourced',
    flags,
  };
}

/**
 * Build a New Installation assembly (fixed-composition, size × brand-driven,
 * same pattern as burst replacement). Reuses the same real unit + kit pricing
 * as buildGeyserReplacement — a new install still buys the same physical
 * geyser and installation kit. The one thing that differs is labour: instead
 * of the swap-only crew block (GEYSER_LABOUR_COST), a new install's labour is
 * the flat New Point connection charge (NEW_POINT_CONNECTION_COST) — see that
 * constant's comment for sourcing. That single sell-side data point caps the
 * whole assembly at Assumption grade, unlike burst replacement's Sourced.
 */
export function buildNewInstallation(
  size: GeyserSize,
  brand: GeyserBrand,
  pricing: GeyserPricingData
): GeyserAssembly {
  const flags: string[] = [];

  const unitCost = pricing.unitCostBySize[size][brand] ?? GEYSER_UNIT_COST_FALLBACK[size][brand];
  const geyserLine: CostLine = {
    code: `PLB-GEY-${size}`,
    description: `${size}L ${brand} B-rated geyser, inc TP&DC (5yr warranty)`,
    unit: 'ea',
    quantity: 1,
    unitCost,
    total: unitCost,
    grade: 'Sourced', // VR-07 CLOSED — real Plumblink 2026 price (same as burst replacement)
    category: pricing.unitCategory,
    subCategory: pricing.unitSubCategory,
    writingMode: 'Install',
  };

  const kitLines: CostLine[] = pricing.replacementKit.map((l) => ({
    ...l,
    total: l.unitCost * l.quantity,
  }));

  const lines = [geyserLine, ...kitLines];
  const materialCost = lines.reduce((s, l) => s + l.total, 0);
  const labourCost = NEW_POINT_CONNECTION_COST;

  flags.push('New Point connection labour (R4,500) is a single sell-side quote line (job 7174, Villa Blu new-build, 2026-06-25), not a true-cost breakdown — Assumption grade, does not vary by size, pending contractor confirmation of true labour/material cost for a new connection');
  flags.push('Not client-issuable until New Point cost is confirmed and re-graded');

  return {
    jobType: 'new_installation',
    size,
    brand,
    lines,
    materialCost,
    labourCost,
    // Unit/kit are Sourced, but the New Point labour line is a raw sell-side
    // figure standing in for cost (weakest-input cap, same VR rule as Doc 03) —
    // caps the whole assembly at Assumption until true-cost data replaces it.
    grade: 'Assumption',
    flags,
  };
}

/**
 * Build an element / thermostat repair assembly.
 * NOTE: contractor prices repairs flat (R700/1hr, R900/2hr sell-side).
 * Owner decision pending (VR-10): run through ladder vs fixed-price catalogue.
 * This returns true-cost lines; if fixed-price is chosen, bypass the ladder.
 */
export function buildElementRepair(
  size: GeyserSize,
  solar: boolean,
  pricing: GeyserPricingData
): GeyserAssembly {
  const flags: string[] = [];
  const lines: CostLine[] = [];

  const kit = pricing.elementKits[size];
  if (kit) {
    lines.push({
      code: `PLB-GEY-EK-${size}`,
      description: kit.description,
      unit: 'ea',
      quantity: 1,
      unitCost: kit.cost,
      total: kit.cost,
      grade: 'Sourced',
      category: kit.category,
      subCategory: kit.subCategory,
      writingMode: 'Repair',
    });
  } else {
    // fall back to component build
    lines.push(
      { code: 'PLB-GEY-003', description: 'Geyser element (standard)', unit: 'ea', quantity: 1, unitCost: pricing.elementComponents.element.cost, total: pricing.elementComponents.element.cost, grade: 'Sourced', category: pricing.elementComponents.element.category, subCategory: pricing.elementComponents.element.subCategory, writingMode: 'Repair' },
      { code: 'PLB-GEY-001', description: 'Thermostat (standard)', unit: 'ea', quantity: 1, unitCost: pricing.elementComponents.thermostat.cost, total: pricing.elementComponents.thermostat.cost, grade: 'Sourced', category: pricing.elementComponents.thermostat.category, subCategory: pricing.elementComponents.thermostat.subCategory, writingMode: 'Repair' }
    );
    flags.push(`No element kit listed for ${size}L — built from components`);
  }

  // Flange rubber — skipped for solar (contractor rule) and for kits that exclude it
  if (!solar && !kit) {
    lines.push({ code: 'PLB-GEY-005', description: 'Flange rubber', unit: 'ea', quantity: 1, unitCost: pricing.elementComponents.flange.cost, total: pricing.elementComponents.flange.cost, grade: 'Sourced', category: pricing.elementComponents.flange.category, subCategory: pricing.elementComponents.flange.subCategory, writingMode: 'Repair' });
  }
  if (solar) flags.push('Solar geyser — thermostat not replaced (contractor rule)');

  const materialCost = lines.reduce((s, l) => s + l.total, 0);
  // Labour: contractor flat rule, 1hr=R700 / 2hr=R900 (sell-side). Stored as cost reference.
  const labourCost = size >= 200 ? 900 : 700;

  flags.push('Element-repair prices are stale (2022) — reverify');
  flags.push('Labour figures are contractor flat-rate (sell-side) — see VR-10 pricing-convention decision');

  return {
    jobType: 'element_repair',
    size,
    brand: 'Kwikot',
    lines,
    materialCost,
    labourCost,
    grade: 'Sourced',
    flags,
  };
}

/**
 * Apply the ContractorOS commercial ladder to an assembly.
 * Mirrors EstimatePage applyLadder — waste(material) → risk → contingency → margin.
 * NOTE: EstimatePage owns the canonical ladder; this is a reference implementation
 * kept in sync. Both produce identical results (verified: 150L Kwikot burst = R10,168
 * sell excl VAT with real Plumblink unit R4,173 + real Builders kit R868 + R1,750 labour).
 */
export function applyLadder(materialCost: number, labourCost: number) {
  const prime = materialCost + labourCost;
  const direct = prime + materialCost * 0.05; // waste on material only
  const afterRisk = direct * 1.05;
  const afterCont = afterRisk * 1.1;
  const sell = afterCont * 1.25;
  return {
    prime,
    waste: materialCost * 0.05,
    direct,
    afterRisk,
    afterCont,
    margin: afterCont * 0.25,
    sell: Math.round(sell * 100) / 100,
  };
}
