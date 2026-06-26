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
 */

export type GeyserBrand = 'Kwikot' | 'Ariston';
export type GeyserSize = 100 | 150 | 200 | 250;
export type GeyserJobType = 'burst_replacement' | 'element_repair';
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

// ─── FIXED REPLACEMENT KIT (same for every size) — Assumption grade ───────────
// VR-08: confirm itemised buy-prices with contractor.
const REPLACEMENT_KIT: Omit<CostLine, 'total'>[] = [
  { code: 'PLB-GEY-K01', description: 'TP valve + outlet pipe', unit: 'ea', quantity: 1, unitCost: 180, grade: 'Assumption', writingMode: 'Install' },
  { code: 'PLB-GEY-K02', description: 'PRV valve + outlet pipe', unit: 'ea', quantity: 1, unitCost: 220, grade: 'Assumption', writingMode: 'Install' },
  { code: 'PLB-GEY-K03', description: 'Plastic drip tray + outlet', unit: 'ea', quantity: 1, unitCost: 260, grade: 'Assumption', writingMode: 'Install' },
  { code: 'PLB-GEY-K04', description: 'Vacuum breakers (×2)', unit: 'set', quantity: 1, unitCost: 240, grade: 'Assumption', writingMode: 'Install' },
  { code: 'PLB-GEY-K05', description: 'Copper / connectors / consumables', unit: 'lot', quantity: 1, unitCost: 350, grade: 'Assumption', writingMode: 'Install' },
];

// ─── GEYSER UNIT COST BY SIZE — Assumption grade (back-derived) ───────────────
// VR-07: confirm actual supplier buy-prices. 200L interpolated.
const GEYSER_UNIT_COST: Record<GeyserSize, number> = {
  100: 4500,
  150: 5300,
  200: 7500, // interpolated — no direct quote
  250: 9800,
};

// ─── LABOUR BLOCK BY SIZE — Assumption grade (crew-derived) ───────────────────
// VR-09: confirm against actual crew hours.
const GEYSER_LABOUR_COST: Record<GeyserSize, number> = {
  100: 1400,
  150: 1750,
  200: 1600,
  250: 1400,
};

// ─── ELEMENT REPAIR KITS — Sourced (contractor check-list, stale 2022) ────────
const ELEMENT_KITS: Record<
  GeyserSize,
  { description: string; cost: number } | null
> = {
  100: { description: 'Extreme element 2KW + thermostat (no flange)', cost: 700 },
  150: { description: 'Extreme element 3KW + thermostat (no flange)', cost: 720 },
  200: { description: 'Extreme element 4KW + thermostat (no flange rubber)', cost: 750 },
  250: null, // not in check-list — flag
};

/**
 * Build a burst geyser replacement assembly (true-cost inputs).
 */
export function buildGeyserReplacement(
  size: GeyserSize,
  brand: GeyserBrand = 'Kwikot'
): GeyserAssembly {
  const flags: string[] = [];

  const geyserLine: CostLine = {
    code: `PLB-GEY-${size}`,
    description: `${size}L ${brand} B-rated geyser (5yr warranty)`,
    unit: 'ea',
    quantity: 1,
    unitCost: GEYSER_UNIT_COST[size],
    total: GEYSER_UNIT_COST[size],
    grade: 'Assumption',
    writingMode: 'Remove & Replace',
  };

  const kitLines: CostLine[] = REPLACEMENT_KIT.map((l) => ({
    ...l,
    total: l.unitCost * l.quantity,
  }));

  const lines = [geyserLine, ...kitLines];
  const materialCost = lines.reduce((s, l) => s + l.total, 0);
  const labourCost = GEYSER_LABOUR_COST[size];

  flags.push(
    'Geyser unit + kit costs are back-derived (Assumption) — confirm buy-prices with contractor [VR-07, VR-08]'
  );
  flags.push('Labour block crew-derived (Assumption) — confirm vs actual crew hours [VR-09]');
  if (size === 200) flags.push('200L pricing interpolated — no direct quote evidence');
  if (size === 250) flags.push('250L evidence is stale (2022) — reverify before client issue');

  return {
    jobType: 'burst_replacement',
    size,
    brand,
    lines,
    materialCost,
    labourCost,
    grade: 'Assumption', // weakest-input cap
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
  solar: boolean = false
): GeyserAssembly {
  const flags: string[] = [];
  const lines: CostLine[] = [];

  const kit = ELEMENT_KITS[size];
  if (kit) {
    lines.push({
      code: `PLB-GEY-EK-${size}`,
      description: kit.description,
      unit: 'ea',
      quantity: 1,
      unitCost: kit.cost,
      total: kit.cost,
      grade: 'Sourced',
      writingMode: 'Repair',
    });
  } else {
    // fall back to component build
    lines.push(
      { code: 'PLB-GEY-003', description: 'Geyser element (standard)', unit: 'ea', quantity: 1, unitCost: 400, total: 400, grade: 'Sourced', writingMode: 'Repair' },
      { code: 'PLB-GEY-001', description: 'Thermostat (standard)', unit: 'ea', quantity: 1, unitCost: 280, total: 280, grade: 'Sourced', writingMode: 'Repair' }
    );
    flags.push(`No element kit listed for ${size}L — built from components`);
  }

  // Flange rubber — skipped for solar (contractor rule) and for kits that exclude it
  if (!solar && !kit) {
    lines.push({ code: 'PLB-GEY-005', description: 'Flange rubber', unit: 'ea', quantity: 1, unitCost: 100, total: 100, grade: 'Sourced', writingMode: 'Repair' });
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
 * kept in sync. Both produce identical results (verified: 150L burst = R12,456 sell).
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
