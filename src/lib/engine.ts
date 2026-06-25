import type { EstimateData, LibraryRecord, CrewRate } from './supabase-client';

type Inputs = EstimateData['inputs'];
type ScopeLine = EstimateData['scope'][number];
type LabourLine = EstimateData['labour'][number];
type Totals = EstimateData['totals'];

// ─── KEYWORD → FIXTURE MAPPING ────────────────────────────────────────────────

const FIXTURE_KEYWORDS: Record<keyof Inputs['fixtures'], string[]> = {
  toilet:      ['toilet', 'wc', 'suite', 'cistern'],
  basin:       ['basin', 'vanity', 'washbasin', 'hand wash'],
  shower:      ['shower base', 'shower tray', 'shower floor'],
  showerDoor:  ['shower door', 'shower screen', 'shower enclosure'],
  showerRose:  ['shower rose', 'shower head', 'rain head'],
  showerArm:   ['shower arm', 'wall arm'],
  kitchenMixer:['kitchen mixer', 'kitchen tap', 'sink mixer'],
};

const SUPPLY_PIPE_KEYWORDS = ['cpvc', 'poly pipe', 'copper pipe', 'pvc pressure', 'supply pipe', '15mm', '20mm', '25mm'];
const DRAIN_PIPE_KEYWORDS  = ['upvc', 'pvc drain', 'sewer', 'drain pipe', 'waste pipe', 'stormwater'];
const TRENCH_KEYWORDS      = ['trenching', 'excavat', 'backfill'];

function findBestMatch(keywords: string[], materials: LibraryRecord[]): LibraryRecord | null {
  for (const kw of keywords) {
    const match = materials.find((m) => m.description.toLowerCase().includes(kw.toLowerCase()));
    if (match) return match;
  }
  return null;
}

// ─── BUILD SCOPE ──────────────────────────────────────────────────────────────

export function buildScope(inputs: Inputs, materials: LibraryRecord[]): ScopeLine[] {
  const lines: ScopeLine[] = [];

  function addLine(material: LibraryRecord, qty: number) {
    if (qty <= 0) return;
    lines.push({
      code:        material.code,
      description: material.description,
      unit:        material.unit ?? 'ea',
      quantity:    qty,
      price:       material.price,
      total:       qty * material.price,
      confidence:  material.confidence,
    });
  }

  // Fixtures
  for (const [key, keywords] of Object.entries(FIXTURE_KEYWORDS) as [keyof Inputs['fixtures'], string[]][]) {
    const qty = inputs.fixtures[key];
    if (qty <= 0) continue;
    const mat = findBestMatch(keywords, materials);
    if (mat) addLine(mat, qty);
  }

  // Supply pipe (per metre)
  if (inputs.supplyMetres > 0) {
    const mat = findBestMatch(SUPPLY_PIPE_KEYWORDS, materials);
    if (mat) addLine(mat, inputs.supplyMetres);
  }

  // Drain pipe (per metre)
  if (inputs.drainMetres > 0) {
    const mat = findBestMatch(DRAIN_PIPE_KEYWORDS, materials);
    if (mat) addLine(mat, inputs.drainMetres);
  }

  // Trenching (per metre, if needed)
  if (inputs.trenching && inputs.supplyMetres + inputs.drainMetres > 0) {
    const mat = findBestMatch(TRENCH_KEYWORDS, materials);
    if (mat) addLine(mat, inputs.supplyMetres + inputs.drainMetres);
  }

  return lines;
}

// ─── BUILD LABOUR ─────────────────────────────────────────────────────────────

export function buildLabour(inputs: Inputs, resources: CrewRate[]): LabourLine[] {
  const totalFixtures = Object.values(inputs.fixtures).reduce((s, n) => s + n, 0);
  const pipeMetres = inputs.supplyMetres + inputs.drainMetres;

  // Rule of thumb: 2.5 hrs/fixture + 0.25 hrs/metre pipe
  const plumberHours = Math.ceil(totalFixtures * 2.5 + pipeMetres * 0.25);
  const apprenticeHours = Math.ceil(plumberHours * 0.6);

  const plumber    = resources.find((r) => r.description.toLowerCase().includes('plumber'))
                  ?? resources[0];
  const apprentice = resources.find((r) => r.description.toLowerCase().includes('apprentice'))
                  ?? resources[1];

  const lines: LabourLine[] = [];

  if (plumber && plumberHours > 0) {
    const rate = plumber.hourly_rate ?? plumber.daily_rate / 8;
    lines.push({ description: plumber.description, hours: plumberHours, rate, cost: plumberHours * rate });
  }

  if (apprentice && apprenticeHours > 0) {
    const rate = apprentice.hourly_rate ?? apprentice.daily_rate / 8;
    lines.push({ description: apprentice.description, hours: apprenticeHours, rate, cost: apprenticeHours * rate });
  }

  // Fallback if no crew rates loaded
  if (lines.length === 0 && plumberHours > 0) {
    lines.push({ description: 'Plumber (rate not loaded)', hours: plumberHours, rate: 0, cost: 0 });
  }

  return lines;
}

// ─── CALCULATE TOTALS ─────────────────────────────────────────────────────────

export function calculateEstimate(
  _inputs: Inputs,
  scope: ScopeLine[],
  labour: LabourLine[]
): Totals {
  const material_cost  = scope.reduce((s, l) => s + l.total, 0);
  const labour_cost    = labour.reduce((s, l) => s + l.cost, 0);
  const waste_5pct     = material_cost * 0.05;
  const direct_cost    = material_cost + waste_5pct + labour_cost;
  const risk_5pct      = direct_cost * 0.05;
  const contingency_10pct = direct_cost * 0.10;
  const subtotal       = direct_cost + risk_5pct + contingency_10pct;
  const margin_25pct   = subtotal * 0.25;
  const final_total    = subtotal + margin_25pct;

  return { material_cost, waste_5pct, direct_cost, risk_5pct, contingency_10pct, subtotal, margin_25pct, final_total };
}
