import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = "https://drive.google.com/drive/folders/11dK-8qXg0M_vJQ90utyaiaDRlgtyHZOG";
const outputDir = path.resolve("audit_work/output");
const previewDir = path.resolve("audit_work/previews");
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const folderFiles = {
  "Root": ["Contractor Operating System Service (SaaS)"],
  "Validation": ["VAL-004_Source_Truth_Archive.csv", "19_Validation_Log-3.csv"],
  "Labour Productivity": ["Labour_productivity_library_clean", "SPONS_Productivity_Library_v1.csv", "04_Productivity_Library-1 (1).csv", "12_Plumbing_Productivity_Library-1.csv", "15_Plumbing_Resource_Consumption_Mapping.csv", "06_Revised_Productivity_Library-1.csv", "14_Plumbing_Resource_Library-1.csv", "PLUMB_Productivity_Library_v1.csv"],
  "Work in Progress": ["PIETERSE_Elemental_Framework_v1.csv", "PIETERSE_Features_Library_v1.csv", "PIETERSE_Unit_Rates_Baseline_2021.csv", "PIETERSE_Case_Library_v1.csv"],
  "Incoming": ["SPONS_Productivity_Library_v1-1.csv", "Validation_Log_v1-1.csv"],
  "Apps": ["ContractorOS_App-1.jsx", "ContractorOS_ConceptPlan.jsx"],
  "Assembly": ["Assembly_Scaling_Rules_v1.2-1.csv", "05_Assembly_Cost_Benchmarks (1).csv", "10_Plumbing_Assembly_Recipe-1.csv", "Assembly_Scaling_Rules_v1.1.csv", "16_Assembly_Scaling_Rules_v1.1-1.csv"],
  "Material": ["PLUMB_Material_Library_P1P2", "09_Plumbing_Asset_Library.csv", "11_Plumbing_Cost_Benchmarks.csv", "13_Plumbing_Cost_Benchmarks_v02.csv", "plumbing supplies .csv", "PLUMB_Asset_Library_v1.csv", "PLUMB_KB_v1.0_LOCKED-1.csv"],
  "Master": ["MASONRY_KB_v1-1.csv", "02_Decking_Asset_Library-1 (1).csv", "ContractorOS_Assumption_Library_v1 (1).csv", "03_ContractorOS_Writing_Modes-1 (1).txt", "01_ContractorOS_Architecture_v1-1 (1).txt", "Minimum_Charge_Rules_PLACEHOLDER.csv", "17_Minimum_Charge_Rules_PLACEHOLDER.csv", "18_Upgrade_Triggers.csv", "08_Client_Proposal_Generator.txt", "07_Commercial_Rules.csv"],
  "Source Data": ["Tender-BOQ-House-Botha-July-2024-1.pdf", "0_epwsp_labour_based_methods_for_earthworks_cidb-1.pdf", "Labour Output-2_260614_201923.pdf", "Establishing Appropriate Labour Output Rate for Increased Site Work Productivity of Building Projects in Owerri Metropolis-Imo State-Nigeria.pdf", "ContractorOS output data_260614_202725.pdf", "ASAQS Elemental Classification - Version 4", "Guidelines-for-Designing-Affordable-Innovative-Building-Tech.pdf", "consumable supplies .csv", "main material list.csv"],
  "Plumbing": ["PLUMB_DEP_Assemblies_Costed_v1.csv", "PLUMB_Bathroom_Benchmark_v1.csv", "PLUMB_Dependency_Library_v1.csv"],
  "Master/Latest Files": ["12_Plumbing_Productivity_Library", "12_Plumbing_Productivity_Library.csv", "11_Plumbing_Cost_Benchmarks.csv", "10_Plumbing_Assembly_Recipe.csv", "09_Plumbing_Asset_Library.csv", "06_Assumption_Library.csv", "05_Assembly_Cost_Benchmarks.csv", "04_Productivity_Library.csv", "03_Writing_Modes.txt", "02_Asset_Library.csv", "01_Architecture.txt", "ContractorOS_Assumption_Library_v1.csv", "06_Revised_Productivity_Library.csv", "05_Assembly_Cost_Benchmarks.csv", "04_Productivity_Library-1.csv", "03_ContractorOS_Writing_Modes-1.txt", "02_Decking_Asset_Library-1.csv", "01_ContractorOS_Architecture_v1-1.txt"],
  "Archive": [],
  "Master/Knowledge Base": [],
};

