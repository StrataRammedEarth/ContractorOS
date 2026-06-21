"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { formatMoney, Money } from "@/components/Money";
import { isUsableForEstimate, lineageSummary, resolveAuthorityState } from "@/lib/authority";
import { calculateEstimate, estimateClassificationRules, featureSchemaDefinitions, validateClientProposal, validateForFinal } from "@/lib/engine";
import { approveStagedImports, stageStagedImports, updateGovernedRecordApproval } from "@/lib/governance";
import { reviewLibraryCsv } from "@/lib/imports";
import { downloadProposal } from "@/lib/proposal";
import { getOrganizationId, loadCloudActuals, loadCloudEstimates, loadCloudLibrary, saveCloudActual, saveCloudEstimate, saveCloudLibrary } from "@/lib/cloud";
import { localStore } from "@/lib/storage";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { ActualRecord, EstimateClassification, EstimateElementBreakdown, EstimateInput, EstimateSnapshot, FeatureDefinition, ImportIssue, LibraryData, ProductivityRecord, RecordType, StagedImportRecord } from "@/lib/types";

type View = "estimate" | "buy" | "build" | "learn" | "library" | "history";

const defaultInput: EstimateInput = {
  projectName: "",
  clientName: "",
  reference: `COS-${new Date().getFullYear()}-001`,
  vatEnabled: false,
  scope: [],
};

