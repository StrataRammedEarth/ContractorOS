import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "../output/contractoros-productivity-staging";
const today = "2026-06-20";

const sources = [
  ["Tender-BOQ-House-Botha-July-2024-1.pdf", "PDF", "BOQ / validation", "Real South African BOQ structure", "validated", "Use for assembly decomposition and validation quantities only; no priced rates.", "https://drive.google.com/file/d/1L3y3oLTS-DLIDwKIBUqGyvKJjrtDtt3I/view?usp=drivesdk"],
  ["0_epwsp_labour_based_methods_for_earthworks_cidb-1.pdf", "PDF", "Labour productivity", "South African CIDB/EPWP earthworks methods", "canonical", "Best candidate for South African labour-based earthworks productivity assumptions; still requires owner approval before active use.", "https://drive.google.com/file/d/1jqm87LEuEGnRhoxkIEnq1lB9_FWx1aAZ/view?usp=drivesdk"],
  ["Labour Output-2_260614_201923.pdf", "PDF", "Labour productivity", "Non-SA labour output comparator", "reference-only", "Useful cross-check for activity constants; not direct ContractorOS authority.", "https://drive.google.com/file/d/1etT_rhAzUaotyQ4weFga_Tt5bbRAV1Hu/view?usp=drivesdk"],
  ["Establishing Appropriate Labour Output Rate for Increased Site Work Productivity of Building Projects in Owerri Metropolis-Imo State-Nigeria.pdf", "PDF", "Labour productivity", "Nigeria work-sampling paper", "provisional", "Useful methodology and comparator values; not South African canonical data.", "https://drive.google.com/file/d/1JNGG4uhzvaXzytgHzHfbK1M1eEp50_1Z/view?usp=drivesdk"],
  ["ContractorOS output data_260614_202725.pdf", "PDF", "Resource constants", "Spon's Construction Resource Handbook 1998", "reference-only", "Broad UK resource constants; use as comparator only because of age, geography, and licensing.", "https://drive.google.com/file/d/1Qbez5X8By7XNT6YriYJbNqg1Ci5OiQGV/view?usp=drivesdk"],
  ["ASAQS Elemental Classification - Version 4", "Google Sheet", "Classification", "ASAQS elemental framework", "reference-only", "Governance/classification reference, not pricing or productivity data.", "https://docs.google.com/spreadsheets/d/1eBj_avkghVBR_aBBVENzhXCwbFNN50iJeNAr1KBa_hs/edit?usp=drivesdk"],
  ["PIETERSE_Elemental_Framework_v1.csv", "CSV", "Classification / assembly mapping", "Pieterse elemental model", "requires-review", "Maps plumbing to PLB-000, which conflicts with current bottom-up ContractorOS plumbing governance.", "https://drive.google.com/file/d/1nwAXWllmeQYn5TOQ-ZUftz1Ct-CbiGvq/view?usp=drivesdk"],
  ["PIETERSE_Features_Library_v1.csv", "CSV", "Feature library", "Predictor and scope input features", "provisional", "Useful for scope/input schema and benchmark modeling, not direct pricing.", "https://drive.google.com/file/d/11gseqnNfa9SeZsvBTUK4UPgRxLxjLKQU/view?usp=drivesdk"],
  ["PIETERSE_Unit_Rates_Baseline_2021.csv", "CSV", "Reference rates", "2021 baseline unit rates", "provisional", "Reference baseline only; several plumbing rows superseded by ContractorOS component kit approach.", "https://drive.google.com/file/d/1uSTejV6-jLwy4OYd2BQqW2ZCDD5whuuC/view?usp=drivesdk"],
  ["PIETERSE_Case_Library_v1.csv", "CSV", "Validation cases", "Reference building cases", "provisional", "Useful for model validation and benchmark structure; not direct import as rates.", "https://drive.google.com/file/d/1BPt4FE8IqJmygdp0uPb1RUCHebD4yGPI/view?usp=drivesdk"],
  ["Guidelines-for-Designing-Affordable-Innovative-Building-Tech.pdf", "PDF", "Design constraints", "NHBRC IBT guideline", "reference-only", "Useful for design and compliance assumptions; not productivity or pricing source.", "https://drive.google.com/file/d/1wu7Lp6eCy40Emok6_NtxnyGvQHYM3Edt/view?usp=drivesdk"],
  ["consumable supplies .csv", "CSV", "Material candidates", "Consumable prices and stock sections", "malformed", "High value but must be cleaned: embedded sections, formula errors, stock/procurement columns mixed with materials.", "https://drive.google.com/file/d/1iBgcbMY8ee9FFYRpgxuqE6kSNFz5ALlI/view?usp=drivesdk"],
  ["main material list.csv", "CSV", "Material candidates", "Main material prices and stock sections", "malformed", "High value but must be cleaned: preamble rows, appended tables, formula artifacts, status/procurement mixed with materials.", "https://drive.google.com/file/d/1kYNcsZ8V0T7iHM4JbQPyGGgH6NBAu34F/view?usp=drivesdk"],
];