const canonicalNames = new Set([
  "Assembly_Scaling_Rules_v1.2-1.csv", "PLUMB_KB_v1.0_LOCKED-1.csv",
  "PLUMB_Productivity_Library_v1.csv", "14_Plumbing_Resource_Library-1.csv",
  "15_Plumbing_Resource_Consumption_Mapping.csv", "07_Commercial_Rules.csv",
  "MASONRY_KB_v1-1.csv", "VAL-004_Source_Truth_Archive.csv", "19_Validation_Log-3.csv",
]);
const malformedNames = new Set(["PLUMB_Material_Library_P1P2", "Labour_productivity_library_clean"]);
const provisionalNames = new Set(["Minimum_Charge_Rules_PLACEHOLDER.csv", "17_Minimum_Charge_Rules_PLACEHOLDER.csv", "18_Upgrade_Triggers.csv"]);

const inventory = [];
let inventoryId = 1;
for (const [folder, names] of Object.entries(folderFiles)) {
  for (const name of names) {
    const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "google-workspace";
    let authority = "Reference-only";
    let lifecycle = "Reference";
    if (canonicalNames.has(name)) { authority = "Canonical"; lifecycle = "Current exploration"; }
    else if (malformedNames.has(name)) { authority = "Malformed"; lifecycle = "Requires review"; }
    else if (provisionalNames.has(name)) { authority = "Provisional"; lifecycle = "Not release-ready"; }
    else if (folder === "Incoming") { authority = "Requires review"; lifecycle = "Incoming"; }
    else if (folder === "Work in Progress") { authority = "Provisional"; lifecycle = "Work in progress"; }
    else if (folder === "Master/Latest Files" || /v1\.1|-\d\.csv|\(1\)/.test(name)) { authority = "Duplicate/superseded candidate"; lifecycle = "Historical/candidate"; }
    inventory.push([
      `SRC-${String(inventoryId++).padStart(3, "0")}`, folder, name, ext, "2026-06-13 to 2026-06-15",
      lifecycle, authority, canonicalNames.has(name) ? "Deep reconciled" : "Inventoried/classified", root,
    ]);
  }
}

