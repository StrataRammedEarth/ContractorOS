import { useState, useMemo, useCallback } from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import {
  buildGeyserReplacement, buildElementRepair,
  type GeyserAssembly, type GeyserSize, type GeyserBrand, type GeyserJobType,
} from "@/lib/geyser-assembly";
import {
  COMPRESSION_FITTINGS, FITTING_SIZE_GROUPS, fittingsForSizeGroup,
  type FittingPreset,
} from "@/lib/plumblink-fittings";
import {
  printInvoiceDocument, isoDate, addDays, DEFAULT_BANKING_DETAILS,
  type InvoiceMeta, type DocumentType,
} from "@/lib/invoice-document";
import { useSettings, DEFAULT_SETTINGS, type OrgSettings } from "@/lib/settings-context";

// ─── SUPABASE (for the scan-drawing edge function) ────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

// ─── COLOUR TOKENS ────────────────────────────────────────────────────────────
const C = {
  navy:"#0D1B2A", navyMid:"#152436", navyLt:"#1E3250",
  gold:"#F5A623", goldDim:"#C8851A", goldPale:"#FDF3DC",
  slate:"#4A6080", slateL:"#6B859E",
  offWhite:"#F7F8FA", white:"#FFFFFF",
  green:"#27AE60", amber:"#E67E22", red:"#E74C3C", muted:"#8FA3B8",
};

// ─── CONFIDENCE GRADES ────────────────────────────────────────────────────────
const GRADES: Record<string, { rank: number; color: string; bg: string }> = {
  Locked:      { rank:6, color:"#0D1B2A", bg:"#E8EDF2" },
  Validated:   { rank:5, color:"#27AE60", bg:"#EBF9EE" },
  Sourced:     { rank:4, color:"#2E86AB", bg:"#E8F4F8" },
  Derived:     { rank:3, color:"#8E44AD", bg:"#F5EEF8" },
  Assumption:  { rank:2, color:"#E67E22", bg:"#FEF5E7" },
  Placeholder: { rank:1, color:"#E74C3C", bg:"#FDEDEC" },
};
const lowestGrade = (...gs: string[]) =>
  gs.reduce((m, g) => (GRADES[g]?.rank < GRADES[m]?.rank ? g : m), "Validated");

// ─── MATERIAL LIBRARY ─────────────────────────────────────────────────────────
const LIBRARY: Record<string, { desc: string; unit: string; price: number; conf: string; supplier: string }> = {
  "PLB-PD-001": { desc:"PVC cement 500ml",                    unit:"tube", price:68.70,   conf:"Sourced", supplier:"Plumblink" },
  "PLB-PD-002": { desc:"Den Braven clear silicone",           unit:"ea",   price:89.48,   conf:"Sourced", supplier:"DIY Shop" },
  "PLB-PD-006": { desc:"Plumbing tape",                       unit:"ea",   price:7.45,    conf:"Sourced", supplier:"Plumblink" },
  "PLB-PD-021": { desc:"Konex Elbow 90° 15mm",                unit:"ea",   price:35.31,   conf:"Sourced", supplier:"Plumblink" },
  "PLB-PD-022": { desc:"Konex Tee 15mm",                      unit:"ea",   price:50.56,   conf:"Sourced", supplier:"Plumblink" },
  "PLB-PD-026": { desc:"Konex Straight Coupler 15mm",         unit:"ea",   price:32.24,   conf:"Sourced", supplier:"Plumblink" },
  "PLB-PD-027": { desc:"Konex Stop End 15mm",                 unit:"ea",   price:24.97,   conf:"Sourced", supplier:"Plumblink" },
  "PLB-PD-013": { desc:"Cobra PEX Insert 15mm",               unit:"ea",   price:7.14,    conf:"Sourced", supplier:"Plumblink" },
  "PLB-P1-013": { desc:"Brass Compression Tee 15mm",          unit:"ea",   price:45.22,   conf:"Sourced", supplier:"Plumblink" },
  "PLB-P1-001": { desc:"Brass Compression Coupler 15mm",      unit:"ea",   price:60.00,   conf:"Sourced", supplier:"Plumblink" },
  "PLB-PD-071": { desc:"Brass stop tap for mixer",            unit:"ea",   price:146.96,  conf:"Sourced", supplier:"Plumblink" },
  "PLB-PD-019": { desc:"Pan connector 110mm",                 unit:"ea",   price:85.09,   conf:"Sourced", supplier:"Plumblink" },
  "PLB-P1-046": { desc:"PVC UG Gulley P-Trap 110mm",          unit:"ea",   price:123.26,  conf:"Sourced", supplier:"Plumblink" },
  "PLB-P1-050": { desc:"PVC UG Junction 110x45 Plain",        unit:"ea",   price:96.47,   conf:"Sourced", supplier:"Plumblink" },
  "PLB-P1-031": { desc:"PVC UG Bend 110x22.5",                unit:"ea",   price:69.67,   conf:"Sourced", supplier:"Plumblink" },
  "PLB-PD-082": { desc:"Coral White close-coupled toilet",    unit:"ea",   price:929.90,  conf:"Sourced", supplier:"CTM" },
  "PLB-PD-067": { desc:"Bathroom basin white F/S",            unit:"ea",   price:649.90,  conf:"Sourced", supplier:"Plumbit" },
  "PLB-PD-080": { desc:"Shower mixer",                        unit:"ea",   price:355.65,  conf:"Sourced", supplier:"Plumblink" },
  "PLB-PD-074": { desc:"Glass shower door – chrome",          unit:"ea",   price:3559.00, conf:"Sourced", supplier:"CTM" },
  "PLB-PD-018": { desc:"Shower rose round s/steel 200mm",     unit:"ea",   price:477.39,  conf:"Sourced", supplier:"Plumblink" },
  "PLB-PD-078": { desc:"Shower arm round 350mm",              unit:"ea",   price:139.00,  conf:"Sourced", supplier:"Gelmar" },
  "PLB-PD-069": { desc:"Kitchen basin mixer (inc stop taps)", unit:"ea",   price:516.45,  conf:"Sourced", supplier:"AfriCamps" },
  "PLB-PD-085": { desc:"Toilet roll holder",                  unit:"ea",   price:52.51,   conf:"Sourced", supplier:"AfriCamps" },
  "PLB-PD-081": { desc:"Shower towel rail",                   unit:"ea",   price:400.00,  conf:"Sourced", supplier:"AfriCamps" },
};

const BL = { elbowsPPt:3.75, teesPPt:2.25, couplersPPt:1.5, insertsPPt:8.75 };

// (Pipe pricing moved to PIPE_LOOKUP — per-metre rates from real pack prices.
//  The old hardcoded per-metre PIPE_PRICES (copper R58/m) was removed: it
//  under-priced copper ~45% vs the real R102.41/m.)

