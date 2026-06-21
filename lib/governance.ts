import type { Assembly, CommercialRules, LibraryData, Resource, StagedImportRecord } from "./types";

const registerRecordTypes = new Set(["assumption", "validation", "source", "productivity_record"]);

const approveGovernance = (record: StagedImportRecord, approvedAt: string) => ({
  ...record.governance,
  lifecycle: "active" as const,
  approval: record.confidence === "Locked" ? "locked" as const : "approved" as const,
  authorityState: record.governance.placeholder ? "exploration_approved" as const : "approved_locked" as const,
  ownerApprovalRequired: false,
  approver: "Owner",
  approvedAt,
});

const approveStagedRecord = (record: StagedImportRecord, approvedAt: string): StagedImportRecord => ({
  ...record,
  status: "active",
  active: true,
  governance: approveGovernance(record, approvedAt),
  data: {
    ...record.data,
    governance: approveGovernance(record, approvedAt),
    lineage: record.lineage,
  },
});

const stagedGovernance = (record: StagedImportRecord) => ({
  ...record.governance,
  lifecycle: "pending" as const,
  approval: "staged" as const,
  authorityState: "staged" as const,
  ownerApprovalRequired: true,
  reviewBy: "owner",
});

export function stageStagedImports(library: LibraryData, staged: StagedImportRecord[]): LibraryData {
  const registerRecords = staged.map((record) => ({
    ...record,
    status: "pending" as const,
    active: false,
    governance: stagedGovernance(record),
    data: {
      ...record.data,
      active: false,
      governance: stagedGovernance(record),
      lineage: record.lineage,
    },
  }));
  const registerKeys = new Set(registerRecords.map((record) => `${record.recordType}:${record.code}`));

  return {
    ...library,
    governedRecords: [
      ...(library.governedRecords ?? []).filter((record) => !registerKeys.has(`${record.recordType}:${record.code}`)),
      ...registerRecords,
    ],
  };
}

export function updateGovernedRecordApproval(library: LibraryData, recordType: StagedImportRecord["recordType"], code: string, action: "approve" | "reject" | "stage" | "withdraw", reviewedAt = new Date().toISOString(), correctionReason = "Withdrawn after owner correction review. Retained for audit history."): LibraryData {
  return {
    ...library,
    governedRecords: (library.governedRecords ?? []).map((record) => {
      if (record.recordType !== recordType || record.code !== code) return record;

      if (action === "approve") return approveStagedRecord(record, reviewedAt);

      const governance = action === "withdraw" ? {
        ...record.governance,
        lifecycle: "withdrawn" as const,
        authority: "corrected" as const,
        approval: "withdrawn" as const,
        authorityState: "withdrawn_corrected" as const,
        ownerApprovalRequired: false,
        approver: "Owner",
        correctedAt: reviewedAt,
        correctedBy: "Owner",
        correctionReason,
        notes: correctionReason,
      } : action === "reject" ? {
        ...record.governance,
        lifecycle: "archived" as const,
        approval: "rejected" as const,
        authorityState: "withdrawn_corrected" as const,
        ownerApprovalRequired: false,
        approver: "Owner",
        archivedAt: reviewedAt,
        notes: "Rejected by owner review. Retained for audit history.",
      } : stagedGovernance(record);

      return {
        ...record,
        status: action === "withdraw" ? "withdrawn" as const : action === "reject" ? "archived" as const : "pending" as const,
        active: false,
        governance,
        data: {
          ...record.data,
          active: false,
          governance,
          lineage: record.lineage,
        },
      };
    }),
  };
}

export function approveStagedImports(library: LibraryData, staged: StagedImportRecord[], approvedAt = new Date().toISOString()): LibraryData {
  const approved = staged.map((record) => approveStagedRecord(record, approvedAt));
  const approvedMaterials = approved
    .filter((record) => record.recordType === "material")
    .map((record) => ({ ...(record.data as LibraryData["materials"][number]), active: true }));
  const approvedResources = approved
    .filter((record) => record.recordType === "resource")
    .map((record) => record.data as Resource);
  const approvedAssemblies = approved
    .filter((record) => record.recordType === "assembly")
    .map((record) => ({ ...(record.data as Assembly), status: "Active" as const }));
  const approvedRules = approved.find((record) => record.recordType === "commercial_rule")?.data as CommercialRules | undefined;
  const registerRecords = approved.filter((record) => registerRecordTypes.has(record.recordType));

  const materialCodes = new Set(approvedMaterials.map((record) => record.code));
  const resourceCodes = new Set(approvedResources.map((record) => record.code));
  const assemblyCodes = new Set(approvedAssemblies.map((record) => record.code));
  const registerKeys = new Set(registerRecords.map((record) => `${record.recordType}:${record.code}`));

  return {
    ...library,
    materials: [...library.materials.filter((record) => !materialCodes.has(record.code)), ...approvedMaterials],
    resources: [...library.resources.filter((record) => !resourceCodes.has(record.code)), ...approvedResources],
    assemblies: [...library.assemblies.filter((record) => !assemblyCodes.has(record.code)), ...approvedAssemblies],
    rules: approvedRules ?? library.rules,
    governedRecords: [
      ...(library.governedRecords ?? []).filter((record) => !registerKeys.has(`${record.recordType}:${record.code}`)),
      ...registerRecords,
    ],
  };
}