const findings = [
  ["F-001","Critical","Supersession and structural rebuild","DCK-001","The owner confirmed R12,667.25 as the currently accepted value and R22,142.25 as incorrect/superseded, but also confirmed the deck benchmark was an example that must be rebuilt from raw materials, labour, and components.","The current value may support exploration, but it must not be treated as a completed governed benchmark.","Mark R22,142.25 superseded; label R12,667.25 as an exploration placeholder; rebuild DCK-001 using the standard bottom-up costing method.","Data governance"],
  ["F-002","Critical","Duplicate identifiers","PLB-P1 material codes","The PLUMB_Material_Library_P1P2 sheet reuses codes for different products and includes an appended malformed section.","Importing this source can silently overwrite unrelated products because the app treats code as the material identity.","Quarantine malformed sheet; rebuild with globally unique material codes and a duplicate-code gate.","Source cleanup"],
  ["F-003","High","Schema mismatch","Confidence","Drive sources use High/Medium/Low and Mixed, while the app accepts Locked/Validated/Provisional/Assumption/Unknown.","Confidence cannot be imported without a governed mapping and may be overstated.","Adopt an explicit mapping table with no automatic promotion to Locked.","Import pipeline"],
  ["F-004","High","Unit mismatch","nr, hrs, litres, Day","The app material importer only approves m, m2, m3, ea, set, L, kg, roll, box, tube, pack, pts, day, hour.","Valid source records are rejected or normalized inconsistently.","Create canonical unit vocabulary and aliases; validate by record type.","Import pipeline"],
  ["F-005","High","Import coverage gap","Library record types","The database supports material, resource, assembly, commercial_rule, assumption, validation, and source, but the UI/import reviewer only imports materials.","Governed sources cannot flow through a single controlled promotion process.","Implement record-type-specific import adapters, staging, review, and approval.","Import pipeline"],
  ["F-006","High","Rate basis conflict","PLM-LAB-001","Source resource library stores Plumbing Assistant as R260/day; app seed stores R32.50/hour. These are equivalent only under an implicit 8-hour day.","Changing workday assumptions can create silent labour variance.","Store rate basis and conversion assumptions explicitly; reconcile before use.","Estimating engine"],
  ["F-007","High","Inactive top-down plumbing benchmarks","PLB-000 / PLB-003","PLB-000 is R6,731.01 and PLB-003 is R8,191.02, but the owner confirmed neither should remain an active estimate option.","Top-down package totals can bypass the intended material/component/kit calculation method.","Retain both as historical test evidence only; rebuild selectable plumbing estimates bottom-up from approved materials, components, kits, labour, and documented assumptions.","Estimating engine"],
  ["F-008","Medium","Encoding defect","Productivity and UI text","The cleaned productivity sheet begins with a BOM/encoding artifact; the app UI contains visible mojibake such as 'Â·'.","Exports and user-facing content can display corrupted characters.","Normalize UTF-8 on ingestion and add encoding regression checks.","Source cleanup"],
  ["F-009","Medium","Exploration placeholders","Waste/risk/contingency/margin","Commercial defaults are intentionally usable during exploration: waste 5-10%, risk 5%, contingency 10%, margin 25% under review, and VAT locked at 15%.","Placeholder values are useful for R&D but may be mistaken for permanently approved policy if status is hidden.","Keep placeholders usable; flag their status internally, record changes, and show non-final-estimate terms with any warnings in an accompanying customer disclaimer.","Data governance"],
  ["F-010","Medium","Validation evidence model","VAL-001 to VAL-004","The owner set a 10% acceptable variance and confirmed that recognized quantity-surveying publications, registered authorities, industry data, quotes, and project results may all support validation.","A quote-only validation workflow would overstate inconsistent contractor quotes and omit stronger industry evidence.","Define a multi-source evidence standard and record the owner's final approval decision for each Locked promotion.","Validation"],
  ["F-011","Medium","Masonry approval state","BRK assemblies","Masonry rates match MASONRY_KB v1 and tests. The owner confirmed masonry may be Locked when explicitly approved by the owner.","The current dataset does not clearly distinguish owner-approved Locked records from exploration assumptions.","Retain current confidence until explicit owner approval is recorded; allow estimates with the accompanying non-final-estimate disclaimer.","Validation"],
  ["F-012","Medium","Source and approval traceability","Seed records","App seed source fields often contain filenames or update IDs but no durable Drive IDs, effective dates, source record version, or approval record.","A reviewer cannot reliably trace a value or determine whether it is a placeholder, approved, or Locked.","Persist source links, effective dates, lifecycle status, approval role, approval event, and supersession links. Approver display name can be deferred during exploration.","Data governance"],
  ["F-013","Low","Lifecycle and retention governance","Full Drive root","Accessible files span candidate, duplicate, source, and current-release locations; Archive and Knowledge Base folders are empty.","Users must infer authority and retention from filenames and folder placement.","Publish lifecycle metadata; archive superseded records and retain them for one year from archive date before deletion.","Data governance"],
  ["F-014","Low","PDF evidence extraction","Source Data PDFs","PDFs are inventoried as reference evidence but are not connected to promoted records through page-level citations.","Validation claims can be hard to audit later.","Require source document, page/table, extraction date, and reviewer for promoted PDF-derived records.","Data governance"],
];

const mappings = [
  ["Confidence","High","Validated","Never maps to Locked without explicit governance lock"],
  ["Confidence","Medium","Provisional","Requires review before final estimate"],
  ["Confidence","Low","Assumption","Flag internally and include in the accompanying customer disclaimer"],
  ["Confidence","Mixed","Provisional","Preserve component-level confidence in notes"],
  ["Unit","nr","ea","Alias only when item is a discrete count"],
  ["Unit","hrs / hr","hour","Normalize singular unit"],
  ["Unit","Day / day","day","Normalize case"],
  ["Unit","litres","L","Normalize SI display"],
  ["Unit","m²","m2","Normalize Unicode square unit"],
  ["Unit","m³","m3","Normalize Unicode cubic unit"],
  ["Status","LOCKED","active + Locked confidence","Lock state should be separate from lifecycle status"],
  ["Status","PROVISIONAL","active + Provisional/Assumption","Usable for exploration; retain internal flag and accompanying disclaimer"],
  ["Trade","Construction","Decking or explicit trade","Generic construction is too broad for app Trade union"],
];

