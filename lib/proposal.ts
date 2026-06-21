import { jsPDF } from "jspdf";
import { estimateClassificationRules, validateClientProposal } from "./engine";
import type { EstimateClassification, EstimateSnapshot } from "./types";

const rand = (value: number) => `R ${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export function downloadProposal(snapshot: EstimateSnapshot) {
  const safety = validateClientProposal(snapshot);
  if (!safety.valid) {
    throw new Error(`Client proposal blocked:\n${safety.warnings.join("\n")}`);
  }
  const pdf = new jsPDF();
  let y = 20;
  const write = (text: string, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, 175);
    pdf.text(lines, 18, y);
    y += lines.length * (size * 0.45) + 4;
    if (y > 275) { pdf.addPage(); y = 20; }
  };

  pdf.setTextColor(13, 27, 42);
  write("ContractorOS", 22, true);
  write("ASSEMBLY-FIRST ESTIMATE", 9, true);
  write(`${snapshot.input.reference} | Version ${snapshot.version}`, 9);
  write(`Client: ${snapshot.input.clientName || "Not specified"}`);
  write(`Project: ${snapshot.input.projectName || "Not specified"}`);
  const classification = getEstimateClassification(snapshot);
  write("Estimate Classification", 14, true);
  write(`${classification.label}: ${classification.uiWarning}`);
  write(`Expected accuracy band: ${classification.expectedLowRange} / ${classification.expectedHighRange}`);
  write(`Basis: ${classification.dataBasis}. Source: ${classification.sourceLocation}. Approval: ${classification.governanceStatus} by ${classification.approvedBy}.`);
  y += 4;
  write("Scope of Works", 14, true);
  snapshot.lines.forEach((line) => write(`${line.code} - ${line.description}: ${line.quantity} ${line.unit}`));
  if (snapshot.elementalBreakdown?.length) {
    write("Elemental Cost Structure", 14, true);
    snapshot.elementalBreakdown.forEach((element) => {
      write(`${element.name}: ${rand(element.prime)} (${element.percentOfPrime.toFixed(1)}% of prime cost)`);
    });
  }
  write("Inclusions", 14, true);
  write("Supply, installation, labour, and commercial allowances shown in the accepted ContractorOS estimate.");
  write("Estimate Notice", 14, true);
  write(snapshot.disclaimer || "This output is an estimate, not a final binding quote. The user remains responsible for site inspection, review, and final approval.");
  if (snapshot.warnings.length) {
    write("Accompanying Internal Warnings", 14, true);
    write(snapshot.warnings.join("\n"));
  }
  write("Exclusions", 14, true);
  write("Work not explicitly listed in the scope, statutory fees, latent site conditions, and client variations.");
  write("Cost Estimate", 14, true);
  write(`Sell price excluding VAT: ${rand(snapshot.totals.sellExVat)}`, 11, true);
  if (snapshot.input.vatEnabled) {
    write(`VAT (${snapshot.rules.vatPct}%): ${rand(snapshot.totals.vat)}`);
    write(`Final project value including VAT: ${rand(snapshot.totals.sellIncVat)}`, 12, true);
  }
  write("Validity Period", 14, true);
  write("This proposal is valid for 30 days from the issue date, subject to supplier price confirmation.");
  write("Acceptance", 14, true);
  write("Client name: ______________________________\nSignature: _________________________________\nDate: _____________________________________");
  pdf.save(`${snapshot.input.reference || "ContractorOS"}-proposal-v${snapshot.version}.pdf`);
}

function getEstimateClassification(snapshot: EstimateSnapshot): EstimateClassification {
  return snapshot.classification ?? {
    code: "CLASS_5",
    ...estimateClassificationRules.CLASS_5,
    rationale: ["Legacy saved snapshot created before estimate classification metadata was introduced."],
  };
}