const productivity = [
  ["EARTH-CLEAR-BUSH-MED", "Earthworks", "Medium dense bush clearing", "m2", "Labour-based hand clearing", "South Africa", "Worker", "", 500, 0.016, "Provisional", "canonical", "pending", true, "CIDB EPWP earthworks Table 1", "0_epwsp_labour_based_methods_for_earthworks_cidb-1.pdf", "https://drive.google.com/file/d/1jqm87LEuEGnRhoxkIEnq1lB9_FWx1aAZ/view?usp=drivesdk", "2005-03-01", "Stage as provisional; owner approval required before active use."],
  ["EARTH-CLEAR-GRASS", "Earthworks", "Grass clearing", "m2", "Labour-based hand clearing", "South Africa", "Worker", "", 124, 0.065, "Provisional", "canonical", "pending", true, "CIDB EPWP earthworks Table 1", "0_epwsp_labour_based_methods_for_earthworks_cidb-1.pdf", "https://drive.google.com/file/d/1jqm87LEuEGnRhoxkIEnq1lB9_FWx1aAZ/view?usp=drivesdk", "2005-03-01", "Stage as provisional; owner approval required before active use."],
  ["EARTH-DESTUMP", "Earthworks", "Destumping", "m2", "Labour-based stump removal", "South Africa", "Worker", "", 85, 0.094, "Provisional", "canonical", "pending", true, "CIDB EPWP earthworks Table 1", "0_epwsp_labour_based_methods_for_earthworks_cidb-1.pdf", "https://drive.google.com/file/d/1jqm87LEuEGnRhoxkIEnq1lB9_FWx1aAZ/view?usp=drivesdk", "2005-03-01", "Stage as provisional; owner approval required before active use."],
  ["EARTH-GRUB-ROOT-250", "Earthworks", "Root grubbing to 250mm in soft loamy soil", "m2", "Labour-based grubbing", "South Africa", "Worker", "", 60, 0.133, "Provisional", "canonical", "pending", true, "CIDB EPWP earthworks Table 1", "0_epwsp_labour_based_methods_for_earthworks_cidb-1.pdf", "https://drive.google.com/file/d/1jqm87LEuEGnRhoxkIEnq1lB9_FWx1aAZ/view?usp=drivesdk", "2005-03-01", "Stage as provisional; owner approval required before active use."],
  ["EARTH-STRIP-GRUB", "Earthworks", "Stripping and grubbing task rate", "m2", "Labour-based task-rate planning", "South Africa", "Worker", "", 200, 0.04, "Provisional", "canonical", "pending", true, "CIDB EPWP earthworks Table 2", "0_epwsp_labour_based_methods_for_earthworks_cidb-1.pdf", "https://drive.google.com/file/d/1jqm87LEuEGnRhoxkIEnq1lB9_FWx1aAZ/view?usp=drivesdk", "2005-03-01", "Stage as planning assumption; factor down for site constraints."],
  ["MASON-BLOCK-GF-NG", "Masonry", "Block laying", "m2", "Work-sampled building sites", "Nigeria comparator", "Mason crew", 0.96, 7.68, 1.042, "Assumption", "reference-only", "pending", true, "Owerri productivity paper: average 64.8 min/m2", "Establishing Appropriate Labour Output Rate...Nigeria.pdf", "https://drive.google.com/file/d/1JNGG4uhzvaXzytgHzHfbK1M1eEp50_1Z/view?usp=drivesdk", "", "Comparator only; do not promote without South African validation."],
  ["CARP-FORMWORK-NG", "Carpentry", "Deck/forming carpentry", "m2", "Work-sampled building sites", "Nigeria comparator", "Carpentry crew", 1.54, 12.32, 0.649, "Assumption", "reference-only", "pending", true, "Owerri productivity paper: average 39 min/m2", "Establishing Appropriate Labour Output Rate...Nigeria.pdf", "https://drive.google.com/file/d/1JNGG4uhzvaXzytgHzHfbK1M1eEp50_1Z/view?usp=drivesdk", "", "Comparator only; do not use to lock deck rebuild."],
  ["EXC-HARD-DENSE-1P5-REF", "Earthworks", "Excavation hard or dense soil to 1.5m", "m3", "Manual excavation", "Non-SA comparator", "Mate and labourer", "", "", 5.44, "Assumption", "reference-only", "pending", true, "Labour Output PDF constants", "Labour Output-2_260614_201923.pdf", "https://drive.google.com/file/d/1etT_rhAzUaotyQ4weFga_Tt5bbRAV1Hu/view?usp=drivesdk", "", "Reference comparator only; region and method not aligned to ContractorOS authority."],
  ["CONC-HANDMIX-FOUND-REF", "Concrete", "Hand mixed concrete in foundation", "m3", "Hand mixing and placing", "Non-SA comparator", "Mason, labourer, water carrier", "", "", 23.44, "Assumption", "reference-only", "pending", true, "Labour Output PDF constants", "Labour Output-2_260614_201923.pdf", "https://drive.google.com/file/d/1etT_rhAzUaotyQ4weFga_Tt5bbRAV1Hu/view?usp=drivesdk", "", "Reference comparator only; should not become active without validation."],
  ["BRICK-ONE-THICK-REF", "Masonry", "One brick thick wall", "m2", "Manual brickwork", "Non-SA comparator", "Labourer and water carrier", "", "", 3.6, "Assumption", "reference-only", "pending", true, "Labour Output PDF constants", "Labour Output-2_260614_201923.pdf", "https://drive.google.com/file/d/1etT_rhAzUaotyQ4weFga_Tt5bbRAV1Hu/view?usp=drivesdk", "", "Reference comparator only; compare against SA masonry validation."],
  ["PLASTER-15MM-REF", "Masonry", "15mm plaster", "m2", "Manual plastering", "Non-SA comparator", "Mason, labourer, water carrier", "", "", 2.24, "Assumption", "reference-only", "pending", true, "Labour Output PDF constants", "Labour Output-2_260614_201923.pdf", "https://drive.google.com/file/d/1etT_rhAzUaotyQ4weFga_Tt5bbRAV1Hu/view?usp=drivesdk", "", "Reference comparator only; compare against local contractor actuals."],
];

