import jsPDF from "jspdf";
import type { CallOutFull } from "./supabase-client";

const NAVY = "#0D1B2A";
const GOLD = "#F5A623";
const SLATE = "#4A6080";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "CallOut";
}

export function generateCallOutPdf(callOut: CallOutFull): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 0;

  // Header bar
  doc.setFillColor(NAVY);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(GOLD);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("ContractorOS — Call-Out Checklist", 32, 30);
  doc.setFontSize(10);
  doc.setTextColor("#8FA3B8");
  doc.text(`Generated ${new Date().toLocaleString("en-ZA")}`, 32, 48);
  y = 100;

  // Issue / category / date / client
  doc.setTextColor(NAVY);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(callOut.issue_name, 32, y);
  y += 20;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(SLATE);
  doc.text(`Category: ${callOut.job_category}`, 32, y);
  y += 16;
  doc.text(`Date: ${callOut.call_out_date ?? "No date set"}`, 32, y);
  y += 16;
  if (callOut.client_name) {
    doc.text(`Client: ${callOut.client_name}`, 32, y);
    y += 16;
  }
  if (callOut.client_address) {
    doc.text(`Address: ${callOut.client_address}`, 32, y);
    y += 16;
  }
  if (callOut.employees.length > 0) {
    doc.text(`Crew: ${callOut.employees.map((e) => e.name).join(", ")}`, 32, y);
    y += 16;
  }
  y += 10;

  const renderSection = (title: string, lines: CallOutFull["lines"], showUnit: boolean) => {
    if (lines.length === 0) return;
    doc.setFillColor(NAVY);
    doc.rect(32, y, pageWidth - 64, 20, "F");
    doc.setTextColor(GOLD);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), 40, y + 14);
    y += 30;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const line of lines) {
      if (y > 780) {
        doc.addPage();
        y = 40;
      }
      doc.setTextColor(NAVY);
      const box = line.is_checked ? "[x]" : "[ ]";
      const qtyUnit = showUnit && line.unit ? `${line.qty} ${line.unit}` : `${line.qty}`;
      doc.text(`${box}  ${line.label}`, 40, y);
      doc.text(qtyUnit, pageWidth - 100, y, { align: "right" });
      y += 14;
      if (line.notes) {
        doc.setTextColor(SLATE);
        doc.setFontSize(8);
        doc.text(line.notes, 56, y);
        doc.setFontSize(10);
        y += 12;
      }
      y += 6;
    }
    y += 10;
  };

  renderSection(
    "Materials",
    callOut.lines.filter((l) => l.line_class === "material"),
    true,
  );
  renderSection(
    "Tools",
    callOut.lines.filter((l) => l.line_class === "tool"),
    false,
  );

  doc.save(`${sanitizeFilename(callOut.issue_name)}_CallOut.pdf`);
}