const benchmarks = [
  ["PLB-000","Standard Africamps Plumbing Package",6731.01,6731.01,0,"Historical test only","Do not offer as an active estimate option; rebuild from approved components and kits."],
  ["PLB-003","Sanitary Fixture Installation roll-up",8191.02,null,null,"Historical test only","Do not offer as an active estimate option; rebuild bottom-up."],
  ["DCK-001","Deck Construction 25m2",22142.25,12667.25,-9475.00,"Accepted placeholder; rebuild required","R22,142.25 is superseded. R12,667.25 may support exploration but must be rebuilt from raw materials, labour, and components."],
  ["BRK-001","Half Brick Wall face 1 side",417.70,417.70,0,"Exploration-ready","Matches source and test; may become Locked only through explicit owner approval."],
  ["BRK-002","One Brick Wall face 1 side",779.90,779.90,0,"Exploration-ready","Matches source; may become Locked only through explicit owner approval."],
  ["Commercial","Waste / Risk / Contingency / Margin","5-10 / 5 / 10 / 25","5 / 5 / 10 / 25",0,"Exploration defaults","Waste is configurable from 5-10%; margin 25% remains usable while under review."],
];

const canonicalMatrix = [
  ["Materials - locked plumbing","PLUMB_KB_v1.0_LOCKED-1.csv","Canonical","Current release","Keep locked; add exact Drive source ID/effective date."],
  ["Materials - expanded plumbing","PLUMB_Material_Library_P1P2","Malformed","Quarantine","Rebuild before promotion."],
  ["Assemblies/scaling","Assembly_Scaling_Rules_v1.2-1.csv","Canonical exploration source","Current exploration","Publish explicit supersession of v1.1 and rebuild the deck benchmark bottom-up."],
  ["Plumbing productivity","PLUMB_Productivity_Library_v1.csv","Canonical","Current release","Map activities to resources and normalize units."],
  ["Resource rates","14_Plumbing_Resource_Library-1.csv","Canonical","Current release","Make hour/day conversion basis explicit."],
  ["Resource consumption","15_Plumbing_Resource_Consumption_Mapping.csv","Canonical","Current release","Reconcile daily resources with hourly app labour."],
  ["Commercial rules","07_Commercial_Rules.csv","Canonical exploration assumption","Current exploration","Keep defaults usable, flag placeholders internally, and record user changes."],
  ["Masonry knowledge base","MASONRY_KB_v1-1.csv","Canonical provisional","Current exploration","Promote to Locked only after explicit owner approval."],
  ["Deck trace evidence","VAL-004_Source_Truth_Archive.csv","Validated historical","Superseded pricing evidence","Do not use as current price authority."],
  ["Validation register","19_Validation_Log-3.csv","Canonical validation register","Current exploration","Add evidence type, source, variance where applicable, owner decision, and dates."],
  ["External productivity sources","SPONS/Pieterse/PDF sources","Reference-only","Research","Promote individual records only after contextual validation."],
];

const remediation = findings.map((f, i) => [
  `R-${String(i+1).padStart(3,"0")}`, f[1], f[7], f[2], f[3], f[6],
  f[1] === "Critical" ? "Before governed promotion" : f[1] === "High" ? "Next exploration cycle" : "Planned", "Open",
]);

