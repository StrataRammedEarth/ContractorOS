import fs from 'node:fs';

const file = 'src/components/EstimatePage.tsx';
let s = fs.readFileSync(file, 'utf8');

if (s.includes('documentType, setDocumentType')) {
  console.log('Invoice mode already applied.');
  process.exit(0);
}

function replace(needle, value, label) {
  if (!s.includes(needle)) throw new Error(`Missing patch anchor: ${label}`);
  s = s.replace(needle, value);
}

replace(
  '} from "@/lib/geyser-assembly";\n',
  '} from "@/lib/geyser-assembly";\nimport { addDays, DEFAULT_BANKING_DETAILS, isoDate, printInvoiceDocument, type DocumentType, type InvoiceMeta } from "@/lib/invoice-document";\n',
  'invoice import',
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
`{tab==="estimate"&&<EstimateTab scope={scope} labour={labour} inputs={effInputs} finalGrade={finalGrade} quoteRef={quoteRef} onPrintQuote={printQuote}/>}\n          {tab==="buy"    &&<BuyTab scope={scope} inputs={effInputs} quoteRef={quoteRef} onPrintBuy={printBuy}/>}\n          {tab==="build"  &&<BuildTab labour={labour}/>}\n          {tab==="learn"  &&<LearnTab scope={scope} labour={labour} flags={flags}/>}\n`,
`{tab==="estimate"&&<EstimateTab scope={scope} labour={labour} inputs={effInputs} finalGrade={finalGrade} quoteRef={docRef} documentType={documentType} onPrintQuote={printDocument}/>}\n          {tab==="buy"    &&<BuyTab scope={scope} inputs={effInputs} quoteRef={docRef} onPrintBuy={printBuy}/>}\n          {tab==="build"  &&<BuildTab labour={labour}/>}\n          {tab==="learn"  &&<LearnTab scope={scope} labour={labour} flags={flags} documentType={documentType}/>}\n`,
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

fs.writeFileSync(file, s);
console.log('Invoice mode applied to EstimatePage.tsx');
