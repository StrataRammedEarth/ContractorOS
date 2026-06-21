import Papa from "papaparse";
import type { Assembly, CommercialRules, Confidence, Governance, ImportIssue, LifecycleStatus, Material, ProductivityRecord, RecordType, SourceLineage, StagedImportRecord, Trade } from "./types";

export const validUnits = new Set(["m", "m2", "m3", "ea", "set", "L", "kg", "roll", "box", "tube", "pack", "pts", "day", "hour"]);

const recordTypes = new Set<RecordType>(["material", "resource", "assembly", "commercial_rule", "assumption", "validation", "source", "productivity_record"]);
const unitAliases = new Map<string, string>([
  ["nr", "ea"],
  ["each", "ea"],
  ["litre", "L"],
  ["litres", "L"],
  ["liter", "L"],
  ["liters", "L"],
  ["hr", "hour"],
  ["hrs", "hour"],
  ["hours", "hour"],
  ["days", "day"],
  ["m²", "m2"],
  ["mÂ²", "m2"],
  ["m^2", "m2"],
  ["m³", "m3"],
  ["mÂ³", "m3"],
  ["m^3", "m3"],
]);

const sourceConfidenceMap: Record<string, Confidence> = {
  high: "Validated",
  medium: "Provisional",
  low: "Assumption",
  mixed: "Provisional",
  locked: "Locked",
  validated: "Validated",
  provisional: "Provisional",
  assumption: "Assumption",
  unknown: "Unknown",
};

const get = (row: Record<string, string>, names: string[]) => {
  for (const name of names) {
    const value = row[name];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
};

export function normalizeUnit(unit: string) {
  const trimmed = unit.trim();
  return unitAliases.get(trimmed) ?? unitAliases.get(trimmed.toLowerCase()) ?? trimmed;
}

export function normalizeConfidence(value: string): Confidence {
  return sourceConfidenceMap[value.trim().toLowerCase()] ?? "Unknown";
}

function governance(recordType: RecordType, placeholder: boolean): Governance {
  return {
    recordType,
    lifecycle: "pending",
    authority: placeholder ? "provisional" : "requires-review",
    approval: "staged",
    authorityState: "staged",
    placeholder,
    ownerApprovalRequired: true,
    reviewBy: "owner",
    notes: "Staged import. No permanent change is allowed without owner approval.",
  };
}

function lineage(source: string, sourceUrl: string, effectiveDate: string): SourceLineage {
  return {
    sourceFile: source || "CSV import",
    sourceUrl: sourceUrl || undefined,
    effectiveDate: effectiveDate || undefined,
  };
}

function issue(row: number, severity: ImportIssue["severity"], code: ImportIssue["code"], message: string): ImportIssue {
  return { row, severity, code, message };
}

const numberOr = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const tradeOr = (value: string): Trade => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "decking") return "Decking";
  if (normalized === "masonry") return "Masonry";
  if (normalized === "logistics") return "Logistics";
  return "Plumbing";
};

const parseRecipe = (value: string): Assembly["recipe"] => {
  if (!value) return [];
  return value.split(";").map((part) => {
    const [materialCode, quantity] = part.split(":").map((item) => item.trim());
    return { materialCode, quantity: Number(quantity) };
  }).filter((item) => item.materialCode && Number.isFinite(item.quantity));
};

const parseLabour = (value: string): Assembly["labour"] => {
  if (!value) return [];
  return value.split(";").map((part) => {
    const [resourceCode, quantity, activity] = part.split(":").map((item) => item.trim());
    return { resourceCode, quantity: Number(quantity), activity: activity || "Imported activity" };
  }).filter((item) => item.resourceCode && Number.isFinite(item.quantity));
};

