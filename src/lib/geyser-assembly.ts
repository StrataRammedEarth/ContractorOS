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

// ─── FIXED REPLACEMENT KIT (same for every size) — Assumption grade ───────────
// VR-08: PRV + drip tray + vacuum breakers + consumables still to itemise.
// Kit correction (2026-06-26): the Plumblink geyser SKUs are "inc TP&DC" (TP
// valve + drain cock bundled into the unit), so the standalone TP-valve line was
// removed from the kit — it would double-count. Kit total now R1,070 (was R1,250).
const REPLACEMENT_KIT: Omit<CostLine, 'total'>[] = [
  // TP valve removed — bundled "inc TP&DC" in the geyser unit (Plumblink 2026).
  { code: 'PLB-GEY-K02', description: 'PRV valve + outlet pipe', unit: 'ea', quantity: 1, unitCost: 220, grade: 'Assumption', writingMode: 'Install' },
  { code: 'PLB-GEY-K03', description: 'Plastic drip tray + outlet', unit: 'ea', quantity: 1, unitCost: 260, grade: 'Assumption', writingMode: 'Install' },
  { code: 'PLB-GEY-K04', description: 'Vacuum breakers (×2)', unit: 'set', quantity: 1, unitCost: 240, grade: 'Assumption', writingMode: 'Install' },
  { code: 'PLB-GEY-K05', description: 'Copper / connectors / consumables', unit: 'lot', quantity: 1, unitCost: 350, grade: 'Assumption', writingMode: 'Install' },
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

  flags.push('Geyser unit cost is Sourced (Plumblink 2026, excl VAT, inc TP&DC) — VR-07 closed');
  flags.push('Fixed replacement kit still Assumption — confirm PRV + drip tray + vacuum breaker buy-prices [VR-08]');
  flags.push('Labour block crew-derived (Assumption) — confirm vs actual crew hours [VR-09]');
  if (size === 150) flags.push('150L sell sits ~15% under Vissi 2024 market quote — confirm whether margin or labour, not unit [VR-11]');

  return {
    jobType: 'burst_replacement',
    size,
    brand,
    lines,
    materialCost,
    labourCost,
    // Overall cap stays ASSUMPTION: the unit is Sourced but the replacement kit
    // is still Assumption (VR-08), so a full burst quote is not client-issuable yet.
    grade: 'Assumption', // weakest-input cap (kit)
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
 * kept in sync. Both produce identical results (verified: 150L Kwikot burst = R10,475
 * sell excl VAT with real Plumblink 2026 unit cost + R1,070 kit + R1,750 labour).
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
