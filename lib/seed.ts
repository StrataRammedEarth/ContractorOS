import type { Assembly, AuthorityState, CommercialRules, Confidence, Governance, LibraryData, Material, Resource, SourceLineage, StagedImportRecord } from "./types";

const sourceUrl = "https://drive.google.com/drive/folders/11dK-8qXg0M_vJQ90utyaiaDRlgtyHZOG";
const manifestFile = "data/contractoros_record_manifest.json";
const prototypeConstantsFile = "data/prototype_embedded_constants.json";
const masonryTaskFile = "data/VAL-005_masonry_validation_task.md";

type GovernedType = "material" | "resource" | "assembly" | "commercial_rule" | "assumption" | "validation" | "source";

function governed(
  recordType: GovernedType,
  source: string,
  authorityState: AuthorityState,
  options: {
    placeholder?: boolean;
    lifecycle?: Governance["lifecycle"];
    authority?: Governance["authority"];
    approval?: Governance["approval"];
    notes?: string;
    effectiveDate?: string;
    sourceRecordId?: string;
    manifestId?: string;
    revision?: string;
    validationRef?: string;
    supersedes?: string;
    supersededBy?: string;
  } = {},
) {
  const placeholder = options.placeholder ?? authorityState === "exploration_approved";
  const lifecycle =
    options.lifecycle
    ?? (authorityState === "staged" ? "pending" : authorityState === "withdrawn_corrected" ? "withdrawn" : "active");
  const approval =
    options.approval
    ?? (authorityState === "staged" ? "staged" : authorityState === "approved_locked" ? "locked" : authorityState === "withdrawn_corrected" ? "withdrawn" : "approved");
  const authority =
    options.authority
    ?? (authorityState === "approved_locked" ? "validated" : authorityState === "withdrawn_corrected" ? "corrected" : placeholder ? "provisional" : "canonical");

  return {
    governance: {
      recordType,
      lifecycle,
      authority,
      approval,
      authorityState,
      placeholder,
      ownerApprovalRequired: authorityState === "staged",
      approver: authorityState === "staged" ? undefined : "Owner",
      approvedAt: authorityState === "staged" ? undefined : "2026-06-21T00:00:00.000Z",
      supersedes: options.supersedes,
      supersededBy: options.supersededBy,
      notes: options.notes,
    } satisfies Governance,
    lineage: {
      sourceFile: source,
      sourceUrl,
      sourceRecordId: options.sourceRecordId,
      manifestId: options.manifestId,
      revision: options.revision,
      validationRef: options.validationRef,
      effectiveDate: options.effectiveDate ?? "2026-06-15",
      reviewedAt: "2026-06-21T00:00:00.000Z",
    } satisfies SourceLineage,
  };
}

function material(
  code: string,
  description: string,
  unit: string,
  unitRate: number,
  supplier: string,
  source: string,
  options: { sourceRecordId?: string; manifestId?: string; revision?: string; validationRef?: string } = {},
): Material {
  return {
    ...governed("material", source, "approved_locked", {
      manifestId: options.manifestId ?? `MAN-${code}`,
      revision: options.revision ?? "r1",
      sourceRecordId: options.sourceRecordId ?? code,
      validationRef: options.validationRef,
      notes: "Approved locked seed material. Every estimate line must trace to this manifest lineage.",
    }),
    code,
    description,
    unit,
    unitRate,
    supplier,
    confidence: "Locked",
    source,
    active: true,
  };
}