export default function Home() {
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [input, setInput] = useState<EstimateInput>(defaultInput);
  const [view, setView] = useState<View>("estimate");
  const [saved, setSaved] = useState<EstimateSnapshot[]>([]);
  const [activeSnapshot, setActiveSnapshot] = useState<EstimateSnapshot | null>(null);
  const [actuals, setActuals] = useState<ActualRecord[]>([]);
  const [search, setSearch] = useState("");
  const [importRecordType, setImportRecordType] = useState<RecordType>("material");
  const [importReport, setImportReport] = useState<{ rows: number; issues: ImportIssue[]; accepted: StagedImportRecord[] } | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [signedIn, setSignedIn] = useState(!isSupabaseConfigured);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    setLibrary(localStore.getLibrary());
    setSaved(localStore.getEstimates());
    setActuals(localStore.getActuals());
  }, []);

  useEffect(() => {
    if (!signedIn || !supabase) return;
    getOrganizationId().then(async (orgId) => {
      setOrganizationId(orgId);
      const [cloudLibrary, cloudEstimates, cloudActuals] = await Promise.all([
        loadCloudLibrary(orgId), loadCloudEstimates(orgId), loadCloudActuals(orgId),
      ]);
      setLibrary(cloudLibrary);
      setSaved(cloudEstimates);
      setActuals(cloudActuals);
    }).catch((error: Error) => alert(`Cloud setup failed: ${error.message}`));
  }, [signedIn]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  const preview = useMemo(() => library ? calculateEstimate(input, library) : null, [input, library]);
  const snapshot = activeSnapshot ?? preview;
  if (!library || !snapshot) return <main className="loading">Loading ContractorOS...</main>;

  const setQuantity = (code: string, quantity: number) => {
    setActiveSnapshot(null);
    setInput((current) => ({
      ...current,
      scope: [
        ...current.scope.filter((item) => item.assemblyCode !== code),
        ...(quantity > 0 ? [{ assemblyCode: code, quantity }] : []),
      ],
    }));
  };

  const saveEstimate = async () => {
    const result = validateForFinal(preview!);
    if (!result.valid) {
      alert("This estimate cannot be finalised yet. Review the warnings first.");
      return;
    }
    const next = organizationId ? await saveCloudEstimate(organizationId, preview!, saved) : localStore.saveEstimate(preview!);
    setSaved(organizationId ? [next, ...saved] : localStore.getEstimates());
    setActiveSnapshot(next);
    setView("estimate");
  };

  const downloadClientProposal = () => {
    const result = validateClientProposal(snapshot);
    if (!result.valid) {
      alert(`Client proposal blocked:\n${result.warnings.join("\n")}`);
      return;
    }
    downloadProposal(snapshot);
  };

  const saveLibrary = (next: LibraryData) => {
    setLibrary(next);
    if (organizationId) saveCloudLibrary(organizationId, next).catch((error: Error) => alert(error.message));
    else localStore.saveLibrary(next);
  };

  const handleImport = async (file: File) => {
    const existing = [
      ...library.materials.map((item) => ({ recordType: "material" as const, code: item.code })),
      ...library.resources.map((item) => ({ recordType: "resource" as const, code: item.code })),
      ...library.assemblies.map((item) => ({ recordType: "assembly" as const, code: item.code })),
      { recordType: "commercial_rule" as const, code: "COMMERCIAL-RULES" },
      ...(library.governedRecords ?? []).map((item) => ({ recordType: item.recordType, code: item.code })),
    ];
    const result = reviewLibraryCsv(await file.text(), existing, importRecordType);
    setImportReport({ rows: result.rows, issues: result.issues, accepted: result.accepted });
  };

  const approveImport = () => {
    if (!importReport) return;
    saveLibrary(approveStagedImports(library, importReport.accepted));
    setImportReport(null);
  };

  const stageImport = () => {
    if (!importReport) return;
    saveLibrary(stageStagedImports(library, importReport.accepted));
    setImportReport(null);
  };

  if (!authReady) return <main className="loading">Checking secure owner session...</main>;
  if (!signedIn) return <Login />;
  return (
    <div className="app-shell">
      <aside>
        <div className="brand"><span className="brand-mark">C</span><div><strong>ContractorOS</strong><small>Reliable Estimating Core</small></div></div>
        <nav>
          {([
            ["estimate", "Estimate"], ["buy", "Buy"], ["build", "Build"], ["learn", "Learn"],
            ["library", "Library"], ["history", "History"],
          ] as [View, string][]).map(([id, label]) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>{label}</button>
          ))}
        </nav>
        <div className="connection"><span className={isSupabaseConfigured ? "dot online" : "dot"} />{isSupabaseConfigured ? "Supabase connected" : "Local data mode"}</div>
      </aside>

      <main>
        <header>
          <div><p className="eyebrow">ASSEMBLY-FIRST ESTIMATING</p><h1>{titleFor(view)}</h1></div>
          {snapshot.lines.length > 0 && <div className="headline-total"><small>Sell price excl. VAT</small><Money value={snapshot.totals.sellExVat} /></div>}
        </header>

        {view === "estimate" && (
          <div className="two-column">
            <section className="panel">
              <div className="section-title"><div><p className="eyebrow">PROJECT</p><h2>Estimate setup</h2></div><button className="secondary" onClick={() => { setInput(defaultInput); setActiveSnapshot(null); }}>New estimate</button></div>
              <div className="form-grid">
                <label>Project name<input value={input.projectName} onChange={(e) => setInput({ ...input, projectName: e.target.value })} placeholder="Bathroom renovation" /></label>
                <label>Client name<input value={input.clientName} onChange={(e) => setInput({ ...input, clientName: e.target.value })} placeholder="Client or company" /></label>
                <label>Reference<input value={input.reference} onChange={(e) => setInput({ ...input, reference: e.target.value })} /></label>
                <label className="toggle-label"><input type="checkbox" checked={input.vatEnabled} onChange={(e) => setInput({ ...input, vatEnabled: e.target.checked })} /> Add 15% VAT</label>
              </div>
              <FeatureSchemaPanel features={getFeatureSchema(snapshot)} />
              {(["Plumbing", "Decking", "Masonry"] as const).map((trade) => (
                <div key={trade} className="assembly-group">
                  <h3>{trade}</h3>
                  {library.assemblies.filter((item) => item.trade === trade && item.status === "Active" && isUsableForEstimate(item)).map((assembly) => (
                    <div className="assembly-row" key={assembly.code}>
                      <div><strong>{assembly.code}</strong><span>{assembly.name}</span><Badge value={assembly.confidence} /><small>{resolveAuthorityState(assembly)}</small></div>
                      <div className="quantity"><input type="number" min="0" step="0.1" value={input.scope.find((item) => item.assemblyCode === assembly.code)?.quantity ?? ""} onChange={(e) => setQuantity(assembly.code, Number(e.target.value))} /><span>{assembly.unit}</span></div>
                    </div>
                  ))}
                </div>
              ))}
            </section>
            <EstimateSummary snapshot={snapshot} onSave={saveEstimate} onPdf={downloadClientProposal} />
          </div>
        )}

        {view === "buy" && <DataTable title="Aggregated purchasing list" empty="Select detailed assemblies to generate a purchasing list." headers={["Code", "Description", "Supplier", "Qty", "Unit", "Rate", "Total", "Confidence", "Authority", "Trace"]} rows={snapshot.buy.map((line) => [line.materialCode, line.description, line.supplier, line.quantity, line.unit, formatMoney(line.unitRate), formatMoney(line.total), <Badge key={line.materialCode} value={line.confidence} />, line.authorityState, lineageSummary(line.lineage)])} />}

        {view === "build" && <DataTable title="Labour and activity plan" empty="Select assemblies with detailed labour recipes to generate the build plan." headers={["Assembly", "Activity", "Resource", "Qty", "Unit", "Rate", "Total", "Confidence", "Authority", "Trace"]} rows={snapshot.build.map((line, index) => [line.assemblyCode, line.activity, line.resource, line.quantity, line.unit, formatMoney(line.rate), formatMoney(line.total), <Badge key={index} value={line.confidence} />, line.authorityState, lineageSummary(line.lineage)])} />}

        {view === "learn" && <LearnView snapshot={snapshot} actuals={actuals} onSave={async (record) => { if (organizationId) { await saveCloudActual(organizationId, record); setActuals([record, ...actuals]); } else { localStore.saveActual(record); setActuals(localStore.getActuals()); } }} />}

        {view === "library" && (
          <LibraryView library={library} search={search} setSearch={setSearch} saveLibrary={saveLibrary} handleImport={handleImport} importReport={importReport} stageImport={stageImport} approveImport={approveImport} reset={() => saveLibrary(localStore.resetLibrary())} importRecordType={importRecordType} setImportRecordType={setImportRecordType} />
        )}

        {view === "history" && (
          <DataTable title="Saved estimate versions" empty="No estimates have been saved yet." headers={["Reference", "Version", "Class", "Accuracy band", "Project", "Client", "Created", "Sell excl. VAT", "Open"]} rows={saved.map((item) => {
            const classification = getEstimateClassification(item);
            return [item.input.reference, item.version, classification.label, `${classification.expectedLowRange} / ${classification.expectedHighRange}`, item.input.projectName, item.input.clientName, new Date(item.createdAt).toLocaleString(), formatMoney(item.totals.sellExVat), <button key={item.id} className="link-button" onClick={() => { setActiveSnapshot(item); setInput(item.input); setView("estimate"); }}>Open snapshot</button>];
          })} />
        )}
      </main>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const signIn = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error?.message ?? "");
  };
  return <main className="loading"><section className="panel" style={{ width: "min(430px, calc(100vw - 32px))", display: "grid", gap: 14 }}><p className="eyebrow">SECURE OWNER ACCESS</p><h1>Sign in to ContractorOS</h1><p className="muted">Use the owner account created in Supabase Authentication.</p><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>{message && <p className="warnings">{message}</p>}<button onClick={signIn}>Sign in</button></section></main>;
}

