import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { HamburgerButton, NavDrawer } from "@/components/NavDrawer";
import {
  buildGeyserReplacement, buildElementRepair, buildNewInstallation, fetchGeyserPricing,
  type GeyserAssembly, type GeyserSize, type GeyserBrand, type GeyserJobType, type GeyserPricingData,
} from "@/lib/geyser-assembly";
import {
  printInvoiceDocument, isoDate, addDays, DEFAULT_BANKING_DETAILS,
  type InvoiceMeta, type DocumentType,
} from "@/lib/invoice-document";
import { useSettings, DEFAULT_SETTINGS, type OrgSettings } from "@/lib/settings-context";
import { saveEstimate, loadEmployees, type Employee } from "@/lib/supabase-client";
import {
  fetchFixtureTemplates, fetchTemplateRows, fetchCandidateMaterials, fetchMaterialByCode,
  type FixtureTemplate,
} from "@/lib/fixture-templates";
import {
  initialRowInstance, createCustomRowInstance, createCatalogRowInstance, createStandaloneRowInstance,
  rowState, isPriced,
  resolvedGrade, pricingGrade, resolvedQty, resolvedTotal,
  isCheckboxDisabled, usesManualEntry, setChecked as rowSetChecked,
  selectMaterial as rowSelectMaterial, setManualProduct as rowSetManual,
  setApplication as rowSetApplication, setSize as rowSetSize, setFittingType as rowSetFittingType,
  setStandaloneSize as rowSetStandaloneSize, setStandaloneFittingType as rowSetStandaloneFittingType,
  sectionCounts, quantityInputLabel,
  type TemplateRowInstance,
} from "@/lib/template-row-state";
import type { PlumblinkMaterial } from "@/lib/product-filter";
import {
  fetchCascadeCatalogue, distinctApplications, distinctSizes, distinctFittingTypes, matchingProducts,
} from "@/lib/product-cascade";
import { aggregateBuyList } from "@/lib/buy-list";
import { GRADES, lowestGrade } from "@/lib/grades";

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

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
// Shared spacing / type / surface roles. Everything below reuses these instead
// of ad-hoc pixel values so the navy-and-gold identity reads consistently across
// all three job-type pages and the app shell.
const S = { xs:4, sm:8, md:12, lg:20, xl:24, xxl:32 } as const;

// Surface + border + control roles (the greys that were previously hardcoded
// per-element get names here).
const UI = {
  border:"#DDE3EA", borderStrong:"#C8D0DB", borderRow:"#E0E5EC",
  pageBg:"#F1F4F8", customBg:"#FEF5E7",
  cardShadow:"0 1px 2px rgba(13,27,42,0.04), 0 2px 10px rgba(13,27,42,0.06)",
};

// Type scale — fixed size/weight/colour per role so hierarchy is predictable.
// (Section-header banners keep their own styling in SectionHeader.)
const T: Record<string, React.CSSProperties> = {
  fieldLabel: { display:"block", fontSize:11, fontWeight:600, color:C.slateL, marginBottom:4 },
  colHead:    { fontSize:10, fontWeight:700, color:C.slateL, textTransform:"uppercase", letterSpacing:0.5 },
  value:      { fontSize:13, fontWeight:600, color:C.navy },
  rate:       { fontSize:11, fontWeight:500, color:C.slateL, padding:"6px 8px", border:`1px solid ${UI.border}`, borderRadius:6, background:UI.pageBg, boxSizing:"border-box", height:34, display:"inline-flex", alignItems:"center", justifyContent:"flex-end" },
  total:      { fontSize:15, fontWeight:700, color:C.navy, padding:"6px 10px", border:`1px solid ${UI.border}`, borderRadius:6, background:C.white, boxSizing:"border-box", display:"inline-flex", alignItems:"center", justifyContent:"flex-end" },
  secondary:  { fontSize:11, color:C.slateL },
  muted:      { fontSize:10, color:C.muted },
};

// White section card: consistent radius, hairline border, subtle elevation and
// vertical rhythm so cards read as distinct surfaces, not flush against the page.
const cardStyle: React.CSSProperties = {
  background:C.white, borderRadius:10, border:`1px solid ${UI.border}`,
  boxShadow:UI.cardShadow, marginBottom:S.lg, overflow:"hidden",
};

// One control height for every editable input/select so line-item rows align.
const CONTROL_H = 36;
const inputStyle: React.CSSProperties = {
  height:CONTROL_H, padding:"0 10px", border:`1px solid ${UI.borderStrong}`,
  borderRadius:6, fontSize:13, color:C.navy, background:C.white, boxSizing:"border-box",
};
// The single dropdown look used app-wide: gold chevron, native appearance stripped.
const CHEVRON = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23${C.gold.slice(1)}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>")`;
const selectStyle: React.CSSProperties = {
  ...inputStyle, appearance:"none", cursor:"pointer", paddingRight:28,
  backgroundImage:CHEVRON, backgroundRepeat:"no-repeat", backgroundPosition:"right 9px center",
};
// Compact control variant for dense line-item rows (same look, shorter).
const rowCtl: React.CSSProperties = { ...inputStyle, height:34, fontSize:12 };
const rowSelect: React.CSSProperties = { ...selectStyle, height:34, fontSize:12 };
// Square delete/remove action used at the end of every line-item row.
const rowDeleteBtn: React.CSSProperties = {
  width:30, height:30, padding:0, borderRadius:6, border:"1px solid #E0B4B4",
  background:C.white, color:C.red, cursor:"pointer", fontSize:13, fontWeight:700, lineHeight:1,
};
// Compact variant for denser fitting-cascade rows and inline remove actions
// where a fixed 30px square would be disproportionate to the row height.
const rowDeleteBtnCompact: React.CSSProperties = {
  padding:"3px 8px", borderRadius:6, border:"1px solid #E0B4B4",
  background:C.white, color:C.red, cursor:"pointer", fontSize:12, fontWeight:700,
};
// Solid-gold primary action button (main forward-progress actions:
// analyse, confirm, generate, download). One shared look instead of each
// call site hand-picking its own padding/size.
const primaryBtn: React.CSSProperties = {
  padding:"10px 24px", borderRadius:6, border:"none",
  background:C.gold, color:C.navy, cursor:"pointer", fontWeight:800, fontSize:13,
};
// Dashed-gold "add a new row/line/template" button — the existing "+ Add..."
// family, consolidated onto one token instead of 7 hand-duplicated copies.
const addLineBtn: React.CSSProperties = {
  padding:"7px 14px", borderRadius:6, border:`1px dashed ${C.gold}`,
  background:C.goldPale, color:C.navy, cursor:"pointer", fontSize:12, fontWeight:700,
};
// Secondary/back-navigation button — the "← [Label]" family used to step
// back within a multi-phase flow (scan review, scope confirmation, manual
// entry toggle). One shared look instead of each call site hand-picking
// its own padding.
const backNavBtn: React.CSSProperties = {
  padding:"8px 16px", borderRadius:6, border:`1px solid ${UI.borderStrong}`,
  background:"#fff", color:C.slate, cursor:"pointer", fontWeight:600, fontSize:12,
};
// Line-item table column layouts live in styles.css (.cos-line--pipe /
// .cos-line--fixture) so a media query can restructure them on narrow screens;
// header + data rows share the same class so their columns line up.

// ─── CONFIDENCE GRADES ────────────────────────────────────────────────────────
// Shared with DocumentDetailPage's Buy list — see src/lib/grades.ts.

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
// A fixture/system template applied to the estimate — its rows carry live
// TemplateRowInstance state (checkbox, resolved product, grade). Only priced
// rows (isPriced) become scope lines; see buildScope. quantityBasis is the
// fixture count (scope='fixture') or pipe run length in metres (scope='system').
interface AppliedTemplate {
  instanceId: string;
  templateId: string;
  fixtureType: string;
  templateName: string;
  templateVariant: string;
  scope: 'fixture' | 'system' | 'geyser';
  quantityBasis: number;
  rows: TemplateRowInstance[];
}

