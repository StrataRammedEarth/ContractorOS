import { useState, type ReactNode } from "react";

// Local copies of the token values SectionGroup depended on — kept minimal
// and self-contained rather than importing EstimatePage.tsx's full C/S/UI
// token objects, to avoid a reverse dependency from a shared component back
// into a page-level file. If/when the app-wide design token system (see
// project backlog) is formalized, these should be replaced with imports from
// that shared token module instead.
const GOLD = "#F5A623";
const GOLD_DIM = "#C8851A";
const PAGE_BG = "#F1F4F8";
const NAVY_MID = "#152436";
const SPACE_LG = 20;
const SPACE_MD = 12;
const SPACE_XL = 24;

function CollapsedSummaryHeader({ children }: { children: ReactNode }) {
  return (
    <div style={{ background: NAVY_MID, color: GOLD, fontWeight: 600, fontSize: 12,
      letterSpacing: 1, textTransform: "uppercase", padding: "10px 20px",
      borderBottom: `2px solid ${GOLD}40` }}>
      {children}
    </div>
  );
}

export function CollapsibleSection({ label, subHeadings, children, background = PAGE_BG }: {
  label: string;
  subHeadings: string[];
  children: ReactNode;
  // The floating label and corner button cut a "notch" into the border by
  // painting over it with the surface color behind the section. Pages that
  // render this against something other than the standard page background
  // (e.g. a white card) must pass their own value here.
  background?: string;
}) {
  const [collapsed, setCollapsed] = useState(true); // fixed rule: always default-collapsed
  const labelDuplicatesFirstChild = label === subHeadings[0];
  return (
    <div style={{ position: "relative", border: `2px solid ${GOLD}`, borderRadius: 12,
      padding: `${SPACE_LG}px ${SPACE_MD}px ${collapsed ? SPACE_LG : 2}px`,
      marginTop: 30, marginBottom: SPACE_XL }}>
      {!labelDuplicatesFirstChild && (
        <div style={{ position: "absolute", top: -13, left: 16, background,
          padding: "0 10px", fontSize: 12.5, fontWeight: 800, color: GOLD_DIM,
          textTransform: "uppercase", letterSpacing: 0.8 }}>
          {label}
        </div>
      )}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
        style={{ position: "absolute", top: -15, right: 16, background,
          border: `1px solid ${GOLD}`, borderRadius: 6, color: GOLD_DIM,
          fontSize: 11, fontWeight: 700, padding: "3px 9px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 5 }}>
        {collapsed ? "▸ Expand" : "▾ Collapse"}
      </button>
      {collapsed ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          {subHeadings.map((h) => <CollapsedSummaryHeader key={h}>{h}</CollapsedSummaryHeader>)}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
