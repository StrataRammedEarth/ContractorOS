import { describe, expect, it } from "vitest";
import { calculateEstimate, costElementDefinitions, estimateClassificationRules, featureSchemaDefinitions, validateClientProposal, validateForFinal } from "./engine";
import { seedLibrary } from "./seed";

const input = (code: string, quantity: number, vatEnabled = false) => ({
  projectName: "Test",
  clientName: "Test Client",
  reference: "TEST-001",
  vatEnabled,
  scope: [{ assemblyCode: code, quantity }],
});

const multiInput = () => ({
  projectName: "Test",
  clientName: "Test Client",
  reference: "TEST-002",
  vatEnabled: false,
  scope: [
    { assemblyCode: "PLB-KIT-001", quantity: 1 },
    { assemblyCode: "DCK-001", quantity: 25 },
    { assemblyCode: "BRK-001", quantity: 1 },
  ],
});

describe("reliable estimating core", () => {
  it("rebuilds PLB-000 as the current approved package and preserves historical trace separately", () => {
    const assembly = seedLibrary.assemblies.find((item) => item.code === "PLB-000");
    expect(assembly?.status).toBe("Active");
    expect(assembly?.governance?.authorityState).toBe("approved_locked");
    expect(calculateEstimate(input("PLB-000", 1), seedLibrary).totals.prime).toBe(8491.02);
  });

  it("matches the corrected DCK-001 25m2 prime benchmark", () => {
    const estimate = calculateEstimate(input("DCK-001", 25), seedLibrary);
    expect(estimate.totals.prime).toBe(12667.25);
    expect(estimate.buy.length).toBeGreaterThan(0);
    expect(estimate.lines[0]?.authorityState).toBe("exploration_approved");
  });

  it("builds the current PLB-003 plumbing child from materials and labour", () => {
    const estimate = calculateEstimate(input("PLB-003", 1), seedLibrary);
    expect(estimate.totals.material).toBe(8012.27);
    expect(estimate.totals.labour).toBe(178.75);
    expect(estimate.totals.prime).toBe(8191.02);
    expect(estimate.buy.length).toBeGreaterThan(0);
    expect(estimate.build.length).toBeGreaterThan(0);
    expect(estimate.lines[0]?.authorityState).toBe("approved_locked");
  });

  it("matches masonry benchmarks, flags exploration approval, and blocks client output", () => {
    const estimate = calculateEstimate(input("BRK-001", 1), seedLibrary);
    expect(estimate.totals.prime).toBe(417.7);
    expect(estimate.lines[0]?.authorityState).toBe("exploration_approved");
    expect(estimate.warnings.some((warning) => warning.includes("assumption grade"))).toBe(true);
    expect(validateClientProposal(estimate).valid).toBe(false);
  });

  it("applies commercial rules in documented order", () => {
    const totals = calculateEstimate(input("DCK-001", 25), seedLibrary).totals;
    expect(totals.waste).toBe(583.36);
    expect(totals.direct).toBe(13250.61);
    expect(totals.risk).toBe(662.53);
    expect(totals.riskAdjusted).toBe(13913.14);
    expect(totals.contingency).toBe(1391.31);
    expect(totals.margin).toBe(3826.11);
    expect(totals.sellExVat).toBe(19130.56);
  });

  it("applies optional VAT after the sell total", () => {
    const totals = calculateEstimate(input("DCK-001", 25, true), seedLibrary).totals;
    expect(totals.vat).toBe(2869.58);
    expect(totals.sellIncVat).toBe(22000.14);
  });

  it("blocks empty estimates", () => {
    const estimate = calculateEstimate({ ...input("DCK-001", 0), scope: [] }, seedLibrary);
    expect(validateForFinal(estimate).valid).toBe(false);
  });

  it("blocks client proposals on authority state rather than confidence grade", () => {
    const deckEstimate = calculateEstimate(input("DCK-001", 25), seedLibrary);
    expect(deckEstimate.lines[0]?.confidence).toBe("Provisional");
    expect(validateClientProposal(deckEstimate).warnings.some((warning) => warning.includes("exploration_approved"))).toBe(true);

    const plumbingEstimate = calculateEstimate(input("PLB-003", 1), seedLibrary);
    expect(plumbingEstimate.lines[0]?.authorityState).toBe("approved_locked");
    expect(validateClientProposal(plumbingEstimate).warnings.some((warning) => warning.includes("Commercial rules: exploration_approved"))).toBe(true);
    expect(validateClientProposal(plumbingEstimate).valid).toBe(false);

    const lockedCommercialRules = structuredClone(seedLibrary);
    lockedCommercialRules.rules.governance = {
      ...lockedCommercialRules.rules.governance!,
      authorityState: "approved_locked",
      authority: "validated",
      approval: "locked",
      placeholder: false,
    };
    const clientSafePlumbing = calculateEstimate(input("PLB-003", 1), lockedCommercialRules);
    expect(validateClientProposal(clientSafePlumbing).valid).toBe(true);
  });

  it("seeds one current revision for contested records and retains superseded history in governance notes", () => {
    const plb000 = seedLibrary.assemblies.find((item) => item.code === "PLB-000");
    const plb003 = seedLibrary.assemblies.find((item) => item.code === "PLB-003");
    const dck001 = seedLibrary.assemblies.find((item) => item.code === "DCK-001");

    expect(plb000?.lineage?.revision).toBe("r2");
    expect(plb000?.governance?.supersedes).toContain("6731.01");
    expect(plb003?.lineage?.revision).toBe("r2");
    expect(plb003?.governance?.supersedes).toContain("2579.77");
    expect(dck001?.lineage?.revision).toBe("r2");
    expect(dck001?.governance?.supersedes).toContain("22142.25");
  });

  it("snapshots rules independently from later changes", () => {
    const estimate = calculateEstimate(input("DCK-001", 25), seedLibrary);
    const changed = structuredClone(seedLibrary);
    changed.rules.marginPct = 99;
    expect(estimate.rules.marginPct).toBe(25);
  });

  it("adds owner-approved estimate classification metadata to snapshots", () => {
    const estimate = calculateEstimate(input("PLB-003", 1), seedLibrary);
    expect(estimate.classification.code).toBe("CLASS_2");
    expect(estimate.classification.label).toBe("Detailed approximate estimate");
    expect(estimate.classification.expectedLowRange).toBe("-5% to -10%");
    expect(estimate.classification.expectedHighRange).toBe("+5% to +15%");
    expect(estimate.classification.governanceStatus).toBe("Approved");
    expect(estimate.classification.source).toContain("Estimate Classification sheet");
  });

  it("reserves Class 1 and exposes all approved accuracy bands", () => {
    expect(estimateClassificationRules.CLASS_1.label).toBe("Detailed quantity estimate");
    expect(estimateClassificationRules.CLASS_2.expectedHighRange).toBe("+5% to +15%");
    expect(estimateClassificationRules.CLASS_5.uiWarning).toContain("not a final quote");
  });

  it("adds owner-approved elemental cost structure to estimate snapshots", () => {
    const estimate = calculateEstimate(multiInput(), seedLibrary);
    expect(costElementDefinitions.PLUMBING_SERVICES.name).toBe("Plumbing services");
    expect(costElementDefinitions.GROUND_FLOOR_CONSTRUCTION.approvalState).toBe("approved");
    expect(estimate.lines.find((line) => line.code === "PLB-KIT-001")?.costElement).toBe("PLUMBING_SERVICES");
    expect(estimate.lines.find((line) => line.code === "DCK-001")?.costElement).toBe("GROUND_FLOOR_CONSTRUCTION");
    expect(estimate.lines.find((line) => line.code === "BRK-001")?.costElement).toBe("INTERNAL_DIVISIONS");
    expect(estimate.elementalBreakdown.find((element) => element.code === "PLUMBING_SERVICES")?.prime).toBe(8191.02);
    expect(estimate.elementalBreakdown.find((element) => element.code === "GROUND_FLOOR_CONSTRUCTION")?.prime).toBe(12667.25);
    expect(estimate.elementalBreakdown.find((element) => element.code === "INTERNAL_DIVISIONS")?.prime).toBe(417.7);
  });

  it("adds the owner-approved fourteen feature schema to estimate snapshots", () => {
    const estimate = calculateEstimate(input("PLB-003", 1), seedLibrary);
    expect(Object.values(featureSchemaDefinitions)).toHaveLength(14);
    expect(estimate.featureSchema).toHaveLength(14);
    expect(estimate.featureSchema.every((feature) => feature.approvalState === "approved")).toBe(true);
    expect(estimate.featureSchema.find((feature) => feature.code === "SANITARY_FITTINGS")?.usedByElements).toEqual(["PLUMBING_SERVICES"]);
    expect(estimate.featureSchema.find((feature) => feature.code === "ROOF_PITCH")?.measurementUnit).toBe("degrees or ratio");
    expect(estimate.featureSchema[0].source).toContain("Feature Schema sheet");
  });

  it("traces displayed estimate numbers to manifest lineage", () => {
    const estimate = calculateEstimate(input("PLB-003", 1), seedLibrary);
    expect(estimate.lines[0]?.lineage?.manifestId).toBeTruthy();
    expect(estimate.lines[0]?.lineage?.revision).toBeTruthy();
    expect(estimate.buy.every((line) => Boolean(line.lineage?.manifestId))).toBe(true);
    expect(estimate.build.every((line) => Boolean(line.lineage?.manifestId))).toBe(true);
  });

  it("uses markup wording while preserving the current markup formula", () => {
    const estimate = calculateEstimate(input("PLB-003", 1), seedLibrary);
    expect(estimate.totals.margin).toBeCloseTo(estimate.totals.cost * 0.25, 2);
    expect(seedLibrary.rules.governance?.notes).toContain("markup");
  });
});
