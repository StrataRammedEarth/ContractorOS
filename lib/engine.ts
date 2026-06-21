import { authorityWarning, isClientSafe, isUsableForEstimate, resolveAuthorityState } from "./authority";
import type { Assembly, AuthorityState, BuyLine, BuildLine, CostElementCode, CostElementDefinition, EstimateClassCode, EstimateClassification, EstimateElementBreakdown, EstimateInput, EstimateLine, EstimateSnapshot, FeatureCode, FeatureDefinition, LibraryData } from "./types";

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const nonFinalDisclaimer = "ContractorOS outputs are exploratory estimates, not final binding quotes. The user remains responsible for site inspection, review, supplier confirmation, and final quote approval. Internal assumptions and warnings are listed separately from estimate line items.";
const classificationSource = "ContractorOS_Cost_Model_Staging_Workbook_2026 - Estimate Classification sheet";
const classificationSourceUrl = "https://docs.google.com/spreadsheets/d/1j_PaKBfGV5sAezlvVlRDagL131icKpUsHNVWnsM1stI/edit?usp=drivesdk";
const elementalSource = "ContractorOS_Cost_Model_Staging_Workbook_2026 - Elemental Cost Structure sheet";
const elementalSourceUrl = classificationSourceUrl;
const featureSchemaSource = "ContractorOS_Cost_Model_Staging_Workbook_2026 - Feature Schema sheet";
const featureSchemaSourceUrl = classificationSourceUrl;

export const costElementDefinitions: Record<CostElementCode, CostElementDefinition> = {
  GROUND_FLOOR_CONSTRUCTION: {
    code: "GROUND_FLOOR_CONSTRUCTION",
    name: "Ground floor construction",
    description: "Foundations, ground floor construction and associated base building work.",
    contractorOsUse: "Estimate output group; benchmark bucket",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: elementalSource,
    sourceUrl: elementalSourceUrl,
    sourceLocation: "Elemental Cost Structure sheet, GROUND_FLOOR_CONSTRUCTION",
    governanceNote: "Can be adopted as structure, not as price.",
  },
  EXTERNAL_ENVELOPE: {
    code: "EXTERNAL_ENVELOPE",
    name: "External envelope",
    description: "External walls, external doors/windows, envelope-related wall geometry.",
    contractorOsUse: "Estimate output group; feature scaling target",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: elementalSource,
    sourceUrl: elementalSourceUrl,
    sourceLocation: "Elemental Cost Structure sheet, EXTERNAL_ENVELOPE",
    governanceNote: "Sub-elements should distinguish walls vs openings.",
  },
  ROOF: {
    code: "ROOF",
    name: "Roof",
    description: "Roof construction and roof covering; driven by roof area and pitch.",
    contractorOsUse: "Estimate output group; roof assembly scaling",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: elementalSource,
    sourceUrl: elementalSourceUrl,
    sourceLocation: "Elemental Cost Structure sheet, ROOF",
    governanceNote: "Use raw components for app estimates.",
  },
  INTERNAL_DIVISIONS: {
    code: "INTERNAL_DIVISIONS",
    name: "Internal divisions",
    description: "Internal walls, rooms, bedrooms and wall heights.",
    contractorOsUse: "Estimate output group; sanity check bucket",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: elementalSource,
    sourceUrl: elementalSourceUrl,
    sourceLocation: "Elemental Cost Structure sheet, INTERNAL_DIVISIONS",
    governanceNote: "Useful for masonry/drywall assemblies.",
  },
  FFE: {
    code: "FFE",
    name: "Furniture, fixtures and equipment",
    description: "Length of fitted furniture, fixtures and equipment.",
    contractorOsUse: "Optional element for residential/project fixtures",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: elementalSource,
    sourceUrl: elementalSourceUrl,
    sourceLocation: "Elemental Cost Structure sheet, FFE",
    governanceNote: "May be excluded from some ContractorOS estimates.",
  },
  PLUMBING_SERVICES: {
    code: "PLUMBING_SERVICES",
    name: "Plumbing services",
    description: "Sewer, sanitary pipework, water supply, sanitary fittings, geysers, shower cubicles and accessories.",
    contractorOsUse: "Plumbing estimate element; fixture-driven scaling",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: elementalSource,
    sourceUrl: elementalSourceUrl,
    sourceLocation: "Elemental Cost Structure sheet, PLUMBING_SERVICES",
    governanceNote: "Supports rebuilding plumbing kits from components.",
  },
  ELECTRICAL_MECHANICAL: {
    code: "ELECTRICAL_MECHANICAL",
    name: "Electrical / mechanical services",
    description: "Electrical and mechanical services; linked to construction area in the source model.",
    contractorOsUse: "Estimate output group; later data capture target",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: elementalSource,
    sourceUrl: elementalSourceUrl,
    sourceLocation: "Elemental Cost Structure sheet, ELECTRICAL_MECHANICAL",
    governanceNote: "Requires ContractorOS-specific electrical scope before active use.",
  },
};