const linearIssues = [
  ["COS-AUD-001","P0","Data governance","Supersede and rebuild DCK-001 bottom-up","F-001","Retain R12,667.25 only as an accepted exploration placeholder and rebuild the deck benchmark from raw materials, labour, and components.","R22,142.25 is marked superseded; R12,667.25 is labeled placeholder; rebuilt assembly has traceable components, labour, and owner approval status."],
  ["COS-AUD-002","P0","Source cleanup","Rebuild malformed PLUMB material library with unique codes","F-002","Quarantine the malformed sheet and generate a clean, deduplicated material dataset.","No duplicate codes; appended malformed section removed; all rows pass unit, price, and source checks."],
  ["COS-AUD-003","P1","Import pipeline","Add governed vocabulary normalization","F-003,F-004,F-008","Normalize confidence, units, status, and encoding before staged review.","All supported aliases map deterministically; unknown values block approval; UTF-8 regression fixtures pass."],
  ["COS-AUD-004","P1","Import pipeline","Support all governed library record types","F-005","Extend controlled imports beyond materials.","Resource, assembly, rule, assumption, validation, and source imports stage inactive and require approval."],
  ["COS-AUD-005","P1","Estimating engine","Make resource rate basis and workday conversion explicit","F-006","Prevent silent day/hour conversion variance.","Resource records include rate basis and hours/day; PLM-LAB-001 reconciles to R260/day and R32.50/hour."],
  ["COS-AUD-006","P1","Estimating engine","Replace active plumbing package totals with bottom-up kits","F-007","Retain PLB-000 and PLB-003 as historical test evidence only and build selectable estimates from materials, components, kits, labour, and assumptions.","Top-down totals are not active estimate options; each selectable kit has traceable children, calculation logic, and owner approval status."],
  ["COS-AUD-007","P1","Data governance","Implement exploration placeholder and disclaimer controls","F-009","Allow placeholder values for R&D without presenting them as permanent approved policy.","Placeholders are internally flagged; changes are logged; customer output includes a separate non-final-estimate disclaimer with applicable warnings."],
  ["COS-AUD-008","P2","Validation","Implement multi-source validation and owner lock approval","F-010,F-011","Support industry publications, recognized authorities, quotes, project results, and owner decisions as validation evidence.","Evidence type and source are recorded; applicable comparisons use a 10% tolerance; only an explicit owner decision can set Locked."],
  ["COS-AUD-009","P2","Data governance","Persist durable source and approval lineage","F-012,F-014","Make every promoted record auditable to exact source evidence and approval event.","Records store Drive source URL, page/table where applicable, effective date, approval role/event, lifecycle state, and supersession link."],
  ["COS-AUD-010","P2","Data governance","Publish lifecycle and one-year archive-retention policy","F-013","Replace filename-based authority inference with explicit lifecycle and retention metadata.","Every file has a lifecycle classification; superseded records archive before deletion; deletion cannot occur until one year after archive date."],
];

const governanceDecisions = [
  ["Governance model","Operating stage","Exploration / research and development","Use structure and traceability without treating placeholder data as final production policy."],
  ["Governance model","Final authority","Sole owner approval","All permanent data changes, promotions, locks, and overrides require the owner's final approval."],
  ["Governance model","Approver display name","Deferred","Record the owner approval role/event now; decide the formal display name later."],
  ["Permissions","User configuration","Allowed within system-defined parameters","Users may change configurable percentages and options; highlight changes to prevent mistakes."],
  ["Permissions","Override controls","Owner only","Only the owner may bypass system controls or approve an exception."],
  ["Data state","Placeholder use","Allowed for exploration","Placeholders must be internally flagged, sourced, dated, and prevented from silently becoming Locked."],
  ["Confidence","High source confidence","Validated","Never promote automatically to Locked."],
  ["Confidence","Medium source confidence","Provisional","Usable for exploration with internal status."],
  ["Confidence","Low source confidence","Assumption","Usable for exploration with internal status and accompanying customer disclaimer."],
  ["Lifecycle","Locked promotion","Explicit owner approval only","A record becomes Locked when the owner approves it."],
  ["Lifecycle","Archive retention","One year from archive date","After one year, deletion may occur under the agreed lifecycle process."],
  ["Materials","Duplicate codes","Block","Every material record needs a unique full code; related items may share a prefix."],
  ["Materials","Supplier-price review","Annual","Review supplier prices once per year."],
  ["Imports","Supported scope","All governed record types and external sources","Stage and present imports with reasoning for owner approval."],
  ["Imports","Missing required source","Flag and hold","Proceed only after explicit owner exception approval."],
  ["Units","Aliases","nr->ea; litres->L; hrs/hr->hour; m2/m3 normalized","Apply governed normalization before review."],
  ["Labour","Working day","8 hours","R260/day equals R32.50/hour for the approved plumbing assistant rate."],
  ["Commercial","Waste","Configurable 5-10%","Exploration default may be 5%; record user changes."],
  ["Commercial","Risk / contingency","5% / 10% defaults","Users may change values within supported parameters; highlight changes."],
  ["Commercial","Margin","25% placeholder under review","Remain usable for exercises; flag internally as under review."],
  ["Commercial","VAT","Locked at 15%","Not user-configurable without owner action."],
  ["Validation","Acceptable variance","10% where a comparison is applicable","Validation is not limited to contractor quotes."],
  ["Validation","Evidence sources","Industry publications, registered authorities, quotes, and project results","Owner makes the final promotion/lock decision."],
  ["Customer output","Estimate status","Always an estimate, not a final binding quote","Customer/user remains responsible for inspections, review, and final quote approval."],
  ["Customer output","Warnings","Separate accompanying disclaimer","Do not display warnings inside estimate line items; list applicable warnings with the non-final-estimate clause."],
];

