import { useMemo, useState } from "react";
import { addDays, DEFAULT_BANKING_DETAILS, isoDate, printInvoiceDocument, type DocumentType, type InvoiceMeta } from "@/lib/invoice-document";
import { COMPRESSION_FITTINGS, FITTING_SIZE_GROUPS, fittingsForSizeGroup, type FittingPreset } from "@/lib/plumblink-fittings";

const C = { navy:"#0D1B2A", mid:"#152436", gold:"#F5A623", pale:"#FDF3DC", bg:"#F1F4F8", line:"#DDE3EA", text:"#0D1B2A", muted:"#6B859E" };
const fmt = (n:number) => `R ${n.toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const uid = () => Math.random().toString(36).slice(2,9);
const hrRate = 860 / 8;

type ScopeLine = { id:string; code:string; description:string; qty:number; unit:string; unitPrice:number; conf:string; total:number; supplier:string; derivation:string; mode:string };
type LabourLine = { id:string; description:string; hours:number; rate:number; cost:number; conf:string; derivation:string };
type AddedFitting = { id:string; preset:FittingPreset; quantity:number };

type FixtureKey = "toilet" | "basin" | "showerMixer" | "showerDoor" | "showerRose";
const fixtureCatalog: Record<FixtureKey,{label:string;desc:string;price:number;supplier:string;hours:number}> = {
  toilet:{label:"Toilet",desc:"Coral White close-coupled toilet",price:929.90,supplier:"CTM",hours:1.83},
  basin:{label:"Basin",desc:"Bathroom basin white F/S",price:649.90,supplier:"Plumbit",hours:1.50},
  showerMixer:{label:"Shower mixer",desc:"Shower mixer",price:355.65,supplier:"Plumblink",hours:1.17},
  showerDoor:{label:"Shower door",desc:"Glass shower door – chrome",price:3559.00,supplier:"CTM",hours:1.00},
  showerRose:{label:"Shower rose",desc:"Shower rose round s/steel 200mm",price:477.39,supplier:"Plumblink",hours:0.25},
};

function nextRef(type:DocumentType){
  const d = new Date();
  const y = d.getFullYear();
  const ym = `${y}${String(d.getMonth()+1).padStart(2,"0")}`;
  const key = type === "invoice" ? `cos_invoice_seq_${ym}` : `cos_quote_seq_${y}`;
  let seq = 1;
  try { seq = parseInt(sessionStorage.getItem(key) ?? "0",10) + 1; sessionStorage.setItem(key,String(seq)); } catch {}
  return type === "invoice" ? `INV-${ym}-${String(seq).padStart(3,"0")}` : `PLB-${y}-${String(seq).padStart(3,"0")}`;
}

function ladder(mat:number, lab:number){
  const prime=mat+lab, waste=mat*0.05, direct=prime+waste, risk=direct*0.05, cont=(direct+risk)*0.10, margin=(direct+risk+cont)*0.25;
  return { prime, waste, direct, risk, cont, margin, sell: direct+risk+cont+margin };
}

function downloadQuote(ref:string, project:string, client:string, scope:ScopeLine[], labour:LabourLine[], sell:number){
  const rows = scope.map(l=>`<tr><td>${l.description}<br><small>${l.code} · ${l.supplier}</small></td><td>${l.qty}</td><td>${fmt(l.unitPrice)}</td><td>${fmt(l.total)}</td></tr>`).join("");
  const mat = scope.reduce((s,l)=>s+l.total,0), lab = labour.reduce((s,l)=>s+l.cost,0), vat=sell*0.15;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${ref}</title><style>body{font-family:Arial;padding:32px;color:#0D1B2A}header{background:#0D1B2A;color:white;padding:20px;border-bottom:4px solid #F5A623}.gold{color:#F5A623}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0D1B2A;color:#8FA3B8;text-align:left}td,th{padding:9px;border-bottom:1px solid #eee}.total{background:#0D1B2A;color:white;padding:14px;font-size:18px;font-weight:bold;display:flex;justify-content:space-between}.total span:last-child{color:#F5A623}</style></head><body><header><h2 class="gold">ContractorOS Quote</h2><div>${ref}</div></header><p><b>Project:</b> ${project}</p><p><b>Client:</b> ${client || "Client"}</p><table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><p>Materials: ${fmt(mat)}<br>Labour: ${fmt(lab)}<br>VAT: ${fmt(vat)}</p><div class="total"><span>Total incl. VAT</span><span>${fmt(sell+vat)}</span></div></body></html>`;
  const blob = new Blob([html],{type:"text/html"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${ref}_Quote.html`; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}

function Panel({title,children}:{title:string;children:React.ReactNode}){return <section style={{background:"white",border:`1px solid ${C.line}`,borderRadius:10,overflow:"hidden",marginBottom:14}}><div style={{background:C.mid,color:C.gold,fontSize:11,fontWeight:900,letterSpacing:1,textTransform:"uppercase",padding:"7px 14px"}}>{title}</div><div style={{padding:14,display:"grid",gap:10}}>{children}</div></section>}
function Field({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label style={{fontSize:11,fontWeight:800,color:C.muted,display:"grid",gap:4}}>{label}<input value={value} onChange={e=>onChange(e.target.value)} style={input}/></label>}
function Num({label,value,onChange}:{label:string;value:number;onChange:(v:number)=>void}){return <label style={{fontSize:11,fontWeight:800,color:C.muted,display:"grid",gap:4}}>{label}<input type="number" min={0} value={value} onChange={e=>onChange(Math.max(0,Number(e.target.value)||0))} style={input}/></label>}
const input:React.CSSProperties={padding:"8px 10px",border:`1px solid ${C.line}`,borderRadius:7,fontSize:13};
const btn:React.CSSProperties={padding:"9px 14px",borderRadius:7,border:"none",background:C.gold,color:C.navy,fontWeight:900,cursor:"pointer"};

export default function EstimatePageStable(){
  const [documentType,setDocumentType]=useState<DocumentType>("quote");
  const [quoteRef]=useState(()=>nextRef("quote"));
  const [invoiceRef]=useState(()=>nextRef("invoice"));
  const ref = documentType === "invoice" ? invoiceRef : quoteRef;
  const [project,setProject]=useState("Bathroom Fit-out — 3 Fixture");
  const [client,setClient]=useState("");
  const [points,setPoints]=useState(3);
  const [supply,setSupply]=useState(20);
  const [drain,setDrain]=useState(15);
  const [fixtures,setFixtures]=useState<Record<FixtureKey,number>>({toilet:1,basin:1,showerMixer:1,showerDoor:1,showerRose:1});
  const issueDate=isoDate(new Date());
  const [invoiceMeta,setInvoiceMeta]=useState<InvoiceMeta>({issueDate,dueDate:addDays(issueDate,7),bankingDetails:DEFAULT_BANKING_DETAILS});
  const [group,setGroup]=useState(FITTING_SIZE_GROUPS[0] ?? "15mm");
  const [code,setCode]=useState(fittingsForSizeGroup(FITTING_SIZE_GROUPS[0] ?? "15mm")[0]?.materialCode ?? "");
  const [qty,setQty]=useState(1);
  const [fittings,setFittings]=useState<AddedFitting[]>([]);
  const options=fittingsForSizeGroup(group);

  const scope=useMemo<ScopeLine[]>(()=>{
    const lines:ScopeLine[]=[];
    if(supply>0)lines.push({id:"S01",code:"PIPE-SUPPLY",description:"Copper 15mm supply pipe",qty:supply,unit:"m",unitPrice:102.41,conf:"Sourced",total:supply*102.41,supplier:"Plumblink",derivation:"per-metre pipe rate",mode:"Supply"});
    if(drain>0)lines.push({id:"D01",code:"PIPE-DRAIN",description:"PVC 110mm drainage pipe",qty:drain,unit:"m",unitPrice:44.72,conf:"Sourced",total:drain*44.72,supplier:"Plumblink",derivation:"per-metre pipe rate",mode:"Supply"});
    (Object.keys(fixtures) as FixtureKey[]).forEach(k=>{const n=fixtures[k], f=fixtureCatalog[k]; if(n>0)lines.push({id:k,code:`FIX-${k}`,description:f.desc,qty:n,unit:"ea",unitPrice:f.price,conf:"Sourced",total:n*f.price,supplier:f.supplier,derivation:"fixture preset",mode:"Install"});});
    fittings.forEach((f,i)=>lines.push({id:`CF${i+1}`,code:f.preset.plumblinkCode||f.preset.materialCode,description:f.preset.description,qty:f.quantity,unit:"ea",unitPrice:f.preset.unitPrice,conf:"Sourced",total:f.quantity*f.preset.unitPrice,supplier:f.preset.supplier,derivation:`${f.preset.sizeGroup} compression fitting`,mode:"Supply"}));
    lines.push({id:"A01",code:"STOP-TAPS",description:"Brass stop taps for mixers",qty:points*2,unit:"ea",unitPrice:146.96,conf:"Sourced",total:points*2*146.96,supplier:"Plumblink",derivation:"2 per point",mode:"Install"});
    return lines;
  },[supply,drain,fixtures,fittings,points]);

  const labour=useMemo<LabourLine[]>(()=>{
    const lines:LabourLine[]=[{id:"L01",description:"Pipework installation",hours:supply*0.1,rate:hrRate,cost:supply*0.1*hrRate,conf:"Sourced",derivation:"0.10hr/m"},{id:"L02",description:"Point make-off",hours:points,rate:hrRate,cost:points*hrRate,conf:"Assumption",derivation:"1hr/point"}];
    if(drain>0)lines.push({id:"L03",description:"Drainage installation",hours:drain*0.15,rate:hrRate,cost:drain*0.15*hrRate,conf:"Assumption",derivation:"0.15hr/m"});
    (Object.keys(fixtures) as FixtureKey[]).forEach(k=>{const n=fixtures[k], f=fixtureCatalog[k]; if(n>0)lines.push({id:`LF-${k}`,description:`${f.label} install`,hours:n*f.hours,rate:hrRate,cost:n*f.hours*hrRate,conf:"Assumption",derivation:`${n} × ${f.hours}hr`});});
    return lines;
  },[supply,drain,fixtures,points]);
  const mat=scope.reduce((s,l)=>s+l.total,0), lab=labour.reduce((s,l)=>s+l.cost,0), sell=ladder(mat,lab).sell;
  const addFitting=()=>{const p=COMPRESSION_FITTINGS.find(f=>f.materialCode===code)??options[0]; if(p&&qty>0)setFittings(x=>[...x,{id:uid(),preset:p,quantity:qty}]);};
  const print=()=>documentType==="invoice"?printInvoiceDocument({inputs:{projectName:project,clientName:client},scope,labour,invoiceRef:ref,invoiceMeta,sellExVat:sell}):downloadQuote(ref,project,client,scope,labour,sell);

  return <div style={{fontFamily:"Inter,system-ui,sans-serif",background:C.bg,minHeight:"100vh",color:C.text}}><header style={{background:C.navy,borderBottom:`3px solid ${C.gold}`,padding:"14px 20px"}}><div style={{maxWidth:1100,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{color:C.gold,fontWeight:900,fontSize:18}}>ContractorOS</div><div style={{color:C.muted,fontSize:10,textTransform:"uppercase",letterSpacing:1}}>Plumbing estimate · quote · invoice</div></div><div style={{textAlign:"right",color:C.gold,fontWeight:900,fontSize:22}}>{fmt(sell)}<div style={{color:C.muted,fontSize:10}}>{ref}</div></div></div></header><main style={{maxWidth:1100,margin:"0 auto",padding:20,display:"grid",gridTemplateColumns:"390px 1fr",gap:16}}><div><Panel title="Document type"><div style={{display:"flex",gap:8}}>{(["quote","invoice"] as DocumentType[]).map(t=><button key={t} onClick={()=>setDocumentType(t)} style={{...btn,flex:1,background:documentType===t?C.gold:"white",border:`2px solid ${C.gold}`}}>{t.toUpperCase()}</button>)}</div>{documentType==="invoice"&&<><input type="date" value={invoiceMeta.issueDate} onChange={e=>setInvoiceMeta(p=>({...p,issueDate:e.target.value}))} style={input}/><input type="date" value={invoiceMeta.dueDate} onChange={e=>setInvoiceMeta(p=>({...p,dueDate:e.target.value}))} style={input}/><textarea value={invoiceMeta.bankingDetails} onChange={e=>setInvoiceMeta(p=>({...p,bankingDetails:e.target.value}))} rows={2} style={input}/></>}</Panel><Panel title="Project"><Field label="Project" value={project} onChange={setProject}/><Field label="Client" value={client} onChange={setClient}/><Num label="Water points" value={points} onChange={setPoints}/><Num label="Supply metres" value={supply} onChange={setSupply}/><Num label="Drain metres" value={drain} onChange={setDrain}/></Panel><Panel title="Fixtures">{(Object.keys(fixtures) as FixtureKey[]).map(k=><Num key={k} label={fixtureCatalog[k].label} value={fixtures[k]} onChange={v=>setFixtures(p=>({...p,[k]:v}))}/>)}</Panel><Panel title="Fittings — Compression fittings"><label style={{fontSize:11,fontWeight:800,color:C.muted}}>Size</label><select value={group} onChange={e=>{const g=e.target.value;setGroup(g);setCode(fittingsForSizeGroup(g)[0]?.materialCode??"");}} style={input}>{FITTING_SIZE_GROUPS.map(g=><option key={g}>{g}</option>)}</select><label style={{fontSize:11,fontWeight:800,color:C.muted}}>Product</label><select value={code} onChange={e=>setCode(e.target.value)} style={input}>{options.map(f=><option key={f.materialCode} value={f.materialCode}>{f.label} — {f.size} — {fmt(f.unitPrice)}</option>)}</select><Num label="Quantity" value={qty} onChange={setQty}/><button onClick={addFitting} style={btn}>+ Add fitting</button>{fittings.map(f=><div key={f.id} style={{background:C.pale,padding:8,borderRadius:7,fontSize:12}}>{f.quantity} × {f.preset.description} <button onClick={()=>setFittings(x=>x.filter(y=>y.id!==f.id))} style={{float:"right"}}>Remove</button></div>)}</Panel></div><div><Panel title={documentType==="invoice"?"Invoice output":"Estimate output"}><button onClick={print} style={btn}>{documentType==="invoice"?"⬇ Download Invoice":"⬇ Download Quote"}</button><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}><b>Materials<br/>{fmt(mat)}</b><b>Labour<br/>{fmt(lab)}</b><b>Sell excl VAT<br/>{fmt(sell)}</b></div></Panel><Panel title="Material lines"><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><tbody>{scope.map(l=><tr key={l.id} style={{borderBottom:`1px solid ${C.line}`}}><td style={{padding:8}}>{l.description}<br/><small>{l.code} · {l.supplier}</small></td><td style={{padding:8,textAlign:"right"}}>{l.qty}</td><td style={{padding:8,textAlign:"right"}}>{fmt(l.total)}</td></tr>)}</tbody></table></Panel><Panel title="Labour lines"><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><tbody>{labour.map(l=><tr key={l.id} style={{borderBottom:`1px solid ${C.line}`}}><td style={{padding:8}}>{l.description}<br/><small>{l.derivation}</small></td><td style={{padding:8,textAlign:"right"}}>{l.hours.toFixed(2)} hr</td><td style={{padding:8,textAlign:"right"}}>{fmt(l.cost)}</td></tr>)}</tbody></table></Panel></div></main></div>;
}