function EstimateSummary({ snapshot, onSave, onPdf }: { snapshot: EstimateSnapshot; onSave: () => void; onPdf: () => void }) {
  const classification = getEstimateClassification(snapshot);
  const elementalBreakdown = getElementalBreakdown(snapshot);
  return <section className="panel sticky">
    <p className="eyebrow">LIVE VERSION PREVIEW</p><h2>{snapshot.input.reference}</h2>
    <div className="classification-card">
      <div>
        <span>Estimate class</span>
        <strong>{classification.label}</strong>
        <small>{classification.dataBasis}</small>
      </div>
      <div>
        <span>Expected accuracy band</span>
        <strong>{classification.expectedLowRange} / {classification.expectedHighRange}</strong>
        <small>{classification.governanceStatus} from Estimate Classification sheet</small>
      </div>
    </div>
    <p className="classification-warning">{classification.uiWarning}</p>
    {classification.rationale.length > 0 && <div className="classification-rationale">{classification.rationale.map((item) => <p key={item}>{item}</p>)}</div>}
    <div className="summary-lines">{snapshot.lines.map((line) => <div key={line.code}><span>{line.code} - {line.description} ({line.authorityState})</span><Money value={line.prime} /></div>)}</div>
    {elementalBreakdown.length > 0 && <div className="elemental-breakdown">
      <div className="elemental-title"><span>Approved elemental cost structure</span><small>Elemental Cost Structure sheet</small></div>
      {elementalBreakdown.map((element) => (
        <div key={element.code} className="element-row">
          <div>
            <strong>{element.name}</strong>
            <span>{element.percentOfPrime.toFixed(1)}% of prime cost</span>
          </div>
          <Money value={element.prime} />
        </div>
      ))}
    </div>}
    <div className="totals">
      <Total label="Materials" value={snapshot.totals.material} /><Total label="Labour" value={snapshot.totals.labour} />
      <Total label="Prime cost" value={snapshot.totals.prime} strong /><Total label={`Waste ${snapshot.rules.wastePct}%`} value={snapshot.totals.waste} />
      <Total label={`Risk ${snapshot.rules.riskPct}%`} value={snapshot.totals.risk} /><Total label={`Contingency ${snapshot.rules.contingencyPct}%`} value={snapshot.totals.contingency} />
      <Total label={`Markup ${snapshot.rules.marginPct}%`} value={snapshot.totals.margin} /><Total label="Sell price excl. VAT" value={snapshot.totals.sellExVat} strong />
      {snapshot.input.vatEnabled && <><Total label={`VAT ${snapshot.rules.vatPct}%`} value={snapshot.totals.vat} /><Total label="Sell price incl. VAT" value={snapshot.totals.sellIncVat} strong /></>}
    </div>
    {snapshot.warnings.length > 0 && <div className="warnings"><strong>Review before finalising</strong>{snapshot.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
    <div className="actions"><button onClick={onSave}>Save version</button><button className="secondary" onClick={onPdf} disabled={!snapshot.lines.length}>Download client PDF</button></div>
  </section>;
}

function getEstimateClassification(snapshot: EstimateSnapshot): EstimateClassification {
  return snapshot.classification ?? {
    code: "CLASS_5",
    ...estimateClassificationRules.CLASS_5,
    rationale: ["Legacy saved snapshot created before estimate classification metadata was introduced."],
  };
}

function getElementalBreakdown(snapshot: EstimateSnapshot): EstimateElementBreakdown[] {
  if (snapshot.elementalBreakdown) return snapshot.elementalBreakdown;
  return [];
}

function getFeatureSchema(snapshot: EstimateSnapshot): FeatureDefinition[] {
  return snapshot.featureSchema ?? Object.values(featureSchemaDefinitions);
}

function FeatureSchemaPanel({ features }: { features: FeatureDefinition[] }) {
  return <section className="feature-schema-panel">
    <div className="feature-schema-header">
      <div><p className="eyebrow">APPROVED COST MODEL SCHEMA</p><h3>Fourteen feature schema</h3></div>
      <span>{features.length} approved features</span>
    </div>
    <p className="muted">These are the approved measurement fields for future project feature capture and elemental benchmarking. They are schema records only; no project values are required yet.</p>
    <div className="feature-grid">
      {features.map((feature) => (
        <div key={feature.code} className="feature-card">
          <strong>{feature.name}</strong>
          <span>{feature.code}</span>
          <small>{feature.measurementUnit} | {feature.suggestedInputControl}</small>
        </div>
      ))}
    </div>
  </section>;
}

function Total({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div className={strong ? "strong" : ""}><span>{label}</span><Money value={value} /></div>;
}

function DataTable({ title, headers, rows, empty }: { title: string; headers: string[]; rows: React.ReactNode[][]; empty: string }) {
  return <section className="panel"><div className="section-title"><div><p className="eyebrow">OUTPUT</p><h2>{title}</h2></div></div>{rows.length ? <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div> : <div className="empty">{empty}</div>}</section>;
}

function LearnView({ snapshot, actuals, onSave }: { snapshot: EstimateSnapshot; actuals: ActualRecord[]; onSave: (record: ActualRecord) => void }) {
  const existing = actuals.find((item) => item.estimateId === snapshot.id);
  const [values, setValues] = useState({ material: "", labour: "", final: "", notes: "" });
  const actualCost = Number(values.material) + Number(values.labour);
  const variance = actualCost ? actualCost - snapshot.totals.prime : 0;
  return <section className="panel"><p className="eyebrow">REVIEWED LEARNING LOOP</p><h2>Capture actual project results</h2><p className="muted">Actuals create a review suggestion. They never change locked library rates automatically.</p>
    {existing ? <div className="success">Actuals captured for this snapshot. Suggested updates remain pending owner review.</div> : <div className="form-grid">
      <label>Actual material cost<input type="number" value={values.material} onChange={(e) => setValues({ ...values, material: e.target.value })} /></label>
      <label>Actual labour cost<input type="number" value={values.labour} onChange={(e) => setValues({ ...values, labour: e.target.value })} /></label>
      <label>Actual final value<input type="number" value={values.final} onChange={(e) => setValues({ ...values, final: e.target.value })} /></label>
      <label>Notes<textarea value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} /></label>
      <div className="metric"><span>Prime-cost variance</span><Money value={variance} /></div>
      <button disabled={!snapshot.lines.length || !actualCost} onClick={() => onSave({ estimateId: snapshot.id, actualMaterial: Number(values.material), actualLabour: Number(values.labour), actualFinalValue: Number(values.final), notes: values.notes, createdAt: new Date().toISOString() })}>Save for review</button>
    </div>}
  </section>;
}

function LibraryView({ library, search, setSearch, saveLibrary, handleImport, importReport, stageImport, approveImport, reset, importRecordType, setImportRecordType }: { library: LibraryData; search: string; setSearch: (value: string) => void; saveLibrary: (library: LibraryData) => void; handleImport: (file: File) => void; importReport: { rows: number; issues: ImportIssue[]; accepted: StagedImportRecord[] } | null; stageImport: () => void; approveImport: () => void; reset: () => void; importRecordType: RecordType; setImportRecordType: (value: RecordType) => void }) {
  const filtered = library.materials.filter((item) => `${item.code} ${item.description} ${item.supplier}`.toLowerCase().includes(search.toLowerCase()));
  const productivityRecords = (library.governedRecords ?? []).filter((record) => record.recordType === "productivity_record");
  const stagedProductivity = productivityRecords.filter((record) => record.governance.approval === "staged");
  const approvedProductivity = productivityRecords.filter((record) => record.governance.approval === "approved" || record.governance.approval === "locked");
  const rejectedProductivity = productivityRecords.filter((record) => record.governance.approval === "rejected");
  const withdrawnProductivity = productivityRecords.filter((record) => record.governance.approval === "withdrawn");
  const reviewProductivity = (code: string, action: "approve" | "reject" | "stage" | "withdraw") => saveLibrary(updateGovernedRecordApproval(library, "productivity_record", code, action));
  return <div className="stack"><section className="panel"><div className="section-title"><div><p className="eyebrow">CURATED MASTER LIBRARY</p><h2>Materials and pricing</h2></div><button className="secondary" onClick={reset}>Restore trusted seed</button></div>
    <input className="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code, description, or supplier" />
    <div className="table-wrap"><table><thead><tr><th>Code</th><th>Description</th><th>Supplier</th><th>Unit</th><th>Price excl. VAT</th><th>Confidence</th><th>Authority</th><th>Approval</th><th>Trace</th><th>Source</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.code}><td>{item.code}</td><td>{item.description}</td><td>{item.supplier}</td><td>{item.unit}</td><td><input className="price-input" type="number" value={item.unitRate ?? ""} onChange={(e) => saveLibrary({ ...library, materials: library.materials.map((material) => material.code === item.code ? { ...material, unitRate: Number(e.target.value), governance: { ...(material.governance ?? item.governance!), lifecycle: "pending", approval: "staged", authorityState: "staged", ownerApprovalRequired: true, notes: "Price edited and awaiting owner approval." } } : material) })} /></td><td><Badge value={item.confidence} /></td><td>{resolveAuthorityState(item)}</td><td>{item.governance?.approval ?? "approved"}</td><td>{lineageSummary(item.lineage)}</td><td>{item.source}</td></tr>)}</tbody></table></div>
  </section>
  <section className="panel"><p className="eyebrow">CONTROLLED IMPORT</p><h2>Review governed CSV</h2><p className="muted">Imports are staged inactive, source-checked, normalized, and require owner approval before permanent use.</p>
    <label>Default record type<select value={importRecordType} onChange={(e) => setImportRecordType(e.target.value as RecordType)}>{(["material", "resource", "assembly", "commercial_rule", "assumption", "validation", "source", "productivity_record"] as RecordType[]).map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
    <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
    {importReport && <div className="import-report"><h3>{importReport.rows} rows reviewed - {importReport.accepted.length} staged - {importReport.issues.length} issues</h3>{importReport.accepted.length > 0 && <table><thead><tr><th>Type</th><th>Code</th><th>Confidence</th><th>Source</th></tr></thead><tbody>{importReport.accepted.map((record) => <tr key={`${record.recordType}-${record.code}`}><td>{record.recordType}</td><td>{record.code}</td><td><Badge value={record.confidence} /></td><td>{record.source}</td></tr>)}</tbody></table>}{importReport.issues.map((issue, index) => <p key={index} className={issue.severity}>Row {issue.row}: {issue.message}</p>)}<div className="actions"><button disabled={importReport.issues.some((item) => item.severity === "error")} onClick={stageImport}>Stage awaiting owner approval</button><button className="secondary" disabled={importReport.issues.some((item) => item.severity === "error")} onClick={approveImport}>Owner approve now</button></div></div>}
  </section>
  <ProductivityRecordsTable title="Productivity records awaiting approval" empty="No labour productivity records are waiting for review." records={stagedProductivity} onReview={reviewProductivity} />
  <ProductivityRecordsTable title="Approved productivity records" empty="No labour productivity records have been approved yet." records={approvedProductivity} onReview={reviewProductivity} />
  {rejectedProductivity.length > 0 && <ProductivityRecordsTable title="Rejected productivity records" empty="No productivity records have been rejected." records={rejectedProductivity} onReview={reviewProductivity} />}
  {withdrawnProductivity.length > 0 && <ProductivityRecordsTable title="Withdrawn productivity records" empty="No productivity records have been withdrawn." records={withdrawnProductivity} onReview={reviewProductivity} />}
  <DataTable title="Governance register" empty="No assumptions, validations, or source records have been approved yet." headers={["Type", "Code", "Confidence", "Authority", "Approval", "Trace", "Source"]} rows={(library.governedRecords ?? []).map((record) => [record.recordType, record.code, <Badge key={`${record.recordType}-${record.code}`} value={record.confidence} />, record.governance.authorityState, record.governance.approval, lineageSummary(record.lineage), record.source])} />
  </div>;
}