const wb = Workbook.create();
const palette = { navy:"#132238", blue:"#2176AE", teal:"#2A9D8F", amber:"#F4A261", red:"#D1495B", pale:"#EEF4F8", white:"#FFFFFF", ink:"#1E293B", gray:"#64748B" };
function addSheet(name) {
  const s = wb.worksheets.add(name);
  s.showGridLines = false;
  return s;
}
function title(s, text, subtitle, endCol="H") {
  s.mergeCells(`A1:${endCol}1`); s.getRange("A1").values=[[text]];
  s.mergeCells(`A2:${endCol}2`); s.getRange("A2").values=[[subtitle]];
  s.getRange(`A1:${endCol}1`).format={fill:palette.navy,font:{bold:true,color:palette.white,size:18},horizontalAlignment:"left",verticalAlignment:"center"};
  s.getRange(`A2:${endCol}2`).format={fill:palette.pale,font:{color:palette.gray,italic:true,size:10},wrapText:true};
  s.getRange("1:1").format.rowHeight=30; s.getRange("2:2").format.rowHeight=28;
}
function tableSheet(name, subtitle, headers, rows, widths) {
  const s=addSheet(name); const endCol=String.fromCharCode(64+headers.length);
  title(s,name,subtitle,endCol);
  s.getRange(`A4:${endCol}${4+rows.length}`).values=[headers,...rows];
  s.getRange(`A4:${endCol}4`).format={fill:palette.blue,font:{bold:true,color:palette.white},wrapText:true};
  s.getRange(`A5:${endCol}${4+rows.length}`).format={font:{color:palette.ink,size:9},wrapText:true,borders:{preset:"all",style:"thin",color:"#D7E0E8"}};
  s.freezePanes.freezeRows(4);
  widths.forEach((w,i)=>s.getRangeByIndexes(0,i,Math.max(rows.length+4,5),1).format.columnWidth=w);
  if(rows.length) s.tables.add(`A4:${endCol}${4+rows.length}`,true,`${name.replace(/[^A-Za-z0-9]/g,"")}Table`);
  return s;
}

