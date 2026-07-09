import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings-context";
import { loadEstimates } from "@/lib/supabase-client";
import { DocumentIcon, ClipboardDollarIcon } from "@/components/nav-icons";
import { HamburgerButton, NavDrawer } from "@/components/NavDrawer";

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

// ─── ICONS (inline SVG, white line icons on the navy badge) ──────────────────
// DocumentIcon / ClipboardDollarIcon now live in @/components/nav-icons so the
// drawer's Quotes/Invoices shortcuts can reuse the exact same glyphs.
function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.navy}
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ─── DOCUMENT-TYPE CARD ──────────────────────────────────────────────────────
// Whole card is the click target → /plumbing?doc=<quote|invoice>. Navy circular
// icon badge, gold left-border accent, decorative gold arrow on the right.
function DocumentCard({
  doc,
  heading,
  subtext,
  ariaLabel,
  icon,
}: {
  doc: "quote" | "invoice";
  heading: string;
  subtext: string;
  ariaLabel: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to="/plumbing"
      search={{ doc }}
      aria-label={ariaLabel}
      className="doc-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        background: C.panel,
        border: "1px solid #DDE3EA",
        borderLeft: `4px solid ${C.gold}`,
        borderRadius: 10,
        padding: "20px 22px",
        textDecoration: "none",
        boxShadow: "0 1px 3px rgba(13,27,42,0.06)",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          flexShrink: 0,
          borderRadius: "50%",
          background: C.navy,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: C.navy, fontWeight: 800, fontSize: 18 }}>{heading}</div>
        <div style={{ color: C.slateL, fontSize: 13, marginTop: 4 }}>{subtext}</div>
      </div>
      <div
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: "50%",
          background: `${C.gold}26`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ArrowIcon />
      </div>
    </Link>
  );
}

// ─── RECENT QUOTES ────────────────────────────────────────────────────────────
interface RecentQuote {
  reference: string;
  document_type: string;
  project_name?: string;
  sell_price?: number;
  created_at: string;
}

function RecentQuotesPanel() {
  const [quotes, setQuotes] = useState<RecentQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      const estimates = await loadEstimates(undefined, 5);
      const formatted: RecentQuote[] = estimates.map((row) => {
        const snapshot = row.snapshot as { projectName?: string; totals?: { sellExclVat?: number } } | null;
        return {
          reference: row.reference,
          document_type: row.document_type,
          project_name: snapshot?.projectName || 'Unnamed project',
          sell_price: snapshot?.totals?.sellExclVat,
          created_at: row.created_at,
        };
      });
      setQuotes(formatted);
      setLoading(false);
    };

    fetchQuotes();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "28px 16px", textAlign: "center", color: C.slateL, fontSize: 13 }}>
        Loading...
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div style={{ padding: "28px 16px", textAlign: "center", color: C.slateL, fontSize: 13 }}>
        No quotes yet — start one above.
      </div>
    );
  }

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatPrice = (price?: number) => {
    if (!price) return '—';
    return `R${price.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div>
      {quotes.map((q) => (
        <div
          key={q.reference}
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #EEF0F5",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: C.navy }}>{q.reference}</div>
            <div style={{ color: C.slateL, fontSize: 12, marginTop: 2 }}>{q.project_name}</div>
          </div>
          <div style={{ textAlign: "right", marginLeft: 16 }}>
            <div style={{ color: C.gold, fontWeight: 600 }}>{formatPrice(q.sell_price)}</div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{formatDate(q.created_at)}</div>
          </div>
          <div
            style={{
              background: q.document_type === "invoice" ? "#FEF5E7" : "#E8F4F8",
              color: q.document_type === "invoice" ? C.amber : "#2E86AB",
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              marginLeft: 12,
              whiteSpace: "nowrap",
            }}
          >
            {q.document_type === "invoice" ? "Invoice" : "Quote"}
          </div>
        </div>
      ))}
    </div>
  );
}

function Home() {
  const { profileComplete } = useSettings();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div
      style={{ fontFamily: "'Inter',system-ui,sans-serif", background: C.bg, minHeight: "100vh" }}
    >
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} active="dashboard" />

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
          <HamburgerButton onClick={() => setDrawerOpen(true)} />
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

        {/* Document-type cards — the only choice the home page makes:
            Quote vs Invoice. Each carries that choice to the plumbing
            workflow page via the ?doc search param. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 20,
          }}
        >
          <DocumentCard
            doc="quote"
            heading="Quote"
            subtext="New quote"
            ariaLabel="Create new quote"
            icon={<DocumentIcon />}
          />
          <DocumentCard
            doc="invoice"
            heading="Invoice"
            subtext="New job"
            ariaLabel="Create new invoice"
            icon={<ClipboardDollarIcon />}
          />
        </div>

        {/* Recent quotes */}
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
          <RecentQuotesPanel />
        </div>
      </div>
    </div>
  );
}
