export type Confidence = "Locked" | "Validated" | "Provisional" | "Assumption" | "Unknown";
export type Trade = "Plumbing" | "Decking" | "Masonry" | "Logistics";
export type RecordType = "material" | "resource" | "assembly" | "commercial_rule" | "assumption" | "validation" | "source" | "productivity_record";
export type LifecycleStatus = "pending" | "active" | "archived" | "superseded" | "withdrawn";
export type AuthorityStatus = "canonical" | "validated" | "provisional" | "reference-only" | "duplicate" | "superseded" | "corrected" | "malformed" | "requires-review";
export type ApprovalStatus = "draft" | "staged" | "approved" | "rejected" | "locked" | "withdrawn";
export type AuthorityState = "staged" | "exploration_approved" | "approved_locked" | "withdrawn_corrected";

export interface SourceLineage {
  sourceFile: string;
  sourceUrl?: string;
  sourceRecordId?: string;
  manifestId?: string;
  revision?: string;
  validationRef?: string;
  effectiveDate?: string;
  reviewedAt?: string;
}

export interface Governance {
  recordType: RecordType;
  lifecycle: LifecycleStatus;
  authority: AuthorityStatus;
  approval: ApprovalStatus;
  authorityState: AuthorityState;
  placeholder: boolean;
  ownerApprovalRequired: boolean;
  approver?: string;
  approvedAt?: string;
  archivedAt?: string;
  correctedAt?: string;
  correctedBy?: string;
  correctionReason?: string;
  supersedes?: string;
  supersededBy?: string;
  reviewBy?: string;
  notes?: string;
}

export interface GovernedRecord {
  governance: Governance;
  lineage: SourceLineage;
}

export interface Material extends Partial<GovernedRecord> {
  code: string;
  description: string;
  unit: string;
  unitRate: number | null;
  supplier: string;
  supplierCode?: string;
  confidence: Confidence;
  source: string;
  active: boolean;
}

export interface Resource extends Partial<GovernedRecord> {
  code: string;
  name: string;
  unit: "hour" | "day";
  rate: number;
  confidence: Confidence;
  source: string;
}

export interface ProductivityRecord extends GovernedRecord {
  code: string;
  trade: string;
  activity: string;
  unit: string;
  method?: string;
  region?: string;
  crew?: string;
  outputPerHour?: number;
  outputPerDay?: number;
  labourHoursPerUnit?: number;
  confidence: Confidence;
  source: string;
  active: boolean;
}

export interface RecipeItem {
  materialCode: string;
  quantity: number;
}

export interface LabourItem {
  resourceCode: string;
  quantity: number;
  activity: string;
}

export interface Assembly {
  code: string;
  name: string;
  trade: Trade;
  unit: string;
  baseQuantity: number;
  basePrimeCost?: number;
  baseMaterialCost?: number;
  baseLabourCost?: number;
  confidence: Confidence;
  status: "Active" | "Archived";
  source: string;
  notes?: string;
  recipe: RecipeItem[];
  labour: LabourItem[];
  governance?: Governance;
  lineage?: SourceLineage;
}

export interface LibraryData {
  materials: Material[];
  resources: Resource[];
  assemblies: Assembly[];
  rules: CommercialRules;
  governedRecords: StagedImportRecord[];
}

export interface CommercialRules {
  wastePct: number;
  wasteMinPct?: number;
  wasteMaxPct?: number;
  riskPct: number;
  contingencyPct: number;
  marginPct: number;
  vatPct: number;
  governance?: Governance;
  lineage?: SourceLineage;
}

export interface ScopeItem {
  assemblyCode: string;
  quantity: number;
}

export interface EstimateInput {
  projectName: string;
  clientName: string;
  reference: string;
  vatEnabled: boolean;
  scope: ScopeItem[];
}

export interface EstimateLine {
  code: string;
  description: string;
  trade: Trade;
  costElement: CostElementCode;
  quantity: number;
  unit: string;
  material: number;
  labour: number;
  prime: number;
  confidence: Confidence;
  authorityState: AuthorityState;
  lineage?: SourceLineage;
  warnings: string[];
}

export type CostElementCode =
  | "GROUND_FLOOR_CONSTRUCTION"
  | "EXTERNAL_ENVELOPE"
  | "ROOF"
  | "INTERNAL_DIVISIONS"
  | "FFE"
  | "PLUMBING_SERVICES"
  | "ELECTRICAL_MECHANICAL";