const dashboard=addSheet("Executive Dashboard");
title(dashboard,"ContractorOS End-to-End Data Audit","Read-only audit completed June 15, 2026 | Full-folder inventory, exploration-stage governance","L");
dashboard.getRange("A4:L4").merge(); dashboard.getRange("A4").values=[["Overall assessment: EXPLORATION-READY under owner-controlled governance; not production-ready"]];
dashboard.getRange("A4:L4").format={fill:"#FFF4DB",font:{bold:true,color:"#8A4B08",size:13},horizontalAlignment:"center"};
const cards=[["Accessible files",inventory.length],["Controlling sources",canonicalNames.size],["Critical findings",findings.filter(x=>x[1]==="Critical").length],["High findings",findings.filter(x=>x[1]==="High").length]];
cards.forEach((c,i)=>{const col=1+i*3; const a=dashboard.getRangeByIndexes(5,col-1,2,2); a.merge(); a.values=[[`${c[1]}\n${c[0]}`]]; a.format={fill:i<2?palette.teal:palette.red,font:{bold:true,color:palette.white,size:12},wrapText:true,horizontalAlignment:"center",verticalAlignment:"center",borders:{preset:"outside",style:"medium",color:palette.white}};});
dashboard.getRange("A9:L9").merge(); dashboard.getRange("A9").values=[["Executive Summary"]];
dashboard.getRange("A9:L9").format={fill:palette.blue,font:{bold:true,color:palette.white,size:12}};
const summary=[
  ["A10:L10","ContractorOS is an exploration-stage operating system. Placeholder values may remain usable for research and exercises when they are internally flagged, sourced, dated, and prevented from silently becoming approved or Locked."],
  ["A11:L11","The owner is the sole final approver for permanent data changes, promotions, locks, exceptions, and overrides. Users may configure values only within system-defined parameters."],
  ["A12:L12","The deck and plumbing package benchmarks must be rebuilt bottom-up. Duplicate material codes remain blocked, and the malformed expanded plumbing sheet remains excluded until cleaned."],
  ["A13:L13","Customer outputs remain estimates rather than binding final quotes. Assumptions and warnings belong in a separate accompanying disclaimer, while detailed status remains visible internally."],
];
for(const [r,t] of summary){dashboard.getRange(r).merge(); dashboard.getRange(r).values=[[t]]; dashboard.getRange(r).format={fill:palette.pale,font:{color:palette.ink,size:10},wrapText:true,borders:{preset:"outside",style:"thin",color:"#D7E0E8"}};}
dashboard.getRange("A15:F15").values=[["Priority","Count","Priority","Count","Authority class","Files"]];
dashboard.getRange("A16:B19").values=[["Critical",findings.filter(x=>x[1]==="Critical").length],["High",findings.filter(x=>x[1]==="High").length],["Medium",findings.filter(x=>x[1]==="Medium").length],["Low",findings.filter(x=>x[1]==="Low").length]];
dashboard.getRange("C16:D19").values=[["Before governed promotion",remediation.filter(x=>x[6]==="Before governed promotion").length],["Next exploration cycle",remediation.filter(x=>x[6]==="Next exploration cycle").length],["Planned",remediation.filter(x=>x[6]==="Planned").length],["Total",remediation.length]];
const authCounts=[...new Set(inventory.map(x=>x[6]))].map(a=>[a,inventory.filter(x=>x[6]===a).length]);
dashboard.getRange(`E16:F${15+authCounts.length}`).values=authCounts;
dashboard.getRange("A15:F15").format={fill:palette.blue,font:{bold:true,color:palette.white}};
dashboard.getRange(`A16:F${Math.max(19,15+authCounts.length)}`).format={borders:{preset:"all",style:"thin",color:"#D7E0E8"},font:{size:9}};
const chartData=dashboard.getRange("A15:B19");
const chart=dashboard.charts.add("bar",chartData); chart.title="Validated findings by severity"; chart.hasLegend=false; chart.setPosition("H15","L29");
dashboard.getRange("A: L").format.columnWidth=14;
dashboard.getRange("A:A").format.columnWidth=18; dashboard.getRange("C:C").format.columnWidth=22; dashboard.getRange("E:E").format.columnWidth=28;