export const featureSchemaDefinitions: Record<FeatureCode, FeatureDefinition> = {
  CONSTRUCTION_AREA: {
    code: "CONSTRUCTION_AREA",
    name: "Construction area",
    measurementUnit: "m2",
    description: "Overall construction area used as a cost-size driver.",
    usedByElements: ["GROUND_FLOOR_CONSTRUCTION", "ELECTRICAL_MECHANICAL"],
    suggestedInputControl: "Number input",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, CONSTRUCTION_AREA",
  },
  STRUCTURE_AREA: {
    code: "STRUCTURE_AREA",
    name: "Area of structure",
    measurementUnit: "m2",
    description: "Structural footprint/area measure for foundation/floor relationships.",
    usedByElements: ["GROUND_FLOOR_CONSTRUCTION"],
    suggestedInputControl: "Number input",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, STRUCTURE_AREA",
  },
  ROOF_AREA_SLOPE: {
    code: "ROOF_AREA_SLOPE",
    name: "Roof area on slope",
    measurementUnit: "m2",
    description: "Roof area measured on slope.",
    usedByElements: ["ROOF"],
    suggestedInputControl: "Number input",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, ROOF_AREA_SLOPE",
  },
  ROOF_PITCH: {
    code: "ROOF_PITCH",
    name: "Roof pitch",
    measurementUnit: "degrees or ratio",
    description: "Pitch of roof; retained for classification and roof cost context.",
    usedByElements: ["ROOF"],
    suggestedInputControl: "Number / select",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, ROOF_PITCH",
  },
  EXTERNAL_ENVELOPE_AREA: {
    code: "EXTERNAL_ENVELOPE_AREA",
    name: "External envelope area",
    measurementUnit: "m2",
    description: "External wall/elevation surface area.",
    usedByElements: ["EXTERNAL_ENVELOPE"],
    suggestedInputControl: "Number input",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, EXTERNAL_ENVELOPE_AREA",
  },
  WALL_HEIGHTS: {
    code: "WALL_HEIGHTS",
    name: "Wall height(s)",
    measurementUnit: "m",
    description: "External/internal wall height driver.",
    usedByElements: ["EXTERNAL_ENVELOPE", "INTERNAL_DIVISIONS"],
    suggestedInputControl: "Number or grouped inputs",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, WALL_HEIGHTS",
  },
  EXTERNAL_OPENINGS_AREA: {
    code: "EXTERNAL_OPENINGS_AREA",
    name: "Area of external doors and windows",
    measurementUnit: "m2",
    description: "Total external door/window opening area.",
    usedByElements: ["EXTERNAL_ENVELOPE"],
    suggestedInputControl: "Number input",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, EXTERNAL_OPENINGS_AREA",
  },
  EXTERNAL_WALL_LENGTH: {
    code: "EXTERNAL_WALL_LENGTH",
    name: "Length of external walls",
    measurementUnit: "m",
    description: "Total external wall length.",
    usedByElements: ["EXTERNAL_ENVELOPE"],
    suggestedInputControl: "Number input",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, EXTERNAL_WALL_LENGTH",
  },
  EXTERNAL_CORNERS: {
    code: "EXTERNAL_CORNERS",
    name: "Number of corners in external walls",
    measurementUnit: "count",
    description: "Shape/complexity driver.",
    usedByElements: ["EXTERNAL_ENVELOPE"],
    suggestedInputControl: "Whole number input",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, EXTERNAL_CORNERS",
  },
  INTERNAL_WALL_LENGTH: {
    code: "INTERNAL_WALL_LENGTH",
    name: "Length of internal walls",
    measurementUnit: "m",
    description: "Total internal wall length.",
    usedByElements: ["INTERNAL_DIVISIONS"],
    suggestedInputControl: "Number input",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, INTERNAL_WALL_LENGTH",
  },
  ROOM_COUNT: {
    code: "ROOM_COUNT",
    name: "Number of rooms",
    measurementUnit: "count",
    description: "Planning/layout complexity driver.",
    usedByElements: ["INTERNAL_DIVISIONS"],
    suggestedInputControl: "Whole number input",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, ROOM_COUNT",
  },
  BEDROOM_COUNT: {
    code: "BEDROOM_COUNT",
    name: "Number of bedrooms",
    measurementUnit: "count",
    description: "Residential layout driver.",
    usedByElements: ["INTERNAL_DIVISIONS"],
    suggestedInputControl: "Whole number input",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, BEDROOM_COUNT",
  },
  SANITARY_FITTINGS: {
    code: "SANITARY_FITTINGS",
    name: "Number of sanitary fittings",
    measurementUnit: "count",
    description: "Fixture count for plumbing service scaling.",
    usedByElements: ["PLUMBING_SERVICES"],
    suggestedInputControl: "Whole number input",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, SANITARY_FITTINGS",
  },
  FFE_LENGTH: {
    code: "FFE_LENGTH",
    name: "Length of furniture, fixtures and equipment",
    measurementUnit: "m",
    description: "Linear length of FFE items.",
    usedByElements: ["FFE"],
    suggestedInputControl: "Number input",
    recordType: "feature_record",
    authorityClassification: "Approved",
    approvalState: "approved",
    approvedBy: "ContractorOS owner",
    source: featureSchemaSource,
    sourceUrl: featureSchemaSourceUrl,
    sourceLocation: "Feature Schema sheet, FFE_LENGTH",
  },
};

