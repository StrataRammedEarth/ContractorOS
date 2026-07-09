import { useEffect, useMemo, useState } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { useSettings } from "@/lib/settings-context";
import { supabase } from "@/lib/supabase-client";
import { DocumentIcon, ClipboardDollarIcon, CheckboxIcon, SearchIcon } from "@/components/nav-icons";
import { HamburgerButton, NavDrawer, type DrawerActiveKey } from "@/components/NavDrawer";
import type { DocumentType } from "@/lib/invoice-document";

// ─── COLOUR THEME (shared navy / gold tokens — matches index.tsx) ─────────────
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

interface DocumentRow {
  id: string;
  reference: string;
  status: string;
  created_at: string;
  project_name: string | null;
  client_name: string | null;
  sell_price: number | null;
}

export interface FilterPill {
  label: string;
  status: string | null; // null = "All"
}

export function DocumentListPage({
  documentType,
  activeDrawerKey,
  pageTitle,
  newButtonLabel,
  pills,
  searchPlaceholder,
  emptyIcon,
  emptyTitle,
  emptyBody,
  emptyCtaLabel,
  emptyCtaTo,
  emptyCtaSearch,
}: {
  documentType: DocumentType;
  activeDrawerKey: DrawerActiveKey;
  pageTitle: string;
  newButtonLabel: string;
  pills: FilterPill[];
  searchPlaceholder: string;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyBody: string;
  emptyCtaLabel: string;
  emptyCtaTo: LinkProps["to"];
  emptyCtaSearch?: Record<string, unknown>;
}) {
  const { settings } = useSettings();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [activePill, setActivePill] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchRows = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("estimate_versions")
        .select("id, reference, status, snapshot, created_at")
        .eq("organization_id", settings.organizationId)
        .eq("document_type", documentType)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error(`Failed to fetch ${documentType}s:`, error);
        setRows([]);
      } else {
        setRows(
          (data ?? []).map(
            (row: {
              id: string;
              reference: string;
              status: string;
              created_at: string;
              snapshot: { projectName?: string; clientName?: string; totals?: { sellExclVat?: number } } | null;
            }) => ({
              id: row.id,
              reference: row.reference,
              status: row.status,
              created_at: row.created_at,
              project_name: row.snapshot?.projectName ?? null,
              client_name: row.snapshot?.clientName ?? null,
              sell_price: row.snapshot?.totals?.sellExclVat ?? null,
            }),
          ),
        );
      }
      setLoading(false);
    };

    fetchRows();
    return () => {
      cancelled = true;
    };
  }, [documentType, settings.organizationId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (activePill && r.status !== activePill) return false;
      if (!q) return true;
      return (
        r.reference.toLowerCase().includes(q) ||
        (r.project_name ?? "").toLowerCase().includes(q) ||
        (r.client_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, activePill, search]);

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatPrice = (price: number | null) => {
    if (!price) return "—";
    return `R${price.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", background: C.bg, minHeight: "100vh" }}>
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} active={activeDrawerKey} />

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
          <div style={{ color: C.gold, fontWeight: 900, fontSize: 18 }}>{pageTitle}</div>
          <HamburgerButton onClick={() => setDrawerOpen(true)} />
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px" }}>
        {/* Toolbar: Select toggle + New button */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => setSelectMode((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: 8,
              border: `1px solid ${selectMode ? C.gold : "#DDE3EA"}`,
              background: selectMode ? `${C.gold}1A` : C.panel,
              color: selectMode ? C.navy : C.slate,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <CheckboxIcon size={16} color={selectMode ? C.navy : C.slateL} />
            Select
          </button>

          <Link
            to="/plumbing"
            search={{ doc: documentType }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: C.navy,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            + {newButtonLabel}
          </Link>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {pills.map((pill) => {
            const isActive = activePill === pill.status;
            return (
              <button
                key={pill.label}
                onClick={() => setActivePill(pill.status)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: `1.5px solid ${isActive ? C.gold : "#DDE3EA"}`,
                  background: isActive ? C.navy : C.panel,
                  color: isActive ? C.gold : C.slate,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Search box */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: C.panel,
            border: "1px solid #DDE3EA",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 20,
          }}
        >
          <SearchIcon size={16} color={C.muted} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            style={{
              border: "none",
              outline: "none",
              flex: 1,
              fontSize: 13,
              color: C.navy,
              background: "transparent",
            }}
          />
        </div>

        {/* List / loading / empty state */}
        {loading ? (
          <div style={{ padding: "40px 16px", textAlign: "center", color: C.slateL, fontSize: 13 }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              background: C.panel,
              border: "1px solid #DDE3EA",
              borderRadius: 10,
              padding: "48px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: `${C.gold}1A`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              {emptyIcon}
            </div>
            <div style={{ color: C.navy, fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
              {emptyTitle}
            </div>
            <div style={{ color: C.slateL, fontSize: 13, marginBottom: 20 }}>{emptyBody}</div>
            <Link
              to={emptyCtaTo}
              search={emptyCtaSearch}
              style={{
                display: "inline-block",
                padding: "10px 20px",
                borderRadius: 8,
                background: C.navy,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {emptyCtaLabel}
            </Link>
          </div>
        ) : (
          <div
            style={{
              background: C.panel,
              border: "1px solid #DDE3EA",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {filtered.map((row) => (
              <div
                key={row.id}
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid #EEF0F5",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                {selectMode && (
                  <input type="checkbox" style={{ width: 16, height: 16, cursor: "pointer" }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>{row.reference}</div>
                  <div style={{ color: C.slateL, fontSize: 12, marginTop: 2 }}>
                    {row.project_name ?? "Unnamed project"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: C.gold, fontWeight: 700, fontSize: 14 }}>
                    {formatPrice(row.sell_price)}
                  </div>
                  <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                    {formatDate(row.created_at)}
                  </div>
                </div>
                <div
                  style={{
                    background: `${C.gold}26`,
                    color: C.navy,
                    padding: "3px 10px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "capitalize",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyEstimateIcon() {
  return <DocumentIcon size={34} color={C.navy} />;
}

export function EmptyInvoiceIcon() {
  return <ClipboardDollarIcon size={34} color={C.navy} />;
}
