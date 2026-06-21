import { describe, expect, it } from "vitest";
import { normalizeConfidence, normalizeUnit, reviewLibraryCsv, reviewMaterialCsv } from "./imports";
import { materials } from "./seed";

describe("controlled material imports", () => {
  it("reports duplicate, conflict, invalid-unit, and missing-price issues", () => {
    const csv = [
      "code,description,unit,unitRate,supplier",
      "NEW-001,New material,ea,12.50,Supplier",
      "NEW-001,Duplicate material,ea,13.00,Supplier",
      "BE1WH813,Existing material,ea,100,Supplier",
      "BAD-001,Bad unit,thing,10,Supplier",
      "BAD-002,Missing price,ea,,Supplier",
    ].join("\n");
    const result = reviewMaterialCsv(csv, materials);
    for (const code of ["duplicate", "conflict", "invalid-unit", "missing-price"]) {
      expect(result.issues.some((issue) => issue.code === code)).toBe(true);
    }
  });

  it("normalizes governed vocabulary and stages imports for owner approval", () => {
    const csv = [
      "recordType,code,description,unit,unitRate,confidence,source,effectiveDate",
      "material,NEW-002,Governed material,nr,25.00,High,Test source,2026-06-20",
      "resource,RES-001,Imported labour,hrs,32.50,Medium,Test source,2026-06-20",
    ].join("\n");
    const result = reviewLibraryCsv(csv, [], "material");
    expect(result.accepted).toHaveLength(2);
    expect(result.accepted[0].confidence).toBe("Validated");
    expect(result.accepted[0].active).toBe(false);
    expect(result.accepted[0].governance.ownerApprovalRequired).toBe(true);
    expect(result.accepted[0].governance.authorityState).toBe("staged");
    expect((result.accepted[0].data as { unit: string }).unit).toBe("ea");
    expect((result.accepted[1].data as { unit: string }).unit).toBe("hour");
  });

  it("maps audit vocabularies into app contracts", () => {
    expect(normalizeConfidence("High")).toBe("Validated");
    expect(normalizeConfidence("Medium")).toBe("Provisional");
    expect(normalizeConfidence("Low")).toBe("Assumption");
    expect(normalizeUnit("litres")).toBe("L");
    expect(normalizeUnit("nr")).toBe("ea");
  });

  it("stages productivity records as inactive governed records", () => {
    const csv = [
      "recordType,code,trade,activity,unit,outputPerDay,labourHoursPerUnit,confidence,source,sourceUrl,effectiveDate,placeholder",
      "productivity_record,EARTH-CLEAR-GRASS,Earthworks,Grass clearing,m2,124,0.0645,Medium,CIDB EPWP earthworks,https://drive.google.com/file/d/1jqm87LEuEGnRhoxkIEnq1lB9_FWx1aAZ/view,2005-03-01,true",
    ].join("\n");
    const result = reviewLibraryCsv(csv, [], "productivity_record");
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].recordType).toBe("productivity_record");
    expect(result.accepted[0].active).toBe(false);
    expect(result.accepted[0].governance.approval).toBe("staged");
    expect(result.accepted[0].governance.authorityState).toBe("staged");
    expect(result.accepted[0].governance.ownerApprovalRequired).toBe(true);
    expect((result.accepted[0].data as { outputPerDay: number }).outputPerDay).toBe(124);
  });
});
