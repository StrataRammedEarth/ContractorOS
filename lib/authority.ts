import type { AuthorityState, Confidence, Governance, SourceLineage } from "./types";

export interface AuthorityBearing {
  confidence?: Confidence;
  governance?: Partial<Governance>;
  lineage?: SourceLineage;
  active?: boolean;
  status?: string;
}

export function resolveAuthorityState(record?: AuthorityBearing | null): AuthorityState {
  if (!record) return "staged";
  const governance = record.governance;
  if (governance?.authorityState) return governance.authorityState;
  if (governance?.approval === "withdrawn" || governance?.authority === "corrected" || governance?.lifecycle === "withdrawn") {
    return "withdrawn_corrected";
  }
  if (governance?.approval === "staged" || governance?.lifecycle === "pending" || record.active === false) {
    return "staged";
  }
  if (governance?.placeholder || record.confidence === "Assumption" || record.confidence === "Provisional") {
    return "exploration_approved";
  }
  if (governance?.approval === "approved" || governance?.approval === "locked" || record.confidence === "Locked" || record.confidence === "Validated") {
    return "approved_locked";
  }
  return "staged";
}

export function isUsableForEstimate(record?: AuthorityBearing | null) {
  const state = resolveAuthorityState(record);
  return state === "approved_locked" || state === "exploration_approved";
}

export function isClientSafe(state: AuthorityState) {
  return state === "approved_locked";
}

export function authorityWarning(code: string, state: AuthorityState) {
  if (state === "exploration_approved") {
    return `${code} is exploration-approved: usable for internal pilot estimates, but blocked from binding client output until approved/locked.`;
  }
  if (state === "staged") {
    return `${code} is staged and cannot be used in calculations.`;
  }
  if (state === "withdrawn_corrected") {
    return `${code} was withdrawn/corrected and is retained only for audit history.`;
  }
  return "";
}

export function lineageSummary(lineage?: SourceLineage) {
  if (!lineage) return "No manifest lineage";
  return [lineage.manifestId, lineage.sourceRecordId, lineage.revision, lineage.validationRef].filter(Boolean).join(" | ") || lineage.sourceFile;
}
