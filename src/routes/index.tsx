import { createFileRoute, Link } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ContractorOS — Governed Estimating for Trade Contractors" },
      {
        name: "description",
        content: "Governed estimating for South African trade contractors. One job. Four outputs.",
      },
    ],
  }),
  component: Home,
});

// ─── COLOUR THEME (shared navy / brass tokens) ────────────────────────────────
const C = {
  navy: "#0D1B2A",
  navyMid: "#152436",
  gold: "#F5A623",
  slate: "#4A6080",
  slateL: "#6B859E",
  muted: "#8FA3B8",
  panel: "#FFFFFF",
  bg: "#F1F4F8",
  amber: "#E67E22",
};

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 40,
          height: 40,
          background: C.gold,
          clipPath: "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: 13,
          color: C.navy,
        }}
      >
        CO
      </div>
      <div>
        <div style={{ color: C.gold, fontWeight: 900, fontSize: 20, lineHeight: 1 }}>
          ContractorOS
        </div>
        <div
          style={{
            color: C.muted,
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          Plumbing · One Job. Four Outputs.
        </div>
      </div>
    </div>
  );
}

function Home() {
  const { profileComplete } = useSettings();

  return (
    <div
      style={{ fontFamily: "'Inter',system-ui,sans-serif", background: C.bg, minHeight: "100vh" }}
    >
      {/* Header */}
      <div style={{ background: C.navy, borderBottom: `3px solid ${C.gold}` }}>
        <div
          style={{
            maxWidth: 960,
            margin: "0 auto",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Logo />
          <Link
            to="/profile"
            style={{
              padding: "7px 14px",
              borderRadius: 6,
              border: `1px solid ${C.gold}50`,
              color: C.gold,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ⚙ Profile &amp; Settings
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px" }}>
        {/* Profile-complete banner */}
        {!profileComplete && (
          <div
            style={{
              background: "#FEF5E7",
              border: `1px solid ${C.amber}55`,
              borderRadius: 8,
              padding: "14px 18px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ color: C.navy, fontSize: 13, lineHeight: 1.5 }}>
              <strong>⚠ Complete your profile to issue client documents.</strong>
              <div style={{ color: C.slate, fontSize: 12, marginTop: 2 }}>
                Your business name and banking details are needed before a quote or invoice can be
                sent.
              </div>
            </div>
            <Link
              to="/profile"
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                background: C.navy,
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Complete profile →
            </Link>
          </div>
        )}

        {/* Job-type cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <Link
            to="/plumbing"
            style={{
              display: "block",
              background: C.panel,
              border: "1px solid #DDE3EA",
              borderRadius: 10,
              padding: "24px 22px",
              textDecoration: "none",
            }}
          >
            <div style={{ fontSize: 30 }}>🔧</div>
            <div style={{ color: C.navy, fontWeight: 800, fontSize: 18, marginTop: 10 }}>
              Plumbing Estimator
            </div>
            <div style={{ color: C.slateL, fontSize: 13, marginTop: 4 }}>New quote</div>
          </Link>

          <Link
            to="/plumbing"
            style={{
              display: "block",
              background: C.panel,
              border: "1px solid #DDE3EA",
              borderRadius: 10,
              padding: "24px 22px",
              textDecoration: "none",
            }}
          >
            <div style={{ fontSize: 30 }}>🔥</div>
            <div style={{ color: C.navy, fontWeight: 800, fontSize: 18, marginTop: 10 }}>
              Geyser Replacement
            </div>
            <div style={{ color: C.slateL, fontSize: 13, marginTop: 4 }}>New job</div>
          </Link>
        </div>

        {/* Recent quotes (empty state — persistence is a future step) */}
        <div
          style={{
            background: C.panel,
            border: "1px solid #DDE3EA",
            borderRadius: 10,
            overflow: "hidden",
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
              padding: "8px 16px",
            }}
          >
            Recent quotes
          </div>
          <div style={{ padding: "28px 16px", textAlign: "center", color: C.slateL, fontSize: 13 }}>
            No quotes yet — start one above.
          </div>
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
          <Link
            to="/profile"
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid #C8D0DB",
              background: "#fff",
              color: C.slate,
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ⚙ Profile &amp; Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
