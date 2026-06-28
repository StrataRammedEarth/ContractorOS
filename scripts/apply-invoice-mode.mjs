import fs from 'node:fs';

const file = 'src/components/EstimatePage.tsx';
let s = fs.readFileSync(file, 'utf8');

if (s.includes('documentType, setDocumentType') && s.includes('interface FittingLine')) {
  console.log('Invoice mode and fittings already applied.');
  process.exit(0);
}

function replace(needle, value, label) {
  if (!s.includes(needle)) throw new Error(`Missing patch anchor: ${label}`);
  s = s.replace(needle, value);
}

if (!s.includes('documentType, setDocumentType')) {
replace(
  '} from "@/lib/geyser-assembly";\n',
  '} from "@/lib/geyser-assembly";\nimport { addDays, DEFAULT_BANKING_DETAILS, isoDate, printInvoiceDocument, type DocumentType, type InvoiceMeta } from "@/lib/invoice-document";\nimport { COMPRESSION_FITTINGS, FITTING_SIZE_GROUPS, fittingsForSizeGroup } from "@/lib/plumblink-fittings";\n',
  'invoice/fittings imports',
);

replace(
`// ─── QUOTE REF ────────────────────────────────────────────────────────────────
let _quoteSeq = parseInt(sessionStorage?.getItem?.("cos_seq") ?? "0", 10);
function nextQuoteRef() {
  _quoteSeq += 1;
  try { sessionStorage.setItem("cos_seq", String(_quoteSeq)); } catch(_) {}
  const y = new Date().getFullYear();
  return \`PLB-\${y}-\${String(_quoteSeq).padStart(3, "0")}\`;
}
`,
`// ─── DOCUMENT REFS ────────────────────────────────────────────────────────────
function nextDocumentRef(type: DocumentType) {
  const now = new Date();
  const year = now.getFullYear();
  const yearMonth = \`\${year}\${String(now.getMonth() + 1).padStart(2, "0")}\`;
  const key = type === "invoice" ? \`cos_invoice_seq_\${yearMonth}\` : \`cos_quote_seq_\${year}\`;
  let seq = 0;
  try { seq = parseInt(sessionStorage?.getItem?.(key) ?? "0", 10); } catch(_) {}
  seq += 1;
  try { sessionStorage.setItem(key, String(seq)); } catch(_) {}
  return type === "invoice"
    ? \`INV-\${yearMonth}-\${String(seq).padStart(3, "0")}\`
    : \`PLB-\${year}-\${String(seq).padStart(3, "0")}\`;
}
`,
  'document refs',
);

replace(
`function EstimateTab({ scope, labour, inputs, finalGrade, quoteRef, onPrintQuote }: { scope: ScopeLine[]; labour: LabourLine[]; inputs: Inputs; finalGrade: string; quoteRef: string; onPrintQuote: () => void }) {
`,
`function EstimateTab({ scope, labour, inputs, finalGrade, quoteRef, documentType, onPrintQuote }: { scope: ScopeLine[]; labour: LabourLine[]; inputs: Inputs; finalGrade: string; quoteRef: string; documentType: DocumentType; onPrintQuote: () => void }) {
`,
  'EstimateTab signature',
);

replace(
`  const issuable=GRADES[finalGrade]?.rank>=GRADES["Assumption"].rank;
`,
`  const issuable = documentType === "invoice" || GRADES[finalGrade]?.rank >= GRADES["Derived"].rank;
`,
  'EstimateTab gate',
);

replace(
`<div style={{color:C.muted,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>Sell Price (excl. VAT)</div>`,
`<div style={{color:C.muted,fontSize:11,letterSpacing:1,textTransform:"uppercase"}}>{documentType === "invoice" ? "Invoice Total (excl. VAT)" : "Sell Price (excl. VAT)"}</div>`,
  'EstimateTab total label',
);

replace(
`<div style={{color:C.muted,fontSize:10,marginTop:6}}>{issuable?"✓ Internal use OK":"⚠ Not client-issuable"}</div>`,
`<div style={{color:C.muted,fontSize:10,marginTop:6}}>{documentType === "invoice" ? "✓ Invoice issuable — actuals recorded" : issuable ? "✓ Quote client-issuable" : "⚠ Quote not client-issuable"}</div>`,
  'EstimateTab gate label',
);

replace(
`<button onClick={onPrintQuote} style={{marginTop:10,padding:"7px 16px",borderRadius:6,border:"none",background:C.gold,color:C.navy,cursor:"pointer",fontWeight:700,fontSize:12}}>⬇ Download Quote</button>`,
`<button onClick={onPrintQuote} disabled={!issuable} style={{marginTop:10,padding:"7px 16px",borderRadius:6,border:"none",background:issuable?C.gold:C.muted,color:C.navy,cursor:issuable?"pointer":"not-allowed",fontWeight:700,fontSize:12}}>{documentType === "invoice" ? "⬇ Download Invoice" : "⬇ Download Quote"}</button>`,
  'EstimateTab download button',
);

replace(
`function LearnTab({ scope, labour, flags=[] }: { scope: ScopeLine[]; labour: LabourLine[]; flags?: string[] }) {
`,
`function LearnTab({ scope, labour, flags=[], documentType }: { scope: ScopeLine[]; labour: LabourLine[]; flags?: string[]; documentType: DocumentType }) {
`,
  'LearnTab signature',
);

replace(
`  const issuable=GRADES[weakest]?.rank>=GRADES["Derived"].rank;
`,
`  const issuable = documentType === "invoice" || GRADES[weakest]?.rank >= GRADES["Derived"].rank;
`,
  'LearnTab gate',
);

replace(
`{issuable?"✓ INTERNAL USE — produceable at flagged grade":"✗ NOT CLIENT-ISSUABLE — resolve flagged inputs first"}`,
`{documentType === "invoice" ? "✓ INVOICE ISSUABLE — actuals pass with audit grades retained" : issuable ? "✓ QUOTE CLIENT-ISSUABLE" : "✗ QUOTE NOT CLIENT-ISSUABLE — resolve flagged inputs first"}`,
  'LearnTab gate copy',
);

replace(
`<SectionHeader>Assembly Flags — must clear before client issue</SectionHeader>`,
`<SectionHeader>{documentType === "invoice" ? "Assembly Flags — retained for invoice audit" : "Assembly Flags — must clear before client issue"}</SectionHeader>`,
  'LearnTab flag header',
);

replace(
`  const [jobMode, setJobMode] = useState<"plumbing"|"geyser">("plumbing");
  const [geyser, setGeyser]   = useState<GeyserMeta>(GEYSER_DEFAULT);
  const [quoteRef]          = useState(() => nextQuoteRef());
`,
`  const [jobMode, setJobMode] = useState<"plumbing"|"geyser">("plumbing");
  const [geyser, setGeyser]   = useState<GeyserMeta>(GEYSER_DEFAULT);
  const [documentType, setDocumentType] = useState<DocumentType>("quote");
  const [quoteRef] = useState(() => nextDocumentRef("quote"));
  const [invoiceRef] = useState(() => nextDocumentRef("invoice"));
  const [invoiceMeta, setInvoiceMeta] = useState<InvoiceMeta>(() => {
    const issueDate = isoDate(new Date());
    return { issueDate, dueDate: addDays(issueDate, 7), bankingDetails: DEFAULT_BANKING_DETAILS };
  });
  const docRef = documentType === "invoice" ? invoiceRef : quoteRef;
`,
  'document state',
);

replace(
`  const printQuote=()=>printQuotePDF(effInputs,scope,labour,quoteRef);
  const printBuy  =()=>printBuyPDF(effInputs,scope,quoteRef);
`,
`  const printDocument = () => documentType === "invoice"
    ? printInvoiceDocument({ inputs: effInputs, scope, labour, invoiceRef: docRef, invoiceMeta, sellExVat: sell })
    : printQuotePDF(effInputs, scope, labour, docRef);
  const printBuy = () => printBuyPDF(effInputs, scope, docRef);
`,
  'print branch',
);

replace(
`{tab==="estimate"&&<EstimateTab scope={scope} labour={labour} inputs={effInputs} finalGrade={finalGrade} quoteRef={quoteRef} onPrintQuote={printQuote}/>}
          {tab==="buy"    &&<BuyTab scope={scope} inputs={effInputs} quoteRef={quoteRef} onPrintBuy={printBuy}/>}
          {tab==="build"  &&<BuildTab labour={labour}/>}
          {tab==="learn"  &&<LearnTab scope={scope} labour={labour} flags={flags}/>}
`,
`{tab==="estimate"&&<EstimateTab scope={scope} labour={labour} inputs={effInputs} finalGrade={finalGrade} quoteRef={docRef} documentType={documentType} onPrintQuote={printDocument}/>}
          {tab==="buy"    &&<BuyTab scope={scope} inputs={effInputs} quoteRef={docRef} onPrintBuy={printBuy}/>}
          {tab==="build"  &&<BuildTab labour={labour}/>} 
          {tab==="learn"  &&<LearnTab scope={scope} labour={labour} flags={flags} documentType={documentType}/>}
`,
  'output tab props',
);

replace(
`<div style={{color:C.slateL,fontSize:10}}>{quoteRef}</div>`,
`<div style={{color:C.slateL,fontSize:10}}>{docRef}</div>`,
  'header ref',
);

replace(
`<div style={{color:C.muted,fontSize:10,letterSpacing:0.5}}>SELL PRICE excl. VAT</div>`,
`<div style={{color:C.muted,fontSize:10,letterSpacing:0.5}}>{documentType === "invoice" ? "INVOICE TOTAL excl. VAT" : "SELL PRICE excl. VAT"}</div>`,
  'header amount label',
);

replace(
`        {/* Job-type selector: baseline-and-scale plumbing vs fixed-composition geyser */}
`,
`        {/* Document type selector: quote promise vs invoice actuals */}
        <div style={{background:C.navy,borderRadius:8,border:\`1px solid \${C.gold}40\`,padding:12,marginBottom:16}}>
          <div style={{display:"flex",gap:8,marginBottom:documentType==="invoice"?12:0}}>
            {([{m:"quote" as const,l:"Quote"},{m:"invoice" as const,l:"Invoice"}]).map(d=>(
              <button key={d.m} onClick={()=>setDocumentType(d.m)} style={{
                flex:1,padding:"10px 20px",borderRadius:8,cursor:"pointer",fontWeight:900,fontSize:13,
                border:\`2px solid \${documentType===d.m?C.gold:C.gold+"50"}\`,
                background:documentType===d.m?C.gold:"transparent",color:documentType===d.m?C.navy:C.gold}}>{d.l}</button>))}
          </div>
          {documentType==="invoice"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <label style={{fontSize:11,color:C.slateL,fontWeight:700}}>Issue date<input type="date" value={invoiceMeta.issueDate} onChange={e=>setInvoiceMeta(p=>({...p,issueDate:e.target.value,dueDate:p.dueDate || addDays(e.target.value,7)}))} style={{display:"block",width:"100%",marginTop:3,padding:"7px 8px",border:"1px solid #C8D0DB",borderRadius:6}}/></label>
              <label style={{fontSize:11,color:C.slateL,fontWeight:700}}>Due date<input type="date" value={invoiceMeta.dueDate} onChange={e=>setInvoiceMeta(p=>({...p,dueDate:e.target.value}))} style={{display:"block",width:"100%",marginTop:3,padding:"7px 8px",border:"1px solid #C8D0DB",borderRadius:6}}/></label>
              <label style={{fontSize:11,color:C.slateL,fontWeight:700,gridColumn:"1 / -1"}}>Banking details<textarea value={invoiceMeta.bankingDetails} onChange={e=>setInvoiceMeta(p=>({...p,bankingDetails:e.target.value}))} rows={2} style={{display:"block",width:"100%",marginTop:3,padding:"7px 8px",border:"1px solid #C8D0DB",borderRadius:6,resize:"vertical"}}/></label>
              <div style={{gridColumn:"1 / -1",fontSize:10,color:C.muted}}>Invoice mode records actuals. Custom, Assumption and Placeholder lines pass issue gate, with grades retained for audit.</div>
            </div>
          )}
        </div>

        {/* Job-type selector: baseline-and-scale plumbing vs fixed-composition geyser */}
`,
  'document toggle UI',
);
}