export const materials: Material[] = [
  material("BE1WH813", "CTM Coral White Toilet Suite", "ea", 929.9, "CTM", "PLUMB_KB_v1.0_LOCKED-1"),
  material("29892", "Angle Valve", "ea", 65.21, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("34675", "Pan Connector Jollyflex 350mm", "ea", 190.43, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("RCM-WC-001", "White Sikaflex 310ml", "tube", 129.9, "Project Architect", "PLUMB_KB_v1.0_LOCKED-1"),
  material("BE1WH9102", "Basin Starna White", "ea", 649.9, "CTM", "PLUMB_KB_v1.0_LOCKED-1"),
  material("AfriCamps", "Basin Mixer", "ea", 489.63, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("32232", "Basin Waste Pop-up Unslotted", "ea", 141.04, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("35486", "Bottle Trap Universal", "ea", 216.52, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("185", "Braided Hose 350mm", "ea", 42.61, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("RCM-BSN-001", "Mould Resistant Silicone", "tube", 89.9, "Project Architect", "PLUMB_KB_v1.0_LOCKED-1"),
  material("34147", "Shower Mixer Classic", "ea", 355.65, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("30728", "Konex Female Elbow shower arm", "ea", 33.72, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("30730", "Konex Female Elbow mixer", "ea", 29.17, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("7321", "Shower Arm 350mm Round", "ea", 139, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("7316", "Shower Rose 200mm Stainless Steel", "ea", 477.39, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("15501", "Shower Waste Drain Stainless Steel", "ea", 328.38, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("1924", "PVC 40-50mm Adaptor", "ea", 8.78, "Africamps procurement", "PLUMB_KB_v1.0_LOCKED-1"),
  material("CT8006", "Glass Shower Door Chrome", "ea", 3559, "CTM", "PLUMB_KB_v1.0_LOCKED-1"),
  material("RCM-SHWD-PRATLEY", "Pratley Steel Quick Set", "ea", 74.9, "Project Architect", "PLUMB_KB_v1.0_LOCKED-1"),
  material("RCM-SHWD-EPOXY", "Epoxy Syringe", "ea", 12.9, "Project Architect", "PLUMB_KB_v1.0_LOCKED-1"),
  material("DCK-S01", "SA Pine Decking Plank 21x108x4800", "ea", 169.5, "Africamps source truth", "VAL-004_Source_Truth_Archive", { validationRef: "VAL-004" }),
  material("DCK-S02", "Chipboard Screw 5x60mm", "ea", 0.35, "Africamps source truth", "VAL-004_Source_Truth_Archive", { validationRef: "VAL-004" }),
  material("DCK-B01", "Treated Pine Beam 38x114mm", "ea", 127, "Africamps source truth", "VAL-004_Source_Truth_Archive", { validationRef: "VAL-004" }),
  material("DCK-B02", "Treated Pine Beam 50x152mm", "ea", 291, "Africamps source truth", "VAL-004_Source_Truth_Archive", { validationRef: "VAL-004" }),
  material("DCK-B03", "M12 Threaded Rod cut length", "ea", 2.95, "Africamps source truth", "VAL-004_Source_Truth_Archive", { validationRef: "VAL-004" }),
  material("DCK-B04", "M12 Washer 24mm galvanised", "ea", 0.35, "Africamps source truth", "VAL-004_Source_Truth_Archive", { validationRef: "VAL-004" }),
  material("DCK-B05", "M12 Nut galvanised", "ea", 1.07, "Africamps source truth", "VAL-004_Source_Truth_Archive", { validationRef: "VAL-004" }),
];

export const resources: Resource[] = [
  {
    ...governed("resource", "PLUMB_Productivity_Library_v1", "approved_locked", {
      manifestId: "MAN-PLM-LAB-001",
      revision: "r1",
      sourceRecordId: "PLM-LAB-001",
      notes: "Approved plumbing labour record.",
    }),
    code: "PLM-LAB-001",
    name: "Plumbing Assistant",
    unit: "hour",
    rate: 32.5,
    confidence: "Validated",
    source: "PLUMB_Productivity_Library_v1",
  },
  {
    ...governed("resource", "14_Plumbing_Resource_Library-1", "approved_locked", {
      manifestId: "MAN-PLM-LAB-002",
      revision: "r1",
      sourceRecordId: "PLM-LAB-002",
      notes: "Approved supervising plumber record.",
    }),
    code: "PLM-LAB-002",
    name: "Supervising Plumber",
    unit: "day",
    rate: 600,
    confidence: "Validated",
    source: "14_Plumbing_Resource_Library-1",
  },
  {
    ...governed("resource", "ARCH-UPDATE-035", "exploration_approved", {
      manifestId: "MAN-DCK-CREW-001",
      revision: "r1",
      sourceRecordId: "DCK-CREW-001",
      validationRef: "VAL-004",
      notes: "Accepted exploration-approved deck labour record pending bottom-up rebuild lock.",
    }),
    code: "DCK-CREW-001",
    name: "Carpenter and Labourer Crew",
    unit: "day",
    rate: 1000,
    confidence: "Validated",
    source: "ARCH-UPDATE-035",
  },
  {
    ...governed("resource", "MASONRY_KB_v1", "exploration_approved", {
      manifestId: "MAN-BRK-CREW-001",
      revision: "r1",
      sourceRecordId: "BRK-CREW-001",
      validationRef: "VAL-005",
      notes: "Exploration-approved masonry labour record pending contractor validation call.",
    }),
    code: "BRK-CREW-001",
    name: "Masonry Crew",
    unit: "hour",
    rate: 200,
    confidence: "Assumption",
    source: "MASONRY_KB_v1",
  },
];

const fixtureRecipe: Assembly["recipe"] = [
  { materialCode: "BE1WH813", quantity: 1 }, { materialCode: "29892", quantity: 3 },
  { materialCode: "34675", quantity: 1 }, { materialCode: "RCM-WC-001", quantity: 0.3 },
  { materialCode: "BE1WH9102", quantity: 1 }, { materialCode: "AfriCamps", quantity: 1 },
  { materialCode: "32232", quantity: 1 }, { materialCode: "35486", quantity: 1 },
  { materialCode: "185", quantity: 2 }, { materialCode: "RCM-BSN-001", quantity: 0.3 },
  { materialCode: "34147", quantity: 1 }, { materialCode: "30728", quantity: 1 },
  { materialCode: "30730", quantity: 2 }, { materialCode: "7321", quantity: 1 },
  { materialCode: "7316", quantity: 1 }, { materialCode: "15501", quantity: 1 },
  { materialCode: "1924", quantity: 1 }, { materialCode: "CT8006", quantity: 1 },
  { materialCode: "RCM-SHWD-PRATLEY", quantity: 1 }, { materialCode: "RCM-SHWD-EPOXY", quantity: 1 },
];

function assembly(
  code: string,
  name: string,
  trade: Assembly["trade"],
  unit: string,
  confidence: Confidence,
  source: string,
  authorityState: AuthorityState,
  overrides: Partial<Assembly> & { manifestId?: string; revision?: string; validationRef?: string; sourceRecordId?: string; notes?: string; supersedes?: string; supersededBy?: string },
): Assembly {
  const active = overrides.status ? overrides.status === "Active" : true;
  return {
    ...governed("assembly", source, authorityState, {
      manifestId: overrides.manifestId ?? `MAN-${code}`,
      revision: overrides.revision ?? "r1",
      validationRef: overrides.validationRef,
      sourceRecordId: overrides.sourceRecordId ?? code,
      supersedes: overrides.supersedes,
      supersededBy: overrides.supersededBy,
      notes: overrides.notes,
      lifecycle: active ? "active" : "archived",
    }),
    code,
    name,
    trade,
    unit,
    baseQuantity: overrides.baseQuantity ?? 1,
    basePrimeCost: overrides.basePrimeCost,
    baseMaterialCost: overrides.baseMaterialCost,
    baseLabourCost: overrides.baseLabourCost,
    confidence,
    status: overrides.status ?? "Active",
    source,
    notes: overrides.notes,
    recipe: overrides.recipe ?? [],
    labour: overrides.labour ?? [],
  };
}

export const assemblies: Assembly[] = [
  assembly("PLB-000", "Standard Africamps Plumbing Package", "Plumbing", "structure", "Locked", "Assembly_Scaling_Rules_v1.2 / PLB-000_Rebuild", "approved_locked", {
    baseQuantity: 1,
    basePrimeCost: 8491.02,
    baseMaterialCost: 8012.27,
    baseLabourCost: 478.75,
    validationRef: "VAL-PLB-000",
    revision: "r2",
    supersedes: "PLB-000@r1=6731.01",
    notes: "Current governed package total rebuilt from current children. Historical 6731.01 is superseded and retained only in reconciliation history.",
  }),
  assembly("PLB-001", "Cold Water Supply", "Plumbing", "pts", "Assumption", "Assembly_Scaling_Rules_v1.1", "exploration_approved", {
    status: "Archived",
    baseQuantity: 4,
    basePrimeCost: 2101.77,
    baseMaterialCost: 1841.77,
    baseLabourCost: 260,
    validationRef: "SRC-PROTOTYPE-CONSTANTS",
    supersededBy: "PLB-003@r2",
    notes: "Historical top-down placeholder. Retained for audit history only and excluded from calculations.",
  }),
  assembly("PLB-002", "Hot Water Supply", "Plumbing", "pts", "Assumption", "Assembly_Scaling_Rules_v1.1", "exploration_approved", {
    status: "Archived",
    baseQuantity: 3,
    basePrimeCost: 1749.47,
    baseMaterialCost: 1489.47,
    baseLabourCost: 260,
    validationRef: "SRC-PROTOTYPE-CONSTANTS",
    supersededBy: "PLB-003@r2",
    notes: "Historical top-down placeholder. Retained for audit history only and excluded from calculations.",
  }),
  assembly("PLB-003", "Fixture Installation Roll-up", "Plumbing", "structure", "Locked", "PLUMB_KB_v1.0_LOCKED-1 / DEP roll-up", "approved_locked", {
    baseQuantity: 1,
    basePrimeCost: 8191.02,
    baseMaterialCost: 8012.27,
    baseLabourCost: 178.75,
    recipe: fixtureRecipe,
    labour: [{ resourceCode: "PLM-LAB-001", quantity: 5.5, activity: "Fixture installation" }],
    validationRef: "VAL-PLB-003",
    revision: "r2",
    supersedes: "PLB-003@r1=2579.77",
    notes: "Current approved locked plumbing child rebuilt from detailed fixtures and labour. Historical 2579.77 is superseded.",
  }),
  assembly("PLB-KIT-001", "Standard Plumbing Fixture Kit", "Plumbing", "ea", "Validated", "PLUMB_KB_v1.0_LOCKED-1", "approved_locked", {
    baseQuantity: 1,
    recipe: fixtureRecipe,
    labour: [{ resourceCode: "PLM-LAB-001", quantity: 5.5, activity: "Standard Plumbing Fixture Kit installation" }],
    validationRef: "VAL-PLB-003",
    notes: "Detailed pilot assembly equivalent to the current PLB-003 governed roll-up.",
  }),
  assembly("DEP-WC-001", "Toilet Assembly", "Plumbing", "ea", "Validated", "PLUMB_KB_v1.0_LOCKED-1", "approved_locked", {
    recipe: [
      { materialCode: "BE1WH813", quantity: 1 }, { materialCode: "29892", quantity: 1 },
      { materialCode: "34675", quantity: 1 }, { materialCode: "RCM-WC-001", quantity: 0.3 },
    ],
    labour: [{ resourceCode: "PLM-LAB-001", quantity: 1.83, activity: "Toilet Assembly installation" }],
  }),
  assembly("DEP-BSN-001", "Basin Assembly", "Plumbing", "ea", "Validated", "PLUMB_KB_v1.0_LOCKED-1", "approved_locked", {
    recipe: [
      { materialCode: "BE1WH9102", quantity: 1 }, { materialCode: "AfriCamps", quantity: 1 },
      { materialCode: "32232", quantity: 1 }, { materialCode: "35486", quantity: 1 },
      { materialCode: "29892", quantity: 2 }, { materialCode: "185", quantity: 2 },
      { materialCode: "RCM-BSN-001", quantity: 0.3 },
    ],
    labour: [{ resourceCode: "PLM-LAB-001", quantity: 1.5, activity: "Basin Assembly installation" }],
  }),
  assembly("DEP-SHW-001", "Shower Assembly", "Plumbing", "ea", "Validated", "PLUMB_KB_v1.0_LOCKED-1", "approved_locked", {
    recipe: [
      { materialCode: "34147", quantity: 1 }, { materialCode: "30728", quantity: 1 },
      { materialCode: "30730", quantity: 2 }, { materialCode: "7321", quantity: 1 },
      { materialCode: "7316", quantity: 1 }, { materialCode: "15501", quantity: 1 },
      { materialCode: "1924", quantity: 1 },
    ],
    labour: [{ resourceCode: "PLM-LAB-001", quantity: 1.17, activity: "Shower Assembly installation" }],
  }),
  assembly("DEP-SHWD-001", "Shower Door Assembly", "Plumbing", "ea", "Validated", "PLUMB_KB_v1.0_LOCKED-1", "approved_locked", {
    recipe: [
      { materialCode: "CT8006", quantity: 1 }, { materialCode: "RCM-SHWD-PRATLEY", quantity: 1 },
      { materialCode: "RCM-SHWD-EPOXY", quantity: 1 },
    ],
    labour: [{ resourceCode: "PLM-LAB-001", quantity: 1, activity: "Shower Door Assembly installation" }],
  }),
  assembly("PLB-004", "Testing and Commissioning", "Plumbing", "allowance", "Validated", "15_Plumbing_Resource_Consumption_Mapping", "approved_locked", {
    baseQuantity: 1,
    basePrimeCost: 300,
    baseMaterialCost: 0,
    baseLabourCost: 300,
    validationRef: "VAL-PLB-000",
    notes: "Approved locked commissioning allowance for the plumbing package.",
  }),
  assembly("DCK-001", "Deck Construction", "Decking", "m2", "Provisional", "Assembly_Scaling_Rules_v1.2 / ARCH-UPDATE-035", "exploration_approved", {
    baseQuantity: 25,
    basePrimeCost: 12667.25,
    baseMaterialCost: 11667.25,
    baseLabourCost: 1000,
    recipe: [
      { materialCode: "DCK-S01", quantity: 46.75 }, { materialCode: "DCK-S02", quantity: 929.7142857143 },
      { materialCode: "DCK-B01", quantity: 16.3 }, { materialCode: "DCK-B02", quantity: 4.35 },
      { materialCode: "DCK-B03", quantity: 14.12 }, { materialCode: "DCK-B04", quantity: 28.25 },
      { materialCode: "DCK-B05", quantity: 28.25 },
    ],
    labour: [{ resourceCode: "DCK-CREW-001", quantity: 1, activity: "Deck construction" }],
    validationRef: "VAL-004",
    revision: "r2",
    supersedes: "DCK-001@r1=22142.25",
    notes: "Accepted exploration-approved placeholder. Current value is 12667.25 while bottom-up rebuild remains explicit pending work.",
  }),
  assembly("BAL-001", "Steel Cable Balustrade", "Decking", "m", "Provisional", "Assembly_Scaling_Rules_v1.2", "exploration_approved", {
    baseQuantity: 15,
    basePrimeCost: 4956.6,
    notes: "Labour placeholder pending first completed balustrade project. Internal-only until validated.",
  }),
  ...[
    ["BRK-001", "Half Brick Wall (face 1 side)", 417.7],
    ["BRK-002", "One Brick Wall (face 1 side)", 779.9],
    ["BRK-003", "One and Half Brick Wall", 1144.4],
    ["BRK-004", "Half Brick Wall (face 2 sides)", 441.7],
    ["BRK-005", "Half Brick Hollow Wall Skin", 441.7],
    ["BRK-FACE", "Face Brick Premium", 199.3],
  ].map(([code, name, cost]) => assembly(String(code), String(name), "Masonry", "m2", "Assumption", "MASONRY_KB_v1 / Assembly_Scaling_Rules_v1.2", "exploration_approved", {
    baseQuantity: 1,
    basePrimeCost: Number(cost),
    validationRef: "VAL-005",
    notes: "Exploration-approved masonry benchmark. Promote only after VAL-005 contractor call captures day rate, brick price per 1000, and m2/day output.",
  })),
];

export const rules: CommercialRules = {
  wastePct: 5,
  wasteMinPct: 5,
  wasteMaxPct: 10,
  riskPct: 5,
  contingencyPct: 10,
  marginPct: 25,
  vatPct: 15,
  ...governed("commercial_rule", "07_Commercial_Rules.csv", "exploration_approved", {
    manifestId: "MAN-COMMERCIAL-RULES",
    revision: "r1",
    sourceRecordId: "COMMERCIAL-RULES",
    notes: "Architect placeholder commercial factors retained for internal estimating only. The 25% factor is markup on cost, not gross margin. Lock current commercial rules only after owner approval confirms the intended realised margin.",
  }),
};

const governedRecord = (
  recordType: "assumption" | "validation" | "source",
  code: string,
  confidence: Confidence,
  source: string,
  authorityState: AuthorityState,
  notes: string,
  options: { status?: StagedImportRecord["status"]; active?: boolean; manifestId?: string; revision?: string; validationRef?: string; sourceRecordId?: string } = {},
): StagedImportRecord => {
  const seed = governed(recordType, source, authorityState, {
    manifestId: options.manifestId ?? `MAN-${code}`,
    revision: options.revision ?? "r1",
    validationRef: options.validationRef,
    sourceRecordId: options.sourceRecordId ?? code,
    notes,
    lifecycle: options.status,
  });
  const status = options.status ?? seed.governance.lifecycle;
  const active = options.active ?? status === "active";
  return {
    recordType,
    code,
    status,
    confidence,
    source,
    active,
    governance: {
      ...seed.governance,
      lifecycle: status,
      ownerApprovalRequired: authorityState === "staged",
    },
    lineage: seed.lineage,
    data: {
      code,
      confidence,
      source,
      active,
      notes,
      governance: {
        ...seed.governance,
        lifecycle: status,
        ownerApprovalRequired: authorityState === "staged",
      },
      lineage: seed.lineage,
    },
  };
};

export const seedLibrary: LibraryData = {
  materials,
  resources,
  assemblies,
  rules,
  governedRecords: [
    governedRecord("source", "SRC-MANIFEST-001", "Locked", manifestFile, "approved_locked", "Authoritative record-level manifest for Drive artifacts, reconciled rows, and mixed-status files.", { sourceRecordId: "manifest-root" }),
    governedRecord("source", "SRC-PROTOTYPE-CONSTANTS", "Assumption", prototypeConstantsFile, "exploration_approved", "Extracted prototype constants include orphan values such as Cobra PEX 15mm at R30.64 and unsourced Konex fitting rates. These remain quarantined from governed pricing until sourced."),
    governedRecord("validation", "VAL-PLB-003", "Locked", manifestFile, "approved_locked", "PLB-003 current value rebuilt to 8191.02 from detailed DEP fixture roll-up and locked as the current child revision."),
    governedRecord("validation", "VAL-PLB-000", "Locked", manifestFile, "approved_locked", "PLB-000 current value rebuilt to 8491.02 from current children PLB-003 and PLB-004; historical 6731.01 retained as superseded history."),
    governedRecord("validation", "VAL-004", "Validated", "VAL-004_Source_Truth_Archive", "exploration_approved", "DCK-001 reconciled to 12667.25 as accepted exploration placeholder. Historical 22142.25 remains audit-only until bottom-up rebuild completes."),
    governedRecord("validation", "VAL-005", "Assumption", masonryTaskFile, "staged", "Week-one masonry validation task: one contractor conversation must capture bricklayer day rate, brick price per 1000, and m2/day output before masonry can be promoted beyond exploration-approved.", { status: "pending", active: false }),
    governedRecord("assumption", "ASSUMP-PROTOTYPE-DEMO-ONLY", "Assumption", "ContractorOS_App.jsx", "exploration_approved", "The single-file prototype remains demoable but non-authoritative until the governed repo enforces authority state, traceability, and client proposal blocking."),
  ],
};