const materialCandidates = [
  ["main material list.csv", "Decking, steel, aluminium, fixtures, canvas, procurement rows", "Supplier prices and stock records", "requires cleanup", "Split embedded sections, remove preamble/status rows, normalize material codes/units, remove formula errors, preserve supplier/date/source link.", "Do not import raw."],
  ["consumable supplies .csv", "Hardware, paint, consumables, sliding-door sections", "2026 consumable prices and stock records", "requires cleanup", "Split sections, remove stock-only and calculation rows, normalize units and prices, resolve false/error values.", "Do not import raw."],
  ["PIETERSE_Unit_Rates_Baseline_2021.csv", "Trade unit rates", "Reference rates", "provisional", "Keep as reference rate baseline; superseded plumbing rows must not override component kit records.", "Stage as validation/reference, not active material pricing."],
];

const assemblyCandidates = [
  ["Tender-BOQ-House-Botha-July-2024-1.pdf", "Earthworks", "Excavation, filling, cart-away, compaction, soil poisoning", "BOQ quantities", "Use to test assembly decomposition and validation quantities; no rate promotion."],
  ["Tender-BOQ-House-Botha-July-2024-1.pdf", "Concrete", "Concrete, formwork, joints, reinforcement", "BOQ quantities", "Useful for component-level scope mapping and benchmark checks."],
  ["Tender-BOQ-House-Botha-July-2024-1.pdf", "Masonry", "Half brick beamfilling, hollow walls, reinforcement, lintels, crack repairs", "BOQ quantities", "Useful for masonry assembly validation, not locked rates."],
  ["PIETERSE_Elemental_Framework_v1.csv", "Plumbing", "PLB-000 mapping", "conflict", "Flag because PLB-000 is superseded by bottom-up plumbing kit rebuild."],
  ["PIETERSE_Features_Library_v1.csv", "Estimate inputs", "Area, roof, wall, room, fitting features", "model structure", "Use to refine ContractorOS measurement/input schema."],
];

