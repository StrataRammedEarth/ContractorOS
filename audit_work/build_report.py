from pathlib import Path
import json
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing, String
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

BASE = Path(__file__).resolve().parent
OUT = BASE / "output"
PRE = BASE / "previews"
OUT.mkdir(parents=True, exist_ok=True)
PRE.mkdir(parents=True, exist_ok=True)
summary = json.loads((OUT / "audit_summary.json").read_text())

labels = ["Critical", "High", "Medium", "Low"]
values = [summary["critical"], summary["high"], summary["medium"], summary["low"]]
severity_chart = Drawing(470, 190)
severity_chart.add(String(235, 174, "Validated findings by severity", textAnchor="middle", fontName="Helvetica-Bold", fontSize=11, fillColor=colors.HexColor("#132238")))
bars = VerticalBarChart()
bars.x, bars.y, bars.width, bars.height = 55, 30, 380, 125
bars.data = [values]
bars.categoryAxis.categoryNames = labels
bars.valueAxis.valueMin = 0
bars.valueAxis.valueMax = max(values) + 1
bars.valueAxis.valueStep = 1
bars.bars[0].fillColor = colors.HexColor("#2176AE")
bars.barLabels.nudge = 7
bars.barLabels.fontName = "Helvetica-Bold"
bars.barLabels.fontSize = 8
bars.barLabelFormat = "%d"
severity_chart.add(bars)

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Title2", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=colors.HexColor("#132238"), alignment=TA_CENTER, spaceAfter=10))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=15, leading=18, textColor=colors.HexColor("#2176AE"), spaceBefore=8, spaceAfter=5))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontName="Helvetica", fontSize=9, leading=12, textColor=colors.HexColor("#1E293B"), spaceAfter=5))
styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontName="Helvetica", fontSize=8, leading=11, textColor=colors.HexColor("#64748B"), spaceAfter=4))
styles.add(ParagraphStyle(name="Callout", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=10, leading=14, textColor=colors.HexColor("#8A4B08"), backColor=colors.HexColor("#FFF4DB"), borderColor=colors.HexColor("#F4A261"), borderWidth=0.5, borderPadding=7, spaceAfter=8))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(18*mm, 12*mm, "ContractorOS End-to-End Data Audit | Read-only source review")
    canvas.drawRightString(192*mm, 12*mm, f"Page {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(str(OUT / "ContractorOS_Executive_Data_Audit_Report_2026-06-15.pdf"), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=17*mm, bottomMargin=18*mm)
story = [
    Paragraph("ContractorOS Data Audit", styles["Title2"]),
    Paragraph("Executive report | June 15, 2026", styles["Smallx"]),
    Paragraph("Overall assessment: EXPLORATION-READY under owner-controlled governance; not production-ready", styles["Callout"]),
    Paragraph("Executive Summary", styles["H1x"]),
    Paragraph("<b>ContractorOS is currently an exploration and research system.</b> Placeholder values are useful and may remain usable for exercises, provided they are internally flagged, traceable, and prevented from silently becoming permanently approved or Locked.", styles["Bodyx"]),
    Paragraph("<b>The owner is the sole final authority.</b> Permanent data changes, approvals, promotions, locks, exceptions, and overrides all require the owner's final decision. Other users may configure values only within the parameters the system exposes.", styles["Bodyx"]),
    Paragraph("<b>The current app calculations remain useful for experimentation, but several totals are not governed benchmarks.</b> The deck and plumbing package examples must be rebuilt from raw materials, components, kits, and labour using the standard bottom-up costing method.", styles["Bodyx"]),
    Paragraph("<b>Recommended posture.</b> Continue structured experimentation, keep placeholder status visible internally, block malformed or duplicate-code imports, and treat all customer outputs as estimates rather than binding final quotes.", styles["Bodyx"]),
    Spacer(1, 4),
    severity_chart,
    Paragraph("The validated audit identified 14 findings: two critical, five high, five medium, and two low. The highest-priority findings concern identifier integrity, benchmark structure, and controlled data promotion.", styles["Smallx"]),
    Paragraph("Benchmark decisions are now clearer", styles["H1x"]),
    Paragraph("The owner confirmed R22,142.25 is incorrect and superseded. R12,667.25 is the currently accepted deck value, but it remains an exploration placeholder because the benchmark must be rebuilt from raw materials, labour, and components. The same bottom-up principle applies to plumbing package totals.", styles["Bodyx"]),
]

bench = [
    ["Benchmark","Source","App","Assessment"],
    ["PLB-000 package","R6,731.01","R6,731.01","Historical test only; rebuild bottom-up"],
    ["PLB-003 fixture roll-up","R8,191.02","Not separately modeled","Historical test only; rebuild bottom-up"],
    ["DCK-001 25m2 deck","R22,142.25 superseded","R12,667.25 placeholder","Accepted for exploration; rebuild required"],
    ["BRK-001 half-brick wall","R417.70","R417.70","Exploration-ready; owner controls lock"],
    ["Commercial factors","5-10 / 5 / 10 / 25","5 / 5 / 10 / 25","Usable exploration defaults"],
]
t = Table(bench, colWidths=[42*mm,39*mm,39*mm,56*mm], repeatRows=1)
t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#2176AE")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTNAME",(0,1),(-1,-1),"Helvetica"),("FONTSIZE",(0,0),(-1,-1),7.5),("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#D7E0E8")),("VALIGN",(0,0),(-1,-1),"TOP"),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,colors.HexColor("#EEF4F8")]),("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4),("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4)]))
story += [t, Paragraph("Plumbing package and fixture-rollup totals should not remain active estimate options. They may be retained as historical test evidence while selectable estimates are rebuilt from traceable components and kits.", styles["Smallx"]),
          Paragraph("Data promotion is the largest operational gap", styles["H1x"]),
          Paragraph("The database design anticipates governed materials, resources, assemblies, commercial rules, assumptions, validations, and sources. The current UI only reviews material CSVs. Exploration may use broader data, but permanent promotion must stage the record, preserve its source and effective date, explain the reasoning, and obtain owner approval.", styles["Bodyx"])]

risks = [
    ["Priority","Risk","Required control"],
    ["P0","Duplicate codes can overwrite unrelated materials","Globally unique code gate and quarantined malformed sources"],
    ["P0","Deck and plumbing examples can be mistaken for governed benchmarks","Supersession labels and bottom-up rebuilds"],
    ["P1","High/Medium/Low confidence cannot map safely to app confidence","Explicit mapping with no automatic Locked promotion"],
    ["P1","nr, hrs, litres, m2 and m3 are not governed aliases","Record-type unit vocabulary and normalization"],
    ["P1","R260/day and R32.50/hour depend on implicit 8-hour day","Persist rate basis and conversion assumptions"],
]
risks_wrapped = [[Paragraph(str(cell), styles["Smallx"]) for cell in row] for row in risks]
rt = Table(risks_wrapped, colWidths=[15*mm,78*mm,83*mm], repeatRows=1)
rt.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#132238")),("TEXTCOLOR",(0,0),(-1,0),colors.white),("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTSIZE",(0,0),(-1,-1),7.5),("GRID",(0,0),(-1,-1),0.4,colors.HexColor("#D7E0E8")),("VALIGN",(0,0),(-1,-1),"TOP"),("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white,colors.HexColor("#EEF4F8")]),("LEFTPADDING",(0,0),(-1,-1),4),("RIGHTPADDING",(0,0),(-1,-1),4),("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4)]))
story += [rt, Paragraph("Owner-Confirmed Operating Model", styles["H1x"]),
          Paragraph("<b>Exploration is allowed.</b> Placeholder and provisional values may be used to learn, test, and develop the concept. They must remain internally flagged, sourced, dated, and clearly separated from owner-approved Locked data.", styles["Bodyx"]),
          Paragraph("<b>Approval is centralized.</b> The owner is the only final approver and the only person who may override controls. The formal approver display name is intentionally deferred during this stage.", styles["Bodyx"]),
          Paragraph("<b>Customer output remains an estimate.</b> Assumptions and warnings should not clutter estimate line items. Instead, an accompanying clause must state that the output is not a final binding quote, identify applicable warnings, and leave responsibility for inspections and final approval with the user.", styles["Bodyx"]),
          Paragraph("<b>Lifecycle is explicit.</b> Superseded records must be archived. Archived records are retained for one year from their archive date before they may be deleted.", styles["Bodyx"]),
          Paragraph("Recommended Next Steps", styles["H1x"]),
          Paragraph("<b>1. Rebuild the deck and plumbing estimate options bottom-up.</b> Retain current totals only as labeled exploration or historical test evidence.", styles["Bodyx"]),
          Paragraph("<b>2. Establish a canonical-source and approval register.</b> Record exact Drive links, effective dates, lifecycle state, owner decisions, and supersession links.", styles["Bodyx"]),
          Paragraph("<b>3. Expand controlled imports by record type.</b> Normalize governed vocabulary, detect duplicate codes and missing sources, stage imports, and require owner approval for permanent promotion.", styles["Bodyx"]),
          Paragraph("<b>4. Implement exploration placeholder controls.</b> Keep values such as the 25% margin usable while under review, but flag them internally and record changes.", styles["Bodyx"]),
          Paragraph("<b>5. Use a multi-source validation model.</b> Apply a 10% comparison tolerance where appropriate and consider recognized publications, registered authorities, contractor quotes, and project results before the owner makes a Lock decision.", styles["Bodyx"]),
          Paragraph("Caveats And Assumptions", styles["H1x"]),
          Paragraph("This was a read-only, full-folder inventory with deep reconciliation of current exploration sources. Reference evidence was classified and sampled rather than promoted record-by-record. Existing Drive source files were not changed. The detailed workbook contains the complete governance decisions, findings, mappings, benchmark checks, remediation queue, and issue-ready backlog.", styles["Bodyx"])]

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT / "ContractorOS_Executive_Data_Audit_Report_2026-06-15.pdf")
