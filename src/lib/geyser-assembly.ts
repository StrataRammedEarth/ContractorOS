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
export type GeyserSize = 50 | 100 | 150 | 200 | 250;
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

// ─── FIXED REPLACEMENT KIT (same for every size) — Sourced (Builders 2026) ─────
// VR-08 CLOSED: real Builders Warehouse price (2026-06-26, excl VAT). The geyser
// SKU already bundles TP valve + drain cock ("inc TP&DC"), so the kit covers only
// the all-in installation kit (600kPa PCV + 2× vacuum breakers) plus the drip
// tray = R867.83 Sourced (was ~R1,070 Assumption — the estimate ran ~19% high).
const REPLACEMENT_KIT: Omit<CostLine, 'total'>[] = [
  { code: 'BLD-GEY-KIT', description: 'Geyser installation kit (600kPa PCV + 2× vacuum breakers)', unit: 'ea', quantity: 1, unitCost: 668.70, grade: 'Sourced', writingMode: 'Install' },
  { code: 'BLD-GEY-DRT', description: 'Kwikot DRT1600 drip tray', unit: 'ea', quantity: 1, unitCost: 199.13, grade: 'Sourced', writingMode: 'Install' },
];

// ─── GEYSER UNIT COST BY SIZE × BRAND — Sourced (Plumblink 2026, excl VAT) ─────
// VR-07 CLOSED: real screenshot-confirmed Plumblink prices, all sizes both brands.
// Kwikot and Ariston are identical at 100/150L but diverge at 50/200/250L.
const GEYSER_UNIT_COST: Record<GeyserSize, Record<GeyserBrand, number>> = {
  50:  { Kwikot: 4694.78,  Ariston: 4520.87 },
  100: { Kwikot: 4173.04,  Ariston: 4173.04 },
  150: { Kwikot: 4173.04,  Ariston: 4173.04 },
  200: { Kwikot: 7086.09,  Ariston: 6694.78 },
  250: { Kwikot: 14199.13, Ariston: 13042.61 },
};

// ─── LABOUR BLOCK BY SIZE — Assumption grade (crew-derived) ───────────────────
// VR-09: confirm against actual crew hours. 50L assumed same as 100L (small unit).
const GEYSER_LABOUR_COST: Record<GeyserSize, number> = {
  50:  1400,
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
  50:  null, // not in check-list — falls back to component build
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

  const unitCost = GEYSER_UNIT_COST[size][brand];
  const geyserLine: CostLine = {
    code: `PLB-GEY-${size}`,
    description: `${size}L ${brand} B-rated geyser, inc TP&DC (5yr warranty)`,
    unit: 'ea',
    quantity: 1,
    unitCost,
    total: unitCost,
    grade: 'Sourced', // VR-07 CLOSED — real Plumblink 2026 price
    writingMode: 'Remove & Replace',
  };

  const kitLines: CostLine[] = REPLACEMENT_KIT.map((l) => ({
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