// Default composite crew hourly rate (plumber R600 + assistant R260) / 8h.
// REPLACED BY SETTINGS CONTEXT: now a fallback default — the live rate is derived
// from plumberDayRate / assistantDayRate / hoursPerDay and threaded into the
// labour builders. Kept here so module-level callers still have a sane default.
const CREW_RATE_HR = 860 / 8;
const PROD = {
  trenchExcavation: 0.25,
  pipeworkInstall:  0.10,
  pointMakeOff:     1.00,
  drainInstall:     0.15,
  toiletInstall:    1.83,
  basinInstall:     1.50,
  showerInstall:    1.17,
  showerDoorInstall:1.00,
  accessoryInstall: 0.25,
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Fixtures {
  toilet: number; basin: number; shower: number;
  showerDoor: number; showerRose: number; showerArm: number; kitchenMixer: number;
}

// Repeatable fixture lines (manual entry): each line is a product (library preset
// or custom) + its own quantity. Library presets keep their real grade; custom
// lines are Assumption and flagged. See multiline_entry_spec.
type FixtureType =
  | 'toilet' | 'basin' | 'basin_mixer' | 'shower_mixer'
  | 'shower_door' | 'shower_rose' | 'kitchen_mixer';
interface FixtureLine {
  id: string;
  type: FixtureType;
  source: 'library' | 'custom';
  materialCode?: string;
  description: string;
  unitPrice: number;   // excl VAT
  quantity: number;
  grade: string;       // Sourced (library) | Assumption (custom)
  supplier?: string;
}

// Repeatable pipe lines (supply + drainage): each line is type + diameter + run(m),
// priced per-metre from the pipe lookup (or custom). Mirrors the fixture builder.
interface PipeLine {
  id: string;
  use: 'supply' | 'drainage';
  source: 'library' | 'custom';
  pipeCode?: string;
  type: string;        // Copper | PEX (supply) · PVC (drainage) · or custom
  diameter: number;    // mm (0 for custom)
  description: string;
  perMetre: number;    // excl VAT, per metre
  metres: number;
  grade: string;
  supplier?: string;
}

// Repeatable fitting lines (Compression Fittings, and future families): each line
// is a catalogue product (size group + product) + its own quantity. Pricing,
// confidence, supplier and Plumblink code all populate from the fittings catalogue.
// Mirrors the fixture builder. Source is the COMPRESSION_FITTINGS module, which is
// generated from the Plumblink materials CSV — add a row there and it appears here.
interface FittingLine {
  id: string;
  family: string;        // 'Compression Fittings' (only family enabled today)
  sizeGroup: string;     // '15mm' | '22mm' | 'Reducing / 22→15 / ¾"' (data-driven)
  materialCode: string;
  plumblinkCode: string;
  label: string;         // e.g. 'Female Elbow'
  description: string;
  size: string;
  unit: string;
  unitPrice: number;     // excl VAT
  quantity: number;
  grade: string;         // Sourced (catalogue price)
  supplier?: string;
}

interface GeyserMeta {
  jobType: GeyserJobType; size: GeyserSize; brand: GeyserBrand; solar: boolean;
}
interface Inputs {
  projectName: string; clientName: string; pipeType: string;
  supplyMetres: number; drainMetres: number; points: number; trenching: boolean;
  fixtures: Fixtures;           // legacy (scan extraction still populates this)
  fixtureLines?: FixtureLine[]; // canonical fixtures for manual-entry pricing
  fittingLines?: FittingLine[]; // compression fittings (catalogue-priced, optional)
  supplyLines?: PipeLine[];     // canonical supply pipe (replaces pipeType+supplyMetres)
  drainLines?: PipeLine[];      // canonical drainage pipe (replaces drainMetres)
  _scanNotes?: string; _scanConf?: string;
  _geyser?: GeyserMeta; // present when this is a geyser-assembly job
}
interface ScopeLine {
  id: string; code: string; description: string; qty: number; unit: string;
  unitPrice: number; conf: string; total: number; supplier: string; derivation: string; mode: string;
}
interface LabourLine {
  id: string; description: string; hours: number; rate: number; cost: number; conf: string; derivation: string;
}
interface Ladder {
  prime: number; waste: number; direct: number; risk: number;
  afterRisk: number; cont: number; afterCont: number; margin: number; sell: number;
}

// ─── FIXTURE CATALOGUE + LABOUR (manual-entry line builder) ───────────────────
// Install hours per unit (crew profile / Spon's seed). Mixers & roses use the
// accessory constant. Every type has a constant, so labour is never invented.
const FIXTURE_LABOUR: Record<FixtureType, number> = {
  toilet: 1.83, basin: 1.50, basin_mixer: 0.25, shower_mixer: 1.17,
  shower_door: 1.00, shower_rose: 0.25, kitchen_mixer: 0.25,
};
const FIXTURE_TYPES: { t: FixtureType; label: string }[] = [
  { t:'toilet', label:'Toilet' }, { t:'basin', label:'Basin' },
  { t:'basin_mixer', label:'Basin mixer' }, { t:'shower_mixer', label:'Shower mixer' },
  { t:'shower_door', label:'Shower door' }, { t:'shower_rose', label:'Shower rose' },
  { t:'kitchen_mixer', label:'Kitchen mixer' },
];
// Preset products per type. These are the app's existing real prices (CTM/Plumbit/
// Gelmar/AfriCamps), kept until the Supabase pipe/fixture SKUs load — at which point
// these dropdowns read from the cost library. basin_mixer has no preset yet → custom only.
interface FixturePreset { materialCode: string; description: string; unitPrice: number; grade: string; supplier: string }
const FIXTURE_PRESETS: Record<FixtureType, FixturePreset[]> = {
  toilet:       [{ materialCode:'PLB-PD-082', description:'Coral White close-coupled toilet', unitPrice:929.90, grade:'Sourced', supplier:'CTM' }],
  basin:        [{ materialCode:'PLB-PD-067', description:'Bathroom basin white F/S', unitPrice:649.90, grade:'Sourced', supplier:'Plumbit' }],
  basin_mixer:  [],
  shower_mixer: [{ materialCode:'PLB-PD-080', description:'Shower mixer', unitPrice:355.65, grade:'Sourced', supplier:'Plumblink' }],
  shower_door:  [{ materialCode:'PLB-PD-074', description:'Glass shower door – chrome', unitPrice:3559.00, grade:'Sourced', supplier:'CTM' }],
  shower_rose:  [{ materialCode:'PLB-PD-018', description:'Shower rose round s/steel 200mm', unitPrice:477.39, grade:'Sourced', supplier:'Plumblink' }],
  kitchen_mixer:[{ materialCode:'PLB-PD-069', description:'Kitchen basin mixer (inc stop taps)', unitPrice:516.45, grade:'Sourced', supplier:'AfriCamps' }],
};
const _uid = () => Math.random().toString(36).slice(2, 9);
function makeFixtureLine(type: FixtureType): FixtureLine {
  const p = FIXTURE_PRESETS[type][0];
  if (p) return { id:_uid(), type, source:'library', materialCode:p.materialCode, description:p.description, unitPrice:p.unitPrice, quantity:1, grade:p.grade, supplier:p.supplier };
  return { id:_uid(), type, source:'custom', description:'', unitPrice:0, quantity:1, grade:'Assumption' };
}
const fxCount = (ls: FixtureLine[] | undefined, t: FixtureType) =>
  (ls ?? []).filter(l => l.type === t).reduce((s, l) => s + (l.quantity || 0), 0);

// ─── FITTINGS CATALOGUE (compression-fittings line builder) ───────────────────
// Data-driven from COMPRESSION_FITTINGS (generated from the Plumblink CSV). Size
// groups and products are derived from the catalogue, so adding a row there adds
// it here with no code change. Only the 'Compression Fittings' family is enabled.
const lineFromFitting = (id: string, f: FittingPreset, quantity: number): FittingLine => ({
  id, family: f.family, sizeGroup: f.sizeGroup, materialCode: f.materialCode,
  plumblinkCode: f.plumblinkCode, label: f.label, description: f.description,
  size: f.size, unit: f.unit, unitPrice: f.unitPrice, quantity, grade: f.grade,
  supplier: f.supplier,
});
function makeFittingLine(sizeGroup?: string, materialCode?: string): FittingLine {
  const group = sizeGroup ?? FITTING_SIZE_GROUPS[0];
  const inGroup = fittingsForSizeGroup(group);
  const f = (materialCode && inGroup.find(x => x.materialCode === materialCode)) || inGroup[0];
  return lineFromFitting(_uid(), f, 1);
}

// ─── PIPE LOOKUP (supply + drainage line builders) ────────────────────────────
// type + diameter is the lookup key. PerMetre = PackPrice / PackLength (pre-calc).
// Pricing method A (per-metre × metres) is live; method B (whole-tube) is available
// but off by default. Source: pipe_lookup, Plumblink 2026 (excl VAT). NOTE: copper
// 15mm is R102.41/m here — the old hardcoded R58/m under-priced copper ~45%.
interface PipeRow { code: string; type: string; diameter: number; use: 'supply'|'drainage'; packLength: number; packPrice: number; perMetre: number; grade: string; source: string; description: string }
const PIPE_LOOKUP: PipeRow[] = [
  { code:'PIPE-CU-15',  type:'Copper', diameter:15,  use:'supply',   packLength:5.5, packPrice:563.27,  perMetre:102.41, grade:'Sourced', source:'Plumblink', description:'Copper tube 15×5.5m 460/1 domestic' },
  { code:'PIPE-CU-22',  type:'Copper', diameter:22,  use:'supply',   packLength:5.5, packPrice:1088.07, perMetre:197.83, grade:'Sourced', source:'Plumblink', description:'Copper tube 22×5.5m 460/1 domestic' },
  { code:'PIPE-CU-28',  type:'Copper', diameter:28,  use:'supply',   packLength:5.5, packPrice:1462.95, perMetre:265.99, grade:'Sourced', source:'Plumblink', description:'Copper tube 28×5.5m 460/1 domestic' },
  { code:'PIPE-CU-35',  type:'Copper', diameter:35,  use:'supply',   packLength:5.5, packPrice:2488.85, perMetre:452.52, grade:'Sourced', source:'Plumblink', description:'Copper tube 35×5.5m 460/1 domestic' },
  { code:'PIPE-PEX-16', type:'PEX',    diameter:16,  use:'supply',   packLength:200, packPrice:4269.74, perMetre:21.35,  grade:'Sourced', source:'Plumblink', description:'Rifeng PEX-AL-PEX crimped 16×200m white (036971)' },
  { code:'PIPE-PEX-20', type:'PEX',    diameter:20,  use:'supply',   packLength:200, packPrice:4865.22, perMetre:24.33,  grade:'Sourced', source:'Plumblink', description:'Sunridge Rifeng PEX-AL-PEX 20×200m white (SNR-B-20*200M)' },
  { code:'PIPE-PVC-40', type:'PVC',    diameter:40,  use:'drainage', packLength:6,   packPrice:485.01,  perMetre:80.83,  grade:'Sourced', source:'Plumblink', description:'PVC SV/UG pipe 40mm ×6m' },
  { code:'PIPE-PVC-50', type:'PVC',    diameter:50,  use:'drainage', packLength:6,   packPrice:232.85,  perMetre:38.81,  grade:'Sourced', source:'Plumblink', description:'PVC SV/UG pipe 50mm ×6m' },
  { code:'PIPE-PVC-75', type:'PVC',    diameter:75,  use:'drainage', packLength:6,   packPrice:339.75,  perMetre:56.62,  grade:'Sourced', source:'Plumblink', description:'PVC SV/UG pipe 75mm ×6m' },
  { code:'PIPE-PVC-110',type:'PVC',    diameter:110, use:'drainage', packLength:6,   packPrice:154.99,  perMetre:25.83,  grade:'Sourced', source:'Plumblink', description:'PVC SV/UG pipe 110mm ×6m' },
  { code:'PIPE-PVC-160',type:'PVC',    diameter:160, use:'drainage', packLength:6,   packPrice:437.93,  perMetre:72.99,  grade:'Sourced', source:'Plumblink', description:'PVC SV/UG pipe 160mm ×6m' },
];
const pipeTypesFor = (use: 'supply'|'drainage') =>
  [...new Set(PIPE_LOOKUP.filter(p=>p.use===use).map(p=>p.type))];
const pipeDiametersFor = (use: 'supply'|'drainage', type: string) =>
  PIPE_LOOKUP.filter(p=>p.use===use && p.type===type).map(p=>p.diameter).sort((a,b)=>a-b);
const pipeRow = (use: 'supply'|'drainage', type: string, diameter: number) =>
  PIPE_LOOKUP.find(p=>p.use===use && p.type===type && p.diameter===diameter);
function makePipeLine(use: 'supply'|'drainage'): PipeLine {
  const type = pipeTypesFor(use)[0];
  const dia = pipeDiametersFor(use, type)[0];
  const r = pipeRow(use, type, dia)!;
  return { id:_uid(), use, source:'library', pipeCode:r.code, type:r.type, diameter:r.diameter,
    description:r.description, perMetre:r.perMetre, metres:use==='supply'?10:6, grade:r.grade, supplier:r.source };
}
const sumMetres = (ls: PipeLine[] | undefined) => (ls ?? []).reduce((s,l)=>s+(l.metres||0),0);

// ─── COMMERCIAL LADDER ────────────────────────────────────────────────────────
// Commercial-ladder percentages. Now configurable via Profile & Settings;
// these constants remain the fallback default (Vissi).
// REPLACED BY SETTINGS CONTEXT (kept as defaults): waste 5 · risk 5 · contingency 10 · margin 25
export interface LadderRates { wastePct: number; riskPct: number; contingencyPct: number; marginPct: number; }
const DEFAULT_LADDER: LadderRates = { wastePct: 5, riskPct: 5, contingencyPct: 10, marginPct: 25 };

// Margin is markup on cost: sell = afterCont × (1 + marginPct/100)
// NOT gross margin. 25% markup → ~20% of sell price.
// Owner confirmed: Luke Erasmus, 2026-06-29.
// Order and formula are fixed; only the percentages are configurable.
function applyLadder(mat: number, lab: number, rates: LadderRates = DEFAULT_LADDER): Ladder {
  const prime     = mat + lab;
  const waste     = mat * (rates.wastePct / 100);
  const direct    = prime + waste;
  const risk      = direct * (rates.riskPct / 100);
  const afterRisk = direct + risk;
  const cont      = afterRisk * (rates.contingencyPct / 100);
  const afterCont = afterRisk + cont;
  const margin    = afterCont * (rates.marginPct / 100);
  const sell      = afterCont + margin;
  return { prime, waste, direct, risk, afterRisk, cont, afterCont, margin, sell };
}

// ─── DOCUMENT REF ─────────────────────────────────────────────────────────────
// Quotes keep the PLB-YYYY-NNN series; invoices get an independent INV-YYYYMM-NNN
// series (separate sessionStorage counters), so issuing an invoice never advances
// the quote number and vice-versa.
function nextDocumentRef(type: DocumentType, quotePrefix = "PLB") {
  const now = new Date();
  const year = now.getFullYear();
  const yearMonth = `${year}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const key = type === "invoice" ? `cos_invoice_seq_${yearMonth}` : `cos_quote_seq_${year}`;
  let seq = 0;
  try { seq = parseInt(sessionStorage?.getItem?.(key) ?? "0", 10); } catch (_) {}
  seq += 1;
  try { sessionStorage.setItem(key, String(seq)); } catch (_) {}
  return type === "invoice"
    ? `INV-${yearMonth}-${String(seq).padStart(3, "0")}`
    : `${quotePrefix || "PLB"}-${year}-${String(seq).padStart(3, "0")}`;
}

// ─── ENGINE ───────────────────────────────────────────────────────────────────
function buildScope(inp: Inputs): ScopeLine[] {
  const { points } = inp;
  const fixtureLines = inp.fixtureLines ?? [];
  const supplyLines = inp.supplyLines ?? [];
  const drainLines  = inp.drainLines ?? [];
  const supplyMetres = sumMetres(supplyLines);
  const drainMetres  = sumMetres(drainLines);
  const lines: ScopeLine[] = [];

  // Supply pipe — one scope line per pipe line (method A: per-metre × metres)
  supplyLines.forEach((l, i) => {
    if (l.metres <= 0) return;
    lines.push({ id:`S${String(i+1).padStart(2,"0")}`, code:l.pipeCode ?? "CUSTOM-PIPE",
      description:l.description || `${l.type} ${l.diameter}mm supply`, qty:l.metres, unit:"m",
      unitPrice:l.perMetre, conf:l.grade, total:l.metres*l.perMetre,
      supplier:l.supplier ?? (l.source==="custom"?"Custom":"Plumblink"),
      derivation:`${l.metres}m × R${l.perMetre.toFixed(2)}/m${l.source==="custom"?" (user-entered)":""}`, mode:"Install" });
  });

  ([
    { id:"F01", key:"PLB-PD-021", ppt:BL.elbowsPPt },
    { id:"F02", key:"PLB-PD-022", ppt:BL.teesPPt },
    { id:"F03", key:"PLB-PD-026", ppt:BL.couplersPPt },
    { id:"F04", key:"PLB-PD-013", ppt:BL.insertsPPt },
  ] as const).forEach(f => {
    const it = LIBRARY[f.key]; if (!it) return;
    const qty = Math.ceil(f.ppt * points);
    lines.push({ id:f.id, code:f.key, description:it.desc, qty, unit:it.unit,
      unitPrice:it.price, conf:lowestGrade(it.conf,"Derived"), total:qty*it.price,
      supplier:it.supplier, derivation:`${f.ppt}/pt × ${points} pts (AfriCamps baseline)`, mode:"Supply" });
  });

  ([
    { id:"C01", key:"PLB-PD-006", qty:Math.ceil(supplyMetres/10) },
    { id:"C02", key:"PLB-PD-001", qty:Math.max(1,Math.ceil(supplyMetres/20)) },
    { id:"C03", key:"PLB-PD-002", qty:Math.max(0,Math.ceil(fxCount(fixtureLines,"shower_mixer")+fxCount(fixtureLines,"basin"))) },
  ] as const).forEach(c => {
    const it = LIBRARY[c.key]; if (!it || c.qty===0) return;
    lines.push({ id:c.id, code:c.key, description:it.desc, qty:c.qty, unit:it.unit,
      unitPrice:it.price, conf:lowestGrade(it.conf,"Derived"), total:c.qty*it.price,
      supplier:it.supplier, derivation:"Derived from run/fixture count", mode:"Supply" });
  });

  const st = LIBRARY["PLB-PD-071"];
  if (st) lines.push({ id:"A01", code:"PLB-PD-071", description:st.desc, qty:points*2, unit:"ea",
    unitPrice:st.price, conf:st.conf, total:points*2*st.price, supplier:st.supplier,
    derivation:`2 per point × ${points}`, mode:"Install" });

  // Drainage pipe — one scope line per drain line (PVC, per-metre × metres)
  drainLines.forEach((l, i) => {
    if (l.metres <= 0) return;
    lines.push({ id:`D${String(i+1).padStart(2,"0")}`, code:l.pipeCode ?? "CUSTOM-PIPE",
      description:l.description || `${l.type} ${l.diameter}mm drainage`, qty:l.metres, unit:"m",
      unitPrice:l.perMetre, conf:l.grade, total:l.metres*l.perMetre,
      supplier:l.supplier ?? (l.source==="custom"?"Custom":"Plumblink"),
      derivation:`${l.metres}m × R${l.perMetre.toFixed(2)}/m${l.source==="custom"?" (user-entered)":""}`, mode:"Install" });
  });
  if (drainMetres > 0) {
    const jnQty = Math.max(1,Math.ceil(drainMetres/3));
    const jn = LIBRARY["PLB-P1-050"];
    if (jn) lines.push({ id:"DJ1", code:"PLB-P1-050", description:jn.desc, qty:jnQty, unit:"ea",
      unitPrice:jn.price, conf:lowestGrade(jn.conf,"Derived"), total:jnQty*jn.price,
      supplier:jn.supplier, derivation:"1 per 3m drain run", mode:"Install" });
    const toiletQty = fxCount(fixtureLines,"toilet");
    if (toiletQty>0) {
      const pan=LIBRARY["PLB-PD-019"];
      if (pan) lines.push({ id:"DP1", code:"PLB-PD-019", description:pan.desc, qty:toiletQty, unit:"ea",
        unitPrice:pan.price, conf:pan.conf, total:toiletQty*pan.price,
        supplier:pan.supplier, derivation:"1 per toilet", mode:"Install" });
    }
  }

  // Fixture lines — one scope line per product line (library preset or custom)
  fixtureLines.forEach((fl, i) => {
    if (fl.quantity <= 0) return;
    lines.push({
      id:`X${String(i+1).padStart(2,"0")}`,
      code: fl.materialCode ?? "CUSTOM",
      description: fl.description || "(custom item)",
      qty: fl.quantity, unit:"ea", unitPrice: fl.unitPrice, conf: fl.grade,
      total: fl.quantity*fl.unitPrice,
      supplier: fl.supplier ?? (fl.source==="custom" ? "Custom" : "—"),
      derivation: fl.source==="custom"
        ? `${fl.quantity} × R${fl.unitPrice} (user-entered, unverified)`
        : `${fl.quantity} × R${fl.unitPrice} (${fl.grade} library price)`,
      mode:"Install",
    });
  });

  // Fitting lines — one scope line per catalogue product (compression fittings).
  // Material-only: installation effort is already carried by the pipework/point
  // labour, so fittings do not add a separate labour line (avoids double-count).
  (inp.fittingLines ?? []).forEach((ft, i) => {
    if (ft.quantity <= 0) return;
    lines.push({
      id:`G${String(i+1).padStart(2,"0")}`,
      code: ft.materialCode,
      description: `${ft.label} ${ft.size} — ${ft.family}`,
      qty: ft.quantity, unit: ft.unit, unitPrice: ft.unitPrice, conf: ft.grade,
      total: ft.quantity*ft.unitPrice,
      supplier: ft.supplier ?? "Plumblink",
      derivation: `${ft.quantity} × R${ft.unitPrice.toFixed(2)} (${ft.grade} catalogue price${ft.plumblinkCode?`, PL ${ft.plumblinkCode}`:""})`,
      mode:"Supply",
    });
  });

  return lines;
}

function buildLabour(inp: Inputs, crewRateHr: number = CREW_RATE_HR): LabourLine[] {
  const { points, trenching } = inp;
  const fixtureLines = inp.fixtureLines ?? [];
  const supplyMetres = sumMetres(inp.supplyLines);
  const drainMetres  = sumMetres(inp.drainLines);
  const lines: LabourLine[] = [];
  const add = (id: string, desc: string, hrs: number, grade: string, deriv: string) =>
    lines.push({ id, description:desc, hours:hrs, rate:crewRateHr, cost:hrs*crewRateHr, conf:grade, derivation:deriv });
  if (trenching && drainMetres>0)
    add("L01","Trench excavation",drainMetres*PROD.trenchExcavation,"Sourced",`${drainMetres}m × ${PROD.trenchExcavation}hr/m (Vazirani)`);
  add("L02","Pipework installation",supplyMetres*PROD.pipeworkInstall,"Sourced",`${supplyMetres}m × ${PROD.pipeworkInstall}hr/m (Spon's)`);
  add("L03","Point make-off",points*PROD.pointMakeOff,"Assumption",`${points} pts × ${PROD.pointMakeOff}hr/pt (VR-03 open)`);
  if (drainMetres>0) add("L04","Drainage installation",drainMetres*PROD.drainInstall,"Assumption",`${drainMetres}m × ${PROD.drainInstall}hr/m`);
  // One labour line per fixture line; hours from the per-type install constant.
  fixtureLines.forEach((fl, i) => {
    if (fl.quantity <= 0) return;
    const hrs = FIXTURE_LABOUR[fl.type];
    const label = `${fl.description || fl.type} — install`;
    if (hrs == null) { // no constant for this type → flag for manual entry, never invent
      add(`LF${i}`, `${label} (labour TBC)`, 0, "Placeholder", "No labour constant for this type — enter manually");
      return;
    }
    add(`LF${i}`, label, fl.quantity*hrs, "Assumption", `${fl.quantity} × ${hrs}hr (Spon's seed)`);
  });
  return lines;
}

// ─── GEYSER ASSEMBLY → SCOPE/LABOUR ADAPTERS ──────────────────────────────────
// The geyser module returns TRUE-COST lines + a fixed labour block. We map those
// into the existing ScopeLine/LabourLine shapes so the 4 output tabs, the
// commercial ladder (applyLadder) and the issuance gate all work unchanged.
function geyserToScope(asm: GeyserAssembly): ScopeLine[] {
  const supplier = asm.jobType === "burst_replacement" ? "Geyser supplier (confirm)" : "Vissi/local";
  return asm.lines.map((l, i) => ({
    id: `G${String(i + 1).padStart(2, "0")}`,
    code: l.code,
    description: l.description,
    qty: l.quantity,
    unit: l.unit,
    unitPrice: l.unitCost,
    conf: l.grade,
    total: l.total,
    supplier,
    derivation: `${l.writingMode} · true cost excl. margin`,
    mode: l.writingMode,
  }));
}
function geyserToLabour(asm: GeyserAssembly, crewRateHr: number = CREW_RATE_HR): LabourLine[] {
  const burst = asm.jobType === "burst_replacement";
  return [{
    id: "GL01",
    description: burst ? "Geyser remove & replace — labour block" : "Element / thermostat repair — labour",
    hours: asm.labourCost / crewRateHr,
    rate: crewRateHr,
    cost: asm.labourCost,
    conf: asm.grade,
    derivation: burst
      ? "Fixed crew block by size (Assumption) [VR-09]"
      : "Contractor flat-rate, sell-side reference [VR-10 open decision]",
  }];
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt  = (n: number) => `R ${n.toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtN = (n: number) => n.toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2});
const today = () => new Date().toLocaleDateString("en-ZA",{day:"numeric",month:"long",year:"numeric"});

// ─── MICRO COMPONENTS ─────────────────────────────────────────────────────────
function GradePill({ grade }: { grade: string }) {
  const g = GRADES[grade] ?? GRADES["Placeholder"];
  return <span style={{ display:"inline-block",padding:"1px 8px",borderRadius:99,fontSize:10,
    fontWeight:700,letterSpacing:0.4,background:g.bg,color:g.color,border:`1px solid ${g.color}30` }}>{grade}</span>;
}
function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ background:C.navyMid,color:C.gold,fontWeight:700,fontSize:11,
    letterSpacing:1.2,textTransform:"uppercase",padding:"6px 16px",
    borderBottom:`2px solid ${C.gold}40` }}>{children}</div>;
}

// ─── SETTINGS → ENGINE DERIVATIONS ────────────────────────────────────────────
const ladderFrom = (s: OrgSettings): LadderRates =>
  ({ wastePct: s.wastePct, riskPct: s.riskPct, contingencyPct: s.contingencyPct, marginPct: s.marginPct });
const crewRateFrom = (s: OrgSettings): number =>
  s.hoursPerDay > 0 ? (s.plumberDayRate + s.assistantDayRate) / s.hoursPerDay : CREW_RATE_HR;
const ladderLabel = (s: OrgSettings): string =>
  `${s.wastePct}% waste, ${s.riskPct}% risk, ${s.contingencyPct}% contingency, ${s.marginPct}% markup`;
const businessFrom = (s: OrgSettings): string => s.businessName.trim() || "[Your Plumbing Business]";

// ─── PDF GENERATORS ───────────────────────────────────────────────────────────
function printQuotePDF(inp: Inputs, scope: ScopeLine[], labour: LabourLine[], quoteRef: string, cfg: OrgSettings = DEFAULT_SETTINGS) {
  const mat   = scope.reduce((s,l)=>s+l.total,0);
  const lab   = labour.reduce((s,l)=>s+l.cost,0);
  const ld    = applyLadder(mat,lab,ladderFrom(cfg));
  const allow = ld.sell - ld.prime;
  const vat   = ld.sell * (cfg.vatRatePct / 100);
  const total = ld.sell + vat;
  const biz   = businessFrom(cfg);
  const g = inp._geyser;
  const fixtureLines = g ? [] : (inp.fixtureLines ?? [])
    .filter(l=>l.quantity>0)
    .map(l=>`${l.description || l.type}: ${l.quantity}${l.source==="custom"?" (custom)":""}`);
  const fittingLines = g ? [] : (inp.fittingLines ?? [])
    .filter(l=>l.quantity>0)
    .map(l=>`${l.label} ${l.size}: ${l.quantity}`);
  // Scope-of-work grid: geyser assembly vs plumbing run
  const scopeGrid = g
    ? [
        `<div class="scope-item"><strong>Job:</strong> ${g.jobType==="burst_replacement"?"Burst geyser replacement":"Element / thermostat repair"}</div>`,
        `<div class="scope-item"><strong>Size:</strong> ${g.size}L</div>`,
        g.jobType==="burst_replacement"?`<div class="scope-item"><strong>Brand:</strong> ${g.brand} (B-rated, 5yr warranty)</div>`:"",
        g.jobType==="element_repair"?`<div class="scope-item"><strong>Solar geyser:</strong> ${g.solar?"Yes — thermostat retained":"No"}</div>`:"",
        ...scope.map(l=>`<div class="scope-item"><strong>${l.qty}× ${l.description}</strong></div>`),
        `<div class="scope-item"><strong>Commercial rules:</strong> ${ladderLabel(cfg)}</div>`,
      ].filter(Boolean).join("")
    : `${(inp.supplyLines ?? []).filter(l=>l.metres>0).map(l=>`<div class="scope-item"><strong>Supply:</strong> ${l.metres}m ${l.type} ${l.diameter?l.diameter+"mm":""}</div>`).join("")}<div class="scope-item"><strong>Water points:</strong> ${inp.points}</div>${(inp.drainLines ?? []).filter(l=>l.metres>0).map(l=>`<div class="scope-item"><strong>Drainage:</strong> ${l.metres}m ${l.type} ${l.diameter?l.diameter+"mm":""}</div>`).join("")}${fixtureLines.map(l=>`<div class="scope-item"><strong>${l}</strong></div>`).join("")}${fittingLines.map(l=>`<div class="scope-item"><strong>${l}</strong></div>`).join("")}<div class="scope-item"><strong>Commercial rules:</strong> ${ladderLabel(cfg)}</div>`;
  const scopeIntro = g
    ? `Supply and installation of a ${g.size}L ${g.jobType==="burst_replacement"?`${g.brand} geyser replacement assembly`:"geyser element / thermostat repair"} as set out below.`
    : "Supply and installation of plumbing connection assemblies as set out below.";
  const assumptions = g
    ? [
        `Asset: ${g.size}L geyser, ${g.jobType==="burst_replacement"?`${g.brand} B-rated (5yr warranty)`:"element/thermostat repair"}`,
        "Commercial rules: ${ladderLabel(cfg)}",
        "Geyser unit + kit costs back-derived (Assumption) — confirm buy-prices [VR-07, VR-08]",
        "Labour block crew-derived (Assumption) — confirm vs actual crew hours [VR-09]",
        g.size===200?"200L pricing interpolated — no direct quote evidence":"",
        g.size===250?"250L evidence stale (2022) — reverify before client issue":"",
      ].filter(Boolean)
    : [
        `Supply: ${(inp.supplyLines ?? []).filter(l=>l.metres>0).map(l=>`${l.metres}m ${l.type} ${l.diameter}mm`).join(", ") || "none"}`,
        `Water points: ${inp.points}`,
        `Drainage: ${(inp.drainLines ?? []).filter(l=>l.metres>0).map(l=>`${l.metres}m ${l.type} ${l.diameter}mm`).join(", ") || "none"}`,
        `Trenching: ${inp.trenching?"Yes":"No"}`,
        "Pipe rates per-metre from pack price (Plumblink 2026, excl VAT)",
        "Commercial rules: ${ladderLabel(cfg)}",
        "SA productivity factor: ×1.20 on Spon's UK constants (Assumption VR-05)",
      ];
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${quoteRef} — Plumbing Quotation</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#1a1a2e;background:#fff}.page{max-width:800px;margin:0 auto;padding:32px 40px}.header{background:#0D1B2A;padding:24px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #F5A623}.logo-mark{width:42px;height:42px;background:#F5A623;clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:#0D1B2A}.logo-text{color:#F5A623;font-weight:900;font-size:20px}.logo-sub{color:#8FA3B8;font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-top:2px}.quote-label{text-align:right}.quote-label h2{color:#F5A623;font-size:22px;letter-spacing:3px;text-transform:uppercase}.quote-label p{color:#8FA3B8;font-size:11px;margin-top:4px}.quote-label strong{color:#fff}.parties{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:28px 0;border:1px solid #e0e5ec}.party{padding:18px 20px}.party:first-child{border-right:1px solid #e0e5ec}.party-label{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#8FA3B8;margin-bottom:6px}.party h3{font-size:15px;font-weight:800;color:#0D1B2A}.party p{font-size:11px;color:#6B859E;margin-top:3px}.section-bar{background:#0D1B2A;color:#F5A623;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:7px 16px;margin:20px 0 0}.scope-box{border:1px solid #e0e5ec;border-top:none;padding:16px;margin-bottom:0}.scope-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-top:8px}.scope-item{font-size:11px;color:#4A6080;padding:2px 0}.scope-item strong{color:#0D1B2A}table{width:100%;border-collapse:collapse;margin-top:0}thead tr{background:#0D1B2A}thead th{color:#8FA3B8;font-size:10px;font-weight:600;text-align:left;padding:8px 16px}thead th:last-child{text-align:right}tbody tr{border-bottom:1px solid #f0f4f8}tbody tr:nth-child(odd){background:#f7f8fa}td{padding:10px 16px;font-size:12px;color:#0D1B2A}td:last-child{text-align:right;font-weight:600}td .sub{font-size:10px;color:#8FA3B8;margin-top:2px}.totals{margin-top:0;border:1px solid #e0e5ec;border-top:none}.total-row{display:flex;justify-content:space-between;padding:9px 16px;font-size:12px;border-bottom:1px solid #f0f4f8}.total-final{background:#0D1B2A;color:#fff;display:flex;justify-content:space-between;padding:14px 16px;font-size:16px;font-weight:900}.total-final span:last-child{color:#F5A623}.bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:24px 0}.bottom-box{font-size:11px;color:#4A6080;line-height:1.7}.bottom-box h4{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#0D1B2A;font-weight:700;margin-bottom:6px}.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:16px}.sig-line{border-top:1px solid #ccc;padding-top:6px;font-size:10px;color:#8FA3B8;text-transform:uppercase}.footer{margin-top:32px;text-align:center;font-size:9px;color:#8FA3B8;text-transform:uppercase}.gold-bar{height:3px;background:#F5A623;margin:0}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="page">
<div class="header"><div style="display:flex;align-items:center;gap:14px"><div class="logo-mark">CO</div><div><div class="logo-text">ContractorOS</div><div class="logo-sub">Plumbing · One Job. Four Outputs.</div></div></div><div class="quote-label"><h2>Quotation</h2><p>Ref: <strong>${quoteRef}</strong></p><p>${today()} · <strong>DRAFT</strong></p><p>Valid: ${cfg.quoteValidityDays} days</p></div></div>
<div class="gold-bar"></div>
<div class="parties"><div class="party"><div class="party-label">From</div><h3>${biz}</h3><p>${cfg.vatNumber?`VAT no. ${cfg.vatNumber}`:"Not VAT registered"}</p><p>${[cfg.contactName,cfg.phone,cfg.email].filter(Boolean).join(" · ")||"Phone · Email"}</p></div><div class="party"><div class="party-label">To</div><h3>${inp.projectName||"Project"}</h3><p>${inp.clientName||"Client name &amp; site address"}</p></div></div>
<div class="section-bar">Scope of Work</div><div class="scope-box"><p style="font-size:11px;color:#4A6080;line-height:1.6">${scopeIntro}</p><div class="scope-grid">${scopeGrid}</div></div>
<div class="section-bar">Pricing</div><table><thead><tr><th>Description</th><th style="text-align:right">Amount (excl VAT)</th></tr></thead><tbody><tr><td>Materials &amp; Supply<div class="sub">${g?"Geyser unit, valves, tray, vacuum breakers, consumables":"Pipe, fittings, connection assemblies, consumables"}</div></td><td>${fmtN(mat)}</td></tr><tr><td>Labour &amp; Installation<div class="sub">${g?(g.jobType==="burst_replacement"?"Remove old geyser, install &amp; commission new assembly":"Element / thermostat repair labour"):"Pipework, point make-off, fixture connection"}</div></td><td>${fmtN(lab)}</td></tr><tr><td>Project allowances &amp; margin<div class="sub">Waste, risk, contingency &amp; markup</div></td><td>${fmtN(allow)}</td></tr></tbody></table>
<div class="totals"><div class="total-row"><span>Subtotal (excl VAT)</span><span>R ${fmtN(ld.sell)}</span></div><div class="total-row"><span>VAT @ ${cfg.vatRatePct}%</span><span>R ${fmtN(vat)}</span></div></div>
<div class="total-final"><span>Total Due</span><span>R ${fmtN(total)}</span></div>
<div class="bottom-grid"><div class="bottom-box"><h4>Assumptions</h4>${assumptions.map(a=>`<div>— ${a}</div>`).join("")}</div><div class="bottom-box"><h4>Exclusions &amp; Terms</h4><div>— Builder's work, tiling, electrical and making-good excluded.</div><div>— 50% deposit on acceptance; balance on completion.</div><div>— Quote valid ${cfg.quoteValidityDays} days; subject to site confirmation.</div>${cfg.termsConditions?`<div>— ${cfg.termsConditions}</div>`:""}</div></div>
<div class="section-bar">Acceptance</div><div class="sig-grid" style="margin-top:24px"><div class="sig-line">Client Signature</div><div class="sig-line">For ${biz}</div></div>
<div class="footer">ContractorOS — One Job. Four Outputs. · ${quoteRef} · All prices excl. VAT</div>
</div></body></html>`;
  const blob = new Blob([html],{type:"text/html"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=`${quoteRef}_Quote.html`; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}

function printBuyPDF(inp: Inputs, scope: ScopeLine[], quoteRef: string) {
  const bySupplier: Record<string, ScopeLine[]> = {};
  scope.forEach(l=>{const s=l.supplier||"Other";if(!bySupplier[s])bySupplier[s]=[];bySupplier[s].push(l);});
  const matTotal=scope.reduce((s,l)=>s+l.total,0);
  const supplierBlocks=Object.entries(bySupplier).map(([sup,items])=>{
    const st=items.reduce((s,l)=>s+l.total,0);
    return `<div style="background:#0D1B2A;color:#F5A623;font-size:10px;font-weight:700;padding:7px 10px;display:flex;justify-content:space-between"><span>${sup.toUpperCase()} (${items.length})</span><span>R ${fmtN(st)}</span></div>${items.map(l=>`<tr><td style="padding:8px 10px;font-family:monospace;font-size:10px;color:#6B859E">${l.code}</td><td style="padding:8px 10px">${l.description}</td><td style="padding:8px 10px;text-align:right;font-weight:600">${l.qty}</td><td style="padding:8px 10px">${l.unit}</td><td style="padding:8px 10px;text-align:right">R ${fmtN(l.unitPrice)}</td><td style="padding:8px 10px;text-align:right;font-weight:700">R ${fmtN(l.total)}</td></tr>`).join("")}`;
  }).join("");
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${quoteRef} — Buy List</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;color:#1a1a2e}.page{max-width:900px;margin:0 auto;padding:28px 36px}.header{background:#0D1B2A;padding:20px 28px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #F5A623}.gold-bar{height:3px;background:#F5A623}table{width:100%;border-collapse:collapse}thead tr{background:#f0f4f8}thead th{font-size:9px;font-weight:700;text-transform:uppercase;color:#6B859E;padding:8px 10px;text-align:left;border-bottom:2px solid #e0e5ec}tbody tr{border-bottom:1px solid #f0f4f8}tbody tr:nth-child(odd){background:#f7f8fa}.tot-final{background:#0D1B2A;color:#fff;display:flex;justify-content:space-between;padding:14px 16px;font-size:16px;font-weight:900}.tot-final span:last-child{color:#F5A623}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="page"><div class="header"><div style="color:#F5A623;font-weight:900;font-size:18px">ContractorOS — Buy List</div><div style="text-align:right;color:#8FA3B8;font-size:11px">Quote: <strong style="color:#fff">${quoteRef}</strong><br>${today()}</div></div><div class="gold-bar"></div><table><thead><tr><th>Code</th><th>Description</th><th style="text-align:right">Qty</th><th>Unit</th><th style="text-align:right">Rate</th><th style="text-align:right">Line (excl VAT)</th></tr></thead><tbody>${supplierBlocks}</tbody></table><div class="tot-final"><span>Procurement Total (excl VAT)</span><span>R ${fmtN(matTotal)}</span></div></div></body></html>`;
  const blob=new Blob([html],{type:"text/html"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`${quoteRef}_BuyList.html`; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}

// ─── LOGO ─────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div style={{display:"flex",alignItems:"center",gap:12}}>
      <div style={{width:34,height:34,background:C.gold,flexShrink:0,
        clipPath:"polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)",
        display:"flex",alignItems:"center",justifyContent:"center"}}>
        <span style={{fontSize:11,fontWeight:900,color:C.navy}}>CO</span>
      </div>
      <div>
        <div style={{color:C.gold,fontWeight:900,fontSize:16}}>ContractorOS</div>
        <div style={{color:C.muted,fontSize:9,letterSpacing:1.5,textTransform:"uppercase"}}>Plumbing · One Job. Four Outputs.</div>
      </div>
    </div>
  );
}

// ─── SCAN PANEL ───────────────────────────────────────────────────────────────
function ScanDrawingPanel({ onExtracted }: { onExtracted: (data: Inputs) => void }) {
  const [phase, setPhase]     = useState<"idle"|"preview"|"scanning"|"confirming"|"error">("idle");
  const [imgB64, setImgB64]   = useState<string|null>(null);
  const [imgType, setImgType] = useState("image/jpeg");
  const [preview, setPreview] = useState<string|null>(null);
  const [extracted, setExtracted] = useState<any>(null);
  const [edited, setEdited]   = useState<any>(null);
  const [error, setError]     = useState("");

  const loadFile = (file: File|null|undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please provide a PNG, JPG or WEBP image."); setPhase("error"); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const b64 = (ev.target?.result as string).split(",")[1];
      setImgB64(b64); setImgType(file.type);
      setPreview(ev.target?.result as string); setPhase("preview");
    };
    reader.onerror = () => { setError("File could not be read."); setPhase("error"); };
    reader.readAsDataURL(file);
  };

  const runScan = async () => {
    setPhase("scanning"); setError("");
    // Calls the Supabase `scan-drawing` edge function, which holds the Anthropic
    // API key server-side and returns parsed plumbing parameters as JSON.
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/scan-drawing`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ imageBase64: imgB64, mediaType: imgType }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.success) {
        throw new Error(data?.error || `Scan service error (HTTP ${r.status})`);
      }
      const parsed = data.extraction;
      setExtracted(parsed); setEdited(JSON.parse(JSON.stringify(parsed))); setPhase("confirming");
    } catch(e: any) { setError(`Scan failed — ${e.message}`); setPhase("error"); }
  };

  const confirmExtraction = () => {
    const e = edited;
    const totalFix = Object.values(e.fixtures||{}).reduce((s: number,v: any)=>s+(v||0),0);
    onExtracted({
      projectName:"Drawing Scan — "+new Date().toLocaleDateString("en-ZA"),
      clientName:"", pipeType:"PEX 15mm (Cobra)",
      supplyMetres:e.supplyMetres||Math.round((e.floorArea||50)*0.4),
      drainMetres:e.drainMetres||0,
      points:e.points||Math.max(totalFix as number,1),
      trenching:e.trenching!==false,
      fixtures:{toilet:e.fixtures?.toilet||0,basin:e.fixtures?.basin||0,shower:e.fixtures?.shower||0,
        showerDoor:e.fixtures?.showerDoor||0,showerRose:e.fixtures?.showerRose||0,
        showerArm:e.fixtures?.showerArm||0,kitchenMixer:e.fixtures?.kitchenMixer||0},
      _scanNotes:e.notes, _scanConf:e.confidence,
    });
  };

  const NF = ({ label, path, isFix }: { label: string; path: string; isFix: boolean }) => {
    const val = isFix ? edited?.fixtures?.[path] : edited?.[path];
    return (
      <div style={{display:"flex",flexDirection:"column",gap:3}}>
        <label style={{fontSize:10,color:C.slateL,fontWeight:600}}>{label}</label>
        <input type="number" min={0} value={val??""} placeholder="—"
          onChange={ev=>{const v=parseFloat(ev.target.value)||0;
            setEdited((p: any)=>isFix?{...p,fixtures:{...p.fixtures,[path]:v}}:{...p,[path]:v});}}
          style={{padding:"6px 8px",border:`1px solid ${(val===null||val===undefined)?"#E67E22":"#C8D0DB"}`,
            borderRadius:6,fontSize:13,background:(val===null||val===undefined)?"#FEF5E7":"#fff",width:"100%",boxSizing:"border-box"}}/>
      </div>
    );
  };

  if (phase==="idle") return (
    <div style={{padding:20}}>
      <div style={{background:C.navyMid,borderRadius:10,padding:"28px 24px",textAlign:"center",border:`1px solid ${C.gold}30`}}>
        <div style={{fontSize:44,marginBottom:10}}>📐</div>
        <div style={{color:C.gold,fontWeight:800,fontSize:17,marginBottom:8}}>Scan Architectural Drawing</div>
        <div style={{color:C.slateL,fontSize:12,lineHeight:1.7,maxWidth:380,margin:"0 auto 20px"}}>Select a floor plan image. Claude vision will count fixtures, read room labels and estimate pipe run lengths automatically.</div>
        <label style={{display:"inline-block",cursor:"pointer",position:"relative"}}>
          <div style={{background:C.gold,color:C.navy,padding:"11px 28px",borderRadius:8,fontWeight:800,fontSize:14,display:"inline-block"}}>📂 Choose Floor Plan Image</div>
          <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={e=>loadFile(e.target.files?.[0])}
            style={{position:"absolute",opacity:0,inset:0,width:"100%",height:"100%",cursor:"pointer"}}/>
        </label>
        <div style={{color:C.muted,fontSize:10,marginTop:8}}>PNG · JPG · WEBP</div>
      </div>
      <div style={{background:"#FEF5E7",border:`1px solid ${C.amber}40`,borderRadius:6,padding:"8px 14px",marginTop:12,fontSize:11,color:C.navy}}>
        ⚠ <strong>Review aid, not authority.</strong> All extracted values require your confirmation before any costing is generated.
      </div>
    </div>
  );

  if (phase==="preview") return (
    <div style={{padding:16}}>
      <SectionHeader>Drawing Preview — Ready to Analyse</SectionHeader>
      <div style={{background:"#fff",padding:14,textAlign:"center",border:"1px solid #DDE3EA",borderTop:"none"}}>
        <img src={preview!} alt="floor plan" style={{maxWidth:"100%",maxHeight:420,objectFit:"contain",borderRadius:6}}/>
      </div>
      <div style={{padding:"12px 0",display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={()=>{setImgB64(null);setPreview(null);setPhase("idle");}}
          style={{padding:"8px 16px",borderRadius:6,border:"1px solid #C8D0DB",background:"#fff",color:C.slate,cursor:"pointer",fontWeight:600,fontSize:12}}>← Different image</button>
        <button onClick={runScan}
          style={{padding:"8px 24px",borderRadius:6,border:"none",background:C.gold,color:C.navy,cursor:"pointer",fontWeight:800,fontSize:13}}>Analyse Drawing →</button>
      </div>
    </div>
  );

  if (phase==="scanning") return (
    <div style={{padding:"48px 20px",textAlign:"center"}}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={{fontSize:40,display:"inline-block",animation:"spin 1.2s linear infinite",marginBottom:16}}>⚙️</div>
      <div style={{color:C.navy,fontWeight:700,fontSize:16,marginBottom:6}}>Analysing floor plan…</div>
      <div style={{color:C.slateL,fontSize:12}}>Claude vision is counting fixtures and estimating pipe runs.</div>
    </div>
  );

  if (phase==="error") return (
    <div style={{padding:20}}>
      <div style={{background:"#FDEDEC",border:"1px solid #E74C3C40",borderRadius:8,padding:"16px 20px"}}>
        <div style={{fontWeight:700,color:C.red,marginBottom:8}}>⚠ Scan failed</div>
        <div style={{fontSize:12,color:C.navy,marginBottom:12,lineHeight:1.6}}>{error}</div>
        <button onClick={()=>{setPhase("idle");setError("");}}
          style={{padding:"7px 16px",borderRadius:6,border:"1px solid #C8D0DB",background:"#fff",color:C.slate,cursor:"pointer",fontWeight:600,fontSize:12}}>← Try again</button>
      </div>
    </div>
  );

  if (phase==="confirming"&&edited) return (
    <div style={{padding:16}}>
      <div style={{background:`linear-gradient(90deg,${C.navyMid},${C.navy})`,borderRadius:8,padding:"12px 16px",marginBottom:12,border:`1px solid ${C.gold}30`}}>
        <div style={{color:C.gold,fontWeight:800,fontSize:14}}>Extraction Complete</div>
        <div style={{color:C.slateL,fontSize:11,marginTop:2}}>Confidence: <strong style={{color:"#fff"}}>{extracted?.confidence||"—"}</strong> · Correct any errors then confirm.</div>
      </div>
      {extracted?.notes&&<div style={{background:"#FEF5E7",border:`1px solid ${C.amber}40`,borderRadius:6,padding:"10px 14px",marginBottom:12,fontSize:11,color:C.navy}}><strong>📋 What Claude read:</strong> {extracted.notes}</div>}
      <div style={{background:"#fff",borderRadius:8,border:"1px solid #DDE3EA",overflow:"hidden",marginBottom:12}}>
        <SectionHeader>Extracted Parameters — correct if needed</SectionHeader>
        <div style={{padding:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <NF label="Floor area (m²)"    path="floorArea"    isFix={false}/>
            <NF label="Supply run (m)"     path="supplyMetres" isFix={false}/>
            <NF label="Drain run (m)"      path="drainMetres"  isFix={false}/>
            <NF label="Points (make-offs)" path="points"       isFix={false}/>
          </div>
          <div style={{fontWeight:700,fontSize:10,color:C.slateL,letterSpacing:0.8,textTransform:"uppercase",marginBottom:8}}>Fixtures counted</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
            <NF label="Toilets"        path="toilet"        isFix={true}/>
            <NF label="Basins"         path="basin"         isFix={true}/>
            <NF label="Shower mixers"  path="shower"        isFix={true}/>
            <NF label="Shower doors"   path="showerDoor"    isFix={true}/>
            <NF label="Shower roses"   path="showerRose"    isFix={true}/>
            <NF label="Shower arms"    path="showerArm"     isFix={true}/>
            <NF label="Kitchen mixers" path="kitchenMixer"  isFix={true}/>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
            <input type="checkbox" checked={edited.trenching!==false} onChange={ev=>setEdited((p: any)=>({...p,trenching:ev.target.checked}))} style={{width:16,height:16}}/>
            <span style={{fontSize:13,color:C.navy}}>Include trench excavation labour</span>
          </label>
        </div>
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={()=>setPhase("preview")} style={{padding:"8px 16px",borderRadius:6,border:"1px solid #C8D0DB",background:"#fff",color:C.slate,cursor:"pointer",fontWeight:600,fontSize:12}}>← Back</button>
        <button onClick={confirmExtraction} style={{padding:"8px 28px",borderRadius:6,border:"none",background:C.gold,color:C.navy,cursor:"pointer",fontWeight:800,fontSize:13}}>Confirm &amp; Build Scope →</button>
      </div>
    </div>
  );
  return null;
}

// ─── SCOPE MODAL ──────────────────────────────────────────────────────────────
function ScopeModal({ scope, labour, inputs, onConfirm, onBack }: { scope: ScopeLine[]; labour: LabourLine[]; inputs: Inputs; onConfirm: () => void; onBack: () => void }) {
  const mat=scope.reduce((s,l)=>s+l.total,0);
  const lab=labour.reduce((s,l)=>s+l.cost,0);
  const g=inputs._geyser;
  const items = g
    ? [
        g.jobType==="burst_replacement"
          ? `${g.size}L ${g.brand} B-rated geyser — remove & replace`
          : `${g.size}L geyser — element / thermostat repair`,
        ...scope.map(l=>`${l.qty}× ${l.description}`),
        `Labour: ${fmt(lab)} (${g.jobType==="burst_replacement"?"fixed crew block":"flat-rate repair"})`,
        g.solar?"Solar geyser — thermostat not replaced":null,
      ].filter(Boolean)
    : [
        ...((inputs.supplyLines ?? []).filter(l=>l.metres>0)
          .map(l=>`${l.metres}m ${l.type} ${l.diameter?l.diameter+"mm ":""}supply${l.source==="custom"?" (custom)":""}`)),
        `${inputs.points} plumbing points (make-offs)`,
        ...((inputs.drainLines ?? []).filter(l=>l.metres>0)
          .map(l=>`${l.metres}m ${l.type} ${l.diameter?l.diameter+"mm ":""}drainage${l.source==="custom"?" (custom)":""}`)),
        inputs.trenching?"Trench excavation included":"No trenching",
        ...((inputs.fixtureLines ?? []).filter(l=>l.quantity>0)
          .map(l=>`${l.quantity}× ${l.description || l.type}${l.source==="custom"?" (custom)":""}`)),
        ...((inputs.fittingLines ?? []).filter(l=>l.quantity>0)
          .map(l=>`${l.quantity}× ${l.label} ${l.size} (${l.family})`)),
      ].filter(Boolean);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(13,27,42,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:20}}>
      <div style={{background:"#fff",borderRadius:10,maxWidth:540,width:"100%",boxShadow:"0 24px 80px rgba(0,0,0,0.4)",overflow:"hidden"}}>
        <div style={{background:C.navy,padding:"16px 24px",borderBottom:`3px solid ${C.gold}`}}>
          <div style={{color:C.gold,fontWeight:800,fontSize:16}}>Scope of Work — Confirmation Gate</div>
          <div style={{color:C.muted,fontSize:12,marginTop:2}}>{inputs._scanNotes?"Extracted from scanned drawing":"From manual inputs"} · verify before pricing</div>
        </div>
        <div style={{padding:"20px 24px",maxHeight:"60vh",overflowY:"auto"}}>
          {inputs._scanNotes&&<div style={{background:"#FEF5E7",border:`1px solid ${C.amber}50`,borderRadius:6,padding:"8px 12px",marginBottom:12,fontSize:11,color:C.navy}}>📐 <strong>From scan:</strong> {inputs._scanNotes}</div>}
          <ul style={{paddingLeft:18,fontSize:13,color:C.navy,lineHeight:2}}>{items.map((item,i)=><li key={i}>{item}</li>)}</ul>
          <div style={{background:"#F0F4F8",borderRadius:6,padding:"12px 16px",marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:12}}>
            <div><div style={{color:C.slateL}}>Est. material</div><div style={{fontWeight:700,color:C.navy,fontSize:15}}>{fmt(mat)}</div></div>
            <div><div style={{color:C.slateL}}>Est. labour</div><div style={{fontWeight:700,color:C.navy,fontSize:15}}>{fmt(lab)}</div></div>
          </div>
          <div style={{background:"#FEF5E7",border:`1px solid ${C.amber}50`,borderRadius:6,padding:"8px 12px",marginTop:10,fontSize:11,color:C.navy}}>⚠ This is a review aid. Verify scope before generating the estimate.</div>
        </div>
        <div style={{padding:"12px 24px",borderTop:"1px solid #E0E5EC",display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onBack} style={{padding:"8px 18px",borderRadius:6,border:"1px solid #C8D0DB",background:"#fff",color:C.slate,cursor:"pointer",fontWeight:600,fontSize:12}}>← Revise</button>
          <button onClick={onConfirm} style={{padding:"8px 22px",borderRadius:6,border:"none",background:C.gold,color:C.navy,cursor:"pointer",fontWeight:800,fontSize:13}}>Confirm &amp; Generate Estimate →</button>
        </div>
      </div>
    </div>
  );
}

// ─── OUTPUT TABS ──────────────────────────────────────────────────────────────
function EstimateTab({ scope, labour, inputs, finalGrade, docRef, documentType, onPrintDocument, ladder, vatRate }: { scope: ScopeLine[]; labour: LabourLine[]; inputs: Inputs; finalGrade: string; docRef: string; documentType: DocumentType; onPrintDocument: () => void; ladder: LadderRates; vatRate: number }) {
  const mat=scope.reduce((s,l)=>s+l.total,0);
  const lab=labour.reduce((s,l)=>s+l.cost,0);
  const ld=applyLadder(mat,lab,ladder);
  const allow=ld.sell-ld.prime;
  const vatPct=+(vatRate*100).toFixed(2);
  // Invoices record actual work and are always issuable; quotes keep the strict gate.
  const issuable=documentType==="invoice"||GRADES[finalGrade]?.rank>=GRADES["Assumption"].rank;
  return (
    <div>
      <div style={{background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,borderRadius:8,padding:"20px 24px",margin:16,border:`1px solid ${C.gold}40`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
          <div>
            <div style={{color:C.muted,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>Sell Price (excl. VAT)</div>
            <div style={{color:C.gold,fontSize:36,fontWeight:900,letterSpacing:-1}}>{fmt(ld.sell)}</div>
            <div style={{color:C.slateL,fontSize:12,marginTop:4}}>{fmt(ld.sell*(1+vatRate))} incl. {vatPct}% VAT</div>
            <div style={{color:C.muted,fontSize:11,marginTop:2}}>{documentType==="invoice"?"Invoice":"Quote"} ref: {docRef}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <GradePill grade={finalGrade}/>
            <div style={{color:C.muted,fontSize:10,marginTop:6}}>{issuable?"✓ Internal use OK":"⚠ Not client-issuable"}</div>
            <button onClick={onPrintDocument} style={{marginTop:10,padding:"7px 16px",borderRadius:6,border:"none",background:C.gold,color:C.navy,cursor:"pointer",fontWeight:700,fontSize:12}}>⬇ Download {documentType==="invoice"?"Invoice":"Quote"}</button>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:16,paddingTop:16,borderTop:`1px solid ${C.navyLt}`}}>
          {[{l:"Materials",v:mat},{l:"Labour",v:lab},{l:"Allowances",v:allow}].map(c=>(
            <div key={c.l} style={{background:C.navyLt,borderRadius:6,padding:"8px 12px"}}>
              <div style={{color:C.muted,fontSize:10}}>{c.l}</div>
              <div style={{color:"#fff",fontWeight:700,fontSize:13}}>{fmt(c.v)}</div>
            </div>))}
        </div>
      </div>
      <SectionHeader>Commercial Ladder</SectionHeader>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <tbody>
          {[
            {l:"Material",v:mat,n:""},{l:"Labour",v:lab,n:""},
            {l:"Prime cost",v:ld.prime,n:"mat + lab"},{l:`+ Material waste ${ladder.wastePct}%`,v:ld.waste,n:"on material only"},
            {l:"= Direct cost",v:ld.direct,n:""},{l:`+ Risk ${ladder.riskPct}%`,v:ld.risk,n:"on direct"},
            {l:`+ Contingency ${ladder.contingencyPct}%`,v:ld.cont,n:"on risk-adjusted"},{l:`+ Margin ${ladder.marginPct}%`,v:ld.margin,n:"on cont-adjusted"},
            {l:"= Sell (excl. VAT)",v:ld.sell,n:"",bold:true},{l:`= Sell (incl. ${vatPct}% VAT)`,v:ld.sell*(1+vatRate),n:"",gold:true},
          ].map((r,i)=>(
            <tr key={i} style={{background:r.gold?`${C.gold}12`:r.bold?C.navyLt:i%2===0?C.offWhite:"#fff",borderBottom:"1px solid #E0E5EC"}}>
              <td style={{padding:"7px 16px",color:r.bold||r.gold?C.navy:C.slate,fontWeight:r.bold||r.gold?700:400}}>{r.l}</td>
              <td style={{padding:"7px 16px",textAlign:"right",fontWeight:r.bold||r.gold?700:400,color:r.gold?C.goldDim:C.navy}}>{fmt(r.v)}</td>
              <td style={{padding:"7px 16px",color:C.muted,fontSize:11,fontStyle:"italic"}}>{r.n}</td>
            </tr>))}
        </tbody>
      </table>
      <SectionHeader>Material Lines — {scope.length} items</SectionHeader>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:600}}>
          <thead><tr style={{background:C.navyLt,color:C.muted}}>
            {["Code","Description","Qty","Unit","Unit Price","Total","Grade"].map(h=>(
              <th key={h} style={{padding:"6px 10px",textAlign:"left",fontWeight:600,fontSize:10}}>{h}</th>))}
          </tr></thead>
          <tbody>{scope.map((l,i)=>(
            <tr key={l.id} style={{background:i%2===0?C.offWhite:"#fff",borderBottom:"1px solid #E8EDF2"}}>
              <td style={{padding:"6px 10px",fontFamily:"monospace",fontSize:10,color:C.slate}}>{l.code}</td>
              <td style={{padding:"6px 10px",color:C.navy}}>{l.description}</td>
              <td style={{padding:"6px 10px",textAlign:"right"}}>{l.qty}</td>
              <td style={{padding:"6px 10px",color:C.slateL}}>{l.unit}</td>
              <td style={{padding:"6px 10px",textAlign:"right"}}>{fmt(l.unitPrice)}</td>
              <td style={{padding:"6px 10px",textAlign:"right",fontWeight:600}}>{fmt(l.total)}</td>
              <td style={{padding:"6px 10px"}}><GradePill grade={l.conf}/></td>
            </tr>))}
          </tbody>
          <tfoot><tr style={{background:C.navyLt}}>
            <td colSpan={5} style={{padding:"8px 10px",fontWeight:700,color:"#fff"}}>Material Total</td>
            <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:C.gold}}>{fmt(mat)}</td>
            <td/>
          </tr></tfoot>
        </table>
      </div>
    </div>
  );
}

function BuyTab({ scope, quoteRef, onPrintBuy }: { scope: ScopeLine[]; inputs: Inputs; quoteRef: string; onPrintBuy: () => void }) {
  const bySupplier: Record<string, ScopeLine[]> = {};
  scope.forEach(l=>{const s=l.supplier||"Other";if(!bySupplier[s])bySupplier[s]=[];bySupplier[s].push(l);});
  const total=scope.reduce((s,l)=>s+l.total,0);
  return (
    <div>
      <div style={{background:`linear-gradient(90deg,${C.navyMid},${C.navy})`,padding:"12px 20px",borderRadius:8,margin:16,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${C.gold}30`}}>
        <div>
          <div style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Procurement Total (excl. VAT)</div>
          <div style={{color:C.gold,fontSize:26,fontWeight:900}}>{fmt(total)}</div>
          <div style={{color:C.slateL,fontSize:11}}>{fmt(total*1.15)} incl. VAT · {scope.length} lines</div>
        </div>
        <button onClick={onPrintBuy} style={{padding:"8px 18px",borderRadius:6,border:"none",background:C.gold,color:C.navy,cursor:"pointer",fontWeight:700,fontSize:12}}>⬇ Download Buy List</button>
      </div>
      {Object.entries(bySupplier).map(([sup,items])=>{
        const st=items.reduce((s,l)=>s+l.total,0);
        return (
          <div key={sup}>
            <div style={{background:C.navyMid,color:C.gold,fontSize:11,fontWeight:700,letterSpacing:0.8,textTransform:"uppercase",padding:"6px 16px",display:"flex",justifyContent:"space-between"}}>
              <span>{sup} ({items.length})</span><span>{fmt(st)}</span>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500}}>
                <thead><tr style={{background:"#F0F4F8",color:C.slateL}}>
                  {["Code","Description","Qty","Unit","Unit Price","Total","Conf."].map(h=>(
                    <th key={h} style={{padding:"6px 10px",textAlign:"left",fontWeight:600,fontSize:10}}>{h}</th>))}
                </tr></thead>
                <tbody>{items.map((l,i)=>(
                  <tr key={l.id} style={{background:i%2===0?C.offWhite:"#fff",borderBottom:"1px solid #E8EDF2"}}>
                    <td style={{padding:"6px 10px",fontFamily:"monospace",fontSize:10,color:C.slateL}}>{l.code}</td>
                    <td style={{padding:"6px 10px",color:C.navy}}>{l.description}</td>
                    <td style={{padding:"6px 10px",textAlign:"right",fontWeight:600}}>{l.qty}</td>
                    <td style={{padding:"6px 10px",color:C.slateL}}>{l.unit}</td>
                    <td style={{padding:"6px 10px",textAlign:"right"}}>{fmt(l.unitPrice)}</td>
                    <td style={{padding:"6px 10px",textAlign:"right",fontWeight:600}}>{fmt(l.total)}</td>
                    <td style={{padding:"6px 10px"}}><GradePill grade={l.conf}/></td>
                  </tr>))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <div style={{background:"#FEF5E7",border:`1px solid ${C.amber}40`,borderRadius:6,padding:"10px 16px",margin:"0 0 8px",fontSize:11,color:C.navy}}>
        ⚠ Procurement document — not a client quote. Confirm pack sizes and round up to whole purchasable units. Add 15% VAT at purchase.
      </div>
    </div>
  );
}

function BuildTab({ labour }: { labour: LabourLine[] }) {
  const labTotal=labour.reduce((s,l)=>s+l.cost,0);
  const labHours=labour.reduce((s,l)=>s+l.hours,0);
  return (
    <div>
      <div style={{background:`linear-gradient(90deg,${C.navyMid},${C.navy})`,padding:"12px 20px",borderRadius:8,margin:16,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",border:`1px solid ${C.gold}30`,gap:16}}>
        {[{l:"Labour Cost",v:fmt(labTotal),gold:true},{l:"Man-Hours",v:`${labHours.toFixed(1)}hr`},{l:"Crew Days (2-man)",v:`${(labHours/8).toFixed(1)} days`}].map(c=>(
          <div key={c.l}>
            <div style={{color:C.muted,fontSize:10,textTransform:"uppercase"}}>{c.l}</div>
            <div style={{color:c.gold?C.gold:"#fff",fontWeight:700,fontSize:c.gold?20:15}}>{c.v}</div>
          </div>))}
      </div>
      <SectionHeader>Labour Breakdown</SectionHeader>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:500}}>
          <thead><tr style={{background:"#F0F4F8",color:C.slateL}}>
            {["Task","Hours","Rate/hr","Cost","Grade","Derivation"].map(h=>(
              <th key={h} style={{padding:"6px 10px",textAlign:"left",fontWeight:600,fontSize:10}}>{h}</th>))}
          </tr></thead>
          <tbody>{labour.map((l,i)=>(
            <tr key={l.id} style={{background:i%2===0?C.offWhite:"#fff",borderBottom:"1px solid #E8EDF2"}}>
              <td style={{padding:"6px 10px",color:C.navy}}>{l.description}</td>
              <td style={{padding:"6px 10px",textAlign:"right"}}>{l.hours.toFixed(2)}</td>
              <td style={{padding:"6px 10px",textAlign:"right"}}>{fmt(l.rate)}</td>
              <td style={{padding:"6px 10px",textAlign:"right",fontWeight:600}}>{fmt(l.cost)}</td>
              <td style={{padding:"6px 10px"}}><GradePill grade={l.conf}/></td>
              <td style={{padding:"6px 10px",color:C.slateL,fontSize:10,fontStyle:"italic"}}>{l.derivation}</td>
            </tr>))}
          </tbody>
          <tfoot><tr style={{background:C.navyLt}}>
            <td style={{padding:"8px 10px",fontWeight:700,color:"#fff"}}>Total</td>
            <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:"#fff"}}>{labHours.toFixed(2)}</td>
            <td/><td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:C.gold}}>{fmt(labTotal)}</td>
            <td colSpan={2}/>
          </tr></tfoot>
        </table>
      </div>
      <div style={{background:C.offWhite,border:"1px solid #E0E5EC",borderRadius:6,padding:"10px 16px",margin:"8px 0 0",fontSize:11,color:C.navy}}>
        Crew: 1 plumber R600/day + 1 assistant R260/day = R107.50/hr. SA adjustment ×1.20 on Spon's UK constants. <GradePill grade="Assumption"/> VR-05 open.
      </div>
    </div>
  );
}