function ProductivityRecordsTable({ title, empty, records, onReview }: { title: string; empty: string; records: StagedImportRecord[]; onReview: (code: string, action: "approve" | "reject" | "stage" | "withdraw") => void }) {
  return <DataTable title={title} empty={empty} headers={["Code", "Trade", "Activity", "Unit", "Output/day", "Hours/unit", "Authority", "Approval", "Trace", "Source", "Review"]} rows={records.map((record) => {
    const data = record.data as ProductivityRecord;
    return [record.code, data.trade, data.activity, data.unit, formatOptional(data.outputPerDay), formatOptional(data.labourHoursPerUnit), record.governance.authorityState, record.governance.approval, lineageSummary(record.lineage), record.source, <ReviewActions key={record.code} code={record.code} approval={record.governance.approval} onReview={onReview} />];
  })} />;
}

function ReviewActions({ code, approval, onReview }: { code: string; approval: string; onReview: (code: string, action: "approve" | "reject" | "stage" | "withdraw") => void }) {
  if (approval === "approved" || approval === "locked") {
    return <div className="actions"><button className="link-button" onClick={() => onReview(code, "stage")}>Move to staged</button><button className="link-button" onClick={() => onReview(code, "withdraw")}>Withdraw</button></div>;
  }
  if (approval === "rejected" || approval === "withdrawn") {
    return <div className="actions"><button className="link-button" onClick={() => onReview(code, "stage")}>Move to staged</button><button className="link-button" onClick={() => onReview(code, "approve")}>Approve</button></div>;
  }
  return <div className="actions"><button onClick={() => onReview(code, "approve")}>Approve</button><button className="link-button" onClick={() => onReview(code, "reject")}>Reject</button></div>;
}

function formatOptional(value?: number) {
  return value == null ? "" : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function titleFor(view: View) {
  return ({ estimate: "Create an estimate", buy: "What to buy", build: "What to build", learn: "Learn from actuals", library: "Master library", history: "Estimate history" })[view];
}