export const estimateClassificationRules: Record<EstimateClassCode, Omit<EstimateClassification, "code" | "rationale">> = {
  CLASS_1: {
    label: "Detailed quantity estimate",
    sourceMethod: "Detailed unit cost",
    dataBasis: "Detailed take-off",
    expectedLowRange: "-3% to -5%",
    expectedHighRange: "+3% to +10%",
    uiWarning: "Detailed estimate based on measured quantities.",
    governanceStatus: "Approved",
    approvedBy: "ContractorOS owner",
    source: classificationSource,
    sourceUrl: classificationSourceUrl,
    sourceLocation: "Estimate Classification sheet, Class 1",
  },
  CLASS_2: {
    label: "Detailed approximate estimate",
    sourceMethod: "Detailed unit cost",
    dataBasis: "Forced detailed take-off / approximate quantities",
    expectedLowRange: "-5% to -10%",
    expectedHighRange: "+5% to +15%",
    uiWarning: "Detailed structure with some approximate quantities.",
    governanceStatus: "Approved",
    approvedBy: "ContractorOS owner",
    source: classificationSource,
    sourceUrl: classificationSourceUrl,
    sourceLocation: "Estimate Classification sheet, Class 2",
  },
  CLASS_3: {
    label: "Assembly estimate",
    sourceMethod: "Semi-detailed unit cost",
    dataBasis: "Assembly-level line items / provisional BoQ",
    expectedLowRange: "-5% to -15%",
    expectedHighRange: "+10% to +20%",
    uiWarning: "Assembly-based estimate; review assumptions before quote.",
    governanceStatus: "Approved",
    approvedBy: "ContractorOS owner",
    source: classificationSource,
    sourceUrl: classificationSourceUrl,
    sourceLocation: "Estimate Classification sheet, Class 3",
  },
  CLASS_4: {
    label: "Elemental estimate",
    sourceMethod: "Parametric / assembly-driven",
    dataBasis: "Elemental estimate",
    expectedLowRange: "-10% to -20%",
    expectedHighRange: "+20% to +30%",
    uiWarning: "Elemental estimate for planning and comparison.",
    governanceStatus: "Approved",
    approvedBy: "ContractorOS owner",
    source: classificationSource,
    sourceUrl: classificationSourceUrl,
    sourceLocation: "Estimate Classification sheet, Class 4",
  },
  CLASS_5: {
    label: "Concept benchmark estimate",
    sourceMethod: "Parametric / judgement / analogy",
    dataBasis: "Cost per m2 or cost per unit",
    expectedLowRange: "-20% to -30%",
    expectedHighRange: "+30% to +50%",
    uiWarning: "Concept estimate; not a final quote.",
    governanceStatus: "Approved",
    approvedBy: "ContractorOS owner",
    source: classificationSource,
    sourceUrl: classificationSourceUrl,
    sourceLocation: "Estimate Classification sheet, Class 5",
  },
};

