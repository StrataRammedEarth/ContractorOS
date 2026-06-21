import { normalizeLibraryData } from "./library";
import { seedLibrary } from "./seed";
import { supabase } from "./supabase";
import type { ActualRecord, EstimateSnapshot, LibraryData } from "./types";

const requireClient = () => {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
};

export async function getOrganizationId() {
  const client = requireClient();
  const { data: memberships } = await client.from("organization_members").select("organization_id").limit(1);
  if (memberships?.[0]?.organization_id) return memberships[0].organization_id as string;
  const { data, error } = await client.rpc("bootstrap_owner_organization", { org_name: "ContractorOS" });
  if (error) throw error;
  return data as string;
}

export async function loadCloudLibrary(orgId: string): Promise<LibraryData> {
  const client = requireClient();
  const { data, error } = await client
    .from("library_records")
    .select("record_type,code,status,data")
    .eq("organization_id", orgId)
    .in("status", ["active", "pending", "archived", "superseded", "withdrawn"]);
  if (error) throw error;
  if (!data?.length) {
    await saveCloudLibrary(orgId, seedLibrary);
    return structuredClone(seedLibrary);
  }
  const records = data as { record_type: string; code: string; status: string; data: unknown }[];
  return normalizeLibraryData({
    materials: records.filter((item) => item.record_type === "material" && ["active", "pending"].includes(item.status)).map((item) => item.data) as LibraryData["materials"],
    resources: records.filter((item) => item.record_type === "resource" && ["active", "pending"].includes(item.status)).map((item) => item.data) as LibraryData["resources"],
    assemblies: records.filter((item) => item.record_type === "assembly" && ["active", "pending", "archived"].includes(item.status)).map((item) => item.data) as LibraryData["assemblies"],
    rules: (records.find((item) => item.record_type === "commercial_rule" && ["active", "pending"].includes(item.status))?.data ?? seedLibrary.rules) as LibraryData["rules"],
    governedRecords: records.filter((item) => !["material", "resource", "assembly", "commercial_rule"].includes(item.record_type)).map((item) => item.data) as LibraryData["governedRecords"],
  });
}

export async function saveCloudLibrary(orgId: string, library: LibraryData) {
  const client = requireClient();
  const normalized = normalizeLibraryData(library);
  const rows = [
    ...normalized.materials.map((data) => ({ record_type: "material", code: data.code, confidence: data.confidence, source: data.source, data, status: data.governance?.lifecycle ?? (data.active ? "active" : "pending") })),
    ...normalized.resources.map((data) => ({ record_type: "resource", code: data.code, confidence: data.confidence, source: data.source, data, status: data.governance?.lifecycle ?? "active" })),
    ...normalized.assemblies.map((data) => ({ record_type: "assembly", code: data.code, confidence: data.confidence, source: data.source, data, status: data.status === "Archived" ? "archived" : data.governance?.lifecycle ?? "active" })),
    { record_type: "commercial_rule", code: "COMMERCIAL-RULES", confidence: normalized.rules.governance?.placeholder ? "Assumption" : "Validated", source: normalized.rules.lineage?.sourceFile ?? "07_Commercial_Rules.csv", data: normalized.rules, status: normalized.rules.governance?.lifecycle ?? "active" },
    ...(normalized.governedRecords ?? []).map((data) => ({ record_type: data.recordType, code: data.code, confidence: data.confidence, source: data.source, data, status: data.status })),
  ].map((row) => ({
    ...row,
    organization_id: orgId,
    source_url: row.data.lineage?.sourceUrl,
    source_record_id: row.data.lineage?.sourceRecordId,
    manifest_id: row.data.lineage?.manifestId,
    revision: row.data.lineage?.revision,
    validation_ref: row.data.lineage?.validationRef,
    effective_date: row.data.lineage?.effectiveDate,
    reviewed_at: row.data.lineage?.reviewedAt,
    authority: row.data.governance?.authority ?? "requires-review",
    authority_state: row.data.governance?.authorityState ?? "staged",
    approval_status: row.data.governance?.approval ?? "staged",
    placeholder: row.data.governance?.placeholder ?? false,
    owner_approval_required: row.data.governance?.ownerApprovalRequired ?? true,
    approver: row.data.governance?.approver,
    approved_at: row.data.governance?.approvedAt,
    archived_at: row.data.governance?.archivedAt,
    corrected_at: row.data.governance?.correctedAt,
    corrected_by: row.data.governance?.correctedBy,
    correction_reason: row.data.governance?.correctionReason,
    supersedes: row.data.governance?.supersedes,
    superseded_by: row.data.governance?.supersededBy,
  }));
  const { error } = await client.from("library_records").upsert(rows, { onConflict: "organization_id,record_type,code,status" });
  if (error) throw error;
}

export async function loadCloudEstimates(orgId: string): Promise<EstimateSnapshot[]> {
  const { data, error } = await requireClient().from("estimate_versions").select("snapshot").eq("organization_id", orgId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item) => item.snapshot as EstimateSnapshot);
}

export async function saveCloudEstimate(orgId: string, snapshot: EstimateSnapshot, existing: EstimateSnapshot[]) {
  const version = existing.filter((item) => item.input.reference === snapshot.input.reference).length + 1;
  const saved = { ...snapshot, version };
  const { error } = await requireClient().from("estimate_versions").insert({
    id: saved.id, organization_id: orgId, reference: saved.input.reference, version, snapshot: saved, status: "final",
  });
  if (error) throw error;
  return saved;
}

export async function loadCloudActuals(orgId: string): Promise<ActualRecord[]> {
  const { data, error } = await requireClient().from("actual_records").select("estimate_version_id,actual_material,actual_labour,actual_final_value,notes,created_at").eq("organization_id", orgId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item) => ({
    estimateId: item.estimate_version_id,
    actualMaterial: Number(item.actual_material),
    actualLabour: Number(item.actual_labour),
    actualFinalValue: Number(item.actual_final_value),
    notes: item.notes,
    createdAt: item.created_at,
  }));
}

export async function saveCloudActual(orgId: string, actual: ActualRecord) {
  const { error } = await requireClient().from("actual_records").insert({
    organization_id: orgId,
    estimate_version_id: actual.estimateId,
    actual_material: actual.actualMaterial,
    actual_labour: actual.actualLabour,
    actual_final_value: actual.actualFinalValue,
    notes: actual.notes,
  });
  if (error) throw error;
}
