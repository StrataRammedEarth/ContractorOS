import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  loadEstimateById,
  updateEstimateStatus,
  clearStoredOwnerSecret,
  type EstimateVersionRow,
} from "@/lib/supabase-client";
import { StatusToggle, getOrPromptOwnerSecret } from "@/components/StatusToggle";
import type { DocumentType } from "@/lib/invoice-document";

// ─── COLOUR THEME (shared navy / gold tokens — matches DocumentListPage / index) ──
const C = {
  navy: "#0D1B2A",
  navyMid: "#152436",
  navyLt: "#1F3247",
  gold: "#F5A623",
  slate: "#4A6080",
  slateL: "#6B859E",
  muted: "#8FA3B8",
  panel: "#FFFFFF",
  bg: "#F1F4F8",
  offWhite: "#F7F9FB",
};

interface MaterialLine {
  id?: string;
  code: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
  conf: string;
}

interface LadderBreakdown {
  prime: number;
  waste: number;
  direct: number;
  risk: number;
  afterRisk: number;
  cont: number;
  afterCont: number;
  margin: number;
  sell: number;
}

interface LadderRates {
  wastePct: number;
  riskPct: number;
  contingencyPct: number;
  marginPct: number;
}

interface Snapshot {
  saved_at?: string;
  projectName?: string;
  clientName?: string;
  allocatedEmployees?: { id: string; name: string }[];
  totals?: { material?: number; labour?: number; sellExclVat?: number };
  materialLines?: MaterialLine[];
  ladder?: { rates: LadderRates; breakdown: LadderBreakdown };
}