export function calculateEstimate(input: EstimateInput, library: LibraryData, version = 1): EstimateSnapshot {
  const warnings: string[] = [];
  const buyMap = new Map<string, BuyLine>();
  const build: BuildLine[] = [];
  const lines: EstimateLine[] = [];

  for (const scope of input.scope.filter((item) => item.quantity > 0)) {
    const assembly = library.assemblies.find((item) => item.code === scope.assemblyCode && item.status === "Active" && isUsableForEstimate(item));
    if (!assembly) {
      const unavailable = library.assemblies.find((item) => item.code === scope.assemblyCode);
      const state = resolveAuthorityState(unavailable);
      warnings.push(`${scope.assemblyCode}: active usable assembly not found${unavailable ? ` (${state})` : ""}.`);
      continue;
    }
    const assemblyAuthorityState = resolveAuthorityState(assembly);
    const factor = scope.quantity / assembly.baseQuantity;
    const lineWarnings: string[] = [];
    let materialTotal = 0;
    let labourTotal = 0;
    const assemblyAuthorityWarning = authorityWarning(assembly.code, assemblyAuthorityState);
    if (assemblyAuthorityWarning) lineWarnings.push(assemblyAuthorityWarning);

    for (const recipe of assembly.recipe) {
      const material = library.materials.find((item) => item.code === recipe.materialCode && item.active && isUsableForEstimate(item));
      if (!material || material.unitRate == null) {
        lineWarnings.push(`${recipe.materialCode}: active material price is missing.`);
        continue;
      }
      const materialAuthorityState = resolveAuthorityState(material);
      const materialAuthorityWarning = authorityWarning(material.code, materialAuthorityState);
      if (materialAuthorityWarning) lineWarnings.push(materialAuthorityWarning);
      const quantity = recipe.quantity * factor;
      const total = money(quantity * material.unitRate);
      materialTotal += total;
      const current = buyMap.get(material.code);
      buyMap.set(material.code, {
        materialCode: material.code,
        description: material.description,
        supplier: material.supplier,
        unit: material.unit,
        quantity: money((current?.quantity ?? 0) + quantity),
        unitRate: material.unitRate,
        total: money((current?.total ?? 0) + total),
        confidence: material.confidence,
        authorityState: mergeAuthorityStates(current?.authorityState, materialAuthorityState),
        lineage: material.lineage,
      });
    }

    for (const labour of assembly.labour) {
      const resource = library.resources.find((item) => item.code === labour.resourceCode && isUsableForEstimate(item));
      if (!resource) {
        lineWarnings.push(`${labour.resourceCode}: labour resource is missing.`);
        continue;
      }
      const resourceAuthorityState = resolveAuthorityState(resource);
      const resourceAuthorityWarning = authorityWarning(resource.code, resourceAuthorityState);
      if (resourceAuthorityWarning) lineWarnings.push(resourceAuthorityWarning);
      const quantity = labour.quantity * factor;
      const total = money(quantity * resource.rate);
      labourTotal += total;
      build.push({
        assemblyCode: assembly.code,
        activity: labour.activity,
        resource: resource.name,
        quantity: money(quantity),
        unit: resource.unit,
        rate: resource.rate,
        total,
        confidence: resource.confidence,
        authorityState: resourceAuthorityState,
        lineage: resource.lineage,
      });
    }

    if (assembly.basePrimeCost != null && assembly.recipe.length === 0 && assembly.labour.length === 0) {
      materialTotal = money((assembly.baseMaterialCost ?? assembly.basePrimeCost) * factor);
      labourTotal = money((assembly.baseLabourCost ?? 0) * factor);
    }

    if (assembly.governance?.placeholder) {
      lineWarnings.push(`${assembly.code} uses exploration placeholder data and needs owner approval before Locked promotion.`);
    }
    if (assembly.confidence === "Provisional" || assembly.confidence === "Assumption" || assembly.confidence === "Unknown") {
      lineWarnings.push(`${assembly.code} is ${assembly.confidence.toLowerCase()} grade and requires review.`);
    }
    if (lineWarnings.length) warnings.push(...lineWarnings);

    const costElement = resolveCostElement(assembly);

    lines.push({
      code: assembly.code,
      description: assembly.name,
      trade: assembly.trade,
      costElement,
      quantity: scope.quantity,
      unit: assembly.unit,
      material: money(materialTotal),
      labour: money(labourTotal),
      prime: money(materialTotal + labourTotal),
      confidence: assembly.confidence,
      authorityState: assemblyAuthorityState,
      lineage: assembly.lineage,
      warnings: lineWarnings,
    });
  }

  if (!lines.length) warnings.push("Enter at least one quantity greater than zero before finalising.");

  const material = money(lines.reduce((sum, line) => sum + line.material, 0));
  const labour = money(lines.reduce((sum, line) => sum + line.labour, 0));
  const prime = money(material + labour);
  const waste = money(material * library.rules.wastePct / 100);
  const direct = money(prime + waste);
  const risk = money(direct * library.rules.riskPct / 100);
  const riskAdjusted = money(direct + risk);
  const contingency = money(riskAdjusted * library.rules.contingencyPct / 100);
  const cost = money(riskAdjusted + contingency);
  const markup = money(cost * library.rules.marginPct / 100);
  const sellExVat = money(cost + markup);
  const vat = input.vatEnabled ? money(sellExVat * library.rules.vatPct / 100) : 0;
  const sellIncVat = money(sellExVat + vat);
  if (library.rules.governance?.placeholder) {
    warnings.push(`Commercial rules include exploration placeholders: waste ${library.rules.wasteMinPct ?? library.rules.wastePct}-${library.rules.wasteMaxPct ?? library.rules.wastePct}%, risk ${library.rules.riskPct}%, contingency ${library.rules.contingencyPct}%, markup ${library.rules.marginPct}%.`);
  }

  const classification = classifyEstimate(lines, input, library, warnings);
  const elementalBreakdown = buildElementalBreakdown(lines, prime);

  return {
    id: crypto.randomUUID(),
    version,
    createdAt: new Date().toISOString(),
    input: structuredClone(input),
    lines,
    elementalBreakdown,
    featureSchema: Object.values(featureSchemaDefinitions),
    buy: [...buyMap.values()].sort((a, b) => a.supplier.localeCompare(b.supplier) || a.description.localeCompare(b.description)),
    build,
    rules: structuredClone(library.rules),
    totals: { material, labour, prime, waste, direct, risk, riskAdjusted, contingency, cost, margin: markup, sellExVat, vat, sellIncVat },
    warnings: [...new Set(warnings)],
    disclaimer: nonFinalDisclaimer,
    classification,
  };
}

