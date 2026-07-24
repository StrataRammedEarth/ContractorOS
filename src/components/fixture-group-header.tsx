import { useId, useState, type ReactNode } from "react";

// Local copies of the token values this component depends on — kept minimal
// and self-contained rather than importing EstimatePage.tsx's full C/S/UI
// token objects, mirroring collapsible-section.tsx's precedent for shared
// components (avoids a reverse dependency from a shared component back into
// a page-level file).
const NAVY = "#0D1B2A";
const GOLD = "#F5A623";
const AMBER = "#E67E22";
const SLATE = "#4A6080";
const SLATE_L = "#6B859E";
const WHITE = "#FFFFFF";
const BORDER_STRONG = "#C8D0DB";
const CREAM_BG = "#FEF5E7";

const fmt = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface FixtureGroupHeaderProps {
  /** Fixture icon (same glyph/source as the Fixtures table row). */
  iconSrc: string;
  iconAlt: string;
  /** Sentence-case fixture display name, e.g. "Toilet", "Kitchen mixer". */
  name: string;
  /** Fixture quantity — drives the qty badge, hidden when 1. */
  quantity: number;
  /** Number of rows linked to this fixture in the current section. */
  lineCount: number;
  /** Sum of resolved totals for this fixture's linked rows. */
  total: number;
  /** Header-adjacent actions rendered at the foot of the expanded body (e.g. "+ Add under {Fixture}"). */
  actions?: ReactNode;
  /** Row content, rendered only while expanded. */
  children?: ReactNode;
}

// Shared fixture-group container used by every downstream section that
// groups its rows under a linked Fixtures-table entry (Water Supply, Supply
// Fittings, Drainage, Drainage Fittings, Wastes & Traps). Establishes the
// Section (navy) → Fixture group (tinted, accented) → Rows (white)
// hierarchy: a 3px gold accent bar runs the full height of the group, the
// header band gets a pale gold tint, and the body is indented and white.
// Default collapsed, mirroring CollapsibleSection's fixed collapse rule.
export function FixtureGroupHeader({
  iconSrc, iconAlt, name, quantity, lineCount, total, actions, children,
}: FixtureGroupHeaderProps) {
  const [collapsed, setCollapsed] = useState(true);
  const panelId = useId();
  const statusLine = lineCount > 0
    ? `${lineCount} line${lineCount === 1 ? "" : "s"} · ${fmt(total)}`
    : "Not yet specified";

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 8,
      border: `1px solid ${BORDER_STRONG}`, margin: "0 0 10px", background: WHITE }}>
      <div aria-hidden style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: GOLD }} />
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-controls={panelId}
        aria-label={`${collapsed ? "Expand" : "Collapse"} ${name}`}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "8px 10px 8px 13px", background: `${GOLD}1A`, border: "none",
          cursor: "pointer", textAlign: "left", font: "inherit" }}>
        <img src={iconSrc} alt={iconAlt} width={20} height={20}
          style={{ objectFit: "contain", flex: "0 0 auto" }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: NAVY }}>{name}</span>
          <span style={{ display: "block", fontSize: 11, color: SLATE_L, marginTop: 1 }}>{statusLine}</span>
        </span>
        {quantity > 1 && (
          <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 7px",
            borderRadius: 99, fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
            background: CREAM_BG, color: AMBER, border: `1px solid ${AMBER}55` }}>
            {quantity}
          </span>
        )}
        <span aria-hidden style={{ color: SLATE, fontSize: 11, fontWeight: 700, flex: "0 0 auto" }}>
          {collapsed ? "▸" : "▾"}
        </span>
      </button>
      {!collapsed && (
        <div id={panelId} role="region" aria-label={name}
          style={{ padding: "10px 10px 10px 16px", background: WHITE }}>
          {children}
          {actions && <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>{actions}</div>}
        </div>
      )}
    </div>
  );
}