tableSheet("Source Inventory","Every accessible file observed exactly once; empty Archive and Knowledge Base folders noted separately.",["Source ID","Folder","File","Type","Modified","Lifecycle","Authority","Audit depth","Folder link"],inventory,[12,24,40,18,22,22,28,22,34]);
tableSheet("Governance Decisions","Owner-confirmed operating rules for the current exploration and research stage.",["Area","Decision","Approved rule","Implementation note"],governanceDecisions,[24,30,48,70]);
tableSheet("Canonical Matrix","Recommended authority and lifecycle treatment by source family.",["Domain","Controlling source","Authority","Lifecycle treatment","Required action"],canonicalMatrix,[28,38,26,28,58]);
tableSheet("Reconciliation Findings","Validated findings prioritized by governance and exploration impact.",["Finding","Severity","Category","Affected records","Evidence","Impact","Recommended action","Workstream"],findings,[12,12,22,24,62,52,58,22]);
tableSheet("Duplicate Conflicts","Confirmed duplicate, scope, and authority conflicts requiring resolution.",["Conflict","Severity","Records","Conflict detail","Resolution"],[
  ["DC-001","Critical","PLB-P1 material codes","Same codes are reused for unrelated products inside the malformed appended material sheet.","Rebuild with globally unique codes; quarantine current sheet."],
  ["DC-002","Critical","DCK-001","R22,142.25 is superseded; current R12,667.25 remains an exploration placeholder pending a bottom-up rebuild.","Publish supersession and rebuild from raw materials, labour, and components."],
  ["DC-003","High","PLB-000 / PLB-003","Top-down package totals do not follow the intended bottom-up estimating philosophy.","Retain as historical test evidence only and replace active options with component-based kits."],
  ["DC-004","Medium","Assembly Scaling v1.1 / v1.2","Multiple versioned copies exist across Assembly and Master/Latest Files.","Declare v1.2 canonical and supersede prior copies."],
  ["DC-005","Medium","Productivity libraries","Spon's, revised, clean, plumbing, and copied variants coexist without record-level promotion status.","Promote reviewed records individually; keep external sources reference-only."],
],[12,12,25,65,58]);
tableSheet("Vocabulary Mapping","Explicit normalization required before governed imports can be approved.",["Vocabulary","Source value","App target","Governance rule"],mappings,[18,24,28,62]);
const bs=tableSheet("Benchmark Validation","Independent reconciliation of high-impact exploration benchmarks.",["Code","Benchmark","Source value","App value","Variance","Assessment","Evidence note"],benchmarks,[14,38,20,20,16,28,68]);
bs.getRange("C5:E10").format.numberFormat="#,##0.00";
tableSheet("Remediation Queue","Prioritized implementation queue derived from validated findings.",["Action ID","Severity","Workstream","Issue","Affected","Action","Target","Status"],remediation,[12,12,22,36,28,64,18,14]);
tableSheet("Linear Issue Staging","Issue-ready backlog. Creation blocked in this session because Linear tools were unavailable.",["Key","Priority","Workstream","Title","Findings","Description","Acceptance criteria"],linearIssues,[16,12,22,48,18,62,70]);

for (const sheet of wb.worksheets.items) {
  const used=sheet.getUsedRange();
  if (used) used.format.verticalAlignment="top";
}

const inspect = await wb.inspect({kind:"workbook,sheet,table",maxChars:5000,tableMaxRows:4,tableMaxCols:8});
await fs.writeFile(path.join(outputDir,"workbook_inspect.ndjson"),inspect.ndjson,"utf8");
const errors = await wb.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",options:{useRegex:true,maxResults:100},summary:"final formula error scan"});
await fs.writeFile(path.join(outputDir,"formula_errors.ndjson"),errors.ndjson,"utf8");
for (const sheet of wb.worksheets.items) {
  const blob=await wb.render({sheetName:sheet.name,autoCrop:"all",scale:0.8,format:"png"});
  await fs.writeFile(path.join(previewDir,`${sheet.name.replace(/[^A-Za-z0-9]+/g,"_")}.png`),new Uint8Array(await blob.arrayBuffer()));
}
const out=await SpreadsheetFile.exportXlsx(wb);
await out.save(path.join(outputDir,"ContractorOS_End_to_End_Data_Audit_2026-06-15.xlsx"));
await fs.writeFile(path.join(outputDir,"audit_summary.json"),JSON.stringify({
  auditDate:"2026-06-15", accessibleFiles:inventory.length, currentReleaseSources:canonicalNames.size,
  findings:findings.length, critical:findings.filter(x=>x[1]==="Critical").length,
  high:findings.filter(x=>x[1]==="High").length, medium:findings.filter(x=>x[1]==="Medium").length,
  low:findings.filter(x=>x[1]==="Low").length, linearIssues:linearIssues.length
},null,2));
console.log(JSON.stringify({inventory:inventory.length,findings:findings.length,sheets:wb.worksheets.items.map(s=>s.name)}));