export function validateForFinal(snapshot: EstimateSnapshot) {
  return {
    valid: snapshot.lines.length > 0 && !snapshot.warnings.some((warning) => warning.includes("missing") || warning.includes("not found")),
    warnings: snapshot.warnings,
  };
}

export function validateClientProposal(snapshot: EstimateSnapshot) {
  const rulesAuthorityState = resolveAuthorityState(snapshot.rules);
  const blockingWarnings = [
    ...(isClientSafe(rulesAuthorityState) ? [] : [`Commercial rules: ${rulesAuthorityState} is not client-output safe.`]),
    ...snapshot.lines.flatMap((line) => isClientSafe(line.authorityState) ? [] : [`${line.code}: ${line.authorityState} is not client-output safe.`]),
    ...snapshot.buy.flatMap((line) => isClientSafe(line.authorityState) ? [] : [`${line.materialCode}: ${line.authorityState} material is not client-output safe.`]),
    ...snapshot.build.flatMap((line) => isClientSafe(line.authorityState) ? [] : [`${line.assemblyCode}: ${line.authorityState} labour/resource is not client-output safe.`]),
  ];
  return {
    valid: validateForFinal(snapshot).valid && blockingWarnings.length === 0,
    warnings: [...snapshot.warnings, ...blockingWarnings],
  };
}

export function assemblyPrime(assembly: Assembly, quantity: number) {
  return money((assembly.basePrimeCost ?? 0) * quantity / assembly.baseQuantity);
}