export function reviewLibraryCsv(csv: string, existing: { recordType: RecordType; code: string }[], defaultRecordType: RecordType = "material") {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: true });
  const issues: ImportIssue[] = [];
  const accepted: StagedImportRecord[] = [];
  const seen = new Set<string>();

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;
    const rawType = get(row, ["recordType", "RecordType", "type", "Type"]) || defaultRecordType;
    const recordType = rawType.toLowerCase() as RecordType;
    const code = get(row, ["code", "Code", "MaterialCode", "CostCode", "ResourceCode", "AssemblyCode", "RuleCode"]);
    const source = get(row, ["source", "Source", "SourceFile", "sourceFile"]);
    const sourceUrl = get(row, ["sourceUrl", "SourceUrl", "DriveLink", "URL"]);
    const effectiveDate = get(row, ["effectiveDate", "EffectiveDate", "date", "Date"]);
    const confidence = normalizeConfidence(get(row, ["confidence", "Confidence", "SourceConfidence"]) || "Unknown");
    const placeholder = /true|yes|placeholder|assumption|provisional/i.test(get(row, ["placeholder", "Placeholder", "status", "Status", "confidence", "Confidence"]));

    if (!recordTypes.has(recordType)) {
      issues.push(issue(rowNumber, "error", "unsupported-record-type", `${rawType} is not a governed record type.`));
      return;
    }
    if (!code) issues.push(issue(rowNumber, "error", "conflict", "Code is required."));
    const duplicateKey = `${recordType}:${code}`;
    if (code && seen.has(duplicateKey)) issues.push(issue(rowNumber, "error", "duplicate", `${code} appears more than once for ${recordType} in this import.`));
    if (code && existing.some((item) => item.recordType === recordType && item.code === code)) {
      issues.push(issue(rowNumber, "warning", "conflict", `${code} conflicts with an existing ${recordType} and needs owner approval.`));
    }
    if (!source && !sourceUrl) issues.push(issue(rowNumber, "warning", "missing-source", `${code || "Row"} has no exact source file or Drive link.`));
    if (confidence === "Unknown") issues.push(issue(rowNumber, "warning", "invalid-confidence", `${code || "Row"} confidence was not recognized and is staged as Unknown.`));
    issues.push(issue(rowNumber, "warning", "requires-approval", `${code || "Row"} is staged inactive until owner approval.`));

    seen.add(duplicateKey);
    if (!code) return;

    const unit = normalizeUnit(get(row, ["unit", "Unit", "UnitOfMeasure"]));
    const priceText = get(row, ["unitRate", "UnitRate", "UnitPrice_ExclVAT", "rate", "Rate"]);
    const price = priceText === "" ? null : Number(priceText);
    const recordGovernance = governance(recordType, placeholder);
    const recordLineage = lineage(source, sourceUrl, effectiveDate);

    if ((recordType === "material" || recordType === "resource" || recordType === "assembly" || recordType === "productivity_record") && unit && !validUnits.has(unit)) {
      issues.push(issue(rowNumber, "error", "invalid-unit", `${unit || "(blank)"} is not an approved unit.`));
    }
    if (recordType === "material" && (price == null || !Number.isFinite(price))) {
      issues.push(issue(rowNumber, "error", "missing-price", `${code} has no valid active price.`));
    }
    if (/[ï¿½]|(?:Ãƒ|Ã¢â‚¬|Â)/.test(JSON.stringify(row))) {
      issues.push(issue(rowNumber, "warning", "encoding", `${code} may contain an encoding problem.`));
    }
    if (issues.some((item) => item.row === rowNumber && item.severity === "error")) return;

    const base = { governance: recordGovernance, lineage: recordLineage };
    let data: StagedImportRecord["data"];
    if (recordType === "material") {
      data = {
        ...base,
        code,
        description: get(row, ["description", "Description", "name", "Name"]),
        unit,
        unitRate: price,
        supplier: get(row, ["supplier", "Supplier", "SupplierName"]) || "Imported",
        supplierCode: get(row, ["supplierCode", "SupplierCode"]) || undefined,
        confidence,
        source: source || sourceUrl || "CSV import pending owner approval",
        active: false,
      };
    } else if (recordType === "resource") {
      data = {
        ...base,
        code,
        name: get(row, ["name", "Name", "description", "Description"]),
        unit: unit === "day" ? "day" : "hour",
        rate: Number.isFinite(price) ? Number(price) : 0,
        confidence,
        source: source || sourceUrl || "CSV import pending owner approval",
      };
    } else if (recordType === "assembly") {
      data = {
        ...base,
        code,
        name: get(row, ["name", "Name", "description", "Description"]) || code,
        trade: tradeOr(get(row, ["trade", "Trade"])),
        unit: unit || "ea",
        baseQuantity: numberOr(get(row, ["baseQuantity", "BaseQuantity", "quantity", "Quantity"]), 1),
        basePrimeCost: get(row, ["basePrimeCost", "BasePrimeCost"]) ? numberOr(get(row, ["basePrimeCost", "BasePrimeCost"]), 0) : undefined,
        baseMaterialCost: get(row, ["baseMaterialCost", "BaseMaterialCost"]) ? numberOr(get(row, ["baseMaterialCost", "BaseMaterialCost"]), 0) : undefined,
        baseLabourCost: get(row, ["baseLabourCost", "BaseLabourCost"]) ? numberOr(get(row, ["baseLabourCost", "BaseLabourCost"]), 0) : undefined,
        confidence,
        status: "Archived",
        source: source || sourceUrl || "CSV import pending owner approval",
        notes: get(row, ["notes", "Notes"]) || "Imported assembly staged for owner approval.",
        recipe: parseRecipe(get(row, ["recipe", "Recipe", "materials", "Materials"])),
        labour: parseLabour(get(row, ["labour", "Labour", "resources", "Resources"])),
      };
    } else if (recordType === "commercial_rule") {
      data = {
        ...base,
        wastePct: numberOr(get(row, ["wastePct", "WastePct", "waste", "Waste"]), 5),
        wasteMinPct: get(row, ["wasteMinPct", "WasteMinPct"]) ? numberOr(get(row, ["wasteMinPct", "WasteMinPct"]), 5) : undefined,
        wasteMaxPct: get(row, ["wasteMaxPct", "WasteMaxPct"]) ? numberOr(get(row, ["wasteMaxPct", "WasteMaxPct"]), 10) : undefined,
        riskPct: numberOr(get(row, ["riskPct", "RiskPct", "risk", "Risk"]), 5),
        contingencyPct: numberOr(get(row, ["contingencyPct", "ContingencyPct", "contingency", "Contingency"]), 10),
        marginPct: numberOr(get(row, ["marginPct", "MarginPct", "margin", "Margin"]), 25),
        vatPct: numberOr(get(row, ["vatPct", "VatPct", "vat", "VAT"]), 15),
      } satisfies CommercialRules;
    } else if (recordType === "productivity_record") {
      const outputPerHour = get(row, ["outputPerHour", "OutputPerHour", "OutputPerHr", "perHour"]) ? numberOr(get(row, ["outputPerHour", "OutputPerHour", "OutputPerHr", "perHour"]), 0) : undefined;
      const outputPerDay = get(row, ["outputPerDay", "OutputPerDay", "perDay", "dailyOutput"]) ? numberOr(get(row, ["outputPerDay", "OutputPerDay", "perDay", "dailyOutput"]), 0) : undefined;
      const labourHoursPerUnit = get(row, ["labourHoursPerUnit", "LabourHoursPerUnit", "hoursPerUnit"]) ? numberOr(get(row, ["labourHoursPerUnit", "LabourHoursPerUnit", "hoursPerUnit"]), 0) : undefined;
      data = {
        ...base,
        code,
        trade: get(row, ["trade", "Trade"]) || "Unclassified",
        activity: get(row, ["activity", "Activity", "description", "Description", "name", "Name"]) || code,
        unit: unit || "ea",
        method: get(row, ["method", "Method"]) || undefined,
        region: get(row, ["region", "Region"]) || undefined,
        crew: get(row, ["crew", "Crew"]) || undefined,
        outputPerHour,
        outputPerDay,
        labourHoursPerUnit,
        confidence,
        source: source || sourceUrl || "CSV import pending owner approval",
        active: false,
      } satisfies ProductivityRecord;
    } else {
      data = { ...row, ...base, code, confidence, source: source || sourceUrl || "CSV import pending owner approval" };
    }

    accepted.push({
      recordType,
      code,
      status: "pending" as LifecycleStatus,
      confidence,
      source: source || sourceUrl || "CSV import pending owner approval",
      active: false,
      data,
      governance: recordGovernance,
      lineage: recordLineage,
    });
  });

  return { rows: parsed.data.length, accepted, issues, parseErrors: parsed.errors };
}

export function reviewMaterialCsv(csv: string, existing: Material[]) {
  const result = reviewLibraryCsv(csv, existing.map((item) => ({ recordType: "material", code: item.code })), "material");
  return {
    ...result,
    accepted: result.accepted.filter((item) => item.recordType === "material").map((item) => item.data as Material),
  };
}