const queue = [
  ["P1", "Implement productivity_record import support", "done in app", "New governed record type with staging and owner approval pathway.", "Run tests and import sample CSV."],
  ["P1", "Stage CIDB earthworks records", "ready for owner review", "Canonical SA source, but values still need your final approval before active use.", "Owner approves or overrides candidate outputs."],
  ["P1", "Clean main material list", "not ready", "Malformed source with mixed sections and formula artifacts.", "Cleaned rows have unique codes, valid units, supplier, effective date, Drive link."],
  ["P1", "Clean consumable supplies list", "not ready", "Malformed source with embedded boxes/sections and stock fields.", "Cleaned consumables staged inactive with source lineage."],
  ["P2", "Reconcile Pieterse PLB-000 mapping", "requires review", "Conflicts with bottom-up plumbing kit governance.", "PLB-000 remains superseded; Pieterse row is reference only or remapped."],
  ["P2", "Use House Botha BOQ as validation case", "ready for staging", "Real SA BOQ structure without prices.", "Quantities mapped to assemblies and validation records."],
  ["P3", "Use non-SA productivity sources as comparators", "reference only", "Nigeria, Labour Output, and Spon values are useful but not canonical.", "Records remain reference-only unless locally validated."],
];

const mapping = [
  ["Drive confidence High", "Validated", "Still owner approval required; not locked."],
  ["Drive confidence Medium", "Provisional", "Can be staged for exercises with warning."],
  ["Drive confidence Low", "Assumption", "Reference or placeholder only."],
  ["nr / each", "ea", "Approved unit normalization."],
  ["hrs / hr / hours", "hour", "Approved unit normalization."],
  ["litres / litre", "L", "Approved unit normalization."],
  ["canonical", "authority=canonical", "Source can control a data class after owner approval."],
  ["reference-only", "authority=reference-only", "Can inform review; cannot drive active estimates."],
  ["malformed", "authority=malformed", "Must be cleaned before import."],
  ["productivity_record", "governedRecords", "Visible staging evidence; not used in estimates until approved and wired into calculations."],
];

const productivityImportRows = [
  ["recordType", "code", "trade", "activity", "unit", "method", "region", "crew", "outputPerHour", "outputPerDay", "labourHoursPerUnit", "confidence", "source", "sourceUrl", "effectiveDate", "placeholder", "notes"],
  ...productivity.map((row) => ["productivity_record", row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[15], row[16], row[17], row[13], row[18]]),
];

function toCsv(rows) {
  return rows.map((row) => row.map((value) => {
    const text = value == null ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(",")).join("\r\n") + "\r\n";
}

function addSheet(workbook, name, rows, tableName, widths = []) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, rows.length, rows[0].length).values = rows;
  const used = sheet.getRangeByIndexes(0, 0, rows.length, rows[0].length);
  used.format = { font: { name: "Aptos", size: 10 }, wrapText: true };
  const header = sheet.getRangeByIndexes(0, 0, 1, rows[0].length);
  header.format = {
    fill: "#0D1B2A",
    font: { color: "#FFFFFF", bold: true },
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#0D1B2A" },
  };
  used.format.borders = { insideHorizontal: { style: "thin", color: "#D9E2EA" } };
  sheet.freezePanes.freezeRows(1);
  sheet.tables.add(`A1:${colName(rows[0].length)}${rows.length}`, true, tableName);
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, rows.length, 1).format.columnWidth = width;
  });
  return sheet;
}