function classifyEstimate(lines: EstimateLine[], input: EstimateInput, library: LibraryData, warnings: string[]): EstimateClassification {
  const selectedAssemblies = input.scope
    .filter((item) => item.quantity > 0)
    .map((scope) => library.assemblies.find((assembly) => assembly.code === scope.assemblyCode && assembly.status === "Active" && isUsableForEstimate(assembly)))
    .filter((assembly): assembly is Assembly => Boolean(assembly));

  const rationale: string[] = [];
  let code: EstimateClassCode = "CLASS_5";

  if (!lines.length) {
    rationale.push("No active estimate lines are present, so the output remains a concept benchmark until scope is selected.");
  } else {
    const hasBenchmarkOnlyAssembly = selectedAssemblies.some((assembly) => assembly.basePrimeCost != null && assembly.recipe.length === 0 && assembly.labour.length === 0);
    const hasPlaceholder = selectedAssemblies.some((assembly) => resolveAuthorityState(assembly) === "exploration_approved");
    const hasUnreviewedConfidence = lines.some((line) => ["Provisional", "Assumption", "Unknown"].includes(line.confidence));
    const allComponentized = selectedAssemblies.length === lines.length && selectedAssemblies.every((assembly) => assembly.recipe.length > 0 || assembly.labour.length > 0);
    const allValidatedOrLocked = lines.every((line) => line.confidence === "Validated" || line.confidence === "Locked");

    if (hasBenchmarkOnlyAssembly) {
      code = "CLASS_5";
      rationale.push("At least one selected assembly is benchmark-only rather than built from component quantities.");
    } else if (allComponentized && allValidatedOrLocked && !hasPlaceholder && !warnings.length) {
      code = "CLASS_2";
      rationale.push("All selected assemblies are componentized and validated or locked, with no current review warnings.");
      rationale.push("Class 1 is reserved for a true detailed quantity take-off, which ContractorOS does not yet produce.");
    } else if (allComponentized) {
      code = "CLASS_3";
      rationale.push("The estimate is assembled from governed assembly-level line items and component recipes.");
      if (hasPlaceholder) rationale.push("One or more selected assemblies still use exploration placeholder data.");
      if (hasUnreviewedConfidence) rationale.push("One or more selected assemblies have provisional, assumption, or unknown confidence.");
    } else {
      code = "CLASS_4";
      rationale.push("The estimate uses active assemblies but lacks enough component detail for detailed or assembly-level classification.");
    }
  }

  return {
    code,
    ...estimateClassificationRules[code],
    rationale,
  };
}

function mergeAuthorityStates(left: AuthorityState | undefined, right: AuthorityState): AuthorityState {
  if (!left) return right;
  if (left === "withdrawn_corrected" || right === "withdrawn_corrected") return "withdrawn_corrected";
  if (left === "staged" || right === "staged") return "staged";
  if (left === "exploration_approved" || right === "exploration_approved") return "exploration_approved";
  return "approved_locked";
}

function resolveCostElement(assembly: Assembly): CostElementCode {
  if (assembly.trade === "Plumbing") return "PLUMBING_SERVICES";
  if (assembly.trade === "Masonry") return "INTERNAL_DIVISIONS";
  if (assembly.trade === "Decking") return "GROUND_FLOOR_CONSTRUCTION";
  return "GROUND_FLOOR_CONSTRUCTION";
}

function buildElementalBreakdown(lines: EstimateLine[], totalPrime: number): EstimateElementBreakdown[] {
  const byElement = new Map<CostElementCode, EstimateLine[]>();
  for (const line of lines) {
    const current = byElement.get(line.costElement) ?? [];
    current.push(line);
    byElement.set(line.costElement, current);
  }

  return Object.values(costElementDefinitions)
    .map((definition) => {
      const elementLines = byElement.get(definition.code) ?? [];
      const material = money(elementLines.reduce((sum, line) => sum + line.material, 0));
      const labour = money(elementLines.reduce((sum, line) => sum + line.labour, 0));
      const prime = money(material + labour);
      return {
        code: definition.code,
        name: definition.name,
        description: definition.description,
        material,
        labour,
        prime,
        percentOfPrime: totalPrime > 0 ? money(prime / totalPrime * 100) : 0,
        sourceLocation: definition.sourceLocation,
        governanceNote: definition.governanceNote,
        lineCodes: elementLines.map((line) => line.code),
      };
    })
    .filter((element) => element.prime > 0 || element.lineCodes.length > 0);
}
