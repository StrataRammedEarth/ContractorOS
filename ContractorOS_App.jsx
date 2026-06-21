import { useState, useMemo } from "react";

// ── BRAND ──────────────────────────────────────────────────────────────
const N   = "#0D1B2A";
const NM  = "#152B3D";
const NL  = "#1E3C52";
const G   = "#F5A623";
const GD  = "#C47D10";
const W   = "#FFFFFF";
const MU  = "#6B90A8";
const BD  = "#2A4A62";
const SU  = "#27AE60";
const WA  = "#E67E22";
const fmt = n => "R " + (+n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ── KB DATA ─────────────────────────────────────────────────────────────
const PLB001 = [
  { code:"PLB-001A", desc:"Cobra PEX 15mm Pipe",          qty:30,   unit:"m",    rate:30.64 },
  { code:"PLB-001B", desc:"Konex Tee 15mm",               qty:3.5,  unit:"ea",   rate:50.56 },
  { code:"PLB-001C", desc:"Konex Elbow 90 15mm",          qty:7.5,  unit:"ea",   rate:35.31 },
  { code:"PLB-001D", desc:"Konex Straight Coupler 15mm",  qty:3,    unit:"ea",   rate:32.24 },
  { code:"PLB-001E", desc:"Konex Female Coupler 15mm",    qty:0.5,  unit:"ea",   rate:27.68 },
  { code:"PLB-001F", desc:"Konex Male Elbow 15mm",        qty:1,    unit:"ea",   rate:36.17 },
  { code:"PLB-001G", desc:"Konex Male Coupler 15mm",      qty:0.5,  unit:"ea",   rate:29.25 },
  { code:"PLB-001H", desc:"Pipe Clip 16mm",               qty:12.5, unit:"ea",   rate:4.33  },
  { code:"PLB-001I", desc:"Cobra Insert 15mm",            qty:22.5, unit:"ea",   rate:7.14  },
  { code:"PLB-001J", desc:"15mm Galv Saddle",             qty:5,    unit:"ea",   rate:0.87  },
];
const PLB002 = PLB001.map(r => r.code === "PLB-001A" ? { ...r, qty: 20 } : r);

const DEP_SHW = [
  { code:"34147",      desc:"Shower Mixer Classic",          qty:1,    unit:"ea",   rate:355.65 },
  { code:"30728",      desc:"Konex Female Elbow shower arm", qty:1,    unit:"ea",   rate:33.72  },
  { code:"30730",      desc:"Konex Female Elbow mixer",      qty:2,    unit:"ea",   rate:29.17  },
  { code:"7321",       desc:"Shower Arm 350mm",              qty:1,    unit:"ea",   rate:139.00 },
  { code:"7316",       desc:"Shower Rose 200mm SS",          qty:1,    unit:"ea",   rate:477.39 },
  { code:"15501",      desc:"Shower Waste Drain SS",         qty:1,    unit:"ea",   rate:328.38 },
  { code:"1924",       desc:"PVC 40-50mm Adaptor",           qty:1,    unit:"ea",   rate:8.78   },
];
const DEP_BSN = [
  { code:"BE1WH9102", desc:"Basin Starna White",            qty:1,    unit:"ea",   rate:649.90 },
  { code:"AfriCamps", desc:"Basin Mixer",                   qty:1,    unit:"ea",   rate:489.63 },
  { code:"32232",     desc:"Basin Waste Pop-up",            qty:1,    unit:"ea",   rate:141.04 },
  { code:"35486",     desc:"Bottle Trap Universal",         qty:1,    unit:"ea",   rate:216.52 },
  { code:"29892a",    desc:"Angle Valve",                   qty:2,    unit:"ea",   rate:65.21  },
  { code:"185",       desc:"Braided Hose 350mm",            qty:2,    unit:"ea",   rate:42.61  },
  { code:"SIL-01",    desc:"Mould Resistant Silicone",      qty:0.30, unit:"tube", rate:89.90  },
];
const DEP_WC = [
  { code:"BE1WH813", desc:"CTM Coral White Toilet Suite",   qty:1,    unit:"ea",   rate:929.90 },
  { code:"29892b",   desc:"Angle Valve toilet",             qty:1,    unit:"ea",   rate:65.21  },
  { code:"34675",    desc:"Pan Connector Jollyflex 350mm",  qty:1,    unit:"ea",   rate:190.43 },
  { code:"SIK-01",   desc:"White Sikaflex 310ml",           qty:0.30, unit:"tube", rate:129.90 },
];
const DEP_SHWD = [
  { code:"CT8006", desc:"Glass Shower Door Chrome", qty:1, unit:"ea", rate:3559.00 },
  { code:"PR-01",  desc:"Pratley Steel Quick Set",  qty:1, unit:"ea", rate:74.90   },
  { code:"EP-01",  desc:"Epoxy Syringe",             qty:1, unit:"ea", rate:12.90   },
];
const FIXTURES = [
  { key:"shower",     dep:"DEP-SHW-001", name:"Shower",      icon:"Shower",  data:DEP_SHW,  hrs:1.17, cold:true,  hot:true  },
  { key:"basin",      dep:"DEP-BSN-001", name:"Basin",       icon:"Basin",   data:DEP_BSN,  hrs:1.50, cold:true,  hot:true  },
  { key:"toilet",     dep:"DEP-WC-001",  name:"Toilet",      icon:"Toilet",  data:DEP_WC,   hrs:1.83, cold:true,  hot:false },
  { key:"showerDoor", dep:"DEP-SHWD-001",name:"Shower Door", icon:"Door",    data:DEP_SHWD, hrs:1.00, cold:false, hot:false },
];

// ── MASONRY KB v1.0 ─────────────────────────────────────────────────────
const BRK_ASSEMBLIES = {
  "BRK-001": { name:"Half Brick Wall (face 1 side)",    labHr:0.84, bricks:59,  mortar:0.017, prime:417.70  },
  "BRK-002": { name:"One Brick Wall (face 1 side)",     labHr:1.32, bricks:118, mortar:0.045, prime:779.90  },
  "BRK-003": { name:"One and Half Brick Wall",          labHr:1.80, bricks:178, mortar:0.072, prime:1144.40 },
  "BRK-004": { name:"Half Brick Wall (face 2 sides)",   labHr:0.96, bricks:59,  mortar:0.017, prime:441.70  },
  "BRK-005": { name:"Half Brick Hollow Wall Skin",      labHr:0.96, bricks:59,  mortar:0.017, prime:441.70  },
};
const BRK_BRICK  = 3.80;
const BRK_MORTAR = 1500;
const BRK_CREW   = 200;

const defaultScope = {
  shower:false, basin:false, toilet:false, showerDoor:false, testing:true,
  deckArea:0, balLen:0, demolition:false,
  brkType:"BRK-001", brkArea:0, faceBrick:false,
  travelKm:0,
};

// ── ENGINE ───────────────────────────────────────────────────────────────
function computeEstimate(scope) {
  const pfAcc = {};
  const fixtureGroups = [];
  const deckRows = [];
  const masonryRows = [];
  const labRows = [];
  const flags = [];
  let mat = 0;
  let lab = 0;

  let cold = 0;
  let hot  = 0;
  FIXTURES.forEach(f => {
    if (scope[f.key]) {
      if (f.cold) cold++;
      if (f.hot)  hot++;
    }
  });

  const addPipe = (base, factor) => {
    base.forEach(r => {
      const q    = +(r.qty * factor).toFixed(3);
      const line = +(q * r.rate).toFixed(2);
      if (pfAcc[r.code]) {
        pfAcc[r.code].qty  = +(pfAcc[r.code].qty  + q).toFixed(3);
        pfAcc[r.code].line = +(pfAcc[r.code].line + line).toFixed(2);
      } else {
        pfAcc[r.code] = { ...r, qty: q, line };
      }
      mat += line;
    });
  };

  if (cold > 0) {
    const f = cold / 4;
    addPipe(PLB001, f);
    const a = +(f * 260).toFixed(2);
    lab += a;
    labRows.push({ code:"PLB-001", act:"Cold Water Supply (" + cold + " pts)", res:"Plumbing Assistant", days:f.toFixed(2), rate:"R260/day", amt:a, conf:"Medium" });
  }
  if (hot > 0) {
    const f = hot / 3;
    addPipe(PLB002, f);
    const a = +(f * 260).toFixed(2);
    lab += a;
    labRows.push({ code:"PLB-002", act:"Hot Water Supply (" + hot + " pts)", res:"Plumbing Assistant", days:f.toFixed(2), rate:"R260/day", amt:a, conf:"Medium" });
  }

  let fixHrs = 0;
  let fixDetail = [];
  FIXTURES.forEach(f => {
    if (!scope[f.key]) return;
    const items = f.data.map(r => ({ ...r, line: +(r.qty * r.rate).toFixed(2) }));
    const sub   = +items.reduce((s, r) => s + r.line, 0).toFixed(2);
    fixtureGroups.push({ dep:f.dep, name:f.name + " Assembly", items, sub });
    mat += sub;
    fixHrs += f.hrs;
    fixDetail.push({ name:f.name, hrs:f.hrs, amt:+(f.hrs * 32.50).toFixed(2) });
  });
  if (fixHrs > 0) {
    const a = +(fixHrs * 32.50).toFixed(2);
    lab += a;
    labRows.push({ code:"PLB-003", act:"Fixture Installation (" + fixHrs.toFixed(2) + " hrs)", res:"Plumbing Assistant", days:(fixHrs / 8).toFixed(2), rate:"R32.50/hr", amt:a, conf:"Validated", detail:fixDetail });
  }
  if (scope.testing && (scope.shower || scope.basin || scope.toilet)) {
    lab += 300;
    labRows.push({ code:"PLB-004", act:"Testing and Commissioning", res:"Supervising Plumber", days:"0.50", rate:"R600/day", amt:300, conf:"Medium" });
  }

  if (scope.deckArea > 0) {
    const dm = +(scope.deckArea * 466.69).toFixed(2);
    const dl = +(scope.deckArea / 25 * 1000).toFixed(2);
    mat += dm; lab += dl;
    deckRows.push({ code:"DCK-001", desc:"Deck Construction Material", qty:scope.deckArea, unit:"m2", rate:466.69, line:dm, conf:"High" });
    labRows.push({ code:"DCK-001", act:"Deck Construction (" + scope.deckArea + "m2)", res:"Carpenter and Labourer", days:(scope.deckArea / 25).toFixed(2), rate:"R1000/day", amt:dl, conf:"Validated" });
    if (scope.demolition) flags.push({ lvl:"info", msg:"Demolition scope noted - carried as Allowance. No cost applied." });
  }
  if (scope.balLen > 0) {
    const bm = +(scope.balLen * 79.04).toFixed(2);
    const bl = +(scope.balLen / 20 * 1000).toFixed(2);
    mat += bm; lab += bl;
    deckRows.push({ code:"BAL-001", desc:"Steel Cable Balustrade - PROVISIONAL", qty:scope.balLen, unit:"m", rate:79.04, line:bm, conf:"Provisional" });
    labRows.push({ code:"BAL-001", act:"Balustrade (" + scope.balLen + "m) PROVISIONAL", res:"Crew", days:(scope.balLen / 20).toFixed(2), rate:"R1000/day", amt:bl, conf:"Provisional" });
    flags.push({ lvl:"warn", msg:"BAL-001 PROVISIONAL - labour rate is Architect Placeholder. TRG-BAL-001-UPGRADE pending." });
  }

  if (scope.brkArea > 0) {
    const asm = BRK_ASSEMBLIES[scope.brkType] || BRK_ASSEMBLIES["BRK-001"];
    const brkMat = +(scope.brkArea * (asm.bricks * BRK_BRICK + asm.mortar * BRK_MORTAR)).toFixed(2);
    const brkLab = +(scope.brkArea * asm.labHr * BRK_CREW).toFixed(2);
    const facePrem = scope.faceBrick ? +(scope.brkArea * (59 * 2.70 + 0.20 * BRK_CREW)).toFixed(2) : 0;
    mat += brkMat + facePrem;
    lab += brkLab;
    const desc = asm.name + (scope.faceBrick ? " + Face Brick Premium" : "");
    masonryRows.push({
      code: scope.brkType, desc, qty: scope.brkArea,
      matPerM2: +(asm.bricks * BRK_BRICK + asm.mortar * BRK_MORTAR).toFixed(2),
      labPerM2: +(asm.labHr * BRK_CREW).toFixed(2),
      primePerM2: +(asm.prime + (scope.faceBrick ? 199.30 : 0)).toFixed(2),
      matTotal: +(brkMat + facePrem).toFixed(2),
      labTotal: brkLab,
    });
    labRows.push({ code:scope.brkType, act:asm.name + " (" + scope.brkArea + "m2)", res:"2 Bricklayers + 1 Labourer", days:(scope.brkArea * asm.labHr / 8).toFixed(2), rate:"R200/hr crew", amt:brkLab, conf:"Assumption" });
    flags.push({ lvl:"warn", msg:scope.brkType + " PROVISIONAL - Assumption grade pending VAL-005. Three questions to lock: bricklayer day rate, brick price per 1000, m2 per day output." });
  }

  if (scope.travelKm > 0) {
    const ta = +(scope.travelKm * 4.64).toFixed(2);
    lab += ta;
    labRows.push({ code:"LOG-001", act:"Travel (" + scope.travelKm + "km x R4.64/km)", res:"AA Rate", days:"n/a", rate:"R4.64/km", amt:ta, conf:"Verified" });
  }

  mat = +mat.toFixed(2);
  lab = +lab.toFixed(2);
  const prime    = +(mat + lab).toFixed(2);
  const waste    = +(mat * 0.05).toFixed(2);
  const direct   = +(prime + waste).toFixed(2);
  const risk     = +(direct * 0.05).toFixed(2);
  const riskAdj  = +(direct + risk).toFixed(2);
  const cont     = +(riskAdj * 0.10).toFixed(2);
  const contAdj  = +(riskAdj + cont).toFixed(2);
  const margin   = +(contAdj * 0.25).toFixed(2);
  const sell     = +(contAdj + margin).toFixed(2);

  const highMat  = fixtureGroups.reduce((s, g) => s + g.sub, 0) + deckRows.filter(r => r.conf === "High").reduce((s, r) => s + r.line, 0);
  const medLab   = labRows.filter(r => r.conf === "Medium" || r.conf === "Validated").reduce((s, r) => s + r.amt, 0);
  const assumAmt = waste + risk + cont + margin + masonryRows.reduce((s, r) => s + r.matTotal + r.labTotal, 0);
  const provAmt  = deckRows.filter(r => r.conf === "Provisional").reduce((s, r) => s + r.line, 0);

  return { mat, lab, prime, waste, direct, risk, riskAdj, cont, contAdj, margin, sell,
    pfRows: Object.values(pfAcc), fixtureGroups, deckRows, masonryRows, labRows, flags,
    supplyPts: { cold, hot }, conf: { highMat, medLab, assumAmt, provAmt } };
}

// ── UI ATOMS ────────────────────────────────────────────────────────────
function HexLogo({ sz }) {
  const size = sz || 48;
  const vx = [[50,5],[89,27.5],[89,72.5],[50,95],[11,72.5],[11,27.5]];
  const ix = [[50,36],[72,48],[72,63],[50,72],[28,63],[28,48]];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <polygon points={vx.map(p => p.join(",")).join(" ")} stroke={W} strokeWidth="3" fill="none" strokeLinejoin="round"/>
      {vx.map(([x, y], i) => {
        const [x2, y2] = ix[i];
        return (
          <g key={i}>
            <line x1={x} y1={y} x2={x2} y2={y2} stroke={W} strokeWidth="2"/>
            <circle cx={x} cy={y} r="4" fill={W}/>
          </g>
        );
      })}
      <polygon points="50,30 66,39.5 50,49 34,39.5" fill="#F8D570"/>
      <polygon points="34,39.5 50,49 50,65 34,55.5" fill={GD}/>
      <polygon points="66,39.5 50,49 50,65 66,55.5" fill={G}/>
    </svg>
  );
}