function colName(index) {
  let value = "";
  while (index > 0) {
    const remainder = (index - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    index = Math.floor((index - 1) / 26);
  }
  return value;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const workbook = Workbook.create();

  const dashboard = workbook.worksheets.add("Executive Dashboard");
  dashboard.showGridLines = false;
  dashboard.getRange("A1:B1").merge();
  dashboard.getRange("A1").values = [["ContractorOS Governed Source-Data Staging Workbook"]];
  dashboard.getRange("A1").format = { fill: "#0D1B2A", font: { color: "#FFFFFF", bold: true, size: 16 }, horizontalAlignment: "center" };
  dashboard.getRange("A3:B10").values = [
    ["Audit date", today],
    ["Drive folder", "1SUugeP9DJ5uByxXDOpGPkV2rSY31yIHm"],
    ["Accessible source files", sources.length],
    ["Candidate productivity records", productivity.length],
    ["Import-ready productivity records", 5],
    ["Records requiring cleanup", 2],
    ["Owner approval model", "No record becomes approved or locked without owner approval."],
    ["Recommended next action", "Import the Productivity Import CSV sheet as productivity_record, then stage awaiting owner approval."],
  ];
  dashboard.getRange("A3:A10").format = { fill: "#EAF2F8", font: { bold: true } };
  dashboard.getRange("B3:B10").format.horizontalAlignment = "left";
  dashboard.getRange("A12:B12").values = [["Conclusion", "The CIDB earthworks source is the strongest South African productivity authority in this folder. Main material and consumable CSVs are high-value but malformed and should be cleaned before import. Non-SA productivity documents should remain reference-only comparators."]];
  dashboard.getRange("A12").format = { fill: "#F5A623", font: { bold: true, color: "#0D1B2A" } };
  dashboard.getRange("B12").format = { fill: "#FFF4DA", wrapText: true };
  dashboard.getRange("A3:H12").format = { font: { name: "Aptos", size: 10 }, wrapText: true };
  [32, 110].forEach((width, index) => {
    dashboard.getRangeByIndexes(0, index, 12, 1).format.columnWidth = width;
  });
  dashboard.getRange("A1:B1").format.rowHeight = 28;
  dashboard.getRange("A3:B10").format.rowHeight = 28;
  dashboard.getRange("A12:B12").format.rowHeight = 52;

  addSheet(workbook, "Source Inventory", [["Source file", "File type", "Domain", "Evidence class", "Authority", "Use in ContractorOS", "Drive URL"], ...sources], "SourceInventory", [38, 14, 18, 28, 16, 62, 72]);
  addSheet(workbook, "Productivity Candidates", [["Code", "Trade", "Activity", "Unit", "Method", "Region", "Crew", "Output/hour", "Output/day", "Labour hours/unit", "Confidence", "Authority", "Lifecycle", "Placeholder", "Evidence", "Source file", "Drive URL", "Effective date", "Recommended action"], ...productivity], "ProductivityCandidates", [22, 16, 34, 10, 30, 20, 22, 14, 14, 18, 14, 16, 14, 14, 36, 36, 72, 16, 48]);
  addSheet(workbook, "Productivity Import CSV", productivityImportRows, "ProductivityImportCsv", [20, 24, 16, 34, 10, 30, 20, 22, 15, 15, 18, 14, 38, 72, 16, 14, 48]);
  addSheet(workbook, "Material Candidates", [["Source", "Scope", "Relevant data", "Status", "Required cleanup", "Import recommendation"], ...materialCandidates], "MaterialCandidates", [34, 34, 32, 18, 62, 34]);
  addSheet(workbook, "Assembly BOQ Candidates", [["Source", "Domain", "Candidate evidence", "Evidence type", "Recommended use"], ...assemblyCandidates], "AssemblyCandidates", [38, 18, 44, 20, 58]);
  addSheet(workbook, "Owner Approval Queue", [["Priority", "Action", "Status", "Evidence", "Acceptance criteria"], ...queue], "OwnerApprovalQueue", [12, 36, 22, 62, 62]);
  addSheet(workbook, "Vocabulary Mapping", [["Source vocabulary", "ContractorOS contract", "Rule"], ...mapping], "VocabularyMapping", [30, 30, 62]);

  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 300 },
    summary: "final formula error scan",
  });
  console.log(errors.ndjson);

  for (const sheetName of ["Executive Dashboard", "Source Inventory", "Productivity Candidates", "Productivity Import CSV", "Material Candidates", "Assembly BOQ Candidates", "Owner Approval Queue", "Vocabulary Mapping"]) {
    const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
    await fs.writeFile(`${outputDir}/${sheetName.replaceAll(" ", "_")}.png`, new Uint8Array(await preview.arrayBuffer()));
  }

  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(`${outputDir}/ContractorOS_Governed_Productivity_Staging_2026-06-20.xlsx`);
  await fs.writeFile(`${outputDir}/ContractorOS_Productivity_Import_2026-06-20.csv`, toCsv(productivityImportRows), "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