export interface CostElementDefinition {
  code: CostElementCode;
  name: string;
  description: string;
  contractorOsUse: string;
  authorityClassification: "Approved";
  approvalState: "approved";
  approvedBy: "ContractorOS owner";
  source: string;
  sourceUrl: string;
  sourceLocation: string;
  governanceNote: string;
}

export interface EstimateElementBreakdown {
  code: CostElementCode;
  name: string;
  description: string;
  material: number;
  labour: number;
  prime: number;
  percentOfPrime: number;
  sourceLocation: string;
  governanceNote: string;
  lineCodes: string[];
}

export type FeatureCode =
  | "CONSTRUCTION_AREA"
  | "STRUCTURE_AREA"
  | "ROOF_AREA_SLOPE"
  | "ROOF_PITCH"
  | "EXTERNAL_ENVELOPE_AREA"
  | "WALL_HEIGHTS"
  | "EXTERNAL_OPENINGS_AREA"
  | "EXTERNAL_WALL_LENGTH"
  | "EXTERNAL_CORNERS"
  | "INTERNAL_WALL_LENGTH"
  | "ROOM_COUNT"
  | "BEDROOM_COUNT"
  | "SANITARY_FITTINGS"
  | "FFE_LENGTH";

export interface FeatureDefinition {
  code: FeatureCode;
  name: string;
  measurementUnit: string;
  description: string;
  usedByElements: CostElementCode[];
  suggestedInputControl: string;
  recordType: "feature_record";
  authorityClassification: "Approved";
  approvalState: "approved";
  approvedBy: "ContractorOS owner";
  source: string;
  sourceUrl: string;
  sourceLocation: string;
}

export type EstimateClassCode = "CLASS_1" | "CLASS_2" | "CLASS_3" | "CLASS_4" | "CLASS_5";

export interface EstimateClassification {
  code: EstimateClassCode;
  label: string;
  sourceMethod: string;
  dataBasis: string;
  expectedLowRange: string;
  expectedHighRange: string;
  uiWarning: string;
  governanceStatus: "Approved";
  approvedBy: "ContractorOS owner";
  source: string;
  sourceUrl: string;
  sourceLocation: string;
  rationale: string[];
}

export interface BuyLine {
  materialCode: string;
  description: string;
  supplier: string;
  unit: string;
  quantity: number;
  unitRate: number;
  total: number;
  confidence: Confidence;
  authorityState: AuthorityState;
  lineage?: SourceLineage;
}

export interface BuildLine {
  assemblyCode: string;
  activity: string;
  resource: string;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
  confidence: Confidence;
  authorityState: AuthorityState;
  lineage?: SourceLineage;
}

export interface EstimateSnapshot {
  id: string;
  version: number;
  createdAt: string;
  input: EstimateInput;
  lines: EstimateLine[];
  elementalBreakdown: EstimateElementBreakdown[];
  featureSchema: FeatureDefinition[];
  buy: BuyLine[];
  build: BuildLine[];
  rules: CommercialRules;
  totals: {
    material: number;
    labour: number;
    prime: number;
    waste: number;
    direct: number;
    risk: number;
    riskAdjusted: number;
    contingency: number;
    cost: number;
    margin: number;
    sellExVat: number;
    vat: number;
    sellIncVat: number;
  };
  warnings: string[];
  disclaimer: string;
  classification: EstimateClassification;
}

export interface ActualRecord {
  estimateId: string;
  actualMaterial: number;
  actualLabour: number;
  actualFinalValue: number;
  notes: string;
  createdAt: string;
}

export interface ImportIssue {
  row: number;
  severity: "error" | "warning";
  code: "duplicate" | "conflict" | "invalid-unit" | "missing-price" | "encoding" | "superseded" | "missing-source" | "requires-approval" | "unsupported-record-type" | "invalid-confidence";
  message: string;
}

export interface StagedImportRecord {
  recordType: RecordType;
  code: string;
  status: LifecycleStatus;
  confidence: Confidence;
  source: string;
  active: boolean;
  data: Material | Resource | Assembly | CommercialRules | ProductivityRecord | Record<string, unknown>;
  governance: Governance;
  lineage: SourceLineage;
}