function Btn({ onClick, children, variant, sm, disabled }) {
  const v = variant || "gold";
  const bg = v === "ghost" ? "transparent" : G;
  const cl = v === "ghost" ? W : N;
  const border = v === "ghost" ? "1px solid " + BD : "none";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ background:bg, color:cl, border, borderRadius:4, cursor:disabled ? "not-allowed" : "pointer",
        fontWeight:700, fontFamily:"inherit", padding:sm ? "8px 16px" : "12px 28px",
        fontSize:sm ? 12 : 14, opacity:disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}

function Toggle({ on, onToggle, label, sub }) {
  return (
    <div onClick={onToggle}
      style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px",
        background:on ? NM : N, border:"1px solid " + (on ? G : BD),
        borderRadius:6, cursor:"pointer", marginBottom:8 }}>
      <div style={{ width:40, height:22, borderRadius:11, background:on ? G : "#334", position:"relative", flexShrink:0 }}>
        <div style={{ width:18, height:18, borderRadius:9, background:W, position:"absolute",
          top:2, left:on ? 20 : 2, transition:"left .2s" }}/>
      </div>
      <div>
        <div style={{ color:on ? W : MU, fontWeight:on ? 700 : 400, fontSize:13 }}>{label}</div>
        {sub && <div style={{ color:MU, fontSize:11, marginTop:2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function NumIn({ label, value, onChange, unit, sub }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ color:MU, fontSize:11, marginBottom:5, letterSpacing:.5, textTransform:"uppercase" }}>{label}</div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <input type="number" value={value || ""} min={0}
          onChange={e => onChange(+e.target.value || 0)}
          style={{ background:NM, border:"1px solid " + BD, borderRadius:4, color:W,
            padding:"8px 12px", fontSize:14, width:100, outline:"none", fontFamily:"monospace" }}/>
        <span style={{ color:MU, fontSize:12 }}>{unit}</span>
      </div>
      {sub && <div style={{ color:MU, fontSize:10, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function TextIn({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ color:MU, fontSize:11, marginBottom:5, letterSpacing:.5, textTransform:"uppercase" }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ""}
        style={{ width:"100%", background:NM, border:"1px solid " + BD, borderRadius:4, color:W,
          padding:"10px 14px", fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"inherit" }}/>
    </div>
  );
}

function SecHd({ label }) {
  return (
    <div style={{ background:NL, borderLeft:"3px solid " + G, padding:"7px 16px",
      fontSize:10, fontWeight:700, color:MU, letterSpacing:1.2, textTransform:"uppercase", marginBottom:1 }}>
      {label}
    </div>
  );
}

function TH({ label, right }) {
  return (
    <th style={{ background:N, color:G, padding:"7px 10px", fontSize:10, fontWeight:700,
      textAlign:right ? "right" : "left", letterSpacing:.5, whiteSpace:"nowrap", borderBottom:"1px solid " + G }}>
      {label}
    </th>
  );
}

function DataRow({ cells, zebra }) {
  return (
    <tr style={{ background:zebra ? "rgba(255,255,255,.03)" : "transparent", borderBottom:"1px solid " + BD }}>
      {cells.map((c, i) => {
        let color = W;
        if (c.gold) color = G;
        else if (c.dim) color = MU;
        else if (c.amber) color = WA;
        return (
          <td key={i} style={{ padding:"6px 10px", textAlign:c.right ? "right" : "left",
            color, fontWeight:c.bold ? 700 : 400, fontSize:11,
            fontFamily:c.mono ? "monospace" : "inherit" }}>
            {c.v}
          </td>
        );
      })}
    </tr>
  );
}

function SubTot({ label, value }) {
  return (
    <tr style={{ borderTop:"2px solid " + G, background:"rgba(245,166,35,.06)" }}>
      <td colSpan={4} style={{ padding:"7px 10px", fontWeight:700, color:G, fontSize:11 }}>{label}</td>
      <td style={{ padding:"7px 10px", textAlign:"right", fontWeight:700, color:G, fontFamily:"monospace" }}>{value}</td>
    </tr>
  );
}

function ConfBadge({ v }) {
  const map = {
    High:       { bg:"#1A4A2A", c:SU       },
    Medium:     { bg:"#2A3A1A", c:"#8BC34A" },
    Validated:  { bg:"#1A3A4A", c:"#29B6F6" },
    Provisional:{ bg:"#4A2A10", c:WA        },
    Assumption: { bg:"#3A1A1A", c:"#E74C3C" },
    Verified:   { bg:"#1A4A2A", c:SU        },
  };
  const s = map[v] || map.Medium;
  return (
    <span style={{ background:s.bg, color:s.c, padding:"2px 7px",
      borderRadius:3, fontSize:9, fontWeight:700, letterSpacing:.3 }}>
      {v.toUpperCase()}
    </span>
  );
}

// ── SCREENS ──────────────────────────────────────────────────────────────
function Landing({ onStart }) {
  const kbs = [
    { label:"Plumbing KB v1.0.1", status:"LOCKED", warn:false },
    { label:"Decking KB",         status:"LOCKED", warn:false },
    { label:"Masonry KB v1.0",    status:"PROVISIONAL", warn:true },
  ];
  const outputs = [
    { icon:"D", label:"ESTIMATE", sub:"Accurate quotes from validated assemblies" },
    { icon:"B", label:"BUY",      sub:"Smart procurement with supplier codes" },
    { icon:"H", label:"BUILD",    sub:"Labour schedules per crew and trade" },
    { icon:"L", label:"LEARN",    sub:"Confidence data that improves profit" },
  ];
  return (
    <div style={{ minHeight:"100vh", background:N, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:32 }}>
      <div style={{ display:"flex", alignItems:"center", gap:20, marginBottom:20 }}>
        <HexLogo sz={80}/>
        <div>
          <div style={{ fontSize:48, fontWeight:800, color:W, lineHeight:1, letterSpacing:-1 }}>
            Contractor<span style={{ color:G }}>OS</span>
          </div>
          <div style={{ color:MU, fontSize:12, letterSpacing:4, textTransform:"uppercase", marginTop:4 }}>
            One Job. Four Outputs.
          </div>
        </div>
      </div>
      <div style={{ display:"flex", gap:12, marginBottom:40, color:G, fontSize:12, letterSpacing:3, textTransform:"uppercase" }}>
        {["Estimate","Buy","Build","Learn"].map((t, i) => (
          <span key={i} style={{ display:"flex", alignItems:"center", gap:12 }}>
            {i > 0 && <span style={{ color:BD }}>·</span>}
            {t}
          </span>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, maxWidth:700, marginBottom:32, width:"100%" }}>
        {outputs.map((c, i) => (
          <div key={i} style={{ background:NM, border:"1px solid " + BD, borderRadius:8, padding:20, textAlign:"center" }}>
            <div style={{ fontSize:22, marginBottom:8, color:G, fontWeight:800 }}>{c.icon}</div>
            <div style={{ color:G, fontSize:10, fontWeight:700, letterSpacing:1.5, marginBottom:8 }}>{c.label}</div>
            <div style={{ color:MU, fontSize:11, lineHeight:1.6 }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {kbs.map((kb, i) => (
          <span key={i} style={{ background:kb.warn ? "rgba(230,126,34,.15)" : NM,
            border:"1px solid " + (kb.warn ? WA : BD),
            color:kb.warn ? WA : MU, borderRadius:4, padding:"4px 10px", fontSize:10, fontWeight:700 }}>
            {kb.label} {kb.status}
          </span>
        ))}
      </div>
      <Btn onClick={onStart}>Start New Estimate</Btn>
      <div style={{ marginTop:16, color:BD, fontSize:10, letterSpacing:1 }}>
        ContractorOS Plumbing Decking Masonry Edition KB v1.2
      </div>
    </div>
  );
}

function Step1({ project, setProject, onNext, onBack }) {
  return (
    <div style={{ maxWidth:500, margin:"0 auto", padding:32 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
        <HexLogo sz={36}/>
        <span style={{ color:G, fontWeight:700, letterSpacing:2, fontSize:13 }}>
          CONTRACTOR<span style={{ color:W }}>OS</span>
        </span>
      </div>
      <div style={{ color:W, fontSize:18, fontWeight:700, marginBottom:24 }}>Project Information</div>
      <TextIn label="Contractor Name" value={project.contractor}
        onChange={v => setProject(p => ({ ...p, contractor:v }))} placeholder="Your company name"/>
      <TextIn label="Client Name" value={project.client}
        onChange={v => setProject(p => ({ ...p, client:v }))} placeholder="Client or project name"/>
      <TextIn label="Quote Reference" value={project.ref}
        onChange={v => setProject(p => ({ ...p, ref:v }))} placeholder="COS-2026-001"/>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:16 }}>
        <Btn onClick={onBack} variant="ghost">Back</Btn>
        <Btn onClick={onNext} disabled={!project.contractor}>Next: Scope</Btn>
      </div>
    </div>
  );
}

function Step2({ scope, setScope, onGenerate, onBack }) {
  const S = (k, v) => setScope(p => ({ ...p, [k]:v }));
  const [trade, setTrade] = useState("plumbing");
  const hasScope = scope.shower || scope.basin || scope.toilet || scope.showerDoor ||
    scope.deckArea > 0 || scope.balLen > 0 || scope.brkArea > 0;
  const coldPts = FIXTURES.filter(f => f.cold && scope[f.key]).length;
  const hotPts  = FIXTURES.filter(f => f.hot  && scope[f.key]).length;
  const trades  = [["plumbing","Plumbing"],["decking","Decking"],["masonry","Masonry"],["logistics","Logistics"]];

  return (
    <div style={{ maxWidth:580, margin:"0 auto", padding:32 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:28 }}>
        <HexLogo sz={36}/>
        <span style={{ color:G, fontWeight:700, letterSpacing:2, fontSize:13 }}>
          CONTRACTOR<span style={{ color:W }}>OS</span>
        </span>
      </div>
      <div style={{ color:W, fontSize:18, fontWeight:700, marginBottom:20 }}>Scope Builder</div>
      <div style={{ display:"flex", gap:4, marginBottom:20 }}>
        {trades.map(([k, l]) => (
          <button key={k} onClick={() => setTrade(k)}
            style={{ flex:1, padding:"9px 4px", border:"1px solid " + (trade === k ? G : BD),
              borderRadius:4, background:trade === k ? G : NM, color:trade === k ? N : MU,
              fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>
            {l}
          </button>
        ))}
      </div>

      {trade === "plumbing" && (
        <div>
          <SecHd label="Sanitary Fixtures"/>
          <div style={{ padding:"12px 0" }}>
            {FIXTURES.map(f => (
              <Toggle key={f.key} on={!!scope[f.key]} onToggle={() => S(f.key, !scope[f.key])}
                label={f.name}
                sub={"R" + f.data.reduce((s, r) => s + r.qty * r.rate, 0).toFixed(2) + " material " + f.hrs + "hr install"}/>
            ))}
          </div>
          <SecHd label="Services"/>
          <div style={{ padding:"12px 0" }}>
            <Toggle on={scope.testing} onToggle={() => S("testing", !scope.testing)}
              label="Testing and Commissioning" sub="0.5 day Supervising Plumber R300"/>
          </div>
          {coldPts > 0 && (
            <div style={{ background:NM, border:"1px solid " + BD, borderRadius:6, padding:"10px 14px", marginTop:4, fontSize:11 }}>
              <span style={{ color:MU }}>Auto supply: </span>
              <span style={{ color:G, fontWeight:700 }}>Cold {coldPts} pts  Hot {hotPts} pts</span>
            </div>
          )}
        </div>
      )}

      {trade === "decking" && (
        <div>
          <SecHd label="Deck Construction"/>
          <div style={{ padding:"12px 0" }}>
            <NumIn label="Deck Area" value={scope.deckArea} onChange={v => S("deckArea", v)}
              unit="m2" sub="DCK-001 LOCKED R466.69/m2 material"/>
            <Toggle on={scope.demolition} onToggle={() => S("demolition", !scope.demolition)}
              label="Demolition and Disposal" sub="Allowance only - no cost applied"/>
          </div>
          <SecHd label="Balustrade"/>
          <div style={{ padding:"12px 0" }}>
            <NumIn label="Balustrade Length" value={scope.balLen} onChange={v => S("balLen", v)}
              unit="m" sub="BAL-001 PROVISIONAL - Architect Placeholder rate"/>
          </div>
        </div>
      )}

      {trade === "masonry" && (
        <div>
          <SecHd label="Brickwork - PROVISIONAL (Assumption grade)"/>
          <div style={{ background:"rgba(230,126,34,.08)", border:"1px solid rgba(230,126,34,.25)",
            borderRadius:4, padding:"10px 14px", margin:"8px 0 12px", fontSize:11, color:MU, lineHeight:1.6 }}>
            Assumption grade pending VAL-005. Three questions to lock:
            bricklayer day rate, brick price per 1000, m2 per day output.
          </div>
          <div style={{ padding:"8px 0" }}>
            {Object.entries(BRK_ASSEMBLIES).map(([code, asm]) => (
              <div key={code} onClick={() => S("brkType", code)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
                  background:scope.brkType === code ? NM : N,
                  border:"1px solid " + (scope.brkType === code ? G : BD),
                  borderRadius:6, cursor:"pointer", marginBottom:6 }}>
                <div style={{ width:18, height:18, borderRadius:9,
                  border:"2px solid " + (scope.brkType === code ? G : BD),
                  background:scope.brkType === code ? G : "transparent", flexShrink:0 }}/>
                <div>
                  <div style={{ color:scope.brkType === code ? W : MU,
                    fontWeight:scope.brkType === code ? 700 : 400, fontSize:12 }}>
                    {code} {asm.name}
                  </div>
                  <div style={{ color:MU, fontSize:10, marginTop:1 }}>
                    R{asm.prime.toFixed(2)}/m2   {asm.bricks} bricks/m2   {asm.labHr}hr/m2
                  </div>
                </div>
              </div>
            ))}
          </div>
          <NumIn label="Wall Area" value={scope.brkArea} onChange={v => S("brkArea", v)} unit="m2"
            sub={scope.brkArea > 0 ? "Prime: R" + (scope.brkArea * ((BRK_ASSEMBLIES[scope.brkType] && BRK_ASSEMBLIES[scope.brkType].prime) || 417.70)).toFixed(2) : "Enter m2 of wall"}/>
          <Toggle on={scope.faceBrick} onToggle={() => S("faceBrick", !scope.faceBrick)}
            label="Face Brick Premium" sub="+R199.30/m2 for exposed face brickwork"/>
        </div>
      )}

      {trade === "logistics" && (
        <div>
          <SecHd label="Travel"/>
          <div style={{ padding:"12px 0" }}>
            <NumIn label="Travel Distance Return" value={scope.travelKm} onChange={v => S("travelKm", v)}
              unit="km" sub="LOG-001 AA Rate R4.64/km Verified"/>
          </div>
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", marginTop:24 }}>
        <Btn onClick={onBack} variant="ghost">Back</Btn>
        <Btn onClick={onGenerate} disabled={!hasScope}>Generate Estimate</Btn>
      </div>
    </div>
  );
}

// ── OUTPUT ────────────────────────────────────────────────────────────────
function TabEstimate({ e }) {
  const scopeRows = [
    ...(e.supplyPts.cold > 0 ? [{ label:"Cold Water Supply " + e.supplyPts.cold + " pts", conf:"Medium" }] : []),
    ...(e.supplyPts.hot  > 0 ? [{ label:"Hot Water Supply "  + e.supplyPts.hot  + " pts", conf:"Medium" }] : []),
    ...e.fixtureGroups.map(g => ({ label:g.name, conf:"High" })),
    ...e.deckRows.map(r  => ({ label:r.code + " " + r.qty + r.unit, conf:r.conf })),
    ...e.masonryRows.map(r => ({ label:r.code + " " + r.desc + " " + r.qty + "m2", conf:"Assumption" })),
    ...(e.labRows.find(r => r.code === "PLB-004") ? [{ label:"Testing and Commissioning", conf:"Medium" }] : []),
  ];
  const pricingRows = [
    { label:"Material (All Trades)", value:fmt(e.mat),     bold:false },
    { label:"Labour",                value:fmt(e.lab),     bold:false },
    { label:"Prime Cost",            value:fmt(e.prime),   bold:true  },
    { label:"+ Waste 5% on material",value:fmt(e.waste),   bold:false },
    { label:"Direct Cost",           value:fmt(e.direct),  bold:true  },
    { label:"+ Risk 5% on direct",   value:fmt(e.risk),    bold:false },
    { label:"Risk Adjusted",         value:fmt(e.riskAdj), bold:true  },
    { label:"+ Contingency 10%",     value:fmt(e.cont),    bold:false },
    { label:"Contingency Adjusted",  value:fmt(e.contAdj), bold:true  },
  ];
  return (
    <div>
      <SecHd label="Scope of Works"/>
      <div style={{ padding:"8px 16px" }}>
        {scopeRows.map((r, i) => (
          <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
            padding:"8px 0", borderBottom:"1px solid " + BD, fontSize:12, color:W }}>
            <span>{r.label}</span>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <ConfBadge v={r.conf}/>
              <span style={{ background:NL, color:G, padding:"2px 8px", borderRadius:3, fontSize:10, fontWeight:700 }}>INSTALL</span>
            </div>
          </div>
        ))}
      </div>
      <SecHd label="Pricing Summary"/>
      <div style={{ display:"grid", gridTemplateColumns:"3fr 2fr" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <tbody>
            {pricingRows.map((r, i) => (
              <tr key={i} style={{ borderBottom:"1px solid " + BD, background:r.bold ? "rgba(245,166,35,.05)" : "transparent" }}>
                <td style={{ padding:"7px 16px", color:r.label.startsWith("+") ? MU : W, fontWeight:r.bold ? 700 : 400, fontSize:r.bold ? 12 : 11 }}>{r.label}</td>
                <td style={{ padding:"7px 16px", textAlign:"right", fontFamily:"monospace", color:r.bold ? G : MU, fontWeight:r.bold ? 700 : 400 }}>{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ background:N, display:"flex", flexDirection:"column", justifyContent:"center",
          alignItems:"center", padding:24, borderLeft:"2px solid " + G, gap:16 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ color:MU, fontSize:9, letterSpacing:2, textTransform:"uppercase", marginBottom:4 }}>Margin 25%</div>
            <div style={{ color:G, fontSize:18, fontWeight:800, fontFamily:"monospace" }}>+ {fmt(e.margin)}</div>
          </div>
          <div style={{ borderTop:"1px solid " + BD, width:"100%", paddingTop:16, textAlign:"center" }}>
            <div style={{ color:MU, fontSize:9, letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>SELL PRICE excl VAT</div>
            <div style={{ color:G, fontSize:26, fontWeight:800, fontFamily:"monospace" }}>{fmt(e.sell)}</div>
          </div>
          {e.masonryRows.length > 0 && (
            <div style={{ background:"rgba(230,126,34,.1)", border:"1px solid rgba(230,126,34,.3)",
              borderRadius:4, padding:10, fontSize:10, color:WA, lineHeight:1.6, width:"100%", boxSizing:"border-box" }}>
              Masonry scope is Assumption grade pending VAL-005 validation
            </div>
          )}
        </div>
      </div>
      <SecHd label="Acceptance"/>
      <div style={{ padding:"16px 16px 20px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:24 }}>
        {["Client Name","Authorised Signature","Date","Purchase Order No."].map(l => (
          <div key={l}>
            <div style={{ color:MU, fontSize:10, marginBottom:6 }}>{l}</div>
            <div style={{ borderBottom:"1px solid " + BD, height:28 }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabBuy({ e }) {
  const pfTotal = e.pfRows.reduce((s, r) => s + r.line, 0);
  return (
    <div>
      {e.pfRows.length > 0 && (
        <div>
          <SecHd label="Section 1 Pipe and Fittings"/>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH label="Code"/><TH label="Description"/><TH label="Qty" right/><TH label="Unit"/><TH label="Rate R" right/><TH label="Line R" right/></tr></thead>
            <tbody>
              {e.pfRows.map((r, i) => (
                <DataRow key={i} zebra={i % 2 === 0} cells={[
                  { v:r.code, dim:true }, { v:r.desc },
                  { v:r.qty.toFixed(2), right:true, mono:true }, { v:r.unit },
                  { v:r.rate.toFixed(2), right:true, mono:true },
                  { v:r.line.toFixed(2), right:true, mono:true, gold:true },
                ]}/>
              ))}
              <SubTot label="Pipe and Fittings Subtotal" value={fmt(pfTotal)}/>
            </tbody>
          </table>
        </div>
      )}
      {e.fixtureGroups.length > 0 && (
        <div>
          <SecHd label="Section 2 Fixture Assembly Materials"/>
          {e.fixtureGroups.map(g => (
            <div key={g.dep}>
              <div style={{ padding:"5px 16px", background:"rgba(30,60,82,.7)", fontSize:10,
                fontWeight:700, color:G, letterSpacing:.8, borderTop:"1px solid " + BD }}>
                {g.dep} {g.name}
              </div>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr><TH label="Code"/><TH label="Description"/><TH label="Qty" right/><TH label="Unit"/><TH label="Rate R" right/><TH label="Line R" right/></tr></thead>
                <tbody>
                  {g.items.map((r, i) => (
                    <DataRow key={i} zebra={i % 2 === 0} cells={[
                      { v:r.code, dim:true }, { v:r.desc },
                      { v:r.qty, right:true, mono:true }, { v:r.unit },
                      { v:r.rate.toFixed(2), right:true, mono:true },
                      { v:r.line.toFixed(2), right:true, mono:true, gold:true },
                    ]}/>
                  ))}
                  <SubTot label={g.name + " Subtotal"} value={fmt(g.sub)}/>
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      {e.deckRows.length > 0 && (
        <div>
          <SecHd label="Section 3 Decking Materials"/>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH label="Code"/><TH label="Description"/><TH label="Qty" right/><TH label="Unit"/><TH label="Rate R" right/><TH label="Line R" right/></tr></thead>
            <tbody>
              {e.deckRows.map((r, i) => (
                <DataRow key={i} zebra={i % 2 === 0} cells={[
                  { v:r.code, dim:true }, { v:r.desc },
                  { v:r.qty, right:true, mono:true }, { v:r.unit },
                  { v:r.rate.toFixed(2), right:true, mono:true },
                  { v:r.line.toFixed(2), right:true, mono:true, gold:true },
                ]}/>
              ))}
              <SubTot label="Decking Subtotal" value={fmt(e.deckRows.reduce((s, r) => s + r.line, 0))}/>
            </tbody>
          </table>
        </div>
      )}
      {e.masonryRows.length > 0 && (
        <div>
          <SecHd label="Section 4 Masonry Materials - ASSUMPTION GRADE"/>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH label="Assembly"/><TH label="Description"/><TH label="Area m2" right/><TH label="Mat/m2 R" right/><TH label="Lab/m2 R" right/><TH label="Total R" right/></tr></thead>
            <tbody>
              {e.masonryRows.map((r, i) => (
                <DataRow key={i} zebra={i % 2 === 0} cells={[
                  { v:r.code, dim:true }, { v:r.desc },
                  { v:r.qty, right:true, mono:true },
                  { v:r.matPerM2.toFixed(2), right:true, mono:true },
                  { v:r.labPerM2.toFixed(2), right:true, mono:true },
                  { v:(r.matTotal + r.labTotal).toFixed(2), right:true, mono:true, gold:true },
                ]}/>
              ))}
            </tbody>
          </table>
          <div style={{ padding:"6px 16px", fontSize:10, color:WA }}>
            Brick R3.80/unit  Mortar R1500/m3  Crew R200/hr  All Assumption grade pending VAL-005
          </div>
        </div>
      )}
      <SecHd label="Procurement Budget Summary"/>
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <tbody>
            {[
              ["Total Material Budget", fmt(e.mat), true],
              ["Pipe and Fittings",     fmt(pfTotal), false],
              ["Fixture Materials",     fmt(e.fixtureGroups.reduce((s, g) => s + g.sub, 0)), false],
              ["Decking Materials",     fmt(e.deckRows.reduce((s, r) => s + r.line, 0)), false],
              ["Masonry Materials",     fmt(e.masonryRows.reduce((s, r) => s + r.matTotal, 0)), false],
            ].map(([l, v, b], i) => (
              <tr key={i} style={{ borderBottom:"1px solid " + BD }}>
                <td style={{ padding:"9px 16px", color:b ? W : MU, fontWeight:b ? 700 : 400, fontSize:b ? 13 : 11 }}>{l}</td>
                <td style={{ padding:"9px 16px", textAlign:"right", fontFamily:"monospace", color:b ? G : MU, fontWeight:b ? 700 : 400 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ background:N, display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", padding:20, borderLeft:"2px solid " + G }}>
          <div style={{ color:MU, fontSize:9, letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>Total Procurement</div>
          <div style={{ color:G, fontSize:22, fontWeight:800, fontFamily:"monospace" }}>{fmt(e.mat)}</div>
          <div style={{ color:BD, fontSize:9, marginTop:6 }}>excl Labour excl VAT</div>
        </div>
      </div>
    </div>
  );
}

function TabBuild({ e }) {
  const totalDays = e.labRows.reduce((s, r) => { const d = parseFloat(r.days); return s + (isNaN(d) ? 0 : d); }, 0);
  const crewRows = [
    { code:"PLM-LAB-001", name:"Plumbing Assistant",        day:"R260/day",  hr:"R32.50/hr", conf:"Medium"     },
    { code:"PLM-LAB-002", name:"Supervising Plumber",       day:"R600/day",  hr:"R75.00/hr", conf:"Medium"     },
    { code:"DCK-CREW",    name:"Carpenter + Labourer",      day:"R1000/day", hr:"R125/hr",   conf:"Validated"  },
    { code:"BRK-CREW",    name:"2x Bricklayer + 1 Labourer",day:"R1600/day", hr:"R200/hr",   conf:"Assumption" },
  ];
  return (
    <div>
      <SecHd label="Crew Structure"/>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr><TH label="Code"/><TH label="Resource"/><TH label="Day Rate"/><TH label="Hourly"/><TH label="Confidence"/></tr></thead>
        <tbody>
          {crewRows.map((r, i) => (
            <DataRow key={i} zebra={i % 2 === 0} cells={[
              { v:r.code }, { v:r.name, bold:true }, { v:r.day }, { v:r.hr },
              { v:<ConfBadge v={r.conf}/> },
            ]}/>
          ))}
        </tbody>
      </table>
      <SecHd label="Production Schedule"/>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr><TH label="Code"/><TH label="Activity"/><TH label="Resource"/><TH label="Days" right/><TH label="Rate"/><TH label="Labour R" right/><TH label="Conf."/></tr></thead>
        <tbody>
          {e.labRows.map((r, i) => (
            <DataRow key={i} zebra={i % 2 === 0} cells={[
              { v:r.code, dim:true }, { v:r.act, bold:true }, { v:r.res },
              { v:r.days, right:true, mono:true }, { v:r.rate, dim:true },
              { v:fmt(r.amt), right:true, mono:true, gold:true },
              { v:<ConfBadge v={r.conf}/> },
            ]}/>
          ))}
          <SubTot label={"Total Labour " + totalDays.toFixed(2) + " resource-days"} value={fmt(e.lab)}/>
        </tbody>
      </table>
      <SecHd label="Production Summary"/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:1, background:BD }}>
        {[
          ["Project Duration", "~" + totalDays.toFixed(1) + " resource-days", "Sequential execution"],
          ["Labour Budget",    fmt(e.lab),   "All resources combined"],
          ["Prime Cost",       fmt(e.prime), "Material + Labour"],
        ].map(([t, v, s], i) => (
          <div key={i} style={{ background:i === 2 ? N : NM, padding:"18px 20px" }}>
            <div style={{ color:MU, fontSize:9, letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>{t}</div>
            <div style={{ color:i === 2 ? G : W, fontSize:17, fontWeight:800, fontFamily:"monospace" }}>{v}</div>
            <div style={{ color:BD, fontSize:10, marginTop:4 }}>{s}</div>
          </div>
        ))}
      </div>
      {e.masonryRows.length > 0 && (
        <div style={{ margin:"12px 16px", background:"rgba(230,126,34,.08)",
          border:"1px solid rgba(230,126,34,.25)", borderRadius:4, padding:"10px 14px",
          fontSize:11, color:WA, lineHeight:1.6 }}>
          Masonry crew rate R200/hr is Assumption grade. Validate via VAL-005:
          ask contractor for bricklayer day rate, brick price per 1000, and m2 per day output.
        </div>
      )}
    </div>
  );
}

function TabLearn({ e }) {
  const s = e.sell || 1;
  const pct = v => ((v / s) * 100).toFixed(1) + "%";
  const valRows = [
    { id:"VAL-001", scope:"1 Sanitary Fixture",        result:"R1,624.55",       status:"PASS"    },
    { id:"VAL-002", scope:"3 Sanitary Fixtures",       result:"R4,873.66",       status:"PASS"    },
    { id:"VAL-003", scope:"Full Plumbing Package",     result:"R6,731.01 prime", status:"PENDING" },
    { id:"VAL-004", scope:"25m2 Deck DCK-001",         result:"R12,667.25",      status:"PASS"    },
    { id:"VAL-005", scope:"BRK-001 Half Brick per m2", result:"R417.70",         status:"PENDING" },
    { id:"VAL-006", scope:"BRK-002 One Brick per m2",  result:"R779.90",         status:"PENDING" },
  ];
  const confBars = [
    { label:"Verified / High",    amt:e.conf.highMat,  c:SU        },
    { label:"Medium / Validated", amt:e.conf.medLab,   c:"#8BC34A" },
    { label:"Assumption",         amt:e.conf.assumAmt, c:G         },
    { label:"Provisional",        amt:e.conf.provAmt,  c:WA        },
  ];
  const kbStatus = [
    { trade:"Plumbing KB",  version:"v1.0.1 LOCKED",      sub:"5 DEP assemblies fully priced",         warn:false },
    { trade:"Decking KB",   version:"DCK-001 LOCKED",      sub:"BAL-001 PROVISIONAL",                   warn:false },
    { trade:"Masonry KB",   version:"v1.0 PROVISIONAL",    sub:"BRK-001 to BRK-005 Assumption pending VAL-005", warn:true  },
  ];
  return (
    <div>
      <SecHd label="Confidence Breakdown"/>
      <div style={{ padding:"12px 16px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
          {confBars.map((b, i) => (
            <div key={i} style={{ background:NM, border:"1px solid " + BD, borderRadius:6, padding:12 }}>
              <div style={{ color:b.c, fontSize:9, fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>{b.label}</div>
              <div style={{ color:W, fontSize:16, fontWeight:800, fontFamily:"monospace" }}>{fmt(b.amt)}</div>
              <div style={{ color:b.c, fontSize:10, marginTop:2 }}>{pct(b.amt)}</div>
            </div>
          ))}
        </div>
        <div style={{ height:12, borderRadius:6, overflow:"hidden", display:"flex" }}>
          {confBars.map((b, i) => (
            <div key={i} style={{ width:pct(b.amt), background:b.c, minWidth:b.amt > 0 ? 4 : 0 }}/>
          ))}
        </div>
      </div>
      {e.flags.length > 0 && (
        <div>
          <SecHd label="Active Flags"/>
          <div style={{ padding:"8px 16px" }}>
            {e.flags.map((f, i) => (
              <div key={i} style={{ display:"flex", gap:10, padding:"10px 12px", borderRadius:4, marginBottom:8,
                background:f.lvl === "warn" ? "rgba(230,126,34,.08)" : "rgba(41,182,246,.08)",
                border:"1px solid " + (f.lvl === "warn" ? "rgba(230,126,34,.3)" : "rgba(41,182,246,.2)"),
                fontSize:11, color:MU, lineHeight:1.6 }}>
                <span>{f.lvl === "warn" ? "!" : "i"}</span>
                <span>{f.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <SecHd label="Validation Campaign - 6 Tests"/>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead><tr><TH label="Test ID"/><TH label="Scope"/><TH label="ContractorOS Result"/><TH label="Status"/></tr></thead>
        <tbody>
          {valRows.map((v, i) => (
            <DataRow key={i} zebra={i % 2 === 0} cells={[
              { v:v.id, gold:true, bold:true },
              { v:v.scope },
              { v:v.result, mono:true },
              { v:<span style={{ color:v.status === "PASS" ? SU : MU, fontWeight:700 }}>{v.status === "PASS" ? "PASS" : "PENDING"}</span> },
            ]}/>
          ))}
        </tbody>
      </table>
      <SecHd label="Knowledge Base Status"/>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:1, background:BD }}>
        {kbStatus.map((k, i) => (
          <div key={i} style={{ background:NM, padding:"14px 16px" }}>
            <div style={{ color:MU, fontSize:9, letterSpacing:1.2, textTransform:"uppercase", marginBottom:4 }}>{k.trade}</div>
            <div style={{ color:k.warn ? WA : G, fontSize:12, fontWeight:700 }}>{k.version}</div>
            <div style={{ color:BD, fontSize:10, marginTop:4, lineHeight:1.5 }}>{k.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ padding:12 }}/>
    </div>
  );
}

function OutputShell({ e, project, onReset }) {
  const [tab, setTab] = useState("estimate");
  const tabs = [
    { id:"estimate", label:"ESTIMATE" },
    { id:"buy",      label:"BUY"      },
    { id:"build",    label:"BUILD"    },
    { id:"learn",    label:"LEARN"    },
  ];
  return (
    <div style={{ maxWidth:780, margin:"0 auto" }}>
      <div style={{ background:N, padding:"16px 20px 0", borderBottom:"2px solid " + G }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <HexLogo sz={40}/>
            <div>
              <div style={{ color:W, fontSize:16, fontWeight:700 }}>
                Contractor<span style={{ color:G }}>OS</span>
              </div>
              <div style={{ color:MU, fontSize:11 }}>
                {project.contractor || "n/a"} {project.client || ""} {project.ref}
              </div>
            </div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:MU, fontSize:10, letterSpacing:1, textTransform:"uppercase" }}>Sell Price excl VAT</div>
            <div style={{ color:G, fontSize:22, fontWeight:800, fontFamily:"monospace" }}>{fmt(e.sell)}</div>
            <div style={{ marginTop:4 }}><Btn onClick={onReset} variant="ghost" sm>New Estimate</Btn></div>
          </div>
        </div>
        <div style={{ display:"flex" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex:1, padding:"10px 4px", border:"none",
                borderBottom:tab === t.id ? "3px solid " + G : "3px solid transparent",
                background:"transparent", color:tab === t.id ? G : MU, fontWeight:700,
                fontSize:11, letterSpacing:1.2, cursor:"pointer", fontFamily:"inherit" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ background:NM, minHeight:400, border:"1px solid " + BD, borderTop:"none" }}>
        {tab === "estimate" && <TabEstimate e={e}/>}
        {tab === "buy"      && <TabBuy e={e}/>}
        {tab === "build"    && <TabBuild e={e}/>}
        {tab === "learn"    && <TabLearn e={e}/>}
      </div>
      <div style={{ background:N, padding:"8px 20px", borderTop:"1px solid " + BD,
        display:"flex", justifyContent:"space-between", fontSize:10, color:BD }}>
        <span>ContractorOS Plumbing KB v1.0.1 Decking KB Masonry KB v1.0 Scaling Rules v1.2</span>
        <span>Provisional Estimate VAT Excluded</span>
      </div>
    </div>
  );
}

// ── APP ROOT ─────────────────────────────────────────────────────────────
export default function App() {
  const [screen,   setScreen]   = useState("landing");
  const [step,     setStep]     = useState(1);
  const [project,  setProject]  = useState({ contractor:"", client:"", ref:"COS-2026-001" });
  const [scope,    setScope]    = useState(defaultScope);
  const estimate = useMemo(() => computeEstimate(scope), [scope]);

  return (
    <div style={{ background:screen === "landing" ? N : NM, minHeight:"100vh",
      fontFamily:"'Segoe UI',Arial,sans-serif", color:W }}>
      {screen === "landing" && (
        <Landing onStart={() => { setScreen("form"); setStep(1); }}/>
      )}
      {screen === "form" && step === 1 && (
        <Step1 project={project} setProject={setProject}
          onNext={() => setStep(2)} onBack={() => setScreen("landing")}/>
      )}
      {screen === "form" && step === 2 && (
        <Step2 scope={scope} setScope={setScope}
          onGenerate={() => setScreen("output")} onBack={() => setStep(1)}/>
      )}
      {screen === "output" && (
        <div style={{ padding:"20px 16px" }}>
          <OutputShell e={estimate} project={project}
            onReset={() => { setScreen("landing"); setScope(defaultScope); }}/>
        </div>
      )}
    </div>
  );
}