function LearnTab({ scope, labour, flags=[], documentType="quote" }: { scope: ScopeLine[]; labour: LabourLine[]; flags?: string[]; documentType?: DocumentType }) {
  const isGeyser = scope.some(l=>l.code.startsWith("PLB-GEY"));
  const all=[...scope.map(l=>l.conf),...labour.map(l=>l.conf)];
  const weakest=all.reduce((m,g)=>(GRADES[g]?.rank<GRADES[m]?.rank?g:m),"Validated");
  const issuable=documentType==="invoice"||GRADES[weakest]?.rank>=GRADES["Derived"].rank;
  const plumbingVR=[
    {id:"VR-01",desc:"AfriCamps baseline extracted to per-unit intensities",grade:"Pending",  closes:"Quantities derived and recorded"},
    {id:"VR-02",desc:"Scaling model: linear vs taper vs split",            grade:"Assumption",closes:"QS source material reviewed"},
    {id:"VR-03",desc:"Productivity constants (Spon's-seeded)",             grade:"Sourced",  closes:"SA plumber field test validation"},
    {id:"VR-04",desc:"Fittings driver: per-metre vs per-point",            grade:"Assumption",closes:"Confirmed against real job data"},
    {id:"VR-05",desc:"SA adjustment factor ×1.20 on UK productivity",      grade:"Assumption",closes:"Field test confirms or revises"},
    {id:"VR-06",desc:"Supervising plumber day rate (R600/day)",            grade:"Assumption",closes:"Plumber network confirmation"},
  ];
  const geyserVR=[
    {id:"VR-07",desc:"Geyser unit buy-prices (Plumblink 2026, all sizes/brands)",grade:"Sourced",      closes:"CLOSED — screenshot-confirmed Sourced prices"},
    {id:"VR-08",desc:"Replacement kit (Builders install kit + drip tray, R868)",  grade:"Sourced",      closes:"CLOSED — real Builders Warehouse 2026 price"},
    {id:"VR-09",desc:"Geyser labour block (crew-derived)",                       grade:"Assumption",   closes:"Confirmed vs crew time on real jobs"},
    {id:"VR-10",desc:"Element-repair: ladder vs fixed-price",                    grade:"Open decision",closes:"Owner sets pricing convention"},
    {id:"VR-11",desc:"150L sell ~18% under 2024 market quote",                   grade:"Open decision",closes:"Confirm with Ruan: margin or labour (inputs confirmed)"},
  ];
  const openVR = isGeyser ? geyserVR : plumbingVR;
  return (
    <div>
      <div style={{background:issuable?"#EBF9EE":"#FDEDEC",border:`1px solid ${issuable?C.green:C.red}40`,borderRadius:8,padding:"14px 20px",margin:16}}>
        <div style={{fontWeight:700,color:issuable?C.green:C.red,fontSize:13}}>
          {issuable?"✓ INTERNAL USE — produceable at flagged grade":"✗ NOT CLIENT-ISSUABLE — resolve flagged inputs first"}
        </div>
        <div style={{color:C.navy,fontSize:12,marginTop:4}}>Output grade: <GradePill grade={weakest}/></div>
      </div>
      {flags.length>0&&(
        <>
          <SectionHeader>Assembly Flags — must clear before client issue</SectionHeader>
          <div style={{padding:"10px 16px"}}>
            {flags.map((f,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",background:"#FEF5E7",border:`1px solid ${C.amber}40`,borderRadius:6,padding:"8px 12px",marginBottom:6,fontSize:11,color:C.navy}}>
                <span>⚠</span><span>{f}</span>
              </div>))}
          </div>
        </>
      )}
      <SectionHeader>Validation Register</SectionHeader>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:420}}>
          <thead><tr style={{background:"#F0F4F8"}}>
            {["ID","Description","Grade","Closes when"].map(h=>(<th key={h} style={{padding:"6px 10px",textAlign:"left",fontWeight:600,color:C.slateL,fontSize:10}}>{h}</th>))}
          </tr></thead>
          <tbody>{openVR.map((v,i)=>(
            <tr key={v.id} style={{background:i%2===0?C.offWhite:"#fff",borderBottom:"1px solid #E8EDF2"}}>
              <td style={{padding:"7px 10px",fontFamily:"monospace",color:C.slate,fontWeight:700}}>{v.id}</td>
              <td style={{padding:"7px 10px",color:C.navy}}>{v.desc}</td>
              <td style={{padding:"7px 10px"}}><GradePill grade={v.grade}/></td>
              <td style={{padding:"7px 10px",color:C.slateL,fontSize:10,fontStyle:"italic"}}>{v.closes}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
      <SectionHeader>Derivation Audit — all lines</SectionHeader>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,minWidth:380}}>
          <thead><tr style={{background:"#F0F4F8"}}>
            {["ID","Description","Derivation","Grade"].map(h=>(<th key={h} style={{padding:"5px 10px",textAlign:"left",fontWeight:600,color:C.slateL}}>{h}</th>))}
          </tr></thead>
          <tbody>{[...scope,...labour].map((l,i)=>(
            <tr key={l.id} style={{background:i%2===0?C.offWhite:"#fff",borderBottom:"1px solid #EDF0F5"}}>
              <td style={{padding:"5px 10px",fontFamily:"monospace",color:C.slateL}}>{l.id}</td>
              <td style={{padding:"5px 10px",color:C.navy}}>{l.description}</td>
              <td style={{padding:"5px 10px",color:C.slateL,fontStyle:"italic"}}>{l.derivation}</td>
              <td style={{padding:"5px 10px"}}><GradePill grade={l.conf}/></td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
function pipeLineFrom(use: 'supply'|'drainage', type: string, diameter: number, metres: number): PipeLine {
  const r = pipeRow(use, type, diameter);
  if (!r) return { ...makePipeLine(use), metres };
  return { id:_uid(), use, source:'library', pipeCode:r.code, type:r.type, diameter:r.diameter,
    description:r.description, perMetre:r.perMetre, metres, grade:r.grade, supplier:r.source };
}
const DEFAULT: Inputs = {
  projectName:"Bathroom Fit-out — 3 Fixture", clientName:"",
  pipeType:"PEX 15mm (Cobra)", supplyMetres:20, drainMetres:15, points:3, trenching:true,
  fixtures:{toilet:1,basin:1,shower:1,showerDoor:1,showerRose:1,showerArm:1,kitchenMixer:0},
  fixtureLines:(["toilet","basin","shower_mixer","shower_door","shower_rose"] as FixtureType[]).map(t=>makeFixtureLine(t)),
  fittingLines:[],
  supplyLines:[pipeLineFrom("supply","Copper",15,20)],
  drainLines:[pipeLineFrom("drainage","PVC",110,15)],
};

// Convert scan-extracted fixture counts into fixture lines (one preset line per type).
function scanFixturesToLines(f: Fixtures): FixtureLine[] {
  const map: [keyof Fixtures, FixtureType][] = [
    ["toilet","toilet"],["basin","basin"],["shower","shower_mixer"],
    ["showerDoor","shower_door"],["showerRose","shower_rose"],["kitchenMixer","kitchen_mixer"],
  ];
  const out: FixtureLine[] = [];
  for (const [k,t] of map) { const q=f[k]??0; if (q>0) out.push({ ...makeFixtureLine(t), quantity:q }); }
  return out;
}

const TABS = [
  {id:"estimate",label:"Estimate",icon:"📋"},
  {id:"buy",     label:"Buy",     icon:"🛒"},
  {id:"build",   label:"Build",   icon:"🔧"},
  {id:"learn",   label:"Learn",   icon:"📊"},
];

const GEYSER_DEFAULT: GeyserMeta = { jobType:"burst_replacement", size:150, brand:"Kwikot", solar:false };

// Document type (quote vs invoice) is chosen on the home page and arrives here
// as the ?doc search param — this page does not re-ask it.
const plumbingRoute = getRouteApi("/plumbing");

export default function EstimatePage() {
  const { doc } = plumbingRoute.useSearch();
  // Per-contractor configuration (commercial ladder, labour rates, VAT, identity,
  // document prefixes). Falls back to DEFAULT_SETTINGS for a first-time user.
  const { settings } = useSettings();
  const ladder = ladderFrom(settings);
  const vatRate = settings.vatRatePct / 100;
  const crewRateHr = crewRateFrom(settings);

  const [screen, setScreen] = useState<"entry"|"scan"|"review"|"output">("entry");
  const [tab,    setTab]    = useState("estimate");
  const [inputs, setInputs] = useState<Inputs>(DEFAULT);
  const [jobMode, setJobMode] = useState<"plumbing"|"geyser">("plumbing");
  const [geyser, setGeyser]   = useState<GeyserMeta>(GEYSER_DEFAULT);
  // Document mode comes from the home page (?doc) — quote vs invoice. Each keeps
  // its own reference. No on-page toggle: the choice was already made at home.
  const [documentType] = useState<DocumentType>(doc);
  const [quoteRef]   = useState(() => nextDocumentRef("quote", settings.quotePrefix));
  const [invoiceRef] = useState(() => nextDocumentRef("invoice"));
  const [invoiceMeta, setInvoiceMeta] = useState<InvoiceMeta>(() => {
    const issue = isoDate(new Date());
    return { issueDate: issue, dueDate: addDays(issue, settings.invoicePaymentDays), bankingDetails: settings.bankingDetails ?? "" };
  });
  const docRef = documentType === "invoice" ? invoiceRef : quoteRef;

  // Geyser assembly (fixed-composition) vs plumbing engine (baseline-and-scale)
  const geyserAsm = useMemo<GeyserAssembly | null>(() =>
    jobMode==="geyser"
      ? (geyser.jobType==="burst_replacement"
          ? buildGeyserReplacement(geyser.size, geyser.brand)
          : buildElementRepair(geyser.size, geyser.solar))
      : null, [jobMode, geyser]);

  const scope  = useMemo(()=> geyserAsm ? geyserToScope(geyserAsm)  : buildScope(inputs),  [geyserAsm, inputs]);
  const labour = useMemo(()=> geyserAsm ? geyserToLabour(geyserAsm, crewRateHr) : buildLabour(inputs, crewRateHr), [geyserAsm, inputs, crewRateHr]);
  // Flags: geyser flags, or warnings for any user-entered (custom) lines.
  const flags  = geyserAsm
    ? geyserAsm.flags
    : [
        ...(inputs.fixtureLines ?? []).filter(l => l.source==="custom" && l.quantity>0)
          .map(l => `Custom fixture line "${l.description || "(unnamed)"}" — user-entered price R${l.unitPrice}, unverified (Assumption)`),
        ...([...(inputs.supplyLines ?? []), ...(inputs.drainLines ?? [])]).filter(l => l.source==="custom" && l.metres>0)
          .map(l => `Custom ${l.use} pipe "${l.description || "(unnamed)"}" — user-entered R${l.perMetre}/m, unverified (Assumption)`),
      ];
  const finalGrade = useMemo(()=>{
    const all=[...scope.map(l=>l.conf),...labour.map(l=>l.conf)];
    return all.reduce((m,g)=>(GRADES[g]?.rank<GRADES[m]?.rank?g:m),"Validated");
  },[scope,labour]);

  // effInputs carries the geyser meta + a descriptive project name into the
  // header, scope modal, tabs and PDF generators.
  const geyserName = geyserAsm
    ? `${geyser.size}L ${geyser.jobType==="burst_replacement"?`${geyser.brand} geyser replacement`:"geyser element repair"}`
    : "";
  const effInputs: Inputs = geyserAsm
    ? { ...inputs, projectName: (inputs.projectName && inputs.projectName!==DEFAULT.projectName) ? inputs.projectName : geyserName, _geyser: geyser, _scanNotes: undefined }
    : inputs;

  const setInp = useCallback((k: keyof Inputs, v: unknown) => setInputs(p=>({...p,[k]:v})),[]);
  const setGey = useCallback((patch: Partial<GeyserMeta>) => setGeyser(p=>({...p,...patch})),[]);

  // Fixture-line builder management
  const addFixtureLine = useCallback((type: FixtureType) =>
    setInputs(p=>({...p, fixtureLines:[...(p.fixtureLines ?? []), makeFixtureLine(type)]})),[]);
  const removeFixtureLine = useCallback((id: string) =>
    setInputs(p=>({...p, fixtureLines:(p.fixtureLines ?? []).filter(l=>l.id!==id)})),[]);
  const updateFixtureLine = useCallback((id: string, patch: Partial<FixtureLine>) =>
    setInputs(p=>({...p, fixtureLines:(p.fixtureLines ?? []).map(l=>l.id===id?{...l,...patch}:l)})),[]);

  // Fitting-line builder management (compression fittings)
  const addFittingLine = useCallback(() =>
    setInputs(p=>({...p, fittingLines:[...(p.fittingLines ?? []), makeFittingLine()]})),[]);
  const removeFittingLine = useCallback((id: string) =>
    setInputs(p=>({...p, fittingLines:(p.fittingLines ?? []).filter(l=>l.id!==id)})),[]);
  const updateFittingLine = useCallback((id: string, patch: Partial<FittingLine>) =>
    setInputs(p=>({...p, fittingLines:(p.fittingLines ?? []).map(l=>l.id===id?{...l,...patch}:l)})),[]);

  // Pipe-line builder management (supply + drainage share these via the `key`)
  const addPipeLine = useCallback((use: 'supply'|'drainage') => {
    const key = use==='supply' ? 'supplyLines' : 'drainLines';
    setInputs(p=>({...p, [key]:[...(p[key] ?? []), makePipeLine(use)]}));
  },[]);
  const removePipeLine = useCallback((use: 'supply'|'drainage', id: string) => {
    const key = use==='supply' ? 'supplyLines' : 'drainLines';
    setInputs(p=>({...p, [key]:(p[key] ?? []).filter(l=>l.id!==id)}));
  },[]);
  const updatePipeLine = useCallback((use: 'supply'|'drainage', id: string, patch: Partial<PipeLine>) => {
    const key = use==='supply' ? 'supplyLines' : 'drainLines';
    setInputs(p=>({...p, [key]:(p[key] ?? []).map(l=>l.id===id?{...l,...patch}:l)}));
  },[]);

  const onScanDone = useCallback((data: Inputs) => {
    setJobMode("plumbing");
    setInputs({
      ...data,
      fixtureLines: scanFixturesToLines(data.fixtures),
      supplyLines: data.supplyMetres>0 ? [pipeLineFrom("supply","Copper",15,data.supplyMetres)] : [],
      drainLines:  data.drainMetres>0  ? [pipeLineFrom("drainage","PVC",110,data.drainMetres)] : [],
    });
    setScreen("review");
  },[]);

  const matTotal=scope.reduce((s,l)=>s+l.total,0);
  const labTotal=labour.reduce((s,l)=>s+l.cost,0);
  const sell=applyLadder(matTotal,labTotal,ladder).sell;

  // Output branches on document type: invoice → past-tense invoice with VAT, due
  // date & banking (printInvoiceDocument); quote → existing quotation PDF.
  const printDocument=()=> documentType==="invoice"
    ? printInvoiceDocument({ inputs:effInputs, scope, labour, invoiceRef:docRef, invoiceMeta, sellExVat:sell, vatRate, business:businessFrom(settings), vatNumber:settings.vatNumber, terms:settings.termsConditions })
    : printQuotePDF(effInputs,scope,labour,docRef,settings);
  const printBuy  =()=>printBuyPDF(effInputs,scope,docRef);

  const AppHeader = ({ showTabs }: { showTabs: boolean }) => (
    <div style={{background:C.navy,borderBottom:`3px solid ${C.gold}`,position:"sticky",top:0,zIndex:100}}>
      <div style={{maxWidth:960,margin:"0 auto",padding:"12px 20px",display:"flex",alignItems:"center",gap:14}}>
        <Link to="/" style={{textDecoration:"none"}}><Logo/></Link>
        <div style={{flex:1,marginLeft:4}}>
          {showTabs&&<div style={{color:C.slateL,fontSize:12}}>{effInputs.projectName}</div>}
        </div>
        <Link to="/profile" title="Profile & Settings" style={{color:C.gold,fontSize:12,fontWeight:600,textDecoration:"none",border:`1px solid ${C.gold}50`,borderRadius:6,padding:"5px 10px",whiteSpace:"nowrap"}}>⚙ Settings</Link>
        {showTabs
          ? <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <div style={{textAlign:"right"}}>
                <div style={{color:C.muted,fontSize:10,letterSpacing:0.5}}>{documentType==="invoice"?"AMOUNT DUE incl. VAT":"SELL PRICE excl. VAT"}</div>
                <div style={{color:C.gold,fontWeight:900,fontSize:20}}>{fmt(documentType==="invoice"?sell*(1+vatRate):sell)}</div>
                <div style={{color:C.slateL,fontSize:10}}>{documentType==="invoice"?"🧾 ":"📄 "}{docRef}</div>
              </div>
              <GradePill grade={finalGrade}/>
              <button onClick={()=>{setScreen("entry");setTab("estimate");}}
                style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${C.gold}50`,background:"transparent",color:C.gold,cursor:"pointer",fontSize:11,fontWeight:600}}>← Edit</button>
            </div>
          : <div style={{display:"flex",gap:6}}>
              {["Estimate","Buy","Build","Learn"].map(t=>(
                <span key={t} style={{background:`${C.gold}22`,color:C.gold,fontSize:10,padding:"2px 7px",borderRadius:4,fontWeight:700}}>{t}</span>))}
            </div>
        }
      </div>
      {showTabs&&(
        <div style={{maxWidth:960,margin:"0 auto",padding:"0 20px"}}>
          <div style={{display:"flex",gap:2}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{
                padding:"7px 18px",borderRadius:"6px 6px 0 0",cursor:"pointer",fontSize:13,
                border:`1px solid ${t.id===tab?C.gold+"60":"transparent"}`,borderBottom:"none",
                background:t.id===tab?"#fff":"transparent",
                color:t.id===tab?C.navy:C.muted,fontWeight:t.id===tab?700:400}}>
                {t.icon} {t.label}
              </button>))}
          </div>
        </div>
      )}
    </div>
  );

  if (screen==="scan") return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:"#F1F4F8",minHeight:"100vh"}}>
      <AppHeader showTabs={false}/>
      <div style={{maxWidth:680,margin:"0 auto",padding:"24px 20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button onClick={()=>setScreen("entry")} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #C8D0DB",background:"#fff",color:C.slate,cursor:"pointer",fontSize:12,fontWeight:600}}>← Manual entry</button>
          <span style={{color:C.slateL,fontSize:12}}>or upload a floor plan to auto-populate inputs</span>
        </div>
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #DDE3EA",overflow:"hidden"}}>
          <SectionHeader>📐 Scan Architectural Drawing</SectionHeader>
          <ScanDrawingPanel onExtracted={onScanDone}/>
        </div>
      </div>
    </div>
  );

  if (screen==="review") return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:"#F1F4F8",minHeight:"100vh"}}>
      <AppHeader showTabs={false}/>
      <ScopeModal scope={scope} labour={labour} inputs={effInputs}
        onConfirm={()=>{setTab("estimate");setScreen("output");}}
        onBack={()=>setScreen("entry")}/>
    </div>
  );

  if (screen==="output") return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:"#F1F4F8",minHeight:"100vh"}}>
      <AppHeader showTabs={true}/>
      <div style={{maxWidth:960,margin:"0 auto",padding:"0 20px 32px"}}>
        {inputs._scanNotes&&!geyserAsm&&<div style={{background:"#FEF5E7",border:`1px solid ${C.amber}40`,borderRadius:"0 0 6px 6px",padding:"6px 16px",fontSize:11,color:C.navy,marginBottom:4}}>📐 <strong>Scan-derived scope:</strong> {inputs._scanNotes}</div>}
        {geyserAsm&&<div style={{background:"#FEF5E7",border:`1px solid ${C.amber}40`,borderRadius:"0 0 6px 6px",padding:"6px 16px",fontSize:11,color:C.navy,marginBottom:4}}>♨ <strong>Geyser assembly · {finalGrade} grade:</strong> fixed-composition quote — {flags.length} note{flags.length===1?"":"s"} in the Learn tab{GRADES[finalGrade]?.rank>=GRADES["Derived"].rank?" · client-issuable through the normal gate.":" · not client-issuable until grade lifts."}</div>}
        <div style={{background:"#fff",borderRadius:"0 8px 8px 8px",border:"1px solid #DDE3EA",borderTop:"none",overflow:"hidden"}}>
          {tab==="estimate"&&<EstimateTab scope={scope} labour={labour} inputs={effInputs} finalGrade={finalGrade} docRef={docRef} documentType={documentType} onPrintDocument={printDocument} ladder={ladder} vatRate={vatRate}/>}
          {tab==="buy"    &&<BuyTab scope={scope} inputs={effInputs} quoteRef={docRef} onPrintBuy={printBuy}/>}
          {tab==="build"  &&<BuildTab labour={labour}/>}
          {tab==="learn"  &&<LearnTab scope={scope} labour={labour} flags={flags} documentType={documentType}/>}
        </div>
        <div style={{marginTop:8,fontSize:10,color:C.muted,textAlign:"center"}}>{geyserAsm?"ContractorOS v2 · Geyser Assembly (Tier 2) · Vissi evidence 2022–26 · true-cost + ladder · excl. VAT":"ContractorOS v2 · Plumbing Tier 2 · Plumblink/CTM/Gelmar 2025–26 · Spon's seed SA-adjusted · excl. VAT"}</div>
      </div>
    </div>
  );

  // Reusable supply/drainage pipe line builder (type + diameter + metres)
  const pipeSection = (use: 'supply'|'drainage', title: string, extra: React.ReactNode) => {
    const lines = ((use==='supply' ? inputs.supplyLines : inputs.drainLines) ?? []);
    const types = pipeTypesFor(use);
    return (
      <div style={{background:"#fff",borderRadius:8,border:"1px solid #DDE3EA",marginBottom:14,overflow:"hidden"}}>
        <SectionHeader>{title}</SectionHeader>
        <div style={{padding:"12px 16px"}}>
          {lines.length===0&&<div style={{fontSize:12,color:C.slateL,padding:"6px 2px 10px"}}>No {use} lines — add one below.</div>}
          {lines.map(l=>{
            const dias = l.source==="custom" ? [] : pipeDiametersFor(use,l.type);
            return (
            <div key={l.id} style={{border:"1px solid #E0E5EC",borderRadius:8,padding:"8px 10px",marginBottom:8,background:l.source==="custom"?"#FEF5E7":C.offWhite}}>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <select value={l.source==="custom"?"__custom__":l.type}
                  onChange={e=>{const v=e.target.value;
                    if(v==="__custom__"){updatePipeLine(use,l.id,{source:"custom",pipeCode:undefined,type:"Custom",diameter:0,description:"",perMetre:0,grade:"Assumption",supplier:undefined});}
                    else{const dia=pipeDiametersFor(use,v)[0];const r=pipeRow(use,v,dia);if(r)updatePipeLine(use,l.id,{source:"library",pipeCode:r.code,type:r.type,diameter:r.diameter,description:r.description,perMetre:r.perMetre,grade:r.grade,supplier:r.source});}}}
                  style={{padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12,minWidth:90}}>
                  {types.map(t=><option key={t} value={t}>{t}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
                {l.source!=="custom"&&(
                  <select value={l.diameter}
                    onChange={e=>{const d=parseInt(e.target.value);const r=pipeRow(use,l.type,d);if(r)updatePipeLine(use,l.id,{pipeCode:r.code,diameter:r.diameter,description:r.description,perMetre:r.perMetre,grade:r.grade});}}
                    style={{padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12,minWidth:80}}>
                    {dias.map(d=><option key={d} value={d}>{d}mm</option>)}
                  </select>)}
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <input type="number" min={0} value={l.metres}
                    onChange={e=>updatePipeLine(use,l.id,{metres:Math.max(0,parseFloat(e.target.value)||0)})}
                    style={{width:64,padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:14,fontWeight:700,textAlign:"center"}}/>
                  <span style={{fontSize:11,color:C.slateL}}>m</span>
                </div>
                <span style={{fontSize:10,color:C.slateL}}>R{l.perMetre.toFixed(2)}/m</span>
                <span style={{fontSize:11,color:C.navy,fontWeight:600,minWidth:64,textAlign:"right"}}>{fmt(l.metres*l.perMetre)}</span>
                <GradePill grade={l.grade}/>
                <button onClick={()=>removePipeLine(use,l.id)} title="Remove" style={{padding:"4px 9px",borderRadius:6,border:"1px solid #E0B4B4",background:"#fff",color:C.red,cursor:"pointer",fontSize:13,fontWeight:700}}>✕</button>
              </div>
              {l.source==="custom"&&(
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <input placeholder={`Custom ${use} pipe description`} value={l.description}
                    onChange={e=>updatePipeLine(use,l.id,{description:e.target.value})}
                    style={{flex:1,padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12}}/>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontSize:11,color:C.slateL}}>R</span>
                    <input type="number" min={0} step="0.01" placeholder="/m" value={l.perMetre||""}
                      onChange={e=>updatePipeLine(use,l.id,{perMetre:Math.max(0,parseFloat(e.target.value)||0)})}
                      style={{width:90,padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12}}/>
                    <span style={{fontSize:11,color:C.slateL}}>/m</span>
                  </div>
                </div>)}
            </div>);
          })}
          <button onClick={()=>addPipeLine(use)}
            style={{padding:"7px 14px",borderRadius:6,border:`1px dashed ${C.gold}`,background:C.goldPale,color:C.navy,cursor:"pointer",fontSize:12,fontWeight:700}}>+ Add {use==="supply"?"supply":"drain"} line</button>
          {extra}
        </div>
      </div>
    );
  };

  // ENTRY FORM
  return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:"#F1F4F8",minHeight:"100vh"}}>
      <AppHeader showTabs={false}/>
      <div style={{maxWidth:780,margin:"0 auto",padding:"24px 20px"}}>
        {/* Document type (quote vs invoice) is set on the home page and arrives
            via the ?doc search param — no on-page toggle here. */}
        {documentType==="invoice"&&(
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #DDE3EA",marginBottom:16,overflow:"hidden"}}>
          <SectionHeader>🧾 Invoice details — issued for work completed</SectionHeader>
          <div style={{padding:"14px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={{display:"block",fontSize:11,color:C.slateL,marginBottom:3,fontWeight:600}}>Issue date</label>
              <input type="date" value={invoiceMeta.issueDate}
                onChange={e=>setInvoiceMeta(m=>({...m,issueDate:e.target.value,dueDate:addDays(e.target.value,7)}))}
                style={{width:"100%",padding:"7px 10px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:13,color:C.navy,boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,color:C.slateL,marginBottom:3,fontWeight:600}}>Due date <span style={{color:C.muted,fontWeight:400}}>(default issue + 7 days)</span></label>
              <input type="date" value={invoiceMeta.dueDate}
                onChange={e=>setInvoiceMeta(m=>({...m,dueDate:e.target.value}))}
                style={{width:"100%",padding:"7px 10px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:13,color:C.navy,boxSizing:"border-box"}}/>
            </div>
            <div style={{gridColumn:"1 / -1"}}>
              <label style={{display:"block",fontSize:11,color:C.slateL,marginBottom:3,fontWeight:600}}>Banking details</label>
              <textarea value={invoiceMeta.bankingDetails} rows={2}
                placeholder={DEFAULT_BANKING_DETAILS}
                onChange={e=>setInvoiceMeta(m=>({...m,bankingDetails:e.target.value}))}
                style={{width:"100%",padding:"7px 10px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12,color:C.navy,boxSizing:"border-box",fontFamily:"inherit",resize:"vertical"}}/>
              <div style={{fontSize:10,color:C.muted,marginTop:3}}>Invoice ref: <strong>{invoiceRef}</strong> · totals include 15% VAT · payment due {invoiceMeta.dueDate||"—"}</div>
            </div>
          </div>
        </div>)}

        {/* Job-type selector — a single dropdown replacing the old button rows.
            Plumbing Estimate / Geyser Replacement / Scan Drawing. The document
            type (quote vs invoice) is NOT chosen here — it arrives from home. */}
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #DDE3EA",marginBottom:14,overflow:"hidden"}}>
          <SectionHeader>Job type</SectionHeader>
          <div style={{padding:"14px 20px"}}>
            <select
              value={jobMode==="geyser"?"geyser":"plumbing"}
              onChange={e=>{
                const v=e.target.value;
                if(v==="geyser"){setJobMode("geyser");}
                else if(v==="scan"){setJobMode("plumbing");setScreen("scan");}
                else{setJobMode("plumbing");setScreen("entry");}
              }}
              style={{width:"100%",padding:"11px 14px",border:`1px solid #C8D0DB`,borderRadius:8,
                fontSize:14,fontWeight:700,color:C.navy,background:C.white,cursor:"pointer",
                appearance:"none",
                backgroundImage:`url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23${C.gold.slice(1)}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>")`,
                backgroundRepeat:"no-repeat",backgroundPosition:"right 14px center"}}>
              <option value="plumbing">Plumbing Estimate</option>
              <option value="geyser">Geyser Replacement</option>
              <option value="scan">Scan Drawing</option>
            </select>
            <div style={{fontSize:11,color:C.muted,marginTop:8}}>
              Options: Plumbing Estimate · Geyser Replacement · Scan Drawing
            </div>
          </div>
        </div>

        <div style={{background:"#fff",borderRadius:8,border:"1px solid #DDE3EA",marginBottom:14,overflow:"hidden"}}>
          <SectionHeader>Project Details</SectionHeader>
          <div style={{padding:"14px 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {([{l:"Project / Job name",k:"projectName"},{l:"Client name (optional)",k:"clientName"}] as const).map(f=>(
              <div key={f.k}>
                <label style={{display:"block",fontSize:11,color:C.slateL,marginBottom:3,fontWeight:600}}>{f.l}</label>
                <input value={inputs[f.k] as string} onChange={e=>setInp(f.k,e.target.value)}
                  style={{width:"100%",padding:"7px 10px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:13,color:C.navy,boxSizing:"border-box"}}/>
              </div>))}
          </div>
        </div>

        {jobMode==="plumbing"&&(<>
        {pipeSection("supply","Supply Runs — Copper / PEX (type + diameter + metres)",
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,paddingTop:10,borderTop:"1px solid #EDF0F5"}}>
            <label style={{fontSize:11,color:C.slateL,fontWeight:600}}>Points (make-offs)</label>
            <input type="number" min={1} value={inputs.points}
              onChange={e=>setInp("points",Math.max(1,parseInt(e.target.value)||1))}
              style={{width:70,padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:13,textAlign:"center"}}/>
            <span style={{fontSize:10,color:C.muted}}>drives fittings & stop taps</span>
          </div>)}

        {pipeSection("drainage","Drainage — PVC (type + diameter + metres)",
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:10,paddingTop:10,borderTop:"1px solid #EDF0F5"}}>
            <input type="checkbox" checked={inputs.trenching} onChange={e=>setInp("trenching",e.target.checked)} style={{width:16,height:16}}/>
            <span style={{fontSize:13,color:C.navy}}>Include trench excavation labour (across drainage lines)</span>
          </label>)}

        <div style={{background:"#fff",borderRadius:8,border:"1px solid #DDE3EA",marginBottom:14,overflow:"hidden"}}>
          <SectionHeader>Fixtures — one line per product (add variants &amp; quantities)</SectionHeader>
          <div style={{padding:"12px 16px"}}>
            {(inputs.fixtureLines ?? []).length===0&&
              <div style={{fontSize:12,color:C.slateL,padding:"6px 2px 10px"}}>No fixtures yet — add a line below.</div>}
            {(inputs.fixtureLines ?? []).map(fl=>{
              const presets=FIXTURE_PRESETS[fl.type];
              return (
              <div key={fl.id} style={{border:"1px solid #E0E5EC",borderRadius:8,padding:"8px 10px",marginBottom:8,background:fl.source==="custom"?"#FEF5E7":C.offWhite}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <select value={fl.type} onChange={e=>{const t=e.target.value as FixtureType;const b=makeFixtureLine(t);updateFixtureLine(fl.id,{type:t,source:b.source,materialCode:b.materialCode,description:b.description,unitPrice:b.unitPrice,grade:b.grade,supplier:b.supplier});}}
                    style={{padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12,minWidth:120}}>
                    {FIXTURE_TYPES.map(ft=><option key={ft.t} value={ft.t}>{ft.label}</option>)}
                  </select>
                  <select value={fl.source==="custom"?"__custom__":(fl.materialCode??"__custom__")}
                    onChange={e=>{const v=e.target.value;
                      if(v==="__custom__"){updateFixtureLine(fl.id,{source:"custom",materialCode:undefined,description:"",unitPrice:0,grade:"Assumption",supplier:undefined});}
                      else{const p=presets.find(x=>x.materialCode===v);if(p)updateFixtureLine(fl.id,{source:"library",materialCode:p.materialCode,description:p.description,unitPrice:p.unitPrice,grade:p.grade,supplier:p.supplier});}}}
                    style={{padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12,flex:1,minWidth:180}}>
                    {presets.map(p=><option key={p.materialCode} value={p.materialCode}>{p.description} — R{p.unitPrice} ({p.grade})</option>)}
                    <option value="__custom__">Custom / enter your own…</option>
                  </select>
                  <input type="number" min={0} max={50} value={fl.quantity}
                    onChange={e=>updateFixtureLine(fl.id,{quantity:Math.max(0,parseInt(e.target.value)||0)})}
                    style={{width:60,padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:14,fontWeight:700,textAlign:"center"}}/>
                  <span style={{fontSize:11,color:C.slateL,minWidth:70,textAlign:"right"}}>{fmt(fl.quantity*fl.unitPrice)}</span>
                  <GradePill grade={fl.grade}/>
                  <button onClick={()=>removeFixtureLine(fl.id)} title="Remove" style={{padding:"4px 9px",borderRadius:6,border:"1px solid #E0B4B4",background:"#fff",color:C.red,cursor:"pointer",fontSize:13,fontWeight:700}}>✕</button>
                </div>
                {fl.source==="custom"&&(
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <input placeholder="Custom product description" value={fl.description}
                      onChange={e=>updateFixtureLine(fl.id,{description:e.target.value})}
                      style={{flex:1,padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12}}/>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={{fontSize:11,color:C.slateL}}>R</span>
                      <input type="number" min={0} step="0.01" placeholder="unit price" value={fl.unitPrice||""}
                        onChange={e=>updateFixtureLine(fl.id,{unitPrice:Math.max(0,parseFloat(e.target.value)||0)})}
                        style={{width:100,padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12}}/>
                    </div>
                  </div>)}
              </div>);
            })}
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
              <button onClick={()=>addFixtureLine("toilet")}
                style={{padding:"7px 14px",borderRadius:6,border:`1px dashed ${C.gold}`,background:C.goldPale,color:C.navy,cursor:"pointer",fontSize:12,fontWeight:700}}>+ Add fixture line</button>
              <span style={{fontSize:10,color:C.muted}}>Library prices are <GradePill grade="Sourced"/>; custom lines are <GradePill grade="Assumption"/> &amp; flagged.</span>
            </div>
          </div>
        </div>

        {/* Fittings — compression fittings line builder (catalogue-priced).
            Size groups + products are data-driven from COMPRESSION_FITTINGS. */}
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #DDE3EA",marginBottom:14,overflow:"hidden"}}>
          <SectionHeader>Fittings — Compression Fittings (size + product + quantity)</SectionHeader>
          <div style={{padding:"12px 16px"}}>
            {(inputs.fittingLines ?? []).length===0&&
              <div style={{fontSize:12,color:C.slateL,padding:"6px 2px 10px"}}>No fittings yet — add a line below.</div>}
            {(inputs.fittingLines ?? []).map(ft=>{
              const products=fittingsForSizeGroup(ft.sizeGroup);
              return (
              <div key={ft.id} style={{border:"1px solid #E0E5EC",borderRadius:8,padding:"8px 10px",marginBottom:8,background:C.offWhite}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <select value={ft.sizeGroup} onChange={e=>{const sg=e.target.value;const b=makeFittingLine(sg);updateFittingLine(ft.id,{sizeGroup:sg,materialCode:b.materialCode,plumblinkCode:b.plumblinkCode,label:b.label,description:b.description,size:b.size,unit:b.unit,unitPrice:b.unitPrice,grade:b.grade,supplier:b.supplier});}}
                    style={{padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12,minWidth:90}}>
                    {FITTING_SIZE_GROUPS.map(sg=><option key={sg} value={sg}>{sg}</option>)}
                  </select>
                  <select value={ft.materialCode} onChange={e=>{const b=makeFittingLine(ft.sizeGroup,e.target.value);updateFittingLine(ft.id,{materialCode:b.materialCode,plumblinkCode:b.plumblinkCode,label:b.label,description:b.description,size:b.size,unit:b.unit,unitPrice:b.unitPrice,grade:b.grade,supplier:b.supplier});}}
                    style={{padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12,flex:1,minWidth:200}}>
                    {products.map(p=><option key={p.materialCode} value={p.materialCode}>{p.label} — R{p.unitPrice} ({p.grade})</option>)}
                  </select>
                  <input type="number" min={0} max={99} value={ft.quantity}
                    onChange={e=>updateFittingLine(ft.id,{quantity:Math.max(0,parseInt(e.target.value)||0)})}
                    style={{width:60,padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:14,fontWeight:700,textAlign:"center"}}/>
                  <span style={{fontSize:11,color:C.slateL,minWidth:70,textAlign:"right"}}>{fmt(ft.quantity*ft.unitPrice)}</span>
                  <GradePill grade={ft.grade}/>
                  <button onClick={()=>removeFittingLine(ft.id)} title="Remove" style={{padding:"4px 9px",borderRadius:6,border:"1px solid #E0B4B4",background:"#fff",color:C.red,cursor:"pointer",fontSize:13,fontWeight:700}}>✕</button>
                </div>
                <div style={{fontSize:10,color:C.muted,marginTop:5}}>{ft.description}{ft.plumblinkCode?` · PL ${ft.plumblinkCode}`:""} · {ft.supplier ?? "Plumblink"}</div>
              </div>);
            })}
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
              <button onClick={addFittingLine}
                style={{padding:"7px 14px",borderRadius:6,border:`1px dashed ${C.gold}`,background:C.goldPale,color:C.navy,cursor:"pointer",fontSize:12,fontWeight:700}}>+ Add fitting</button>
              <span style={{fontSize:10,color:C.muted}}>Price, confidence, supplier &amp; Plumblink code populate automatically from the materials library.</span>
            </div>
          </div>
        </div>
        </>)}

        {jobMode==="geyser"&&(
        <div style={{background:"#fff",borderRadius:8,border:"1px solid #DDE3EA",marginBottom:14,overflow:"hidden"}}>
          <SectionHeader>♨ Geyser Assembly — fixed composition by size</SectionHeader>
          <div style={{padding:"14px 20px"}}>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,color:C.slateL,marginBottom:6,fontWeight:600}}>Job type</label>
              <div style={{display:"flex",gap:8}}>
                {([{v:"burst_replacement" as const,l:"Burst replacement"},{v:"element_repair" as const,l:"Element / thermostat repair"}]).map(j=>(
                  <button key={j.v} onClick={()=>setGey({jobType:j.v})} style={{
                    flex:1,padding:"9px 12px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700,
                    border:`1px solid ${geyser.jobType===j.v?C.gold:"#C8D0DB"}`,
                    background:geyser.jobType===j.v?C.goldPale:"#fff",color:C.navy}}>{j.l}</button>))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={{display:"block",fontSize:11,color:C.slateL,marginBottom:3,fontWeight:600}}>Geyser size</label>
                <select value={geyser.size} onChange={e=>setGey({size:parseInt(e.target.value) as GeyserSize})}
                  style={{width:"100%",padding:"7px 10px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:13}}>
                  {[50,100,150,200,250].map(s=><option key={s} value={s}>{s} L</option>)}
                </select>
                <div style={{fontSize:10,color:C.slateL,marginTop:3}}>Unit price Sourced (Plumblink 2026)</div>
                {geyser.size===150&&<div style={{fontSize:10,color:C.amber,marginTop:3}}>⚠ 150L ~15% under 2024 market — VR-11</div>}
              </div>
              {geyser.jobType==="burst_replacement"
                ? <div>
                    <label style={{display:"block",fontSize:11,color:C.slateL,marginBottom:3,fontWeight:600}}>Brand</label>
                    <select value={geyser.brand} onChange={e=>setGey({brand:e.target.value as GeyserBrand})}
                      style={{width:"100%",padding:"7px 10px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:13}}>
                      {["Kwikot","Ariston"].map(b=><option key={b}>{b}</option>)}
                    </select>
                    <div style={{fontSize:10,color:C.slateL,marginTop:3}}>B-rated · 5yr warranty</div>
                  </div>
                : <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",paddingTop:18}}>
                    <input type="checkbox" checked={geyser.solar} onChange={e=>setGey({solar:e.target.checked})} style={{width:16,height:16}}/>
                    <span style={{fontSize:13,color:C.navy}}>Solar geyser (skip thermostat)</span>
                  </label>}
            </div>
            <div style={{background:C.goldPale,border:`1px solid ${C.gold}40`,borderRadius:6,padding:"10px 14px",marginTop:14,fontSize:11,color:C.navy}}>
              ♨ Fixed-composition assembly · <strong>{finalGrade} grade</strong> · material {fmt(matTotal)} + labour {fmt(labTotal)} → ladder → <strong>{fmt(sell)}</strong> sell excl. VAT. {GRADES[finalGrade]?.rank>=GRADES["Derived"].rank?"Client-issuable through the normal gate (see Learn tab).":"Not client-issuable until grade lifts (see Learn tab)."}
            </div>
          </div>
        </div>)}

        <div style={{background:"#fff",border:`1px solid ${C.gold}40`,borderRadius:8,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:12,color:C.slateL}}><strong style={{color:C.navy}}>{scope.length}</strong> lines · <GradePill grade={finalGrade}/></div>
            <div style={{fontSize:10,color:C.muted,marginTop:2}}>Scope review required before costings.</div>
          </div>
          <button onClick={()=>setScreen("review")} style={{padding:"10px 28px",borderRadius:8,border:"none",background:C.gold,color:C.navy,cursor:"pointer",fontWeight:800,fontSize:14}}>Review Scope →</button>
        </div>
      </div>
    </div>
  );
}
