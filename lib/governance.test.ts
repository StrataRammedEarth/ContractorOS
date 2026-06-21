import { describe, expect, it } from "vitest";
import { approveStagedImports, stageStagedImports, updateGovernedRecordApproval } from "./governance";
import { reviewLibraryCsv } from "./imports";
import { seedLibrary } from "./seed";

describe("owner approval promotion", () => {
  it("promotes assemblies, commercial rules, and governance register records", () => {
    const csv = [
      "recordType,code,name,trade,unit,baseQuantity,recipe,labour,confidence,source",
      "assembly,ASM-001,Imported Assembly,Plumbing,ea,1,BE1WH813:1,PLM-LAB-001:2:Install,High,Test source",
      "commercial_rule,COMM-TEST,Rules,,,,,,Medium,Test source",
      "validation,VAL-TEST,Validation Note,,,,,,High,Test source",
    ].join("\n");
    const staged = reviewLibraryCsv(csv, [], "material").accepted;
    const next = approveStagedImports(seedLibrary, staged, "2026-06-20T00:00:00.000Z");

    expect(next.assemblies.find((item) => item.code === "ASM-001")?.status).toBe("Active");
    expect(next.rules.governance?.approval).toBe("approved");
    expect(next.rules.governance?.authorityState).toBe("approved_locked");
    expect(next.governedRecords.find((item) => item.code === "VAL-TEST")?.governance.approval).toBe("approved");
  });

  it("persists productivity records as staged until owner approval", () => {
    const csv = [
      "recordType,code,trade,activity,unit,outputPerDay,confidence,source",
      "productivity_record,EARTH-CLEAR-GRASS,Earthworks,Grass clearing,m2,124,Medium,CIDB EPWP earthworks",
    ].join("\n");
    const staged = reviewLibraryCsv(csv, [], "productivity_record").accepted;
    const next = stageStagedImports(seedLibrary, staged);
    const productivity = next.governedRecords.find((item) => item.code === "EARTH-CLEAR-GRASS");

    expect(productivity?.recordType).toBe("productivity_record");
    expect(productivity?.status).toBe("pending");
    expect(productivity?.active).toBe(false);
    expect(productivity?.governance.approval).toBe("staged");
    expect(productivity?.governance.authorityState).toBe("staged");
    expect(productivity?.governance.ownerApprovalRequired).toBe(true);
  });

  it("updates staged productivity records through owner review actions", () => {
    const csv = [
      "recordType,code,trade,activity,unit,outputPerDay,confidence,source",
      "productivity_record,EARTH-CLEAR-GRASS,Earthworks,Grass clearing,m2,124,Medium,CIDB EPWP earthworks",
    ].join("\n");
    const staged = reviewLibraryCsv(csv, [], "productivity_record").accepted;
    const library = stageStagedImports(seedLibrary, staged);

    const approved = updateGovernedRecordApproval(library, "productivity_record", "EARTH-CLEAR-GRASS", "approve", "2026-06-20T00:00:00.000Z");
    const approvedRecord = approved.governedRecords.find((item) => item.code === "EARTH-CLEAR-GRASS");
    expect(approvedRecord?.status).toBe("active");
    expect(approvedRecord?.active).toBe(true);
    expect(approvedRecord?.governance.approval).toBe("approved");
    expect(approvedRecord?.governance.authorityState).toBe("approved_locked");
    expect(approvedRecord?.governance.ownerApprovalRequired).toBe(false);

    const stagedAgain = updateGovernedRecordApproval(approved, "productivity_record", "EARTH-CLEAR-GRASS", "stage");
    const restagedRecord = stagedAgain.governedRecords.find((item) => item.code === "EARTH-CLEAR-GRASS");
    expect(restagedRecord?.status).toBe("pending");
    expect(restagedRecord?.active).toBe(false);
    expect(restagedRecord?.governance.approval).toBe("staged");
    expect(restagedRecord?.governance.authorityState).toBe("staged");

    const rejected = updateGovernedRecordApproval(stagedAgain, "productivity_record", "EARTH-CLEAR-GRASS", "reject", "2026-06-20T00:00:00.000Z");
    const rejectedRecord = rejected.governedRecords.find((item) => item.code === "EARTH-CLEAR-GRASS");
    expect(rejectedRecord?.status).toBe("archived");
    expect(rejectedRecord?.active).toBe(false);
    expect(rejectedRecord?.governance.approval).toBe("rejected");
    expect(rejectedRecord?.governance.authorityState).toBe("withdrawn_corrected");
  });

  it("supports correction or withdrawal without overwriting audit history", () => {
    const csv = [
      "recordType,code,trade,activity,unit,outputPerDay,confidence,source",
      "productivity_record,EARTH-CLEAR-GRASS,Earthworks,Grass clearing,m2,124,Medium,CIDB EPWP earthworks",
    ].join("\n");
    const staged = reviewLibraryCsv(csv, [], "productivity_record").accepted;
    const library = stageStagedImports(seedLibrary, staged);
    const approved = updateGovernedRecordApproval(library, "productivity_record", "EARTH-CLEAR-GRASS", "approve", "2026-06-20T00:00:00.000Z");
    const withdrawn = updateGovernedRecordApproval(approved, "productivity_record", "EARTH-CLEAR-GRASS", "withdraw", "2026-06-21T00:00:00.000Z", "Approved in error.");

    const withdrawnRecord = withdrawn.governedRecords.find((item) => item.code === "EARTH-CLEAR-GRASS");
    expect(withdrawnRecord?.status).toBe("withdrawn");
    expect(withdrawnRecord?.governance.approval).toBe("withdrawn");
    expect(withdrawnRecord?.governance.authority).toBe("corrected");
    expect(withdrawnRecord?.governance.authorityState).toBe("withdrawn_corrected");
    expect(withdrawnRecord?.governance.correctionReason).toBe("Approved in error.");
  });
});
