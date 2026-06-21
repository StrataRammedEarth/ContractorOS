import { resolveAuthorityState } from "./authority";
import { seedLibrary } from "./seed";
import type { Assembly, CommercialRules, Governance, LibraryData, Material, Resource, StagedImportRecord } from "./types";

function normalizeGovernance(governance: Partial<Governance> | undefined, fallback: Pick<Governance, "recordType" | "placeholder">, active: boolean, archived = false): Governance {
  const authorityState = resolveAuthorityState({ governance, active });
  const lifecycle =
    governance?.lifecycle
    ?? (authorityState === "withdrawn_corrected" ? "withdrawn" : archived ? "archived" : active ? "active" : "pending");
  const approval =
    governance?.approval
    ?? (authorityState === "withdrawn_corrected" ? "withdrawn" : authorityState === "staged" ? "staged" : authorityState === "approved_locked" ? "locked" : "approved");

  return {
    recordType: fallback.recordType,
    lifecycle,
    authority: governance?.authority ?? (authorityState === "withdrawn_corrected" ? "corrected" : fallback.placeholder ? "provisional" : "validated"),
    approval,
    authorityState,
    placeholder: governance?.placeholder ?? fallback.placeholder,
    ownerApprovalRequired: governance?.ownerApprovalRequired ?? authorityState === "staged",
    approver: governance?.approver,
    approvedAt: governance?.approvedAt,
    archivedAt: governance?.archivedAt,
    correctedAt: governance?.correctedAt,
    correctedBy: governance?.correctedBy,
    correctionReason: governance?.correctionReason,
    supersedes: governance?.supersedes,
    supersededBy: governance?.supersededBy,
    reviewBy: governance?.reviewBy,
    notes: governance?.notes,
  };
}

function normalizeMaterial(material: Material): Material {
  return {
    ...material,
    governance: normalizeGovernance(material.governance, { recordType: "material", placeholder: material.governance?.placeholder ?? false }, material.active),
  };
}

function normalizeResource(resource: Resource): Resource {
  return {
    ...resource,
    governance: normalizeGovernance(resource.governance, { recordType: "resource", placeholder: resource.governance?.placeholder ?? false }, true),
  };
}

function normalizeAssembly(assembly: Assembly): Assembly {
  return {
    ...assembly,
    governance: normalizeGovernance(assembly.governance, { recordType: "assembly", placeholder: assembly.governance?.placeholder ?? false }, assembly.status === "Active", assembly.status === "Archived"),
  };
}

function normalizeRules(rules: CommercialRules): CommercialRules {
  return {
    ...rules,
    governance: normalizeGovernance(rules.governance, { recordType: "commercial_rule", placeholder: rules.governance?.placeholder ?? false }, true),
  };
}

function normalizeGovernedRecord(record: StagedImportRecord): StagedImportRecord {
  const governance = normalizeGovernance(record.governance, { recordType: record.recordType, placeholder: record.governance.placeholder }, record.active, record.status === "archived");
  return {
    ...record,
    status: governance.lifecycle,
    governance,
    data: {
      ...record.data,
      active: record.active,
      governance,
      lineage: record.lineage,
    },
  };
}

export function normalizeLibraryData(library: LibraryData): LibraryData {
  return {
    materials: (library.materials ?? []).map(normalizeMaterial),
    resources: (library.resources ?? []).map(normalizeResource),
    assemblies: (library.assemblies ?? []).map(normalizeAssembly),
    rules: normalizeRules(library.rules ?? seedLibrary.rules),
    governedRecords: (library.governedRecords ?? []).map(normalizeGovernedRecord),
  };
}