const fmt = (n: number | undefined) =>
  n == null ? "—" : `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (isoStr: string) =>
  new Date(isoStr).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

export function DocumentDetailPage({ documentType, id }: { documentType: DocumentType; id: string }) {
  const [row, setRow] = useState<EstimateVersionRow | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadEstimateById(id).then((r) => {
      if (!cancelled) setRow(r);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const listTo = documentType === "invoice" ? "/invoices" : "/estimates";
  const listLabel = documentType === "invoice" ? "Invoices" : "Estimates";

  if (row === undefined) {
    return (
      <div style={{ fontFamily: "'Inter',system-ui,sans-serif", background: C.bg, minHeight: "100vh", padding: 40, textAlign: "center", color: C.slateL, fontSize: 13 }}>
        Loading...
      </div>
    );
  }

  if (row === null) {
    return (
      <div style={{ fontFamily: "'Inter',system-ui,sans-serif", background: C.bg, minHeight: "100vh" }}>
        <Header listTo={listTo} listLabel={listLabel} />
        <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 20px", textAlign: "center", color: C.slateL, fontSize: 13 }}>
          Record not found.
        </div>
      </div>
    );
  }

  const snapshot = (row.snapshot ?? {}) as Snapshot;
  const viewable = typeof snapshot.saved_at === "string";

  if (!viewable) {
    return (
      <div style={{ fontFamily: "'Inter',system-ui,sans-serif", background: C.bg, minHeight: "100vh" }}>
        <Header listTo={listTo} listLabel={listLabel} />
        <div style={{ maxWidth: 720, margin: "40px auto", padding: "0 20px", textAlign: "center", color: C.slateL, fontSize: 13 }}>
          This record predates the current estimate format and can't be displayed here.
        </div>
      </div>
    );
  }

  const lines = snapshot.materialLines ?? [];
  const ladder = snapshot.ladder;
  const vatPct = 15; // display only — VAT rate isn't frozen per-record, so incl-VAT figures aren't shown here.

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", background: C.bg, minHeight: "100vh" }}>
      <Header listTo={listTo} listLabel={listLabel} />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px" }}>
        {/* Identity card */}
        <div style={{ background: C.panel, border: "1px solid #DDE3EA", borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 800, color: C.navy, fontSize: 16 }}>{snapshot.clientName || "Unnamed client"}</div>
              <div style={{ color: C.slateL, fontSize: 13, marginTop: 2 }}>{snapshot.projectName || "Unnamed project"}</div>
            </div>
            <StatusToggle
              documentType={documentType}
              id={row.id}
              status={row.status}
              onChanged={(patch) =>
                setRow((prev) => (prev ? { ...prev, ...patch } : prev))
              }
            />
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: C.slate }}>
            <div><span style={{ color: C.muted }}>Ref: </span><span style={{ fontFamily: "monospace" }}>{row.reference}</span></div>
            <div><span style={{ color: C.muted }}>Date: </span>{formatDate(row.created_at)}</div>
          </div>
          {snapshot.allocatedEmployees && snapshot.allocatedEmployees.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.slateL }}>
              <span style={{ color: C.muted }}>Crew: </span>
              {snapshot.allocatedEmployees.map((e) => e.name).join(", ")}
            </div>
          )}
          {documentType === "invoice" && (
            <DueDateField
              id={row.id}
              status={row.status}
              invoiceMeta={row.invoice_meta}
              onChanged={(patch) => setRow((prev) => (prev ? { ...prev, ...patch } : prev))}
            />
          )}
        </div>

        {/* Sell price card */}
        <div style={{ background: `linear-gradient(135deg,${C.navy},${C.navyMid})`, borderRadius: 8, padding: "20px 24px", marginBottom: 16, border: `1px solid ${C.gold}40` }}>
          <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" }}>Sell Price (excl. VAT)</div>
          <div style={{ color: C.gold, fontSize: 32, fontWeight: 900, letterSpacing: -1 }}>
            {fmt(snapshot.totals?.sellExclVat)}
          </div>
        </div>

        {/* Commercial ladder */}
        {ladder ? (
          <>
            <SectionHeader>Commercial Ladder</SectionHeader>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16, background: C.panel }}>
              <tbody>
                {[
                  { l: "Material", v: snapshot.totals?.material },
                  { l: "Labour", v: snapshot.totals?.labour },
                  { l: "Prime cost", v: ladder.breakdown.prime },
                  { l: `+ Material waste ${ladder.rates.wastePct}%`, v: ladder.breakdown.waste },
                  { l: "= Direct cost", v: ladder.breakdown.direct },
                  { l: `+ Risk ${ladder.rates.riskPct}%`, v: ladder.breakdown.risk },
                  { l: `+ Contingency ${ladder.rates.contingencyPct}%`, v: ladder.breakdown.cont },
                  { l: `+ Margin ${ladder.rates.marginPct}%`, v: ladder.breakdown.margin },
                  { l: "= Sell (excl. VAT)", v: ladder.breakdown.sell, bold: true },
                ].map((r, i) => (
                  <tr key={i} style={{ background: r.bold ? C.navyLt + "0D" : i % 2 === 0 ? C.offWhite : "#fff", borderBottom: "1px solid #E0E5EC" }}>
                    <td style={{ padding: "7px 16px", color: r.bold ? C.navy : C.slate, fontWeight: r.bold ? 700 : 400 }}>{r.l}</td>
                    <td style={{ padding: "7px 16px", textAlign: "right", fontWeight: r.bold ? 700 : 400, color: C.navy }}>{fmt(r.v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div style={{ background: "#FEF5E7", border: "1px solid #E67E2240", borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 11, color: C.navy }}>
            ⚠ Cost breakdown not available for this record — only totals were captured at save time.
          </div>
        )}

        {/* Material lines */}
        <SectionHeader>Material Lines{lines.length > 0 ? ` — ${lines.length} items` : ""}</SectionHeader>
        {lines.length > 0 ? (
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 600, background: C.panel }}>
              <thead>
                <tr style={{ background: C.navyLt, color: C.muted }}>
                  {["Code", "Description", "Qty", "Unit", "Unit Price", "Total", "Grade"].map((h) => (
                    <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.id ?? `${l.code}-${i}`} style={{ background: i % 2 === 0 ? C.offWhite : "#fff", borderBottom: "1px solid #E8EDF2" }}>
                    <td style={{ padding: "6px 10px", fontFamily: "monospace", fontSize: 10, color: C.slate }}>{l.code}</td>
                    <td style={{ padding: "6px 10px", color: C.navy }}>{l.description}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{l.qty}</td>
                    <td style={{ padding: "6px 10px", color: C.slateL }}>{l.unit}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{fmt(l.unitPrice)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>{fmt(l.total)}</td>
                    <td style={{ padding: "6px 10px", color: C.slateL }}>{l.conf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ background: "#FEF5E7", border: "1px solid #E67E2240", borderRadius: 6, padding: "10px 16px", marginBottom: 16, fontSize: 11, color: C.navy }}>
            ⚠ Line-item detail not available for this record — only totals were captured at save time.
          </div>
        )}

        <div style={{ color: C.muted, fontSize: 10, marginTop: 8 }}>
          {vatPct}% VAT not shown — this view reflects the material and labour costs frozen at save time only.
        </div>
      </div>
    </div>
  );
}

type StatusPatch = Pick<EstimateVersionRow, "status" | "invoice_meta" | "updated_at">;

function DueDateField({
  id,
  status,
  invoiceMeta,
  onChanged,
}: {
  id: string;
  status: string;
  invoiceMeta: Record<string, unknown> | null;
  onChanged: (patch: StatusPatch) => void;
}) {
  const currentDueDate = typeof invoiceMeta?.dueDate === "string" ? invoiceMeta.dueDate : "";
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentDueDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!value) return;
    const ownerSecret = getOrPromptOwnerSecret("Enter the owner passphrase to change the due date:");
    if (!ownerSecret) return;

    setSaving(true);
    setError(null);
    const result = await updateEstimateStatus(id, status, value, ownerSecret);
    setSaving(false);

    if (!result.success || !result.estimate) {
      if (result.unauthorized) {
        clearStoredOwnerSecret();
        setError("Incorrect owner passphrase.");
      } else {
        setError(result.error ?? "Failed to update due date.");
      }
      return;
    }
    onChanged(result.estimate);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ marginTop: 8, fontSize: 12, color: "#4A6080", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#8FA3B8" }}>Due: </span>
        <input
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ fontSize: 12, padding: "3px 6px", border: "1px solid #DDE3EA", borderRadius: 4 }}
        />
        <button
          type="button"
          disabled={saving}
          onClick={save}
          style={{ fontSize: 11, fontWeight: 700, color: "#0D1B2A", background: "none", border: "none", cursor: saving ? "default" : "pointer" }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setValue(currentDueDate); setError(null); }}
          style={{ fontSize: 11, color: "#8FA3B8", background: "none", border: "none", cursor: "pointer" }}
        >
          Cancel
        </button>
        {error && <span style={{ fontSize: 10, color: "#C0392B" }}>{error}</span>}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8, fontSize: 12, color: "#4A6080" }}>
      <span style={{ color: "#8FA3B8" }}>Due: </span>
      {currentDueDate ? formatDate(currentDueDate) : "—"}{" "}
      <button
        type="button"
        onClick={() => setEditing(true)}
        style={{ fontSize: 11, color: "#0D1B2A", fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
      >
        Edit
      </button>
    </div>
  );
}

function Header({ listTo, listLabel }: { listTo: string; listLabel: string }) {
  return (
    <div style={{ background: C.navy, borderBottom: `3px solid ${C.gold}` }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <Link to={listTo} style={{ color: C.gold, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          ← {listLabel}
        </Link>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: C.navy, fontWeight: 800, fontSize: 13, margin: "0 0 8px" }}>{children}</div>
  );
}
