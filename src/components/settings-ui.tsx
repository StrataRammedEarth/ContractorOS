import { type CSSProperties, type ReactNode } from "react";

// Extracted from profile.tsx (Brief 1+2 original location) so both profile.tsx
// and team.tsx can use identical Settings-card styling without duplication.
// Verbatim move — do not alter behavior or appearance during this extraction.

const C = {
  navy: "#0D1B2A",
  navyMid: "#152436",
  gold: "#F5A623",
  slate: "#4A6080",
  slateL: "#6B859E",
  muted: "#8FA3B8",
  bg: "#F1F4F8",
  red: "#E74C3C",
  green: "#27AE60",
};

export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <label
      style={{ display: "block", fontSize: 11, color: C.slate, fontWeight: 600, marginBottom: 4 }}
    >
      {children}
      {hint && (
        <span style={{ display: "block", color: C.muted, fontWeight: 400, marginTop: 1 }}>
          {hint}
        </span>
      )}
    </label>
  );
}

export const inputStyle = (invalid?: boolean): CSSProperties => ({
  width: "100%",
  padding: "9px 11px",
  borderRadius: 6,
  border: `1px solid ${invalid ? C.red : "#C8D0DB"}`,
  fontSize: 13,
  color: C.navy,
  background: "#fff",
  boxSizing: "border-box",
});

export function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #DDE3EA",
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 18,
      }}
    >
      <div
        style={{
          background: C.navyMid,
          color: C.gold,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          padding: "9px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>{title}</span>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

export const addLineBtnStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 6,
  border: `1px dashed ${C.gold}`,
  background: "#FDF3DC",
  color: C.navy,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

export const rowDeleteBtnStyle: CSSProperties = {
  padding: "3px 8px",
  borderRadius: 6,
  border: "1px solid #E0B4B4",
  background: "#fff",
  color: C.red,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};