interface GeyserMeta {
  jobType: GeyserJobType; size: GeyserSize; brand: GeyserBrand; solar: boolean;
}
interface ActiveSections {
  waterSupply: boolean; drainage: boolean; geyser: boolean; fixtures: boolean;
}
interface Inputs {
  projectName: string; clientName: string; pipeType: string;
  supplyMetres: number; drainMetres: number; points: number; trenching: boolean;
  fixtures: Fixtures;           // legacy (scan extraction still populates this)
  fixtureLines?: FixtureLine[]; // canonical fixtures for manual-entry pricing
  supplyFittings?: TemplateRowInstance[];   // standalone Supply Fittings section (catalogue cascade)
  drainageFittings?: TemplateRowInstance[]; // standalone Drainage Fittings section (catalogue cascade)
  fittingTemplates?: AppliedTemplate[]; // fixture-linked fitting templates
  supplyLines?: PipeLine[];     // canonical supply pipe (replaces pipeType+supplyMetres)
  drainLines?: PipeLine[];      // canonical drainage pipe (replaces drainMetres)
  // Denormalized {id, name} pairs, not a live employees join — a later soft-delete
  // (is_active=false) must not change what a saved estimate displays it allocated.
  // Purely descriptive: never read by buildScope/buildLabour or scope-review gating.
  allocatedEmployees?: { id: string; name: string }[];
  // Invoice-only (Brief 2, Emergency Call-Out) — multiplies the composite crew
  // hourly rate by settings.afterHoursMultiplier. Never rendered/set on Quote.
  afterHours?: boolean;
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
// Category placeholder thumbnails — one icon per fixture TYPE (not per product),
// reused across every preset/custom line of that type. fixtureIcon() always
// returns a valid path (falls back to the generic icon) so an unmapped/future
// type never renders a broken image.
const FIXTURE_ICONS: Record<FixtureType, string> = {
  toilet: "/icons/fixtures/toilet.png",
  basin: "/icons/fixtures/basin.png",
  basin_mixer: "/icons/fixtures/basin-mixer.png",
  shower_mixer: "/icons/fixtures/shower-mixer.png",
  shower_door: "/icons/fixtures/shower-door.png",
  shower_rose: "/icons/fixtures/shower-rose.png",
  kitchen_mixer: "/icons/fixtures/kitchen-mixer.png",
};
const FIXTURE_ICON_GENERIC = "/icons/fixtures/fixture-generic.png";
const fixtureIcon = (type: FixtureType): string => FIXTURE_ICONS[type] ?? FIXTURE_ICON_GENERIC;
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

// ─── ENGINE ───────────────────────────────────────────────────────────────────
// invoiceStrict (brief §2 "Invoice strictness"): when true, unconfirmed Suggested
// template rows are excluded — even though they're priced in a draft quote, they
// must never leak onto an invoice. Only rows the plumber actually confirmed
// (state 'confirmed') or added ('custom') survive. Non-template scope (fixtures,
// pipes, fittings, points-driven lines) is unaffected — it is either user-added
// or already gated by the existing Points=0 guards.
function buildScope(inp: Inputs, opts: { invoiceStrict?: boolean } = {}): ScopeLine[] {
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

  // Points-driven auto-generated fittings (the make-off intensity). A zero-point
  // job — a maintenance callout or repair — has no make-offs, so we skip these
  // entirely rather than invent phantom fittings the plumber never bought.
  if (points > 0) ([
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

  // Pipe-run consumables (tape C01, cement C02) are only auto-added alongside
  // make-off points; at points === 0 they are suppressed so a repair invoice
  // shows only what was explicitly entered. C03 sealant stays fixture-driven.
  ([
    { id:"C01", key:"PLB-PD-006", qty:points>0 ? Math.ceil(supplyMetres/10) : 0 },
    { id:"C02", key:"PLB-PD-001", qty:points>0 ? Math.max(1,Math.ceil(supplyMetres/20)) : 0 },
    { id:"C03", key:"PLB-PD-002", qty:Math.max(0,Math.ceil(fxCount(fixtureLines,"shower_mixer")+fxCount(fixtureLines,"basin"))) },
  ] as const).forEach(c => {
    const it = LIBRARY[c.key]; if (!it || c.qty===0) return;
    lines.push({ id:c.id, code:c.key, description:it.desc, qty:c.qty, unit:it.unit,
      unitPrice:it.price, conf:lowestGrade(it.conf,"Derived"), total:c.qty*it.price,
      supplier:it.supplier, derivation:"Derived from run/fixture count", mode:"Supply" });
  });

  const st = LIBRARY["PLB-PD-071"];
  if (st && points > 0) lines.push({ id:"A01", code:"PLB-PD-071", description:st.desc, qty:points*2, unit:"ea",
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

  // Standalone Supply/Drainage fitting rows — one scope line per priced catalogue
  // row. Material-only (like the old compression-fitting lines): installation
  // effort is already carried by the pipework/point labour, so fittings do not
  // add a separate labour line (avoids double-count). isPriced() gates exactly as
  // the template rows do — a row prices only once checked AND resolved to a
  // product; grade is computed from the live resolution, never assumed.
  ([
    ['SF', 'Supply',   inp.supplyFittings   ?? []],
    ['DF', 'Drainage', inp.drainageFittings ?? []],
  ] as const).forEach(([prefix, sectionLabel, rows]) => {
    rows.forEach((r, ri) => {
      if (!isPriced(r)) return;
      const qty = resolvedQty(r);
      const grade = pricingGrade(r);
      lines.push({
        id:`${prefix}${String(ri+1).padStart(2,"0")}`,
        code: r.materialCode ?? "CUSTOM",
        description: r.description || r.fittingType || "(fitting)",
        qty, unit:"ea", unitPrice: r.unitPrice, conf: grade,
        total: resolvedTotal(r),
        supplier: r.materialCode ? "Plumblink" : "Custom",
        derivation: `${qty} × R${r.unitPrice.toFixed(2)} (${sectionLabel} fitting · ${grade})`,
        mode:"Supply",
      });
    });
  });

  // Fixture-template fitting rows — one scope line per priced row. isPriced()
  // gates this exactly as the brief's row-state table requires: Suggested
  // (unconfirmed) and Confirmed/Custom priced rows flow through; Optional,
  // Removed, and unresolved Placeholder rows do not. Grade is computed from the
  // row's live resolution (Sourced if a real material_code is linked, else
  // Assumption), never trusted blindly from the static template column.
  (inp.fittingTemplates ?? []).forEach((tpl, ti) => {
    tpl.rows.forEach((r, ri) => {
      if (!isPriced(r)) return;
      // Invoice strictness: a priced-but-unconfirmed Suggested row is the only
      // priced state that isn't a deliberate confirmation, so it's the leak this
      // guard blocks. Confirmed and Custom rows pass through to the invoice.
      if (opts.invoiceStrict && rowState(r) === "suggested") return;
      const qty = resolvedQty(r);
      // pricingGrade (not resolvedGrade) — resolvedGrade returns null for an
      // unconfirmed Suggested row, but that row is still priced here and must
      // carry its real Sourced/Assumption grade, not a fallback.
      const grade = pricingGrade(r);
      lines.push({
        id:`T${ti+1}-${String(ri+1).padStart(2,"0")}`,
        code: r.materialCode ?? "CUSTOM",
        description: r.description || r.fittingType || "(fitting)",
        qty, unit:"ea", unitPrice: r.unitPrice, conf: grade,
        total: resolvedTotal(r),
        supplier: r.materialCode ? "Plumblink" : "Custom",
        derivation: `${qty} × R${r.unitPrice.toFixed(2)} (${tpl.templateName} · ${rowState(r)} · ${grade})`,
        mode:"Supply",
      });
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
  if (supplyMetres>0) add("L02","Pipework installation",supplyMetres*PROD.pipeworkInstall,"Sourced",`${supplyMetres}m × ${PROD.pipeworkInstall}hr/m (Spon's)`);
  if (points>0) add("L03","Point make-off",points*PROD.pointMakeOff,"Assumption",`${points} pts × ${PROD.pointMakeOff}hr/pt (VR-03 open)`);
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
  const supplier = asm.jobType === "burst_replacement" || asm.jobType === "new_installation" ? "Geyser supplier (confirm)" : "Vissi/local";
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
  const description = asm.jobType === "burst_replacement" ? "Geyser remove & replace — labour block"
    : asm.jobType === "new_installation" ? "New Point — supply/drain/electrical connection & install"
    : "Element / thermostat repair — labour";
  const derivation = asm.jobType === "burst_replacement" ? "Fixed crew block by size (Assumption) [VR-09]"
    : asm.jobType === "new_installation" ? "Single sell-side quote line, not size-graded (Assumption, unconfirmed)"
    : "Contractor flat-rate, sell-side reference [VR-10 open decision]";
  return [{
    id: "GL01",
    description,
    hours: asm.labourCost / crewRateHr,
    rate: crewRateHr,
    cost: asm.labourCost,
    conf: asm.grade,
    derivation,
  }];
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt  = (n: number) => `R ${n.toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const fmtN = (n: number) => n.toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2});
const today = () => new Date().toLocaleDateString("en-ZA",{day:"numeric",month:"long",year:"numeric"});
// Every product dropdown's visible option text: "[Brand] Product Name" only —
// SKU/spec code, price and confidence tag stay on the record (still power the
// price column and Sourced/Assumption badges) but are stripped from the label.
const productOptionLabel = (m: Pick<PlumblinkMaterial, 'brand' | 'description' | 'material_code'>) => {
  const name = m.description ?? m.material_code;
  return m.brand ? `${m.brand} ${name}` : name;
};

// ─── MICRO COMPONENTS ─────────────────────────────────────────────────────────
function GradePill({ grade }: { grade: string }) {
  const g = GRADES[grade] ?? GRADES["Placeholder"];
  return <span style={{ display:"inline-block",padding:"1px 6px",borderRadius:99,fontSize:9,
    fontWeight:700,letterSpacing:0.3,background:g.bg,color:g.color,border:`1px solid ${g.color}30` }}>{grade}</span>;
}
// Mirrors the Fixtures price span (fmt(qty*unitPrice)) for template/standalone
// fitting rows. Blank — not "R 0.00" — until isPriced(row), so unresolved
// custom/manual rows don't display a fake price ahead of their Assumption grade.
function PriceCell({ row, style }: {
  row: Pick<TemplateRowInstance, 'checked' | 'materialCode' | 'description' | 'unitPrice' | 'defaultQty' | 'quantityBasis'>;
  style?: React.CSSProperties;
}) {
  return isPriced(row)
    ? <span style={{...T.total,textAlign:"right",height:32,...style}}>{fmt(resolvedTotal(row))}</span>
    : <span style={style}/>;
}
function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ background:C.navyMid,color:C.gold,fontWeight:600,fontSize:12,
    letterSpacing:1,textTransform:"uppercase",padding:"10px 20px",
    borderBottom:`2px solid ${C.gold}40` }}>{children}</div>;
}
// Section-level heading + bounding border wrapping all cards belonging to one
// active Job Section (Water Supply/Drainage/Geyser/Fixtures) — Brief C-4. Purely
// visual grouping around existing, unchanged cards; the label sits over a break
// in the border like a fieldset legend, using the page background so it reads
// as a cutout rather than an overlay. Individual cards keep their own dark
// SectionHeader banners and marginBottom unchanged — this just adds one more
// layer around the group so a user scanning a multi-section page can see at a
// glance where one section's cards end and the next begins.
function SectionGroup({ label, subHeadings, children }: {
  label: string;
  subHeadings: string[];
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ position:"relative", border:`2px solid ${C.gold}`, borderRadius:12,
      padding:`${S.lg}px ${S.md}px ${collapsed ? S.lg : 2}px`, marginTop:30, marginBottom:S.xl }}>
      <div style={{ position:"absolute", top:-13, left:16, background:UI.pageBg,
        padding:"0 10px", fontSize:12.5, fontWeight:800, color:C.goldDim,
        textTransform:"uppercase", letterSpacing:0.8 }}>
        {label}
      </div>
      <button
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
        style={{ position:"absolute", top:-15, right:16, background:UI.pageBg,
          border:`1px solid ${C.gold}`, borderRadius:6, color:C.goldDim,
          fontSize:11, fontWeight:700, padding:"3px 9px", cursor:"pointer",
          display:"flex", alignItems:"center", gap:5 }}>
        {collapsed ? "▸ Expand" : "▾ Collapse"}
      </button>
      {collapsed ? (
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:6 }}>
          {subHeadings.map((h) => <SectionHeader key={h}>{h}</SectionHeader>)}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

// ─── SETTINGS → ENGINE DERIVATIONS ────────────────────────────────────────────
const ladderFrom = (s: OrgSettings): LadderRates =>
  ({ wastePct: s.wastePct, riskPct: s.riskPct, contingencyPct: s.contingencyPct, marginPct: s.marginPct });
const crewRateFrom = (s: OrgSettings): number =>
  s.hoursPerDay > 0 ? (s.plumberDayRate + s.assistantDayRate) / s.hoursPerDay : CREW_RATE_HR;
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
  const fittingLines = g ? [] : [...(inp.supplyFittings ?? []), ...(inp.drainageFittings ?? [])]
    .filter(r=>isPriced(r))
    .map(r=>`${r.description || r.fittingType}${r.nominalSize?` ${r.nominalSize}`:""}: ${resolvedQty(r)}`);
  // Scope-of-work grid: geyser assembly vs plumbing run
  const geyserJobLabel = (jt: GeyserJobType) => jt==="burst_replacement"?"Burst geyser replacement":jt==="new_installation"?"New Installation":"Element / thermostat repair";
  const scopeGrid = g
    ? [
        `<div class="scope-item"><strong>Job:</strong> ${geyserJobLabel(g.jobType)}</div>`,
        `<div class="scope-item"><strong>Size:</strong> ${g.size}L</div>`,
        (g.jobType==="burst_replacement"||g.jobType==="new_installation")?`<div class="scope-item"><strong>Brand:</strong> ${g.brand} (B-rated, 5yr warranty)</div>`:"",
        g.jobType==="element_repair"?`<div class="scope-item"><strong>Solar geyser:</strong> ${g.solar?"Yes — thermostat retained":"No"}</div>`:"",
        ...scope.map(l=>`<div class="scope-item"><strong>${l.qty}× ${l.description}</strong></div>`),
      ].filter(Boolean).join("")
    : `${(inp.supplyLines ?? []).filter(l=>l.metres>0).map(l=>`<div class="scope-item"><strong>Supply:</strong> ${l.metres}m ${l.type} ${l.diameter?l.diameter+"mm":""}</div>`).join("")}<div class="scope-item"><strong>Water points:</strong> ${inp.points}</div>${(inp.drainLines ?? []).filter(l=>l.metres>0).map(l=>`<div class="scope-item"><strong>Drainage:</strong> ${l.metres}m ${l.type} ${l.diameter?l.diameter+"mm":""}</div>`).join("")}${fixtureLines.map(l=>`<div class="scope-item"><strong>${l}</strong></div>`).join("")}${fittingLines.map(l=>`<div class="scope-item"><strong>${l}</strong></div>`).join("")}`;
  const scopeIntro = g
    ? `Supply and installation of a ${g.size}L ${g.jobType==="burst_replacement"?`${g.brand} geyser replacement assembly`:g.jobType==="new_installation"?`${g.brand} geyser new installation (new supply/drain/electrical point)`:"geyser element / thermostat repair"} as set out below.`
    : "Supply and installation of plumbing connection assemblies as set out below.";
  const assumptions = g
    ? [
        `Asset: ${g.size}L geyser, ${g.jobType==="burst_replacement"?`${g.brand} B-rated (5yr warranty)`:g.jobType==="new_installation"?`${g.brand} B-rated (5yr warranty), new connection`:"element/thermostat repair"}`,
      ].filter(Boolean)
    : [
        `Supply: ${(inp.supplyLines ?? []).filter(l=>l.metres>0).map(l=>`${l.metres}m ${l.type} ${l.diameter}mm`).join(", ") || "none"}`,
        `Water points: ${inp.points}`,
        `Drainage: ${(inp.drainLines ?? []).filter(l=>l.metres>0).map(l=>`${l.metres}m ${l.type} ${l.diameter}mm`).join(", ") || "none"}`,
        `Trenching: ${inp.trenching?"Yes":"No"}`,
      ];
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${quoteRef} — Plumbing Quotation</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#1a1a2e;background:#fff}.page{max-width:800px;margin:0 auto;padding:32px 40px}.header{background:#0D1B2A;padding:24px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #F5A623}.logo-mark{width:42px;height:42px;background:#F5A623;clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;color:#0D1B2A}.logo-text{color:#F5A623;font-weight:900;font-size:20px}.logo-sub{color:#8FA3B8;font-size:9px;letter-spacing:2px;text-transform:uppercase;margin-top:2px}.quote-label{text-align:right}.quote-label h2{color:#F5A623;font-size:22px;letter-spacing:3px;text-transform:uppercase}.quote-label p{color:#8FA3B8;font-size:11px;margin-top:4px}.quote-label strong{color:#fff}.parties{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:28px 0;border:1px solid #e0e5ec}.party{padding:18px 20px}.party:first-child{border-right:1px solid #e0e5ec}.party-label{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#8FA3B8;margin-bottom:6px}.party h3{font-size:15px;font-weight:800;color:#0D1B2A}.party p{font-size:11px;color:#6B859E;margin-top:3px}.section-bar{background:#0D1B2A;color:#F5A623;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:7px 16px;margin:20px 0 0}.scope-box{border:1px solid #e0e5ec;border-top:none;padding:16px;margin-bottom:0}.scope-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-top:8px}.scope-item{font-size:11px;color:#4A6080;padding:2px 0}.scope-item strong{color:#0D1B2A}table{width:100%;border-collapse:collapse;margin-top:0}thead tr{background:#0D1B2A}thead th{color:#8FA3B8;font-size:10px;font-weight:600;text-align:left;padding:8px 16px}thead th:last-child{text-align:right}tbody tr{border-bottom:1px solid #f0f4f8}tbody tr:nth-child(odd){background:#f7f8fa}td{padding:10px 16px;font-size:12px;color:#0D1B2A}td:last-child{text-align:right;font-weight:600}td .sub{font-size:10px;color:#8FA3B8;margin-top:2px}.totals{margin-top:0;border:1px solid #e0e5ec;border-top:none}.total-row{display:flex;justify-content:space-between;padding:9px 16px;font-size:12px;border-bottom:1px solid #f0f4f8}.total-final{background:#0D1B2A;color:#fff;display:flex;justify-content:space-between;padding:14px 16px;font-size:16px;font-weight:900}.total-final span:last-child{color:#F5A623}.bottom-grid{display:flex;flex-direction:column;gap:16px;margin:24px 0}.bottom-box{width:100%;font-size:11px;color:#4A6080;line-height:1.7}.bottom-box h4{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#0D1B2A;font-weight:700;margin-bottom:6px}.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:16px}.sig-line{border-top:1px solid #ccc;padding-top:6px;font-size:10px;color:#8FA3B8;text-transform:uppercase}.footer{margin-top:32px;text-align:center;font-size:9px;color:#8FA3B8;text-transform:uppercase}.gold-bar{height:3px;background:#F5A623;margin:0}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body><div class="page">
<div class="header"><div style="display:flex;align-items:center;gap:14px"><div class="logo-mark">CO</div><div><div class="logo-text">ContractorOS</div><div class="logo-sub">Plumbing · One Job. Four Outputs.</div></div></div><div class="quote-label"><h2>Quotation</h2><p>Ref: <strong>${quoteRef}</strong></p><p>${today()} · <strong>DRAFT</strong></p><p>Valid: ${cfg.quoteValidityDays} days</p></div></div>
<div class="gold-bar"></div>
<div class="parties"><div class="party"><div class="party-label">From</div><h3>${biz}</h3><p>${cfg.vatNumber?`VAT no. ${cfg.vatNumber}`:"Not VAT registered"}</p><p>${[cfg.contactName,cfg.phone,cfg.email].filter(Boolean).join(" · ")||"Phone · Email"}</p></div><div class="party"><div class="party-label">To</div><h3>${inp.projectName||"Project"}</h3><p>${inp.clientName||"Client name &amp; site address"}</p></div></div>
<div class="section-bar">Scope of Work</div><div class="scope-box"><p style="font-size:11px;color:#4A6080;line-height:1.6">${scopeIntro}</p><div class="scope-grid">${scopeGrid}</div></div>
<div class="section-bar">Pricing</div><table><thead><tr><th>Description</th><th style="text-align:right">Amount (excl VAT)</th></tr></thead><tbody><tr><td>Materials &amp; Supply<div class="sub">${g?"Geyser unit, valves, tray, vacuum breakers, consumables":"Pipe, fittings, connection assemblies, consumables"}</div></td><td>${fmtN(mat)}</td></tr><tr><td>Labour, Installation &amp; Project Costs<div class="sub">${g?(g.jobType==="burst_replacement"?"Remove old geyser, install &amp; commission new assembly":g.jobType==="new_installation"?"New Point connection (supply/drain/electrical) &amp; install":"Element / thermostat repair labour"):"Pipework, point make-off, fixture connection"}</div></td><td>${fmtN(lab+allow)}</td></tr></tbody></table>
<div class="totals"><div class="total-row"><span>Subtotal (excl VAT)</span><span>R ${fmtN(ld.sell)}</span></div><div class="total-row"><span>VAT @ ${cfg.vatRatePct}%</span><span>R ${fmtN(vat)}</span></div></div>
<div class="total-final"><span>Total Due</span><span>R ${fmtN(total)}</span></div>
<div class="bottom-grid"><div class="bottom-box"><h4>Exclusions &amp; Terms</h4><div>— Builder's work, tiling, electrical and making-good excluded.</div><div>— 50% deposit on acceptance; balance on completion.</div><div>— Quote valid ${cfg.quoteValidityDays} days; subject to site confirmation.</div>${cfg.termsConditions?`<div>— ${cfg.termsConditions}</div>`:""}</div><div class="bottom-box"><h4>Assumptions</h4>${assumptions.map(a=>`<div>— ${a}</div>`).join("")}</div></div>
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
  // Same aggregation as the Buy tab so the downloaded list matches on screen.
  const buyLines = aggregateBuyList(scope, lowestGrade);
  const bySupplier: Record<string, typeof buyLines> = {};
  buyLines.forEach(l=>{const s=l.supplier||"Other";if(!bySupplier[s])bySupplier[s]=[];bySupplier[s].push(l);});
  const matTotal=buyLines.reduce((s,l)=>s+l.total,0);
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
          style={{...inputStyle,width:"100%",height:34,textAlign:"center",fontWeight:700,
            border:`1px solid ${(val===null||val===undefined)?C.amber:UI.borderStrong}`,
            background:(val===null||val===undefined)?UI.customBg:C.white}}/>
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
      <div style={{background:"#fff",padding:14,textAlign:"center",border:`1px solid ${UI.border}`,borderTop:"none"}}>
        <img src={preview!} alt="floor plan" style={{maxWidth:"100%",maxHeight:420,objectFit:"contain",borderRadius:6}}/>
      </div>
      <div style={{padding:"12px 0",display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={()=>{setImgB64(null);setPreview(null);setPhase("idle");}}
          style={backNavBtn}>← Different image</button>
        <button onClick={runScan}
          style={primaryBtn}>Analyse Drawing →</button>
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
          style={backNavBtn}>← Try again</button>
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
      <div style={{...cardStyle,marginBottom:S.md}}>
        <SectionHeader>Extracted Parameters — correct if needed</SectionHeader>
        <div style={{padding:S.xl}}>
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
        <button onClick={()=>setPhase("preview")} style={backNavBtn}>← Back</button>
        <button onClick={confirmExtraction} style={primaryBtn}>Confirm &amp; Build Scope →</button>
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
  const summaryNotes = g
    ? [
        g.jobType==="burst_replacement"
          ? `${g.size}L ${g.brand} B-rated geyser — remove & replace`
          : g.jobType==="new_installation"
          ? `${g.size}L ${g.brand} B-rated geyser — new installation`
          : `${g.size}L geyser — element / thermostat repair`,
        g.solar?"Solar geyser — thermostat not replaced":null,
      ].filter(Boolean)
    : [
        `${inputs.points} plumbing points (make-offs)`,
        inputs.trenching?"Trench excavation included":"No trenching",
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
          {summaryNotes.length>0&&(
            <ul style={{paddingLeft:18,fontSize:13,color:C.navy,lineHeight:1.8,marginBottom:16}}>{summaryNotes.map((item,i)=><li key={i}>{item}</li>)}</ul>
          )}
          {scope.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:13,color:C.navy,marginBottom:6}}>Materials</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{textAlign:"left",color:C.slateL,fontSize:10,textTransform:"uppercase",borderBottom:"1px solid #E0E5EC"}}>
                    <th style={{padding:"4px 6px",fontWeight:700}}>Item</th>
                    <th style={{padding:"4px 6px",fontWeight:700,textAlign:"center"}}>Qty</th>
                    <th style={{padding:"4px 6px",fontWeight:700,textAlign:"right"}}>Unit Price</th>
                    <th style={{padding:"4px 6px",fontWeight:700,textAlign:"right"}}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {scope.map(l=>(
                    <tr key={l.id} style={{borderBottom:"1px solid #F1F4F8"}}>
                      <td style={{padding:"6px 6px",color:C.navy}}>{l.description}</td>
                      <td style={{padding:"6px 6px",textAlign:"center",color:C.navy}}>{l.qty} {l.unit}</td>
                      <td style={{padding:"6px 6px",textAlign:"right",color:C.navy}}>{fmt(l.unitPrice)}</td>
                      <td style={{padding:"6px 6px",textAlign:"right",color:C.navy,fontWeight:700}}>{fmt(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {labour.length>0&&(
            <div style={{marginBottom:16}}>
              <div style={{fontWeight:800,fontSize:13,color:C.navy,marginBottom:6}}>Labour</div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{textAlign:"left",color:C.slateL,fontSize:10,textTransform:"uppercase",borderBottom:"1px solid #E0E5EC"}}>
                    <th style={{padding:"4px 6px",fontWeight:700}}>Task</th>
                    <th style={{padding:"4px 6px",fontWeight:700,textAlign:"center"}}>Hours</th>
                    <th style={{padding:"4px 6px",fontWeight:700,textAlign:"right"}}>Rate/hr</th>
                    <th style={{padding:"4px 6px",fontWeight:700,textAlign:"right"}}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {labour.map(l=>(
                    <tr key={l.id} style={{borderBottom:"1px solid #F1F4F8"}}>
                      <td style={{padding:"6px 6px",color:C.navy}}>{l.description}</td>
                      <td style={{padding:"6px 6px",textAlign:"center",color:C.navy}}>{l.hours.toFixed(2)}</td>
                      <td style={{padding:"6px 6px",textAlign:"right",color:C.navy}}>{fmt(l.rate)}</td>
                      <td style={{padding:"6px 6px",textAlign:"right",color:C.navy,fontWeight:700}}>{fmt(l.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{background:"#F0F4F8",borderRadius:6,padding:"12px 16px",marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:12}}>
            <div><div style={{color:C.slateL}}>Est. material</div><div style={{fontWeight:700,color:C.navy,fontSize:15}}>{fmt(mat)}</div></div>
            <div><div style={{color:C.slateL}}>Est. labour</div><div style={{fontWeight:700,color:C.navy,fontSize:15}}>{fmt(lab)}</div></div>
          </div>
          <div style={{background:"#FEF5E7",border:`1px solid ${C.amber}50`,borderRadius:6,padding:"8px 12px",marginTop:10,fontSize:11,color:C.navy}}>⚠ This is a review aid. Verify scope before generating the estimate.</div>
        </div>
        <div style={{padding:"12px 24px",borderTop:"1px solid #E0E5EC",display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onBack} style={backNavBtn}>← Revise</button>
          <button onClick={onConfirm} style={primaryBtn}>Confirm &amp; Generate Estimate →</button>
        </div>
      </div>
    </div>
  );
}

// ─── OUTPUT TABS ──────────────────────────────────────────────────────────────
function EstimateTab({ scope, labour, inputs, finalGrade, docRef, documentType, onPrintDocument, ladder, vatRate, isGeneratingRef }: { scope: ScopeLine[]; labour: LabourLine[]; inputs: Inputs; finalGrade: string; docRef: string | null; documentType: DocumentType; onPrintDocument: () => Promise<void>; ladder: LadderRates; vatRate: number; isGeneratingRef: boolean }) {
  const mat=scope.reduce((s,l)=>s+l.total,0);
  const lab=labour.reduce((s,l)=>s+l.cost,0);
  const ld=applyLadder(mat,lab,ladder);
  const allow=ld.sell-ld.prime;
  const vatPct=+(vatRate*100).toFixed(2);
  // Invoices record actual work and are always issuable; quotes keep the strict gate.
  const issuable=documentType==="invoice"||GRADES[finalGrade]?.rank>=GRADES["Assumption"].rank;
  const refDisplay = docRef || (isGeneratingRef ? "Generating..." : "Pending");
  return (
    <div>
      <div style={{background:`linear-gradient(135deg,${C.navy},${C.navyMid})`,borderRadius:8,padding:"20px 24px",margin:16,border:`1px solid ${C.gold}40`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16}}>
          <div>
            <div style={{color:C.muted,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>Sell Price (excl. VAT)</div>
            <div style={{color:C.gold,fontSize:36,fontWeight:900,letterSpacing:-1}}>{fmt(ld.sell)}</div>
            <div style={{color:C.slateL,fontSize:12,marginTop:4}}>{fmt(ld.sell*(1+vatRate))} incl. {vatPct}% VAT</div>
            <div style={{color:C.muted,fontSize:11,marginTop:2}}>{documentType==="invoice"?"Invoice":"Quote"} ref: {refDisplay}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <GradePill grade={finalGrade}/>
            <div style={{color:C.muted,fontSize:10,marginTop:6}}>{issuable?"✓ Internal use OK":"⚠ Not client-issuable"}</div>
            <button onClick={onPrintDocument} disabled={isGeneratingRef} style={{...primaryBtn,marginTop:10,cursor:isGeneratingRef?"wait":"pointer",opacity:isGeneratingRef?0.6:1}}>⬇ Download {documentType==="invoice"?"Invoice":"Quote"}</button>
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

function BuyTab({ scope, quoteRef, onPrintBuy }: { scope: ScopeLine[]; inputs: Inputs; quoteRef: string | null; onPrintBuy: () => void }) {
  // Collapse identical material codes into one procurement line (summed qty);
  // custom lines stay separate. Procurement total is unchanged by aggregation.
  const buyLines = aggregateBuyList(scope, lowestGrade);
  const bySupplier: Record<string, typeof buyLines> = {};
  buyLines.forEach(l=>{const s=l.supplier||"Other";if(!bySupplier[s])bySupplier[s]=[];bySupplier[s].push(l);});
  const total=buyLines.reduce((s,l)=>s+l.total,0);
  return (
    <div>
      <div style={{background:`linear-gradient(90deg,${C.navyMid},${C.navy})`,padding:"12px 20px",borderRadius:8,margin:16,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${C.gold}30`}}>
        <div>
          <div style={{color:C.muted,fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Procurement Total (excl. VAT)</div>
          <div style={{color:C.gold,fontSize:26,fontWeight:900}}>{fmt(total)}</div>
          <div style={{color:C.slateL,fontSize:11}}>{fmt(total*1.15)} incl. VAT · {buyLines.length} lines</div>
        </div>
        <button onClick={onPrintBuy} style={primaryBtn}>⬇ Download Buy List</button>
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
                  <tr key={`${l.code}-${i}`} style={{background:i%2===0?C.offWhite:"#fff",borderBottom:"1px solid #E8EDF2"}}>
                    <td style={{padding:"6px 10px",fontFamily:"monospace",fontSize:10,color:C.slateL}}>{l.code}</td>
                    <td style={{padding:"6px 10px",color:C.navy}}>{l.description}{l.sourceCount>1&&<span style={{color:C.slateL,fontWeight:600}}> · ×{l.sourceCount} lines merged</span>}</td>
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

function BuildTab({ labour, allocatedEmployees }: { labour: LabourLine[]; allocatedEmployees?: { id: string; name: string }[] }) {
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
      {/* Passive display of employees allocated on Quote/Invoice (Brief 2 snapshot data).
          Adjacent to, not inside, the Labour Breakdown card — no cost coupling. */}
      {allocatedEmployees && allocatedEmployees.length>0 &&
        <div style={{margin:"0 16px 8px",fontSize:11,color:C.slateL}}>
          Crew: {allocatedEmployees.map(e=>e.name).join(", ")}
        </div>}
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
// Genuinely empty — not a pre-filled demo job. Water Supply/Drainage/Fixtures
// contribute nothing to scope/labour until the user actually enters data, which
// is what lets buildScope(inputs)/buildLabour(inputs) be a true no-op whenever
// a section is toggled off (see maskedInputs/the scope/labour concatenation below).
const DEFAULT: Inputs = {
  projectName:"Bathroom Fit-out — 3 Fixture", clientName:"",
  pipeType:"PEX 15mm (Cobra)", supplyMetres:20, drainMetres:15, points:0, trenching:true,
  fixtures:{toilet:1,basin:1,shower:1,showerDoor:1,showerRose:1,showerArm:1,kitchenMixer:0},
  fixtureLines:[],
  supplyFittings:[],
  drainageFittings:[],
  fittingTemplates:[],
  supplyLines:[],
  drainLines:[],
  allocatedEmployees:[],
  afterHours:false,
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

// ─── FIXTURE-TEMPLATE UI ──────────────────────────────────────────────────────
// Per-row Product control. Runs the row's product_filter against plumblink_materials
// to populate the dropdown, or falls back to free-text for Custom rows and the
// Manual/custom line sentinel. Seeds a Suggested row's default price on load
// WITHOUT confirming it (onResolveDefault leaves `touched` false) — pricing a seed is
// not the same as the plumber picking a product.
function TemplateProductSelect({ row, onSelect, onManual, onResolveDefault }: {
  row: TemplateRowInstance;
  onSelect: (m: { materialCode: string; description: string; unitPrice: number }) => void;
  onManual: (description: string, unitPrice: number) => void;
  onResolveDefault: (unitPrice: number, description: string) => void;
}) {
  const manualOnly = usesManualEntry(row);
  const [materials, setMaterials] = useState<PlumblinkMaterial[]>([]);
  const [loading, setLoading] = useState(!manualOnly);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (manualOnly) {
      setLoading(false);
      // A manual-entry row can still carry a real default_material_code (the
      // Geyser templates' rows all do — empty product_filter means there's no
      // cascade to run, but the row's default is still a genuine catalog SKU).
      // Without this, such a row loads with materialCode set but description/
      // unitPrice blank forever, since the catalog-fetch branch below — the
      // only other place that seeds a default's price — never runs for it.
      if (row.materialCode && row.unitPrice === 0 && row.description === '') {
        let alive = true;
        fetchMaterialByCode(row.materialCode).then(m => {
          if (alive && m) onResolveDefault(m.unit_price_excl_vat ?? 0, m.description ?? "");
        });
        return () => { alive = false; };
      }
      return;
    }
    let alive = true;
    setLoading(true);
    fetchCandidateMaterials({ product_filter: row.productFilter }).then(ms => {
      if (!alive) return;
      setMaterials(ms);
      setLoading(false);
      // Seed the default material's price (Suggested rows load with unitPrice 0).
      if (row.materialCode && row.unitPrice === 0) {
        const m = ms.find(x => x.material_code === row.materialCode);
        if (m) onResolveDefault(m.unit_price_excl_vat ?? 0, m.description ?? "");
      }
    });
    return () => { alive = false; };
    // Fetch once per row instance; row.id is stable across its edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  const inputStyle: React.CSSProperties = { flex:1,minWidth:200,padding:"6px 8px",border:`1px solid ${UI.borderStrong}`,borderRadius:6,fontSize:12,color:C.navy,background:C.white,height:32,boxSizing:"border-box" };
  const selStyle: React.CSSProperties = { ...inputStyle, appearance:"none", cursor:"pointer", paddingRight:26, backgroundImage:CHEVRON, backgroundRepeat:"no-repeat", backgroundPosition:"right 8px center" };

  if (manualOnly || manual) {
    return (
      <div style={{display:"flex",gap:6,flex:1,minWidth:200,alignItems:"center"}}>
        <input placeholder={row.origin==="custom"?"Custom fitting product":"Manual / site allowance"} value={row.description}
          onChange={e=>onManual(e.target.value, row.unitPrice)} style={inputStyle}/>
        <span style={{fontSize:11,color:C.slateL}}>R</span>
        <input type="number" min={0} step="0.01" placeholder="price" value={row.unitPrice||""}
          onChange={e=>onManual(row.description, Math.max(0,parseFloat(e.target.value)||0))}
          style={{width:88,padding:"6px 8px",border:`1px solid ${UI.borderStrong}`,borderRadius:6,fontSize:12}}/>
        {!manualOnly&&<button onClick={()=>setManual(false)} title="Back to catalogue"
          style={{...backNavBtn,padding:"4px 8px"}}>↺</button>}
      </div>
    );
  }

  if (loading) return <span style={{fontSize:11,color:C.muted,flex:1,minWidth:200}}>Loading products…</span>;

  return (
    <select value={row.materialCode ?? "__select__"} onChange={e=>{
      const v=e.target.value;
      if (v==="__manual__"){ setManual(true); return; }
      const m=materials.find(x=>x.material_code===v);
      if (m) onSelect({ materialCode:m.material_code, description:m.description ?? "", unitPrice:m.unit_price_excl_vat ?? 0 });
    }} style={selStyle}>
      <option value="__select__" disabled>{materials.length? "Select product…" : "No matching products"}</option>
      {materials.map(m=><option key={m.material_code} value={m.material_code}>{productOptionLabel(m)}</option>)}
      <option value="__manual__">Enter manually…</option>
    </select>
  );
}

// Column grid shared by the header row, group headers (which span it via
// gridColumn:"1 / -1"), and every data row (rendered as display:"contents"
// wrappers so their cells land in the parent grid's columns).
const TEMPLATE_ROW_GRID = "22px 80px 110px 70px 1fr 52px 112px minmax(88px, auto)";
// minWidth:0 overrides the grid item's default min-width:auto (which otherwise
// sizes to the element's intrinsic content — e.g. a <select>'s longest option
// text — and forces the whole row to overflow its container).
// Spreads inputStyle for the properties that are genuinely identical
// (border, radius, color, background, box-sizing) so a future change to
// inputStyle's border/color propagates here automatically. padding and
// height are NOT spread — they're deliberately different from inputStyle
// (a shorter, denser control for the fitting-cascade grid) and, critically,
// must stay numerically identical to templateLockedTextStyle's padding/height
// (see that const's own comment) so editable and locked cells in the same
// AppliedTemplateBlock row align. Do not "fix" this to match inputStyle's
// height/padding — that would misalign this style from templateLockedTextStyle.
const templateSmallInputStyle: React.CSSProperties = {
  ...inputStyle, padding:"6px 8px", height:32, fontSize:12,
  width:"100%", minWidth:0,
};
// Same look as templateSmallInputStyle but with the shared gold chevron — used by
// the cascade/product <select>s so every dropdown in the app matches.
const templateSmallSelectStyle: React.CSSProperties = {...templateSmallInputStyle, appearance:"none", cursor:"pointer", paddingRight:24, backgroundImage:CHEVRON, backgroundRepeat:"no-repeat", backgroundPosition:"right 7px center"};
const templateLockedTextStyle: React.CSSProperties = {
  fontSize:11, color:C.slate, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
  padding:"6px 8px", border:`1px solid ${UI.border}`, borderRadius:6, background:UI.pageBg,
  boxSizing:"border-box", height:32, display:"flex", alignItems:"center",
};
// Per-cell divider fragment shared by every fitting-cascade row renderer
// (CatalogFittingRow, StandaloneCatalogRow, and the renderRow/customRow
// closures below). These rows are display:"contents" wrappers with no box
// of their own, so a row-level borderBottom (like .cos-toggle's pipe/fixture
// divider) has nothing to paint on — instead every one of a row's real cells
// gets the same borderBottom+paddingBottom, which lines up into one visual
// divider across the row's full width. Spread this LAST in each cell's style
// object so paddingBottom wins over any shorthand `padding` already set.
const cellDivider = (showDivider: boolean): React.CSSProperties =>
  showDivider ? { borderBottom:`1px solid ${UI.borderRow}`, paddingBottom:6 } : {};

// A fixture-template catalogue-cascade row's Application/Fitting Type/Size/Product
// cells — four dependent dropdowns, each disabled until the one before it is
// resolved. Sizes never include a null bucket now (a no-dimension row is simply
// unreachable via the cascade), so gating reads straight off the row fields with
// no per-mount "chosen" flag.
function CatalogFittingRow({ row, catalogue, catalogueLoading, showDivider, onUpdate, onRemove }: {
  row: TemplateRowInstance;
  catalogue: PlumblinkMaterial[];
  catalogueLoading: boolean;
  showDivider: boolean;
  onUpdate: (fn: (r: TemplateRowInstance) => TemplateRowInstance) => void;
  onRemove: () => void;
}) {
  const disabled = isCheckboxDisabled(row);
  const grade = resolvedGrade(row);
  const applications = distinctApplications(catalogue);
  const fittingTypes = row.application ? distinctFittingTypes(catalogue, row.application) : [];
  const sizes = row.fittingType ? distinctSizes(catalogue, row.application, row.fittingType) : [];
  const products = (row.fittingType && row.nominalSize) ? matchingProducts(catalogue, row.application, row.fittingType, row.nominalSize) : [];

  return (
    <div style={{display:"contents"}}>
      <input type="checkbox" checked={row.checked} disabled={disabled}
        title={disabled?"Select a product first":""}
        onChange={e=>onUpdate(x=>rowSetChecked(x,e.target.checked))}
        style={{width:16,height:16,cursor:disabled?"not-allowed":"pointer",...cellDivider(showDivider)}}/>
      <select value={row.application||"__select__"} disabled={catalogueLoading}
        onChange={e=>{const v=e.target.value;if(v==="__select__")return;onUpdate(x=>rowSetApplication(x,v));}}
        style={{...templateSmallSelectStyle,...cellDivider(showDivider)}}>
        <option value="__select__" disabled>{catalogueLoading?"Loading catalogue…":"Select…"}</option>
        {applications.map(a=><option key={a} value={a}>{a}</option>)}
      </select>
      <select value={row.fittingType||"__select__"} disabled={!row.application}
        onChange={e=>{const v=e.target.value;if(v==="__select__")return;onUpdate(x=>rowSetFittingType(x,v));}}
        style={{...templateSmallSelectStyle,...cellDivider(showDivider)}}>
        <option value="__select__" disabled>Select…</option>
        {fittingTypes.map(ft=><option key={ft} value={ft}>{ft}</option>)}
      </select>
      <select value={row.nominalSize??"__select__"} disabled={!row.fittingType}
        onChange={e=>{const v=e.target.value;if(v==="__select__")return;onUpdate(x=>rowSetSize(x,v));}}
        style={{...templateSmallSelectStyle,...cellDivider(showDivider)}}>
        <option value="__select__" disabled>Select…</option>
        {sizes.map(s=><option key={s} value={s}>{s}</option>)}
      </select>
      <select value={row.materialCode??"__select__"} disabled={!row.nominalSize}
        onChange={e=>{
          const v=e.target.value; if(v==="__select__")return;
          const m=products.find(p=>p.material_code===v);
          if(m) onUpdate(x=>rowSelectMaterial(x,{materialCode:m.material_code,description:m.description??"",unitPrice:m.unit_price_excl_vat??0}));
        }}
        style={{...templateSmallSelectStyle,...cellDivider(showDivider)}}>
        <option value="__select__" disabled>{products.length?"Select product…":"No matching products"}</option>
        {products.map(p=><option key={p.material_code} value={p.material_code}>{productOptionLabel(p)}</option>)}
      </select>
      <input type="number" min={0} step={1} value={row.defaultQty} title="Qty per unit"
        onChange={e=>{const q=Math.max(0,parseFloat(e.target.value)||0);onUpdate(x=>({...x,defaultQty:q}));}}
        style={{width:48,padding:"6px 6px",border:`1px solid ${UI.borderStrong}`,borderRadius:6,fontSize:13,fontWeight:700,textAlign:"center",...cellDivider(showDivider)}}/>
      <PriceCell row={row} style={cellDivider(showDivider)}/>
      <div style={{display:"flex",alignItems:"center",gap:4,justifySelf:"end",...cellDivider(showDivider)}}>
        {grade ? <GradePill grade={grade}/> : <span/>}
        <button onClick={onRemove} title="Remove"
          style={rowDeleteBtnCompact}>✕</button>
      </div>
    </div>
  );
}

// A standalone-section row (Supply Fittings / Drainage Fittings) — application is
// fixed by the section, so the cascade is just Fitting Type⇄Size⇄Product... but
// the section runs it Size → Fitting Type → Product (Size upstream). Three
// dependent dropdowns using the standalone reset setters, plus checkbox/qty.
function StandaloneCatalogRow({ row, catalogue, catalogueLoading, showDivider, onUpdate, onRemove }: {
  row: TemplateRowInstance;
  catalogue: PlumblinkMaterial[];
  catalogueLoading: boolean;
  showDivider: boolean;
  onUpdate: (fn: (r: TemplateRowInstance) => TemplateRowInstance) => void;
  onRemove: () => void;
}) {
  const disabled = isCheckboxDisabled(row);
  const grade = resolvedGrade(row);
  const sizes = distinctSizes(catalogue, row.application);
  const fittingTypes = row.nominalSize ? distinctFittingTypes(catalogue, row.application, row.nominalSize) : [];
  const products = (row.nominalSize && row.fittingType) ? matchingProducts(catalogue, row.application, row.fittingType, row.nominalSize) : [];

  return (
    <div style={{display:"contents"}}>
      <input type="checkbox" checked={row.checked} disabled={disabled}
        title={disabled?"Select a product first":""}
        onChange={e=>onUpdate(x=>rowSetChecked(x,e.target.checked))}
        style={{width:16,height:16,cursor:disabled?"not-allowed":"pointer",...cellDivider(showDivider)}}/>
      <select value={row.nominalSize??"__select__"} disabled={catalogueLoading}
        onChange={e=>{const v=e.target.value;if(v==="__select__")return;onUpdate(x=>rowSetStandaloneSize(x,v));}}
        style={{...templateSmallSelectStyle,...cellDivider(showDivider)}}>
        <option value="__select__" disabled>{catalogueLoading?"Loading catalogue…":"Select…"}</option>
        {sizes.map(s=><option key={s} value={s}>{s}</option>)}
      </select>
      <select value={row.fittingType||"__select__"} disabled={!row.nominalSize}
        onChange={e=>{const v=e.target.value;if(v==="__select__")return;onUpdate(x=>rowSetStandaloneFittingType(x,v));}}
        style={{...templateSmallSelectStyle,...cellDivider(showDivider)}}>
        <option value="__select__" disabled>Select…</option>
        {fittingTypes.map(ft=><option key={ft} value={ft}>{ft}</option>)}
      </select>
      <select value={row.materialCode??"__select__"} disabled={!row.fittingType}
        onChange={e=>{
          const v=e.target.value; if(v==="__select__")return;
          const m=products.find(p=>p.material_code===v);
          if(m) onUpdate(x=>rowSelectMaterial(x,{materialCode:m.material_code,description:m.description??"",unitPrice:m.unit_price_excl_vat??0}));
        }}
        style={{...templateSmallSelectStyle,...cellDivider(showDivider)}}>
        <option value="__select__" disabled>{products.length?"Select product…":"No matching products"}</option>
        {products.map(p=><option key={p.material_code} value={p.material_code}>{productOptionLabel(p)}</option>)}
      </select>
      <input type="number" min={0} step={1} value={row.defaultQty} title="Qty"
        onChange={e=>{const q=Math.max(0,parseFloat(e.target.value)||0);onUpdate(x=>({...x,defaultQty:q}));}}
        style={{width:48,padding:"6px 6px",border:`1px solid ${UI.borderStrong}`,borderRadius:6,fontSize:13,fontWeight:700,textAlign:"center",...cellDivider(showDivider)}}/>
      <PriceCell row={row} style={cellDivider(showDivider)}/>
      <div style={{display:"flex",alignItems:"center",gap:4,justifySelf:"end",...cellDivider(showDivider)}}>
        {grade ? <GradePill grade={grade}/> : <span/>}
        <button onClick={onRemove} title="Remove"
          style={rowDeleteBtnCompact}>✕</button>
      </div>
    </div>
  );
}

// One standalone fittings table — Supply or Drainage, application fixed. No
// fixture header, no fixture-count basis: it's a plain list of catalogue-cascade
// rows (Size → Fitting Type → Product) with a manual "+ Add custom fitting"
// fallback for anything off-catalogue.
const STANDALONE_ROW_GRID = "22px 80px 120px 1fr 52px 112px minmax(88px, auto)";
function StandaloneFittingSection({ title, use, rows, catalogue, catalogueLoading, onAdd, onAddCustom, onUpdate, onRemove }: {
  title: string;
  use: 'supply'|'drainage';
  rows: TemplateRowInstance[];
  catalogue: PlumblinkMaterial[];
  catalogueLoading: boolean;
  onAdd: (use: 'supply'|'drainage') => void;
  onAddCustom: (use: 'supply'|'drainage') => void;
  onUpdate: (use: 'supply'|'drainage', rowId: string, fn: (r: TemplateRowInstance) => TemplateRowInstance) => void;
  onRemove: (use: 'supply'|'drainage', rowId: string) => void;
}) {
  const priced = rows.filter(r=>isPriced(r)).length;
  const catalog = rows.filter(r=>r.origin==="catalog");
  const custom  = rows.filter(r=>r.origin==="custom");

  const customRow = (r: TemplateRowInstance, showDivider: boolean) => {
    const disabled = isCheckboxDisabled(r);
    const grade = resolvedGrade(r);
    return (
      <div key={r.id} style={{display:"contents"}}>
        <input type="checkbox" checked={r.checked} disabled={disabled}
          title={disabled?"Enter a product first":""}
          onChange={e=>{const c=e.target.checked;onUpdate(use,r.id,x=>rowSetChecked(x,c));}}
          style={{width:16,height:16,cursor:disabled?"not-allowed":"pointer",...cellDivider(showDivider)}}/>
        <input placeholder="Size" value={r.nominalSize ?? ""}
          onChange={e=>{const v=e.target.value;onUpdate(use,r.id,x=>({...x,nominalSize:v||null}));}}
          style={{...templateSmallInputStyle,...cellDivider(showDivider)}}/>
        <input placeholder="Fitting type" value={r.fittingType}
          onChange={e=>{const v=e.target.value;onUpdate(use,r.id,x=>({...x,fittingType:v}));}}
          style={{...templateSmallInputStyle,...cellDivider(showDivider)}}/>
        <div style={{minWidth:0,overflow:"hidden",...cellDivider(showDivider)}}>
          <TemplateProductSelect row={r}
            onSelect={m=>onUpdate(use,r.id,x=>rowSelectMaterial(x,m))}
            onManual={(d,p)=>onUpdate(use,r.id,x=>rowSetManual(x,d,p))}
            onResolveDefault={(p,d)=>onUpdate(use,r.id,x=>({...x,unitPrice:p,description:x.description||d}))}/>
        </div>
        <input type="number" min={0} step={1} value={r.defaultQty} title="Qty"
          onChange={e=>{const q=Math.max(0,parseFloat(e.target.value)||0);onUpdate(use,r.id,x=>({...x,defaultQty:q}));}}
          style={{width:48,padding:"6px 6px",border:`1px solid ${UI.borderStrong}`,borderRadius:6,fontSize:13,fontWeight:700,textAlign:"center",...cellDivider(showDivider)}}/>
        <PriceCell row={r} style={cellDivider(showDivider)}/>
        <div style={{display:"flex",alignItems:"center",gap:4,justifySelf:"end",...cellDivider(showDivider)}}>
          {grade ? <GradePill grade={grade}/> : <span/>}
          <button onClick={()=>onRemove(use,r.id)} title="Remove"
            style={rowDeleteBtnCompact}>✕</button>
        </div>
      </div>
    );
  };

  return (
    <div style={cardStyle}>
      <SectionHeader>{title}</SectionHeader>
      <div style={{padding:S.xl}}>
        {rows.length===0
          ? <div style={{fontSize:12,color:C.slateL,padding:"2px 2px 8px"}}>No {use} fittings yet — add one below.</div>
          : <div style={{display:"grid",gridTemplateColumns:STANDALONE_ROW_GRID,columnGap:8,rowGap:4,alignItems:"center"}}>
              <span/>
              <span style={T.colHead}>Size</span>
              <span style={T.colHead}>Fitting Type</span>
              <span style={T.colHead}>Product</span>
              <span style={{...T.colHead,textAlign:"center"}}>Qty</span>
              <span style={{...T.colHead,textAlign:"right"}}>Price</span>
              <span/>
              <span/>
              {catalog.map((r,i)=>(
                <StandaloneCatalogRow key={r.id} row={r} catalogue={catalogue} catalogueLoading={catalogueLoading}
                  showDivider={i<catalog.length-1}
                  onUpdate={fn=>onUpdate(use,r.id,fn)} onRemove={()=>onRemove(use,r.id)}/>
              ))}
              {custom.length>0&&<div style={{gridColumn:"1 / -1",fontSize:11,fontWeight:700,color:C.slate,textTransform:"uppercase",letterSpacing:0.6,margin:"10px 0 4px"}}>Custom fittings</div>}
              {custom.map((r,i)=>customRow(r, i<custom.length-1))}
            </div>}
        <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
          <button onClick={()=>onAdd(use)}
            style={addLineBtn}>+ Add fitting</button>
          <button onClick={()=>onAddCustom(use)}
            style={addLineBtn}>+ Add custom fitting</button>
        </div>
        <div style={{...T.muted,marginTop:6}}>ⓘ {priced} priced · only confirmed rows are priced and added to the buy list.</div>
      </div>
    </div>
  );
}

// GEYSER_BURST_REPLACEMENT's Pressure/Size picker (Brief B-2) — Advanced brand
// only, 4 fixed combinations sourced from Plumblink Quote #6519 (Brief A-2).
// A module-level constant, not fetched: plumblink_materials has no 'Geyser'
// application rows in the cascade catalogue (fetchCascadeCatalogue filters to
// Drainage/Supply only), and these 4 combinations are fixed and known, so
// there's nothing to gain from a live lookup. Values re-verified directly
// against Supabase before hardcoding, per every prior brief in this sequence.
type GeyserPcvPressure = '400kPa' | '600kPa';
type GeyserPcvSize = '15mm' | '22mm';
interface GeyserPcvVbMaterial { materialCode: string; description: string; unitPrice: number; }
const PCV_VB_MATERIAL_MAP: Record<string, { pcv: GeyserPcvVbMaterial; vb: GeyserPcvVbMaterial }> = {
  '400kPa|15mm': {
    pcv: { materialCode:'PLB-GEY-PCV02', description:'Advanced Plastic Multi PCV Valve Relief & Isolator 400kPa 15mm', unitPrice:549.00 },
    vb:  { materialCode:'PLB-GEY-VB02',  description:'Advanced Vacuum Breaker 15mm CXC', unitPrice:75.00 },
  },
  '400kPa|22mm': {
    pcv: { materialCode:'PLB-GEY-PCV01', description:'Advanced Plastic Multi PCV Valve Relief & Isolator 400kPa 22mm', unitPrice:549.00 },
    vb:  { materialCode:'PLB-GEY-VB01',  description:'Advanced Vacuum Breaker 22mm CXC', unitPrice:75.00 },
  },
  '600kPa|15mm': {
    pcv: { materialCode:'PLB-GEY-PCV03', description:'Advanced Plastic Multi PCV Valve Relief & Isolator 600kPa 15mm', unitPrice:549.00 },
    vb:  { materialCode:'PLB-GEY-VB02',  description:'Advanced Vacuum Breaker 15mm CXC', unitPrice:75.00 },
  },
  '600kPa|22mm': {
    pcv: { materialCode:'PLB-GEY-PCV04', description:'Advanced Plastic Multi PCV Valve Relief & Isolator 600kPa 22mm', unitPrice:549.00 },
    vb:  { materialCode:'PLB-GEY-VB01',  description:'Advanced Vacuum Breaker 22mm CXC', unitPrice:75.00 },
  },
};
// Reverse lookup from the PCV row's current materialCode — used only to derive
// the picker's initial Pressure/Size so a reloaded estimate's selector reflects
// whatever combination its rows already carry. Not a persistence mechanism: it
// just reads the AppliedTemplate row state that already exists, the same state
// everything else in this control operates on. Falls back to the template's
// shipped default (400kPa/22mm) when there's no match (fresh application).
const PCV_CODE_TO_COMBO: Record<string, { pressure: GeyserPcvPressure; size: GeyserPcvSize }> = {
  'PLB-GEY-PCV01': { pressure:'400kPa', size:'22mm' },
  'PLB-GEY-PCV02': { pressure:'400kPa', size:'15mm' },
  'PLB-GEY-PCV03': { pressure:'600kPa', size:'15mm' },
  'PLB-GEY-PCV04': { pressure:'600kPa', size:'22mm' },
};
// No dedicated "Unit row Size/Brand dropdown" exists to copy styling from —
// every fixture-template row (Unit included) uses the same generic
// TemplateProductSelect cascade dropdown. This matches the app-wide gold-chevron
// <select> convention instead (see CHEVRON/selectStyle), scaled to sit inline in
// the block header alongside the existing Fixture count input.
const geyserPcvVbSelectStyle: React.CSSProperties = {
  padding:"6px 22px 6px 8px", border:`1px solid ${UI.borderStrong}`, borderRadius:6,
  fontSize:12, color:C.navy, background:C.white, cursor:"pointer", appearance:"none",
  backgroundImage:CHEVRON, backgroundRepeat:"no-repeat", backgroundPosition:"right 6px center",
  boxSizing:"border-box", width:74,
};

// One applied template: its Suggested/Optional/Custom/Catalog rows with
// informational section counts (NOT interactive toggles — bulk-toggle-on-header
// was rejected in design review) and the quantity-basis input (fixture count vs
// pipe run metres).
function AppliedTemplateBlock({ tpl, onRemoveTemplate, onSetBasis, onUpdateRow, onAddCustomRow, onAddCatalogRow, onRemoveRow, catalogue, catalogueLoading }: {
  tpl: AppliedTemplate;
  onRemoveTemplate: (instanceId: string) => void;
  onSetBasis: (instanceId: string, basis: number) => void;
  onUpdateRow: (instanceId: string, rowId: string, fn: (r: TemplateRowInstance) => TemplateRowInstance) => void;
  onAddCustomRow: (instanceId: string) => void;
  onAddCatalogRow: (instanceId: string) => void;
  onRemoveRow: (instanceId: string, rowId: string) => void;
  catalogue: PlumblinkMaterial[];
  catalogueLoading: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // Identify by template_id, not fixture_type — GEYSER_ELEMENT_REPAIR also has
  // fixture_type:'Geyser' but no PCV/Vacuum Breaker rows, so it must not render
  // this control. Hooks below must still run unconditionally (rules of hooks);
  // they're simply unused for every other template's instances.
  const isGeyserBurst = tpl.templateId === 'GEYSER_BURST_REPLACEMENT';
  const [pcvCombo, setPcvCombo] = useState<{ pressure: GeyserPcvPressure; size: GeyserPcvSize }>(() => {
    const pcvRow = tpl.rows.find(r => r.fittingType === 'Pressure Control Valve');
    const found = pcvRow?.materialCode ? PCV_CODE_TO_COMBO[pcvRow.materialCode] : undefined;
    return found ?? { pressure:'400kPa', size:'22mm' };
  });
  // Updates the PCV row and both Vacuum Breaker rows' materialCode/description/
  // unitPrice together for the new combination. Deliberately does not touch
  // checked/touched on any row — a row's confirm state is independent of which
  // real Plumblink SKU it would price at, per Brief B-2 Change #5. Unit and
  // Drip Tray rows are untouched because they never match either fittingType.
  const setPcvVbCombo = (pressure: GeyserPcvPressure, size: GeyserPcvSize) => {
    setPcvCombo({ pressure, size });
    const combo = PCV_VB_MATERIAL_MAP[`${pressure}|${size}`];
    if (!combo) return;
    tpl.rows.forEach(r => {
      if (r.fittingType === 'Pressure Control Valve') {
        onUpdateRow(tpl.instanceId, r.id, x => ({ ...x, materialCode: combo.pcv.materialCode, description: combo.pcv.description, unitPrice: combo.pcv.unitPrice }));
      } else if (r.fittingType === 'Vacuum Breaker') {
        onUpdateRow(tpl.instanceId, r.id, x => ({ ...x, materialCode: combo.vb.materialCode, description: combo.vb.description, unitPrice: combo.vb.unitPrice }));
      }
    });
  };
  // Bug fix: a freshly-applied instance's PCV/VB rows load with materialCode set
  // (from default_material_code) but description/unitPrice blank — these rows are
  // manual-entry (empty product_filter), so TemplateProductSelect's normal
  // default-price resolution never runs for them. Without this, the picker's
  // starting combination silently priced at R0 until the plumber happened to
  // touch the Pressure/Size selector. Runs setPcvVbCombo's row-update logic once
  // on mount for whichever combination pcvCombo was derived to (the shipped
  // 400kPa/22mm default on a fresh apply, or a reloaded estimate's actual
  // combination) — guarded to only touch rows that are still genuinely
  // unresolved, so it can never clobber a value the plumber already edited.
  useEffect(() => {
    if (!isGeyserBurst) return;
    const combo = PCV_VB_MATERIAL_MAP[`${pcvCombo.pressure}|${pcvCombo.size}`];
    if (!combo) return;
    tpl.rows.forEach(r => {
      const unresolved = r.unitPrice === 0 && r.description === '';
      if (!unresolved) return;
      if (r.fittingType === 'Pressure Control Valve' && r.materialCode === combo.pcv.materialCode) {
        onUpdateRow(tpl.instanceId, r.id, x => ({ ...x, description: combo.pcv.description, unitPrice: combo.pcv.unitPrice }));
      } else if (r.fittingType === 'Vacuum Breaker' && r.materialCode === combo.vb.materialCode) {
        onUpdateRow(tpl.instanceId, r.id, x => ({ ...x, description: combo.vb.description, unitPrice: combo.vb.unitPrice }));
      }
    });
    // Mount-only: seeds the initial price once. Subsequent changes happen via
    // the dropdown's onChange (setPcvVbCombo), not this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const sc = sectionCounts(tpl.rows,"suggested");
  const oc = sectionCounts(tpl.rows,"optional");
  const suggested = tpl.rows.filter(r=>r.origin==="suggested");
  const optional  = tpl.rows.filter(r=>r.origin==="optional");
  const custom    = tpl.rows.filter(r=>r.origin==="custom");
  const catalog   = tpl.rows.filter(r=>r.origin==="catalog");

  // Suggested/Optional/Custom rows share this renderer — Application/Size/Fitting
  // Type are locked display text for the first two, free-text inputs for Custom.
  // Catalog rows are rendered separately by CatalogFittingRow (cascade dropdowns).
  const renderRow = (r: TemplateRowInstance, showDivider: boolean) => {
    const disabled = isCheckboxDisabled(r);
    const grade = resolvedGrade(r);
    const editable = r.origin==="custom";
    const rowOpacity = rowState(r)==="removed"?0.5:1;
    return (
      <div key={r.id} style={{display:"contents"}}>
        <input type="checkbox" checked={r.checked} disabled={disabled}
          title={disabled?"Select a product first":""}
          onChange={e=>{const c=e.target.checked;onUpdateRow(tpl.instanceId,r.id,x=>rowSetChecked(x,c));}}
          style={{width:16,height:16,cursor:disabled?"not-allowed":"pointer",opacity:rowOpacity,...cellDivider(showDivider)}}/>
        {editable
          ? <input placeholder="Application" value={r.application}
              onChange={e=>{const v=e.target.value;onUpdateRow(tpl.instanceId,r.id,x=>({...x,application:v}));}}
              style={{...templateSmallInputStyle,opacity:rowOpacity,...cellDivider(showDivider)}}/>
          : <span style={{...templateLockedTextStyle,fontWeight:600,opacity:rowOpacity,...cellDivider(showDivider)}}>{r.application}</span>}
        {editable
          ? <input placeholder="Fitting type" value={r.fittingType}
              onChange={e=>{const v=e.target.value;onUpdateRow(tpl.instanceId,r.id,x=>({...x,fittingType:v}));}}
              style={{...templateSmallInputStyle,opacity:rowOpacity,...cellDivider(showDivider)}}/>
          : <span title={r.productRole ?? undefined} style={{...templateLockedTextStyle,fontWeight:600,opacity:rowOpacity,...cellDivider(showDivider)}}>{r.fittingType}</span>}
        {editable
          ? <input placeholder="Size" value={r.nominalSize ?? ""}
              onChange={e=>{const v=e.target.value;onUpdateRow(tpl.instanceId,r.id,x=>({...x,nominalSize:v}));}}
              style={{...templateSmallInputStyle,opacity:rowOpacity,...cellDivider(showDivider)}}/>
          : <span style={{...templateLockedTextStyle,opacity:rowOpacity,...cellDivider(showDivider)}}>{r.nominalSize ?? "—"}</span>}
        <div style={{opacity:rowOpacity,minWidth:0,overflow:"hidden",...cellDivider(showDivider)}}>
          <TemplateProductSelect row={r}
            onSelect={m=>onUpdateRow(tpl.instanceId,r.id,x=>rowSelectMaterial(x,m))}
            onManual={(d,p)=>onUpdateRow(tpl.instanceId,r.id,x=>rowSetManual(x,d,p))}
            onResolveDefault={(p,d)=>onUpdateRow(tpl.instanceId,r.id,x=>({...x,unitPrice:p,description:x.description||d}))}/>
        </div>
        <input type="number" min={0} step={1} value={r.defaultQty} title="Qty per unit"
          onChange={e=>{const q=Math.max(0,parseFloat(e.target.value)||0);onUpdateRow(tpl.instanceId,r.id,x=>({...x,defaultQty:q}));}}
          style={{width:48,padding:"6px 6px",border:`1px solid ${UI.borderStrong}`,borderRadius:6,fontSize:13,fontWeight:700,textAlign:"center",opacity:rowOpacity,...cellDivider(showDivider)}}/>
        <PriceCell row={r} style={{opacity:rowOpacity,...cellDivider(showDivider)}}/>
        <div style={{display:"flex",alignItems:"center",gap:4,justifySelf:"end",...cellDivider(showDivider)}}>
          {grade ? <GradePill grade={grade}/> : <span/>}
          {r.origin==="custom"
            ? <button onClick={()=>onRemoveRow(tpl.instanceId,r.id)} title="Remove"
                style={{...rowDeleteBtnCompact,opacity:rowOpacity}}>✕</button>
            : <span/>}
        </div>
      </div>
    );
  };

  const plainHead = (t: string) => <div style={{gridColumn:"1 / -1",fontSize:11,fontWeight:700,color:C.slate,textTransform:"uppercase",letterSpacing:0.6,margin:"10px 0 4px"}}>{t}</div>;
  // Filled green check / empty radio — decorative group markers only, no click
  // handler (bulk-toggle-on-header was explicitly rejected in design review).
  const groupHead = (icon: React.ReactNode, t: string) => (
    <div style={{gridColumn:"1 / -1",display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:700,color:C.slate,textTransform:"uppercase",letterSpacing:0.6,margin:"10px 0 4px"}}>
      {icon}<span>{t}</span>
    </div>
  );
  const filledCheck = <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:14,height:14,borderRadius:"50%",background:C.green,color:"#fff",fontSize:9,fontWeight:900,flexShrink:0}}>✓</span>;
  const emptyRadio = <span style={{display:"inline-block",width:14,height:14,borderRadius:"50%",border:`2px solid ${C.slateL}`,flexShrink:0}}/>;

  return (
    <div style={{border:`1px solid ${C.gold}55`,borderRadius:8,marginBottom:12,overflow:"hidden"}}>
      <div style={{background:C.goldPale,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <button onClick={()=>setCollapsed(c=>!c)} title={collapsed?"Expand":"Collapse"}
            style={{background:"none",border:"none",cursor:"pointer",padding:4,color:C.navy,fontSize:12,display:"flex",alignItems:"center"}}>
            {collapsed ? "▸" : "▾"}
          </button>
          <div style={{fontWeight:800,fontSize:13,color:C.navy}}>
            {tpl.fixtureType} Template — {tpl.templateVariant} <span style={{fontSize:11}}>🔗</span>
            <span style={{fontWeight:600,color:C.slateL,fontSize:11}}> · {tpl.scope}</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {isGeyserBurst && (
            <>
              <label style={{fontSize:11,color:C.slateL,fontWeight:600}}>Pressure</label>
              <select value={pcvCombo.pressure} title="PCV / vacuum breaker pressure rating"
                onChange={e=>setPcvVbCombo(e.target.value as GeyserPcvPressure, pcvCombo.size)}
                style={geyserPcvVbSelectStyle}>
                <option value="400kPa">400kPa</option>
                <option value="600kPa">600kPa</option>
              </select>
              <label style={{fontSize:11,color:C.slateL,fontWeight:600}}>Size</label>
              <select value={pcvCombo.size} title="PCV / vacuum breaker size"
                onChange={e=>setPcvVbCombo(pcvCombo.pressure, e.target.value as GeyserPcvSize)}
                style={geyserPcvVbSelectStyle}>
                <option value="15mm">15mm</option>
                <option value="22mm">22mm</option>
              </select>
            </>
          )}
          <label style={{fontSize:11,color:C.slateL,fontWeight:600}}>{quantityInputLabel(tpl.scope)}</label>
          <input type="number" min={tpl.scope==="system"?0:1} step={tpl.scope==="system"?0.5:1} value={tpl.quantityBasis}
            onChange={e=>onSetBasis(tpl.instanceId,Math.max(0,parseFloat(e.target.value)||0))}
            style={{width:78,padding:"6px 8px",border:`1px solid ${UI.borderStrong}`,borderRadius:6,fontSize:13,textAlign:"center"}}/>
          <button onClick={()=>onRemoveTemplate(tpl.instanceId)} title="Remove template"
            style={{padding:"3px 8px",borderRadius:6,border:"1px solid #E0B4B4",background:"#fff",color:C.red,cursor:"pointer",fontSize:13,fontWeight:700}}>✕</button>
        </div>
      </div>
      {!collapsed && (
        <>
          <div style={{padding:"2px 12px 0",fontSize:10,color:C.slateL,fontStyle:"italic"}}>Suggested fittings for this fixture</div>
          <div style={{padding:"6px 12px 10px"}}>
            <div style={{display:"grid",gridTemplateColumns:TEMPLATE_ROW_GRID,columnGap:8,rowGap:4,alignItems:"center"}}>
              <span/>
              <span style={T.colHead}>Application</span>
              <span style={T.colHead}>Fitting Type</span>
              <span style={T.colHead}>Size</span>
              <span style={T.colHead}>Product</span>
              <span style={{...T.colHead,textAlign:"center"}}>Qty</span>
              <span style={{...T.colHead,textAlign:"right"}}>Price</span>
              <span/>
              <span/>

              {suggested.length>0&&groupHead(filledCheck,`Suggested fittings (${sc.active} of ${sc.total} confirmed)`)}
              {suggested.map((r,i)=>renderRow(r, i<suggested.length-1))}
              {optional.length>0&&groupHead(emptyRadio,`Optional fittings (${oc.active} of ${oc.total} selected)`)}
              {optional.map((r,i)=>renderRow(r, i<optional.length-1))}
              {catalog.length>0&&plainHead("Catalogue fittings")}
              {catalog.map((r,i)=>(
                <CatalogFittingRow key={r.id} row={r} catalogue={catalogue} catalogueLoading={catalogueLoading}
                  showDivider={i<catalog.length-1}
                  onUpdate={fn=>onUpdateRow(tpl.instanceId,r.id,fn)} onRemove={()=>onRemoveRow(tpl.instanceId,r.id)}/>
              ))}
              {custom.length>0&&plainHead("Custom fittings")}
              {custom.map((r,i)=>renderRow(r, i<custom.length-1))}
            </div>
            <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
              <button onClick={()=>onAddCatalogRow(tpl.instanceId)}
                style={addLineBtn}>+ Add fitting</button>
              <button onClick={()=>onAddCustomRow(tpl.instanceId)}
                style={addLineBtn}>+ Add custom fitting</button>
            </div>
            <div style={{...T.muted,marginTop:6}}>ⓘ Only confirmed rows are priced and added to the buy list.</div>
          </div>
        </>
      )}
    </div>
  );
}

// Multi-select of active employees, purely descriptive metadata on the job
// (Brief 2 — "Employees Allocated"). No existing multi-select pattern in the
// app to mirror, so this is a plain dropdown-of-checkboxes + removable chips.
function EmployeesAllocatedField({ value, onChange, employees, loading }: {
  value: { id: string; name: string }[];
  onChange: (next: { id: string; name: string }[]) => void;
  employees: Employee[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selectedIds = new Set(value.map(v => v.id));
  const disabled = !loading && employees.length === 0;

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const toggle = (emp: Employee) => {
    onChange(selectedIds.has(emp.id)
      ? value.filter(v => v.id !== emp.id)
      : [...value, { id: emp.id, name: emp.name }]);
  };
  const remove = (id: string) => onChange(value.filter(v => v.id !== id));

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <label style={T.fieldLabel}>Employees Allocated</label>
      <button type="button" onClick={() => !disabled && setOpen(o => !o)} disabled={disabled}
        style={{ ...selectStyle, width: "100%", textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
          color: value.length ? C.navy : C.slateL }}>
        {loading ? "Loading employees…" : disabled ? "No employees added"
          : value.length ? `${value.length} selected` : "Select employees…"}
      </button>
      {disabled && (
        <div style={{ ...T.muted, marginTop: 4 }}>
          No employees added — add employees in Profile &amp; Settings.
        </div>
      )}
      {open && !disabled && (
        <div style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 4,
          background: C.white, border: `1px solid ${UI.borderStrong}`, borderRadius: 6,
          boxShadow: UI.cardShadow, maxHeight: 220, overflowY: "auto" }}>
          {employees.map(emp => (
            <label key={emp.id} style={{ display: "flex", alignItems: "center", gap: 8,
              padding: "8px 10px", cursor: "pointer", fontSize: 13, color: C.navy }}>
              <input type="checkbox" checked={selectedIds.has(emp.id)} onChange={() => toggle(emp)}
                style={{ width: 14, height: 14 }} />
              {emp.name}{emp.position ? ` (${emp.position})` : ""}
            </label>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {value.map(v => (
            <span key={v.id} style={{ display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 8px", borderRadius: 14, background: C.goldPale,
              border: `1px solid ${C.gold}55`, fontSize: 12, color: C.navy, fontWeight: 600 }}>
              {v.name}
              <button type="button" onClick={() => remove(v.id)} title={`Remove ${v.name}`}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0,
                  color: C.red, fontWeight: 700, fontSize: 12, lineHeight: 1 }}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Reused three times (Drainage's 2.3, Fixtures' 4.2, Geyser's 3.3.2) against the
// same underlying inputs.fittingTemplates array — scopeFilter partitions both
// the picker's offered templates and the rendered applied list by
// AppliedTemplate.scope, so applying a template from one nested location never
// bleeds into another's rendered list even though they share the array.
function FixtureTemplatesSection({ title, scopeFilter, applied, catalogue, catalogueLoading, onApply, onRemoveTemplate, onSetBasis, onUpdateRow, onAddCustomRow, onAddCatalogRow, onRemoveRow }: {
  title: string;
  scopeFilter: 'fixture' | 'system' | 'geyser';
  applied: AppliedTemplate[];
  catalogue: PlumblinkMaterial[];
  catalogueLoading: boolean;
  onApply: (t: FixtureTemplate) => void;
  onRemoveTemplate: (instanceId: string) => void;
  onSetBasis: (instanceId: string, basis: number) => void;
  onUpdateRow: (instanceId: string, rowId: string, fn: (r: TemplateRowInstance) => TemplateRowInstance) => void;
  onAddCustomRow: (instanceId: string) => void;
  onAddCatalogRow: (instanceId: string) => void;
  onRemoveRow: (instanceId: string, rowId: string) => void;
}) {
  const [allTemplates, setAllTemplates] = useState<FixtureTemplate[]>([]);
  const [picked, setPicked] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchFixtureTemplates().then(ts => {
      if (!alive) return;
      setAllTemplates(ts); setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const templates = allTemplates.filter(t=>t.scope===scopeFilter);
  useEffect(() => {
    if (!picked && templates[0]) setPicked(templates[0].template_id);
  }, [templates, picked]);
  const scopedApplied = applied.filter(a=>a.scope===scopeFilter);

  const pick = templates.find(t=>t.template_id===picked);

  return (
    <div style={cardStyle}>
      <SectionHeader>{title}</SectionHeader>
      <div style={{padding:S.xl}}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:scopedApplied.length?12:8}}>
          <select value={picked} onChange={e=>setPicked(e.target.value)} disabled={loading||templates.length===0}
            style={{...selectStyle,flex:1,minWidth:200,height:34,fontSize:12}}>
            {loading&&<option>Loading templates…</option>}
            {!loading&&templates.length===0&&<option>No templates found</option>}
            {templates.map(t=><option key={t.template_id} value={t.template_id}>{t.template_name}</option>)}
          </select>
          <button onClick={()=>pick&&onApply(pick)} disabled={!pick}
            style={{...addLineBtn,cursor:pick?"pointer":"not-allowed",opacity:pick?1:0.5}}>+ Add template</button>
        </div>
        {scopedApplied.length===0
          ? <div style={{fontSize:12,color:C.slateL,padding:"2px 2px 4px"}}>No templates added. A template <em>suggests</em> scope; you confirm what gets priced — nothing is priced from a suggestion alone.</div>
          : scopedApplied.map(tpl=><AppliedTemplateBlock key={tpl.instanceId} tpl={tpl}
              onRemoveTemplate={onRemoveTemplate} onSetBasis={onSetBasis} onUpdateRow={onUpdateRow}
              onAddCustomRow={onAddCustomRow} onAddCatalogRow={onAddCatalogRow} onRemoveRow={onRemoveRow}
              catalogue={catalogue} catalogueLoading={catalogueLoading}/>)}
      </div>
    </div>
  );
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

  const [screen, setScreen] = useState<"entry"|"scan"|"review"|"output">("entry");
  const [tab,    setTab]    = useState("estimate");
  const [inputs, setInputs] = useState<Inputs>(DEFAULT);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Active employees for the "Employees Allocated" picker (Brief 2). Fetched
  // once — same org-resolution path as the Settings page's Employee Details
  // card (get-employees edge function; employees.RLS has no client session yet).
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadEmployees();
      if (!cancelled) {
        setEmployees(list);
        setEmployeesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  // Independent per-section toggles — replaces the old exclusive jobMode gate.
  // A job can hold any combination concurrently; Scan Drawing stays a distinct
  // full-screen flow via `screen`, not a fifth toggle (finishing a scan already
  // returns to a normal editing state, so it isn't "concurrent" the same way).
  const [activeSections, setActiveSections] = useState<ActiveSections>({ waterSupply:false, drainage:false, geyser:false, fixtures:false });
  const toggleSection = useCallback((key: keyof ActiveSections) => setActiveSections(p=>({...p, [key]:!p[key]})), []);
  // Cascade catalogue lifted here (fetched once) and shared by the fixture
  // templates section and both standalone Supply/Drainage fitting sections.
  const [catalogue, setCatalogue] = useState<PlumblinkMaterial[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetchCascadeCatalogue().then(rows => {
      if (!alive) return;
      setCatalogue(rows); setCatalogueLoading(false);
    });
    return () => { alive = false; };
  }, []);
  const [geyser, setGeyser]   = useState<GeyserMeta>(GEYSER_DEFAULT);
  // Geyser pricing (fetched once, like `catalogue` above) — feeds the
  // fixed-composition build functions, which stay synchronous/pure.
  const [geyserPricing, setGeyserPricing] = useState<GeyserPricingData | null>(null);
  useEffect(() => {
    let alive = true;
    fetchGeyserPricing().then(data => {
      if (!alive) return;
      setGeyserPricing(data);
    });
    return () => { alive = false; };
  }, []);
  const [documentType] = useState<DocumentType>(doc);
  const [docRef, setDocRef] = useState<string | null>(null);
  const [isGeneratingRef, setIsGeneratingRef] = useState(false);
  const [invoiceMeta, setInvoiceMeta] = useState<InvoiceMeta>(() => {
    const issue = isoDate(new Date());
    return { issueDate: issue, dueDate: addDays(issue, settings.invoicePaymentDays), bankingDetails: settings.bankingDetails ?? "" };
  });

  // Geyser assembly (fixed-composition) vs plumbing engine (baseline-and-scale)
  const geyserAsm = useMemo<GeyserAssembly | null>(() =>
    activeSections.geyser && geyserPricing
      ? (geyser.jobType==="burst_replacement"
          ? buildGeyserReplacement(geyser.size, geyser.brand, geyserPricing)
          : geyser.jobType==="new_installation"
          ? buildNewInstallation(geyser.size, geyser.brand, geyserPricing)
          : buildElementRepair(geyser.size, geyser.solar, geyserPricing))
      : null, [activeSections.geyser, geyser, geyserPricing]);

  // A toggled-off section's data isn't cleared (re-enabling restores it as-is)
  // but must not silently contribute to totals while its card is hidden — this
  // masks what's passed into buildScope/buildLabour per active section, without
  // touching either function's internals. fittingTemplates is shared across the
  // three nested template pickers (Drainage/Fixtures/Geyser); each applied
  // instance's own `scope` says which section it belongs to.
  const maskedInputs = useMemo<Inputs>(() => ({
    ...inputs,
    supplyLines: activeSections.waterSupply ? (inputs.supplyLines ?? []) : [],
    supplyFittings: activeSections.waterSupply ? (inputs.supplyFittings ?? []) : [],
    points: activeSections.waterSupply ? inputs.points : 0,
    drainLines: activeSections.drainage ? (inputs.drainLines ?? []) : [],
    drainageFittings: activeSections.drainage ? (inputs.drainageFittings ?? []) : [],
    trenching: activeSections.drainage ? inputs.trenching : false,
    fixtureLines: activeSections.fixtures ? (inputs.fixtureLines ?? []) : [],
    fittingTemplates: (inputs.fittingTemplates ?? []).filter(t =>
      (t.scope==='system' && activeSections.drainage) ||
      (t.scope==='fixture' && activeSections.fixtures) ||
      (t.scope==='geyser' && activeSections.geyser)),
  }), [inputs, activeSections]);

  // Invoice-only "After-hours job" toggle (Brief 2, Emergency Call-Out) — applies
  // settings.afterHoursMultiplier to the composite crew rate BEFORE the day-rate
  // → hourly derivation's consumers run, so it compounds correctly rather than
  // being bolted onto the total afterwards. Materials/ladder/callout/travel are
  // untouched — this only changes the rate fed into buildLabour/geyserToLabour.
  const afterHoursActive = documentType==="invoice" && !!inputs.afterHours;
  const crewRateHr = afterHoursActive ? crewRateFrom(settings) * settings.afterHoursMultiplier : crewRateFrom(settings);

  const scope  = useMemo(()=> [...buildScope(maskedInputs, { invoiceStrict: documentType==="invoice" }), ...(geyserAsm ? geyserToScope(geyserAsm) : [])],  [geyserAsm, maskedInputs, documentType]);
  const labour = useMemo(()=> [...buildLabour(maskedInputs, crewRateHr), ...(geyserAsm ? geyserToLabour(geyserAsm, crewRateHr) : [])], [geyserAsm, maskedInputs, crewRateHr]);
  // Flags: geyser flags concatenated with warnings for any user-entered (custom)
  // lines — concatenated, not either/or, now that sections can be concurrent.
  const flags = [
    ...(geyserAsm ? geyserAsm.flags : []),
    ...(maskedInputs.fixtureLines ?? []).filter(l => l.source==="custom" && l.quantity>0)
      .map(l => `Custom fixture line "${l.description || "(unnamed)"}" — user-entered price R${l.unitPrice}, unverified (Assumption)`),
    ...([...(maskedInputs.supplyLines ?? []), ...(maskedInputs.drainLines ?? [])]).filter(l => l.source==="custom" && l.metres>0)
      .map(l => `Custom ${l.use} pipe "${l.description || "(unnamed)"}" — user-entered R${l.perMetre}/m, unverified (Assumption)`),
  ];
  const finalGrade = useMemo(()=>{
    const all=[...scope.map(l=>l.conf),...labour.map(l=>l.conf)];
    return all.reduce((m,g)=>(GRADES[g]?.rank<GRADES[m]?.rank?g:m),"Validated");
  },[scope,labour]);

  // effInputs carries the geyser meta + a descriptive project name into the
  // header, scope modal, tabs and PDF generators.
  const geyserName = geyserAsm
    ? `${geyser.size}L ${geyser.jobType==="burst_replacement"?`${geyser.brand} geyser replacement`
      :geyser.jobType==="new_installation"?`${geyser.brand} geyser new installation`
      :"geyser element repair"}`
    : "";
  const effInputs: Inputs = geyserAsm
    ? { ...maskedInputs, projectName: (maskedInputs.projectName && maskedInputs.projectName!==DEFAULT.projectName) ? maskedInputs.projectName : geyserName, _geyser: geyser, _scanNotes: undefined }
    : maskedInputs;

  const setInp = useCallback((k: keyof Inputs, v: unknown) => setInputs(p=>({...p,[k]:v})),[]);
  const setGey = useCallback((patch: Partial<GeyserMeta>) => setGeyser(p=>({...p,...patch})),[]);

  // Fixture-line builder management
  const addFixtureLine = useCallback((type: FixtureType) =>
    setInputs(p=>({...p, fixtureLines:[...(p.fixtureLines ?? []), makeFixtureLine(type)]})),[]);
  const removeFixtureLine = useCallback((id: string) =>
    setInputs(p=>({...p, fixtureLines:(p.fixtureLines ?? []).filter(l=>l.id!==id)})),[]);
  const updateFixtureLine = useCallback((id: string, patch: Partial<FixtureLine>) =>
    setInputs(p=>({...p, fixtureLines:(p.fixtureLines ?? []).map(l=>l.id===id?{...l,...patch}:l)})),[]);

  // Standalone Supply/Drainage fitting section management. Each section owns a
  // list of catalog rows whose application is fixed by the section; the `use` key
  // routes to the right Inputs list, mirroring the pipe-line builder pattern.
  const addStandaloneFitting = useCallback((use: 'supply'|'drainage') => {
    const key = use==='supply' ? 'supplyFittings' : 'drainageFittings';
    const application = use==='supply' ? 'Supply' : 'Drainage';
    setInputs(p=>({...p, [key]:[...(p[key] ?? []), createStandaloneRowInstance(application)]}));
  },[]);
  const addStandaloneCustomFitting = useCallback((use: 'supply'|'drainage') => {
    const key = use==='supply' ? 'supplyFittings' : 'drainageFittings';
    const application = use==='supply' ? 'Supply' : 'Drainage';
    setInputs(p=>({...p, [key]:[...(p[key] ?? []), { ...createCustomRowInstance(1), application }]}));
  },[]);
  const removeStandaloneFitting = useCallback((use: 'supply'|'drainage', id: string) => {
    const key = use==='supply' ? 'supplyFittings' : 'drainageFittings';
    setInputs(p=>({...p, [key]:(p[key] ?? []).filter(r=>r.id!==id)}));
  },[]);
  const updateStandaloneFitting = useCallback((use: 'supply'|'drainage', id: string, fn: (r: TemplateRowInstance) => TemplateRowInstance) => {
    const key = use==='supply' ? 'supplyFittings' : 'drainageFittings';
    setInputs(p=>({...p, [key]:(p[key] ?? []).map(r=>r.id===id?fn(r):r)}));
  },[]);

  // Fixture-template management. Applying fetches the template's rows and builds
  // live TemplateRowInstances; the basis input scales every row's pricing
  // (fixture count, or pipe run metres for system templates).
  const applyTemplate = useCallback(async (template: FixtureTemplate) => {
    const rows = await fetchTemplateRows(template.template_id);
    if (rows.length === 0) return;
    const basis = template.scope === "system" ? 6 : 1;
    const applied: AppliedTemplate = {
      instanceId: _uid(), templateId: template.template_id, fixtureType: template.fixture_type,
      templateName: template.template_name, templateVariant: template.template_variant, scope: template.scope,
      quantityBasis: basis, rows: rows.map(r => initialRowInstance(r, basis)),
    };
    setInputs(p => ({ ...p, fittingTemplates: [...(p.fittingTemplates ?? []), applied] }));
  }, []);
  const removeTemplate = useCallback((instanceId: string) =>
    setInputs(p => ({ ...p, fittingTemplates: (p.fittingTemplates ?? []).filter(t => t.instanceId !== instanceId) })), []);
  const setTemplateBasis = useCallback((instanceId: string, basis: number) =>
    setInputs(p => ({ ...p, fittingTemplates: (p.fittingTemplates ?? []).map(t =>
      t.instanceId !== instanceId ? t : { ...t, quantityBasis: basis, rows: t.rows.map(r => ({ ...r, quantityBasis: basis })) }) })), []);
  const updateTemplateRow = useCallback((instanceId: string, rowId: string, fn: (r: TemplateRowInstance) => TemplateRowInstance) =>
    setInputs(p => ({ ...p, fittingTemplates: (p.fittingTemplates ?? []).map(t =>
      t.instanceId !== instanceId ? t : { ...t, rows: t.rows.map(r => r.id === rowId ? fn(r) : r) }) })), []);
  const addCustomTemplateRow = useCallback((instanceId: string) =>
    setInputs(p => ({ ...p, fittingTemplates: (p.fittingTemplates ?? []).map(t =>
      t.instanceId !== instanceId ? t : { ...t, rows: [...t.rows, createCustomRowInstance(t.quantityBasis)] }) })), []);
  const addCatalogTemplateRow = useCallback((instanceId: string) =>
    setInputs(p => ({ ...p, fittingTemplates: (p.fittingTemplates ?? []).map(t =>
      t.instanceId !== instanceId ? t : { ...t, rows: [...t.rows, createCatalogRowInstance(t.quantityBasis)] }) })), []);
  const removeTemplateRow = useCallback((instanceId: string, rowId: string) =>
    setInputs(p => ({ ...p, fittingTemplates: (p.fittingTemplates ?? []).map(t =>
      t.instanceId !== instanceId ? t : { ...t, rows: t.rows.filter(r => r.id !== rowId) }) })), []);

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
    // Scan Drawing stays a distinct flow, not concurrent with the other four —
    // finishing a scan returns to a clean plumbing-only state (matching the old
    // jobMode="plumbing" reset) rather than merging into whatever was active.
    setActiveSections({ waterSupply:true, drainage:true, fixtures:true, geyser:false });
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
  const ladderBreakdown=applyLadder(matTotal,labTotal,ladder);
  const sell=ladderBreakdown.sell;

  // Save document to DB for persistence. estimate_versions has RLS requiring
  // auth.uid(), and this app has no signed-in sessions, so the save goes
  // through the save-estimate edge function (service role) rather than a
  // direct client insert — same pattern as employees/vehicles/attendance.
  // The edge function also mints the canonical reference server-side, so it
  // is returned here rather than generated separately beforehand.
  const saveDocumentToDB = async (): Promise<string | null> => {
    // Per-section snapshot (Brief C-2 Step 0.6) — a faithful, reconstructable
    // record of what was actually quoted (which sections were active and each
    // active section's real input data), not just totals as before. This is
    // write-only: no code path reads this shape back into the editor.
    const activeSectionKeys = (Object.keys(activeSections) as (keyof ActiveSections)[]).filter(k=>activeSections[k]);
    const snapshot = {
      projectName: effInputs.projectName,
      clientName: effInputs.clientName,
      allocatedEmployees: (effInputs.allocatedEmployees ?? []).map(e => ({ id: e.id, name: e.name })),
      afterHours: effInputs.afterHours ?? false,
      activeSections: activeSectionKeys,
      waterSupply: activeSections.waterSupply ? {
        supplyLines: inputs.supplyLines ?? [],
        supplyFittings: inputs.supplyFittings ?? [],
      } : null,
      drainage: activeSections.drainage ? {
        drainLines: inputs.drainLines ?? [],
        drainageFittings: inputs.drainageFittings ?? [],
        trenching: inputs.trenching,
        templates: (inputs.fittingTemplates ?? []).filter(t=>t.scope==='system'),
      } : null,
      geyser: activeSections.geyser ? {
        ...geyser,
        templates: (inputs.fittingTemplates ?? []).filter(t=>t.scope==='geyser'),
      } : null,
      fixtures: activeSections.fixtures ? {
        fixtureLines: inputs.fixtureLines ?? [],
        templates: (inputs.fittingTemplates ?? []).filter(t=>t.scope==='fixture'),
      } : null,
      points: inputs.points,
      totals: {
        material: matTotal,
        labour: labTotal,
        sellExclVat: sell,
      },
      // Frozen at save time so the detail view never re-derives from
      // current-day catalogue prices or current organization_settings
      // ladder percentages — both can change after the quote was issued.
      materialLines: scope.map(l => ({
        id: l.id, code: l.code, description: l.description, qty: l.qty,
        unit: l.unit, unitPrice: l.unitPrice, total: l.total, conf: l.conf,
      })),
      ladder: { rates: ladder, breakdown: ladderBreakdown },
    };

    const invoiceMeta2 = documentType === "invoice" ? invoiceMeta : undefined;

    const result = await saveEstimate(snapshot, effInputs.projectName, effInputs.clientName, documentType, (invoiceMeta2 ?? {}) as Record<string, unknown>);
    if (!result.success || !result.estimate) {
      console.error('Save failed:', result.error);
      return null;
    }
    return result.estimate.reference;
  };

  // Save (if not already saved) and print document
  const printDocument = async () => {
    setIsGeneratingRef(true);
    try {
      let currentRef = docRef;
      if (!currentRef) {
        currentRef = await saveDocumentToDB();
        if (!currentRef) {
          alert(`Failed to save ${documentType}. Please check your connection and try again.`);
          return;
        }
        setDocRef(currentRef);
      }

      // Generate and download the document
      if (documentType === "invoice") {
        printInvoiceDocument({ inputs:effInputs, scope, labour, invoiceRef:currentRef, invoiceMeta, sellExVat:sell, vatRate, business:businessFrom(settings), vatNumber:settings.vatNumber, terms:settings.termsConditions });
      } else {
        printQuotePDF(effInputs,scope,labour,currentRef,settings);
      }
    } catch (err) {
      console.error('Failed to generate document:', err);
      alert(`Failed to generate ${documentType}. Please try again.`);
    } finally {
      setIsGeneratingRef(false);
    }
  };

  const printBuy = () => {
    if (!docRef) return;
    printBuyPDF(effInputs,scope,docRef);
  };

  const AppHeader = ({ showTabs }: { showTabs: boolean }) => (
    <div style={{background:C.navy,borderBottom:`3px solid ${C.gold}`,position:"sticky",top:0,zIndex:100}}>
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        active={documentType === "invoice" ? "invoices" : "quotes"}
      />
      <div style={{maxWidth:960,margin:"0 auto",padding:"12px 20px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
        <HamburgerButton onClick={() => setDrawerOpen(true)} />
        <Link to="/" style={{textDecoration:"none"}}><Logo/></Link>
        <div style={{flex:1,marginLeft:4,minWidth:0}}>
          {showTabs&&<div style={{color:C.slateL,fontSize:12}}>{effInputs.projectName}</div>}
        </div>
        {showTabs
          ? <button onClick={()=>{setScreen("entry");setTab("estimate");}}
              style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${C.gold}50`,background:"transparent",color:C.gold,cursor:"pointer",fontSize:11,fontWeight:600}}>← Edit</button>
          : <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["Estimate","Buy","Build","Learn"].map(t=>(
                <span key={t} style={{background:`${C.gold}22`,color:C.gold,fontSize:10,padding:"2px 7px",borderRadius:4,fontWeight:700}}>{t}</span>))}
            </div>
        }
      </div>
      {showTabs&&(
        <div style={{maxWidth:960,margin:"0 auto",padding:"0 20px"}}>
          <div style={{display:"flex",gap:4}}>
            {TABS.map(t=>{
              const active = t.id===tab;
              return (
              <button key={t.id} onClick={()=>setTab(t.id)} className="cos-tab"
                aria-current={active?"page":undefined} style={{
                padding:"9px 18px 8px",borderRadius:"8px 8px 0 0",cursor:"pointer",fontSize:13,marginBottom:-1,
                borderTop:`3px solid ${active?C.gold:"transparent"}`,
                borderLeft:`1px solid ${active?UI.border:"transparent"}`,
                borderRight:`1px solid ${active?UI.border:"transparent"}`,
                borderBottom:active?"1px solid #fff":"1px solid transparent",
                background:active?"#fff":"transparent",
                color:active?C.navy:C.slateL,fontWeight:active?800:500,letterSpacing:0.2}}>
                {t.icon} {t.label}
              </button>);
            })}
          </div>
        </div>
      )}
    </div>
  );

  if (screen==="scan") return (
    <div className="cos-app" style={{fontFamily:"'Inter',system-ui,sans-serif",background:UI.pageBg,minHeight:"100vh"}}>
      <AppHeader showTabs={false}/>
      <div style={{maxWidth:680,margin:"0 auto",padding:"24px 20px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button onClick={()=>setScreen("entry")} style={backNavBtn}>← Manual entry</button>
          <span style={{color:C.slateL,fontSize:12}}>or upload a floor plan to auto-populate inputs</span>
        </div>
        <div style={{...cardStyle,marginBottom:0}}>
          <SectionHeader>📐 Scan Architectural Drawing</SectionHeader>
          <ScanDrawingPanel onExtracted={onScanDone}/>
        </div>
      </div>
    </div>
  );

  if (screen==="review") return (
    <div className="cos-app" style={{fontFamily:"'Inter',system-ui,sans-serif",background:UI.pageBg,minHeight:"100vh"}}>
      <AppHeader showTabs={false}/>
      <ScopeModal scope={scope} labour={labour} inputs={effInputs}
        onConfirm={()=>{setTab("estimate");setScreen("output");}}
        onBack={()=>setScreen("entry")}/>
    </div>
  );

  if (screen==="output") return (
    <div className="cos-app" style={{fontFamily:"'Inter',system-ui,sans-serif",background:UI.pageBg,minHeight:"100vh"}}>
      <AppHeader showTabs={true}/>
      <div style={{maxWidth:960,margin:"0 auto",padding:`0 ${S.xxl}px ${S.xxl}px`}}>
        {inputs._scanNotes&&!geyserAsm&&<div style={{background:"#FEF5E7",border:`1px solid ${C.amber}40`,borderRadius:"0 0 6px 6px",padding:"6px 16px",fontSize:11,color:C.navy,marginBottom:4}}>📐 <strong>Scan-derived scope:</strong> {inputs._scanNotes}</div>}
        {geyserAsm&&<div style={{background:"#FEF5E7",border:`1px solid ${C.amber}40`,borderRadius:"0 0 6px 6px",padding:"6px 16px",fontSize:11,color:C.navy,marginBottom:4}}>♨ <strong>Geyser assembly · {finalGrade} grade:</strong> fixed-composition quote — {flags.length} note{flags.length===1?"":"s"} in the Learn tab{GRADES[finalGrade]?.rank>=GRADES["Derived"].rank?" · client-issuable through the normal gate.":" · not client-issuable until grade lifts."}</div>}
        <div style={{background:C.white,borderRadius:"0 10px 10px 10px",borderLeft:`1px solid ${UI.border}`,borderRight:`1px solid ${UI.border}`,borderBottom:`1px solid ${UI.border}`,overflow:"hidden",boxShadow:UI.cardShadow}}>
          {tab==="estimate"&&<EstimateTab scope={scope} labour={labour} inputs={effInputs} finalGrade={finalGrade} docRef={docRef} documentType={documentType} onPrintDocument={printDocument} ladder={ladder} vatRate={vatRate} isGeneratingRef={isGeneratingRef}/>}
          {tab==="buy"    &&<BuyTab scope={scope} inputs={effInputs} quoteRef={docRef} onPrintBuy={printBuy}/>}
          {tab==="build"  &&<BuildTab labour={labour} allocatedEmployees={effInputs.allocatedEmployees}/>}
          {tab==="learn"  &&<LearnTab scope={scope} labour={labour} flags={flags} documentType={documentType}/>}
        </div>
        <div style={{marginTop:8,...T.muted,textAlign:"center"}}>{geyserAsm?"ContractorOS v2 · Geyser Assembly (Tier 2) · Vissi evidence 2022–26 · true-cost + ladder · excl. VAT":"ContractorOS v2 · Plumbing Tier 2 · Plumblink/CTM/Gelmar 2025–26 · Spon's seed SA-adjusted · excl. VAT"}</div>
      </div>
    </div>
  );

  // Reusable supply/drainage pipe line builder (type + diameter + metres)
  const pipeSection = (use: 'supply'|'drainage', title: string, extra: React.ReactNode) => {
    const lines = ((use==='supply' ? inputs.supplyLines : inputs.drainLines) ?? []);
    const types = pipeTypesFor(use);
    return (
      <div style={cardStyle}>
        <SectionHeader>{title}</SectionHeader>
        <div style={{padding:S.xl}}>
          {lines.length===0&&<div style={{fontSize:12,color:C.slateL,padding:"6px 2px 10px"}}>No {use} lines — add one below.</div>}
          {lines.length>0&&(
            <div className="cos-line cos-line--pipe cos-line-head">
              <span style={T.colHead}>Material</span>
              <span style={T.colHead}>Size</span>
              <span style={{...T.colHead,textAlign:"center"}}>Run (m)</span>
              <span style={{...T.colHead,textAlign:"right"}}>Rate</span>
              <span style={{...T.colHead,textAlign:"right"}}>Line total</span>
              <span/><span/>
            </div>)}
          {lines.map((l,i)=>{
            const dias = l.source==="custom" ? [] : pipeDiametersFor(use,l.type);
            const isCustom = l.source==="custom";
            return (
            <div key={l.id} className="cos-toggle" style={{padding:"12px 14px 12px 0",
              borderBottom:i===lines.length-1?"none":`1px solid ${UI.borderRow}`,
              background:isCustom?UI.customBg:"transparent"}}>
              <div className="cos-line cos-line--pipe">
                <select className="cos-grow" value={isCustom?"__custom__":l.type}
                  onChange={e=>{const v=e.target.value;
                    if(v==="__custom__"){updatePipeLine(use,l.id,{source:"custom",pipeCode:undefined,type:"Custom",diameter:0,description:"",perMetre:0,grade:"Assumption",supplier:undefined});}
                    else{const dia=pipeDiametersFor(use,v)[0];const r=pipeRow(use,v,dia);if(r)updatePipeLine(use,l.id,{source:"library",pipeCode:r.code,type:r.type,diameter:r.diameter,description:r.description,perMetre:r.perMetre,grade:r.grade,supplier:r.source});}}}
                  style={{...rowSelect,minWidth:0}}>
                  {types.map(t=><option key={t} value={t}>{t}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
                {isCustom
                  ? <span style={{...T.secondary,textAlign:"center"}}>—</span>
                  : <select value={l.diameter}
                    onChange={e=>{const d=parseInt(e.target.value);const r=pipeRow(use,l.type,d);if(r)updatePipeLine(use,l.id,{pipeCode:r.code,diameter:r.diameter,description:r.description,perMetre:r.perMetre,grade:r.grade});}}
                    style={{...rowSelect,minWidth:0}}>
                    {dias.map(d=><option key={d} value={d}>{d}mm</option>)}
                  </select>}
                <div className="cos-num" style={{display:"flex",alignItems:"center",gap:4,minWidth:0}}>
                  <input type="number" min={0} value={l.metres}
                    onChange={e=>updatePipeLine(use,l.id,{metres:Math.max(0,parseFloat(e.target.value)||0)})}
                    style={{...rowCtl,width:"100%",minWidth:0,fontWeight:700,textAlign:"center",padding:"0 6px"}}/>
                  <span style={T.secondary}>m</span>
                </div>
                <span style={{...T.rate,textAlign:"right"}}>R{l.perMetre.toFixed(2)}/m</span>
                <span style={{...T.total,textAlign:"right",height:34}}>{fmt(l.metres*l.perMetre)}</span>
                <div style={{display:"flex",alignItems:"center",gap:4,justifySelf:"end"}}>
                  <GradePill grade={l.grade}/>
                  <button onClick={()=>removePipeLine(use,l.id)} title="Remove line" aria-label="Remove line" style={rowDeleteBtn}>✕</button>
                </div>
              </div>
              {isCustom&&(
                <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
                  <input placeholder={`Custom ${use} pipe description`} value={l.description}
                    onChange={e=>updatePipeLine(use,l.id,{description:e.target.value})}
                    style={{...rowCtl,flex:1,minWidth:0}}/>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={T.secondary}>R</span>
                    <input type="number" min={0} step="0.01" placeholder="/m" value={l.perMetre||""}
                      onChange={e=>updatePipeLine(use,l.id,{perMetre:Math.max(0,parseFloat(e.target.value)||0)})}
                      style={{...rowCtl,width:90}}/>
                    <span style={T.secondary}>/m</span>
                  </div>
                </div>)}
            </div>);
          })}
          <button onClick={()=>addPipeLine(use)}
            style={addLineBtn}>+ Add {use==="supply"?"supply":"drain"} line</button>
          {extra}
        </div>
      </div>
    );
  };

  // ENTRY FORM
  return (
    <div className="cos-app" style={{fontFamily:"'Inter',system-ui,sans-serif",background:UI.pageBg,minHeight:"100vh"}}>
      <AppHeader showTabs={false}/>
      <div style={{maxWidth:780,margin:"0 auto",padding:"24px 20px"}}>
        {/* Document type (quote vs invoice) is set on the home page and arrives
            via the ?doc search param — no on-page toggle here. */}
        {documentType==="invoice"&&(
        <div style={cardStyle}>
          <SectionHeader>🧾 Invoice details — issued for work completed</SectionHeader>
          <div style={{padding:S.xl,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={T.fieldLabel}>Issue date</label>
              <input type="date" value={invoiceMeta.issueDate}
                onChange={e=>setInvoiceMeta(m=>({...m,issueDate:e.target.value,dueDate:addDays(e.target.value,7)}))}
                style={{...inputStyle,width:"100%"}}/>
            </div>
            <div>
              <label style={T.fieldLabel}>Due date <span style={{color:C.muted,fontWeight:400}}>(default issue + 7 days)</span></label>
              <input type="date" value={invoiceMeta.dueDate}
                onChange={e=>setInvoiceMeta(m=>({...m,dueDate:e.target.value}))}
                style={{...inputStyle,width:"100%"}}/>
            </div>
            <div style={{gridColumn:"1 / -1"}}>
              <label style={T.fieldLabel}>Banking details</label>
              <textarea value={invoiceMeta.bankingDetails} rows={2}
                placeholder={DEFAULT_BANKING_DETAILS}
                onChange={e=>setInvoiceMeta(m=>({...m,bankingDetails:e.target.value}))}
                style={{width:"100%",padding:"8px 10px",border:`1px solid ${UI.borderStrong}`,borderRadius:6,fontSize:12,color:C.navy,background:C.white,boxSizing:"border-box",fontFamily:"inherit",resize:"vertical"}}/>
              <div style={{...T.muted,marginTop:3}}>Invoice ref: <strong>{docRef || (isGeneratingRef ? "Generating…" : "generated on download")}</strong> · totals include 15% VAT · payment due {invoiceMeta.dueDate||"—"}</div>
            </div>
          </div>
        </div>)}

        <SectionGroup label="Project Details" subHeadings={["Project Details"]}>
        <div style={cardStyle}>
          <SectionHeader>Project Details</SectionHeader>
          <div style={{padding:S.xl,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {([{l:"Project / Job name",k:"projectName"},{l:"Client name (optional)",k:"clientName"}] as const).map(f=>(
              <div key={f.k}>
                <label style={T.fieldLabel}>{f.l}</label>
                <input value={inputs[f.k] as string} onChange={e=>setInp(f.k,e.target.value)}
                  style={{...inputStyle,width:"100%"}}/>
              </div>))}
            {/* Employees Allocated (Brief 2) — third field per PDF ordering
                (Project/Job name → Client name → Employees Allocated). Purely
                descriptive: doesn't touch Points, pricing, or scope-review gating. */}
            <div style={{gridColumn:"1 / -1"}}>
              <EmployeesAllocatedField
                value={inputs.allocatedEmployees ?? []}
                onChange={v=>setInp("allocatedEmployees", v)}
                employees={employees}
                loading={employeesLoading}
              />
            </div>
            {/* Points relocated from inline-in-Water-Supply to job-level (Brief
                C-2 Change #5) — it only drives Water Supply's own fittings/labour
                (F01-F04/C01/C02/A01/L03), so it's disabled/greyed rather than
                silently inert whenever Water Supply itself is toggled off — a
                dead-but-editable field is a worse footgun than a disabled one. */}
            <div style={{gridColumn:"1 / -1",opacity:activeSections.waterSupply?1:0.5}}>
              <label style={T.fieldLabel}>Points (make-offs)</label>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="number" min={0} value={inputs.points} disabled={!activeSections.waterSupply}
                  onChange={e=>setInp("points",Math.max(0,parseInt(e.target.value)||0))}
                  style={{...rowCtl,width:76,textAlign:"center",fontWeight:700,cursor:activeSections.waterSupply?"text":"not-allowed"}}/>
                <span style={{...T.muted}}>
                  {activeSections.waterSupply
                    ? "drives fittings & stop taps — set to 0 for maintenance callouts or repairs"
                    : "enable Water Supply to use Points — it only drives Water Supply's fittings/labour"}
                </span>
              </div>
            </div>
            {/* After-hours job (Brief 2, Emergency Call-Out) — Invoice only, per
                the locked decision that after-hours pricing is retrospective
                billing, never quoted in advance. */}
            {documentType==="invoice"&&(
            <div style={{gridColumn:"1 / -1"}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <input type="checkbox" checked={inputs.afterHours??false} onChange={e=>setInp("afterHours",e.target.checked)} style={{width:16,height:16}}/>
                <span style={{fontSize:13,color:C.navy}}>After-hours job — applies {settings.afterHoursMultiplier}× to labour rate</span>
              </label>
            </div>)}
          </div>
        </div>
        </SectionGroup>

        {/* Job sections — independent toggles replacing the old exclusive
            dropdown. A job can hold any combination of Water Supply, Drainage,
            Geyser and Fixtures data concurrently. Scan Drawing stays a distinct
            full-screen flow rather than a fifth toggle. Document type (quote vs
            invoice) is NOT chosen here — it arrives from home. */}
        <div style={cardStyle}>
          <SectionHeader>Job sections</SectionHeader>
          <div style={{padding:S.xl}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:10}}>
              {([
                {key:"waterSupply" as const, label:"Water Supply"},
                {key:"drainage" as const, label:"Drainage"},
                {key:"geyser" as const, label:"Geyser"},
                {key:"fixtures" as const, label:"Fixtures"},
              ]).map(s=>{
                const on = activeSections[s.key];
                return (
                <button key={s.key} onClick={()=>toggleSection(s.key)} className="cos-toggle" aria-pressed={on} style={{
                  display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                  padding:"11px 12px",borderRadius:8,cursor:"pointer",fontSize:12.5,fontWeight:800,
                  border:`2px solid ${on?C.gold:UI.borderStrong}`,
                  background:on?C.gold:C.white,color:on?C.navy:C.slate,
                  boxShadow:on?"0 2px 8px rgba(245,166,35,0.35)":"none"}}>
                  <span aria-hidden style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
                    width:16,height:16,borderRadius:"50%",flexShrink:0,fontSize:10,fontWeight:900,
                    background:on?C.navy:"transparent",color:on?C.gold:"transparent",
                    border:on?"none":`2px solid ${UI.borderStrong}`}}>{on?"✓":""}</span>
                  {s.label}
                </button>);
              })}
            </div>
            <button onClick={()=>setScreen("scan")}
              style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${UI.borderStrong}`,background:C.white,color:C.slate,fontWeight:700,fontSize:12.5,cursor:"pointer"}}>
              📐 Scan Drawing instead
            </button>
            <div style={{fontSize:11,color:C.muted,marginTop:8}}>
              Enable any combination — a job can hold Water Supply, Drainage, Geyser and Fixtures data at once.
            </div>
          </div>
        </div>

        {activeSections.waterSupply&&(
        <SectionGroup label="Water Supply" subHeadings={["Water Supply", "Supply Fittings"]}>
        {pipeSection("supply","Water Supply", null)}
        <StandaloneFittingSection title="Supply Fittings" use="supply"
          rows={inputs.supplyFittings ?? []} catalogue={catalogue} catalogueLoading={catalogueLoading}
          onAdd={addStandaloneFitting} onAddCustom={addStandaloneCustomFitting}
          onUpdate={updateStandaloneFitting} onRemove={removeStandaloneFitting}/>
        </SectionGroup>
        )}

        {activeSections.drainage&&(
        <SectionGroup label="Drainage" subHeadings={["Drainage", "Drainage Fittings", "Drainage Templates"]}>
        {pipeSection("drainage","Drainage",
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:10,paddingTop:10,borderTop:"1px solid #EDF0F5"}}>
            <input type="checkbox" checked={inputs.trenching} onChange={e=>setInp("trenching",e.target.checked)} style={{width:16,height:16}}/>
            <span style={{fontSize:13,color:C.navy}}>Include trench excavation labour (across drainage lines)</span>
          </label>)}
        <StandaloneFittingSection title="Drainage Fittings" use="drainage"
          rows={inputs.drainageFittings ?? []} catalogue={catalogue} catalogueLoading={catalogueLoading}
          onAdd={addStandaloneFitting} onAddCustom={addStandaloneCustomFitting}
          onUpdate={updateStandaloneFitting} onRemove={removeStandaloneFitting}/>
        <FixtureTemplatesSection
          title="Drainage Templates"
          scopeFilter="system"
          applied={inputs.fittingTemplates ?? []}
          catalogue={catalogue}
          catalogueLoading={catalogueLoading}
          onApply={applyTemplate}
          onRemoveTemplate={removeTemplate}
          onSetBasis={setTemplateBasis}
          onUpdateRow={updateTemplateRow}
          onAddCustomRow={addCustomTemplateRow}
          onAddCatalogRow={addCatalogTemplateRow}
          onRemoveRow={removeTemplateRow}
        />
        </SectionGroup>
        )}

        {activeSections.fixtures&&(
        <SectionGroup label="Fixtures" subHeadings={["Fixtures", "Fixtures and Fittings Replacement Templates"]}>
        <div style={cardStyle}>
          <SectionHeader>Fixtures</SectionHeader>
          <div style={{padding:S.xl}}>
            {(inputs.fixtureLines ?? []).length===0&&
              <div style={{fontSize:12,color:C.slateL,padding:"6px 2px 10px"}}>No fixtures yet — add a line below.</div>}
            {(inputs.fixtureLines ?? []).length>0&&(
              <div className="cos-line cos-line--fixture cos-line-head">
                <span/>
                <span style={T.colHead}>Fixture</span>
                <span style={T.colHead}>Product</span>
                <span style={{...T.colHead,textAlign:"center"}}>Qty</span>
                <span style={{...T.colHead,textAlign:"right"}}>Line total</span>
                <span/>
              </div>)}
            {(inputs.fixtureLines ?? []).map((fl,i,arr)=>{
              const presets=FIXTURE_PRESETS[fl.type];
              const isCustom = fl.source==="custom";
              return (
              <div key={fl.id} className="cos-toggle" style={{padding:"12px 14px 12px 0",
                borderBottom:i===arr.length-1?"none":`1px solid ${UI.borderRow}`,
                background:isCustom?UI.customBg:"transparent"}}>
                <div className="cos-line cos-line--fixture">
                  <span className="cos-fixture-thumb">
                    <img src={fixtureIcon(fl.type)} alt={FIXTURE_TYPES.find(ft=>ft.t===fl.type)?.label ?? fl.type}
                      width={28} height={28} loading="lazy"/>
                  </span>
                  <select value={fl.type} onChange={e=>{const t=e.target.value as FixtureType;const b=makeFixtureLine(t);updateFixtureLine(fl.id,{type:t,source:b.source,materialCode:b.materialCode,description:b.description,unitPrice:b.unitPrice,grade:b.grade,supplier:b.supplier});}}
                    style={{...rowSelect,minWidth:0}}>
                    {FIXTURE_TYPES.map(ft=><option key={ft.t} value={ft.t}>{ft.label}</option>)}
                  </select>
                  <select className="cos-grow" value={isCustom?"__custom__":(fl.materialCode??"__custom__")}
                    onChange={e=>{const v=e.target.value;
                      if(v==="__custom__"){updateFixtureLine(fl.id,{source:"custom",materialCode:undefined,description:"",unitPrice:0,grade:"Assumption",supplier:undefined});}
                      else{const p=presets.find(x=>x.materialCode===v);if(p)updateFixtureLine(fl.id,{source:"library",materialCode:p.materialCode,description:p.description,unitPrice:p.unitPrice,grade:p.grade,supplier:p.supplier});}}}
                    style={{...rowSelect,minWidth:0}}>
                    {presets.map(p=><option key={p.materialCode} value={p.materialCode}>{p.description}</option>)}
                    <option value="__custom__">Custom / enter your own…</option>
                  </select>
                  <input className="cos-num" type="number" min={0} max={50} value={fl.quantity}
                    onChange={e=>updateFixtureLine(fl.id,{quantity:Math.max(0,parseInt(e.target.value)||0)})}
                    style={{...rowCtl,minWidth:0,fontWeight:700,textAlign:"center",padding:"0 6px"}}/>
                  <span style={{...T.total,textAlign:"right",height:34}}>{fmt(fl.quantity*fl.unitPrice)}</span>
                  <div style={{display:"flex",alignItems:"center",gap:4,justifySelf:"end"}}>
                    <GradePill grade={fl.grade}/>
                    <button onClick={()=>removeFixtureLine(fl.id)} title="Remove line" aria-label="Remove line" style={rowDeleteBtn}>✕</button>
                  </div>
                </div>
                {isCustom&&(
                  <div style={{display:"flex",gap:8,marginTop:8,alignItems:"center"}}>
                    <input placeholder="Custom product description" value={fl.description}
                      onChange={e=>updateFixtureLine(fl.id,{description:e.target.value})}
                      style={{...rowCtl,flex:1,minWidth:0}}/>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <span style={T.secondary}>R</span>
                      <input type="number" min={0} step="0.01" placeholder="unit price" value={fl.unitPrice||""}
                        onChange={e=>updateFixtureLine(fl.id,{unitPrice:Math.max(0,parseFloat(e.target.value)||0)})}
                        style={{...rowCtl,width:100}}/>
                    </div>
                  </div>)}
              </div>);
            })}
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
              <button onClick={()=>addFixtureLine("toilet")}
                style={addLineBtn}>+ Add fixture line</button>
              <span style={{...T.muted}}>Library prices are <GradePill grade="Sourced"/>; custom lines are <GradePill grade="Assumption"/> &amp; flagged.</span>
            </div>
          </div>
        </div>

        {/* 4.2 Fixtures and Fittings Replacement Templates — the six confirmed
            FIXTURE_* templates, same mechanism as Drainage's 2.3 above, scoped
            to 'fixture' so it only shows/holds this section's applied templates. */}
        <FixtureTemplatesSection
          title="Fixtures and Fittings Replacement Templates"
          scopeFilter="fixture"
          applied={inputs.fittingTemplates ?? []}
          catalogue={catalogue}
          catalogueLoading={catalogueLoading}
          onApply={applyTemplate}
          onRemoveTemplate={removeTemplate}
          onSetBasis={setTemplateBasis}
          onUpdateRow={updateTemplateRow}
          onAddCustomRow={addCustomTemplateRow}
          onAddCatalogRow={addCatalogTemplateRow}
          onRemoveRow={removeTemplateRow}
        />
        </SectionGroup>
        )}

        {activeSections.geyser&&(
        <SectionGroup label="Geyser" subHeadings={["Geyser Job Specs", "3.3.2 General Repairs — itemized fitting templates"]}>
        <div style={cardStyle}>
          <SectionHeader>Geyser Job Specs</SectionHeader>
          <div style={{padding:S.xl}}>
            {/* 3.1/3.2/3.3 — same nesting pattern as Drainage's 2.3 and Fixtures'
                4.2: a set of sibling options under one "Job type" umbrella. 3.1
                New Installation reuses 3.2's unit/kit fixed-composition (size ×
                brand) plus a flat "New Point" connection labour line — see
                buildNewInstallation in geyser-assembly.ts for sourcing. 3.2/3.3
                are today's existing burst_replacement/element_repair bundles,
                unchanged. 3.3.2 General Repairs (the itemized alternative) is
                its own FixtureTemplatesSection instance below, always visible
                alongside whichever fixed-composition bundle is selected. */}
            <div style={{marginBottom:16}}>
              <label style={{...T.fieldLabel,marginBottom:6}}>Job type</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                {([{v:"new_installation" as const,l:"3.1 New Installation"},{v:"burst_replacement" as const,l:"3.2 Burst Replacement"},{v:"element_repair" as const,l:"3.3 Replacement / Repairs"}]).map(j=>{
                  const on = geyser.jobType===j.v;
                  return (
                  <button key={j.v} onClick={()=>setGey({jobType:j.v})} className="cos-toggle" aria-pressed={on} style={{
                    display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                    padding:"11px 8px",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:800,
                    border:`2px solid ${on?C.gold:UI.borderStrong}`,
                    background:on?C.gold:C.white,color:on?C.navy:C.slate,
                    boxShadow:on?"0 2px 8px rgba(245,166,35,0.35)":"none"}}>
                    <span aria-hidden style={{display:"inline-flex",alignItems:"center",justifyContent:"center",
                      width:16,height:16,borderRadius:"50%",flexShrink:0,fontSize:10,fontWeight:900,
                      background:on?C.navy:"transparent",color:on?C.gold:"transparent",
                      border:on?"none":`2px solid ${UI.borderStrong}`}}>{on?"✓":""}</span>
                    {j.l}
                  </button>);
                })}
              </div>
              {geyser.jobType==="element_repair"&&
                <div style={{fontSize:10,color:C.slateL,marginTop:6}}>3.3.1 Thermostat / Element bundle — fixed-composition, below.</div>}
              {geyser.jobType==="new_installation"&&
                <div style={{fontSize:10,color:C.slateL,marginTop:6}}>New-construction connection (no existing point) — geyser + kit priced as 3.2, plus a flat New Point connection charge (Assumption, unconfirmed).</div>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div>
                <label style={T.fieldLabel}>Geyser size</label>
                <select value={geyser.size} onChange={e=>setGey({size:parseInt(e.target.value) as GeyserSize})}
                  style={{...selectStyle,width:"100%"}}>
                  {[50,100,150,200,250].map(s=><option key={s} value={s}>{s} L</option>)}
                </select>
                <div style={{fontSize:10,color:C.slateL,marginTop:4}}>Unit price Sourced (Plumblink 2026)</div>
                {geyser.size===150&&geyser.jobType==="burst_replacement"&&<div style={{fontSize:10,color:C.amber,marginTop:3}}>⚠ 150L ~15% under 2024 market — VR-11</div>}
              </div>
              {(geyser.jobType==="burst_replacement"||geyser.jobType==="new_installation")
                ? <div>
                    <label style={T.fieldLabel}>Brand</label>
                    <select value={geyser.brand} onChange={e=>setGey({brand:e.target.value as GeyserBrand})}
                      style={{...selectStyle,width:"100%"}}>
                      {["Kwikot","Ariston"].map(b=><option key={b}>{b}</option>)}
                    </select>
                    <div style={{fontSize:10,color:C.slateL,marginTop:4}}>B-rated · 5yr warranty</div>
                  </div>
                : <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",paddingTop:22}}>
                    <input type="checkbox" checked={geyser.solar} onChange={e=>setGey({solar:e.target.checked})} style={{width:16,height:16}}/>
                    <span style={{fontSize:13,color:C.navy}}>Solar geyser (skip thermostat)</span>
                  </label>}
            </div>
            {/* Pricing breakdown — scannable labeled line items, not a run-on sentence. */}
            <div style={{background:C.goldPale,border:`1px solid ${C.gold}40`,borderRadius:8,padding:"12px 14px",marginTop:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:800,color:C.navy}}>♨ Fixed-composition assembly</span>
                <GradePill grade={finalGrade}/>
              </div>
              {[
                {l:"Parts",v:matTotal},
                {l:"Labour",v:labTotal},
                {l:"Markup (commercial ladder)",v:sell-matTotal-labTotal},
              ].map(r=>(
                <div key={r.l} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"3px 0"}}>
                  <span style={{fontSize:11.5,color:C.slate}}>{r.l}</span>
                  <span style={{fontSize:12,fontWeight:600,color:C.navy,fontVariantNumeric:"tabular-nums"}}>{fmt(r.v)}</span>
                </div>))}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"7px 0 1px",marginTop:4,borderTop:`1px solid ${C.gold}55`}}>
                <span style={{fontSize:12,fontWeight:800,color:C.navy}}>Sell price excl. VAT</span>
                <span style={{fontSize:16,fontWeight:900,color:C.goldDim,fontVariantNumeric:"tabular-nums"}}>{fmt(sell)}</span>
              </div>
              <div style={{fontSize:10,color:C.slateL,marginTop:6}}>
                {GRADES[finalGrade]?.rank>=GRADES["Derived"].rank?"Client-issuable through the normal gate (see Learn tab).":"Not client-issuable until grade lifts (see Learn tab)."}
              </div>
            </div>
          </div>
        </div>
        {/* 3.3.2 General Repairs — itemized alternative to the fixed-composition
            bundles above (GEYSER_BURST_REPLACEMENT/GEYSER_ELEMENT_REPAIR), same
            mechanism as Drainage's 2.3 and Fixtures' 4.2, scoped to 'geyser'.
            Brief B-2's Pressure/Size picker is keyed off templateId, not
            location, so it keeps working here unchanged. */}
        <FixtureTemplatesSection
          title="3.3.2 General Repairs — itemized fitting templates"
          scopeFilter="geyser"
          applied={inputs.fittingTemplates ?? []}
          catalogue={catalogue}
          catalogueLoading={catalogueLoading}
          onApply={applyTemplate}
          onRemoveTemplate={removeTemplate}
          onSetBasis={setTemplateBasis}
          onUpdateRow={updateTemplateRow}
          onAddCustomRow={addCustomTemplateRow}
          onAddCatalogRow={addCatalogTemplateRow}
          onRemoveRow={removeTemplateRow}
        />
        </SectionGroup>
        )}

        <div style={{background:"#fff",border:`1px solid ${C.gold}40`,borderRadius:8,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:12,color:C.slateL}}><strong style={{color:C.navy}}>{scope.length}</strong> lines · <GradePill grade={finalGrade}/></div>
            <div style={{...T.muted,marginTop:2}}>Scope review required before costings.</div>
          </div>
          <button onClick={()=>setScreen("review")} style={{padding:"10px 28px",borderRadius:8,border:"none",background:C.gold,color:C.navy,cursor:"pointer",fontWeight:800,fontSize:14}}>Review Scope →</button>
        </div>
      </div>
    </div>
  );
}