if (!s.includes('interface FittingLine')) {
replace(
`interface GeyserMeta {
`,
`interface FittingLine {
  id: string;
  family: 'Compression Fittings';
  sizeGroup: string;
  materialCode: string;
  plumblinkCode: string;
  label: string;
  description: string;
  size: string;
  unitPrice: number;
  quantity: number;
  grade: string;
  supplier: string;
}
interface GeyserMeta {
`,
  'FittingLine type',
);

replace(
`  drainLines?: PipeLine[];      // canonical drainage pipe (replaces drainMetres)
  _scanNotes?: string; _scanConf?: string;
`,
`  drainLines?: PipeLine[];      // canonical drainage pipe (replaces drainMetres)
  fittingLines?: FittingLine[]; // canonical fittings from the Plumblink CSV library
  _scanNotes?: string; _scanConf?: string;
`,
  'Inputs fittingLines',
);

replace(
`const sumMetres = (ls: PipeLine[] | undefined) => (ls ?? []).reduce((s,l)=>s+(l.metres||0),0);
`,
`const sumMetres = (ls: PipeLine[] | undefined) => (ls ?? []).reduce((s,l)=>s+(l.metres||0),0);
const fittingPresetsForGroup = (sizeGroup: string) => fittingsForSizeGroup(sizeGroup);
function makeFittingLine(sizeGroup = FITTING_SIZE_GROUPS[0] ?? "15mm"): FittingLine {
  const p = fittingPresetsForGroup(sizeGroup)[0] ?? COMPRESSION_FITTINGS[0];
  return { id:_uid(), family:p.family, sizeGroup:p.sizeGroup, materialCode:p.materialCode,
    plumblinkCode:p.plumblinkCode, label:p.label, description:p.description, size:p.size,
    unitPrice:p.unitPrice, quantity:1, grade:p.grade, supplier:p.supplier };
}
`,
  'fitting helpers',
);

replace(
`  const drainLines  = inp.drainLines ?? [];
  const supplyMetres = sumMetres(supplyLines);
`,
`  const drainLines  = inp.drainLines ?? [];
  const fittingLines = inp.fittingLines ?? [];
  const supplyMetres = sumMetres(supplyLines);
`,
  'buildScope fitting local',
);

replace(
`

  return lines;
}

function buildLabour`,
`

  fittingLines.forEach((fl, i) => {
    if (fl.quantity <= 0) return;
    lines.push({
      id:\`CF\${String(i+1).padStart(2,"0")}\`,
      code: fl.materialCode,
      description: fl.description,
      qty: fl.quantity,
      unit:"ea",
      unitPrice: fl.unitPrice,
      conf: fl.grade,
      total: fl.quantity * fl.unitPrice,
      supplier: fl.supplier,
      derivation: \`\${fl.quantity} × R\${fl.unitPrice} (\${fl.sizeGroup} compression fitting · Plumblink \${fl.plumblinkCode || fl.materialCode})\`,
      mode:"Supply",
    });
  });

  return lines;
}

function buildLabour`,
  'buildScope fitting lines',
);

replace(
`        ...((inputs.fixtureLines ?? []).filter(l=>l.quantity>0)
          .map(l=>\`${l.quantity}× ${l.description || l.type}${l.source==="custom"?" (custom)":""}\`)),
`,
`        ...((inputs.fixtureLines ?? []).filter(l=>l.quantity>0)
          .map(l=>\`${l.quantity}× ${l.description || l.type}${l.source==="custom"?" (custom)":""}\`)),
        ...((inputs.fittingLines ?? []).filter(l=>l.quantity>0)
          .map(l=>\`${l.quantity}× ${l.description} (${l.sizeGroup})\`)),
`,
  'ScopeModal fitting items',
);

replace(
`  drainLines:[pipeLineFrom("drainage","PVC",110,15)],
};
`,
`  drainLines:[pipeLineFrom("drainage","PVC",110,15)],
  fittingLines:[],
};
`,
  'DEFAULT fittings',
);

replace(
`  const updatePipeLine = useCallback((use: 'supply'|'drainage', id: string, patch: Partial<PipeLine>) => {
    const key = use==='supply' ? 'supplyLines' : 'drainLines';
    setInputs(p=>({...p, [key]:(p[key] ?? []).map(l=>l.id===id?{...l,...patch}:l)}));
  },[]);

  const onScanDone`,
`  const updatePipeLine = useCallback((use: 'supply'|'drainage', id: string, patch: Partial<PipeLine>) => {
    const key = use==='supply' ? 'supplyLines' : 'drainLines';
    setInputs(p=>({...p, [key]:(p[key] ?? []).map(l=>l.id===id?{...l,...patch}:l)}));
  },[]);

  // Fitting-line builder management — CSV-driven Plumblink compression fittings
  const addFittingLine = useCallback((sizeGroup = FITTING_SIZE_GROUPS[0] ?? "15mm") =>
    setInputs(p=>({...p, fittingLines:[...(p.fittingLines ?? []), makeFittingLine(sizeGroup)]})),[]);
  const removeFittingLine = useCallback((id: string) =>
    setInputs(p=>({...p, fittingLines:(p.fittingLines ?? []).filter(l=>l.id!==id)})),[]);
  const updateFittingLine = useCallback((id: string, patch: Partial<FittingLine>) =>
    setInputs(p=>({...p, fittingLines:(p.fittingLines ?? []).map(l=>l.id===id?{...l,...patch}:l)})),[]);

  const onScanDone`,
  'fitting state handlers',
);

replace(
`      drainLines:  data.drainMetres>0  ? [pipeLineFrom("drainage","PVC",110,data.drainMetres)] : [],
`,
`      drainLines:  data.drainMetres>0  ? [pipeLineFrom("drainage","PVC",110,data.drainMetres)] : [],
      fittingLines: [],
`,
  'scan fitting defaults',
);

replace(
`        </>)}

        {jobMode==="geyser"&&(
`,
`        <div style={{background:"#fff",borderRadius:8,border:"1px solid #DDE3EA",marginBottom:14,overflow:"hidden"}}>
          <SectionHeader>Fittings — Compression fittings</SectionHeader>
          <div style={{padding:"12px 16px"}}>
            {(inputs.fittingLines ?? []).length===0&&
              <div style={{fontSize:12,color:C.slateL,padding:"6px 2px 10px"}}>No fittings yet — add a compression fitting line below.</div>}
            {(inputs.fittingLines ?? []).map(fl=>{
              const groupPresets = fittingPresetsForGroup(fl.sizeGroup);
              return (
              <div key={fl.id} style={{border:"1px solid #E0E5EC",borderRadius:8,padding:"8px 10px",marginBottom:8,background:C.offWhite}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <select value={fl.sizeGroup}
                    onChange={e=>{const next=makeFittingLine(e.target.value); updateFittingLine(fl.id,{family:next.family,sizeGroup:next.sizeGroup,materialCode:next.materialCode,plumblinkCode:next.plumblinkCode,label:next.label,description:next.description,size:next.size,unitPrice:next.unitPrice,grade:next.grade,supplier:next.supplier});}}
                    style={{padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12,minWidth:120}}>
                    {FITTING_SIZE_GROUPS.map(g=><option key={g} value={g}>{g}</option>)}
                  </select>
                  <select value={fl.materialCode}
                    onChange={e=>{const p=COMPRESSION_FITTINGS.find(x=>x.materialCode===e.target.value); if(p)updateFittingLine(fl.id,{family:p.family,sizeGroup:p.sizeGroup,materialCode:p.materialCode,plumblinkCode:p.plumblinkCode,label:p.label,description:p.description,size:p.size,unitPrice:p.unitPrice,grade:p.grade,supplier:p.supplier});}}
                    style={{padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:12,flex:1,minWidth:230}}>
                    {groupPresets.map(p=><option key={p.materialCode} value={p.materialCode}>{p.label} — {p.size} — R{p.unitPrice.toFixed(2)}</option>)}
                  </select>
                  <input type="number" min={0} max={500} value={fl.quantity}
                    onChange={e=>updateFittingLine(fl.id,{quantity:Math.max(0,parseInt(e.target.value)||0)})}
                    style={{width:64,padding:"6px 8px",border:"1px solid #C8D0DB",borderRadius:6,fontSize:14,fontWeight:700,textAlign:"center"}}/>
                  <span style={{fontSize:11,color:C.slateL,minWidth:72,textAlign:"right"}}>{fmt(fl.quantity*fl.unitPrice)}</span>
                  <GradePill grade={fl.grade}/>
                  <button onClick={()=>removeFittingLine(fl.id)} title="Remove" style={{padding:"4px 9px",borderRadius:6,border:"1px solid #E0B4B4",background:"#fff",color:C.red,cursor:"pointer",fontSize:13,fontWeight:700}}>✕</button>
                </div>
                <div style={{fontSize:10,color:C.slateL,marginTop:5}}>Plumblink {fl.plumblinkCode || fl.materialCode} · {fl.description}</div>
              </div>);
            })}
            <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
              <button onClick={()=>addFittingLine("15mm")}
                style={{padding:"7px 14px",borderRadius:6,border:\`1px dashed \${C.gold}\`,background:C.goldPale,color:C.navy,cursor:"pointer",fontSize:12,fontWeight:700}}>+ Add fitting</button>
              <span style={{fontSize:10,color:C.muted}}>Compression fitting options are generated from the Plumblink material CSV.</span>
            </div>
          </div>
        </div>
        </>)}

        {jobMode==="geyser"&&(
`,
  'fittings UI section',
);
}

fs.writeFileSync(file, s);
console.log('Invoice mode and compression fittings applied to EstimatePage.tsx');
