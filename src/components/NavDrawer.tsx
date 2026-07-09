import { Link } from "@tanstack/react-router";
import { ClipboardDollarIcon, ClockIcon, DashboardIcon, DocumentIcon, GearIcon, HamburgerIcon } from "@/components/nav-icons";

// ─── THEME (matches index.tsx / team.tsx / profile.tsx conventions) ───────────
const C = {
  navy: "#0D1B2A",
  navyMid: "#152436",
  gold: "#F5A623",
  muted: "#8FA3B8",
};

export type DrawerActiveKey = "dashboard" | "planner" | "profile" | "quotes" | "invoices";

export function HamburgerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Open navigation"
      style={{
        background: "none",
        border: `1px solid ${C.gold}50`,
        borderRadius: 6,
        padding: "7px 10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
      }}
    >
      <HamburgerIcon color={C.gold} size={18} />
    </button>
  );
}

function itemStyle(isActive: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 10,
    border: `2px solid ${isActive ? C.gold : "transparent"}`,
    background: isActive ? C.navyMid : "transparent",
    color: isActive ? C.gold : "#C9D4DE",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  };
}

export function NavDrawer({
  open,
  onClose,
  active = "dashboard",
}: {
  open: boolean;
  onClose: () => void;
  active?: DrawerActiveKey;
}) {
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden={!open}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(13,27,42,0.5)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s ease",
          zIndex: 200,
        }}
      />
      <div
        role="dialog"
        aria-label="Navigation"
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 260,
          background: C.navy,
          boxShadow: "2px 0 16px rgba(0,0,0,0.35)",
          zIndex: 201,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
          padding: "20px 14px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            padding: "0 6px",
          }}
        >
          <span style={{ color: C.gold, fontWeight: 900, fontSize: 15, letterSpacing: 0.5 }}>
            Menu
          </span>
          <button
            onClick={onClose}
            aria-label="Close navigation"
            style={{ background: "none", border: "none", color: C.gold, fontSize: 18, cursor: "pointer", lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Link to="/" onClick={onClose} style={itemStyle(active === "dashboard")}>
            <DashboardIcon size={22} color={active === "dashboard" ? C.gold : "#C9D4DE"} />
            Dashboard
          </Link>
          <Link to="/team" onClick={onClose} style={itemStyle(active === "planner")}>
            <ClockIcon size={22} color={active === "planner" ? C.gold : "#C9D4DE"} />
            Planner
          </Link>
          <Link to="/profile" onClick={onClose} style={itemStyle(active === "profile")}>
            <GearIcon size={22} color={active === "profile" ? C.gold : "#C9D4DE"} />
            Profile &amp; Settings
          </Link>
          <Link
            to="/plumbing"
            search={{ doc: "quote" }}
            onClick={onClose}
            style={itemStyle(active === "quotes")}
          >
            <DocumentIcon size={22} color={active === "quotes" ? C.gold : "#C9D4DE"} />
            Quotes
          </Link>
          <Link
            to="/plumbing"
            search={{ doc: "invoice" }}
            onClick={onClose}
            style={itemStyle(active === "invoices")}
          >
            <ClipboardDollarIcon size={22} color={active === "invoices" ? C.gold : "#C9D4DE"} />
            Invoices
          </Link>
        </nav>
      </div>
    </>
  );
}
