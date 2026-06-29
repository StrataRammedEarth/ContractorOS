import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSettings, type OrgSettings } from "@/lib/settings-context";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile & Settings — ContractorOS" }] }),
  component: ProfilePage,
});

// ─── THEME ────────────────────────────────────────────────────────────────────
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

const fmt = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

// ─── SMALL FIELD HELPERS ──────────────────────────────────────────────────────
function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
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

const inputStyle = (invalid?: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "9px 11px",
  borderRadius: 6,
  border: `1px solid ${invalid ? C.red : "#C8D0DB"}`,
  fontSize: 13,
  color: C.navy,
  background: "#fff",
  boxSizing: "border-box",
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
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
        }}
      >
        {title}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 12,
};

function ProfilePage() {
  const { settings, saveSettings } = useSettings();
  const router = useRouter();
  const [form, setForm] = useState<OrgSettings>(settings);
  const [showErrors, setShowErrors] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof OrgSettings>(key: K, value: OrgSettings[K]) => {
    setForm((p) => ({ ...p, [key]: value }));
    setSaved(false);
  };
  // numeric input → number (NaN guarded); blank optional numeric → undefined
  const setNum = (key: keyof OrgSettings, raw: string, optional = false) => {
    if (optional && raw.trim() === "") return set(key, undefined as never);
    const n = parseFloat(raw);
    set(key, (Number.isFinite(n) ? n : 0) as never);
  };

  // ── Live commercial-ladder preview on a R10,000 prime-cost job ──────────────
  const preview = useMemo(() => {
    const base = 10000;
    const waste = base * (form.wastePct / 100);
    const direct = base + waste;
    const risk = direct * (form.riskPct / 100);
    const afterRisk = direct + risk;
    const cont = afterRisk * (form.contingencyPct / 100);
    const afterCont = afterRisk + cont;
    const margin = afterCont * (form.marginPct / 100);
    const sell = afterCont + margin;
    return { waste, direct, risk, afterRisk, cont, afterCont, margin, sell };
  }, [form.wastePct, form.riskPct, form.contingencyPct, form.marginPct]);

  const crewPerDay = form.plumberDayRate + form.assistantDayRate;
  const crewPerHr = form.hoursPerDay > 0 ? crewPerDay / form.hoursPerDay : 0;

  const businessNameInvalid = showErrors && form.businessName.trim() === "";
  const contactNameInvalid = showErrors && form.contactName.trim() === "";

  const onSave = () => {
    if (form.businessName.trim() === "" || form.contactName.trim() === "") {
      setShowErrors(true);
      setSaved(false);
      return;
    }
    saveSettings(form);
    setShowErrors(false);
    setSaved(true);
  };

  return (
    <div
      style={{ fontFamily: "'Inter',system-ui,sans-serif", background: C.bg, minHeight: "100vh" }}
    >
      {/* Header */}
      <div
        style={{
          background: C.navy,
          borderBottom: `3px solid ${C.gold}`,
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            maxWidth: 820,
            margin: "0 auto",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link
            to="/"
            style={{ color: C.gold, fontSize: 12, fontWeight: 600, textDecoration: "none" }}
          >
            ← Back
          </Link>
          <div style={{ color: C.gold, fontWeight: 900, fontSize: 16 }}>Profile &amp; Settings</div>
          <span style={{ width: 40 }} />
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: 20 }}>
        {/* Section A — Business Identity */}
        <Card title="A · Business Identity">
          <div style={grid2}>
            <div>
              <Label>Business name *</Label>
              <input
                style={inputStyle(businessNameInvalid)}
                value={form.businessName}
                onChange={(e) => set("businessName", e.target.value)}
                placeholder="Acme Plumbing (Pty) Ltd"
              />
            </div>
            <div>
              <Label>Trading name (optional)</Label>
              <input
                style={inputStyle()}
                value={form.tradingName ?? ""}
                onChange={(e) => set("tradingName", e.target.value)}
              />
            </div>
          </div>
          <div style={grid2}>
            <div>
              <Label>Contact name *</Label>
              <input
                style={inputStyle(contactNameInvalid)}
                value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <input
                style={inputStyle()}
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Label>Email</Label>
            <input
              style={inputStyle()}
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Label>Address</Label>
            <textarea
              style={{ ...inputStyle(), resize: "vertical" }}
              rows={3}
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
          <div style={grid2}>
            <div>
              <Label hint="Leave blank if not VAT registered">VAT number</Label>
              <input
                style={inputStyle()}
                value={form.vatNumber ?? ""}
                onChange={(e) => set("vatNumber", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label hint="Shown on invoices — bank, account, branch code">Banking details</Label>
            <textarea
              style={{ ...inputStyle(), resize: "vertical" }}
              rows={2}
              value={form.bankingDetails ?? ""}
              onChange={(e) => set("bankingDetails", e.target.value)}
            />
          </div>
        </Card>

        {/* Section B — Commercial Ladder */}
        <Card title="B · Commercial Ladder">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            {/* inputs */}
            <div>
              {[
                { k: "wastePct" as const, label: "Waste %", note: "on material" },
                { k: "riskPct" as const, label: "Risk %", note: "on direct cost" },
                { k: "contingencyPct" as const, label: "Contingency %", note: "on risk-adjusted" },
                { k: "marginPct" as const, label: "Margin %", note: "markup on cost" },
              ].map((r) => (
                <div
                  key={r.k}
                  style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: C.navy, fontWeight: 600 }}>{r.label}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{r.note}</div>
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    style={{ ...inputStyle(), width: 80, textAlign: "right" }}
                    value={form[r.k]}
                    onChange={(e) => setNum(r.k, e.target.value)}
                  />
                  <span style={{ color: C.slateL, fontSize: 12 }}>%</span>
                </div>
              ))}
            </div>
            {/* live preview */}
            <div style={{ background: C.bg, borderRadius: 8, padding: 14, fontSize: 12 }}>
              <div
                style={{
                  color: C.muted,
                  fontSize: 10,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Live preview: R10,000 job
              </div>
              {[
                { l: "Waste", add: preview.waste, run: preview.direct, runL: "Direct cost" },
                { l: "Risk", add: preview.risk, run: preview.afterRisk, runL: "After risk" },
                {
                  l: "Contingency",
                  add: preview.cont,
                  run: preview.afterCont,
                  runL: "After cont.",
                },
                { l: "Margin", add: preview.margin, run: preview.sell, runL: "Sell price" },
              ].map((row) => (
                <div
                  key={row.l}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                    color: C.slate,
                  }}
                >
                  <span>
                    {row.l} <span style={{ color: C.green }}>+{fmt(row.add)}</span>
                  </span>
                  <span style={{ color: C.navy }}>
                    {row.runL}: <strong>{fmt(row.run)}</strong>
                  </span>
                </div>
              ))}
              <div
                style={{
                  borderTop: "1px solid #DDE3EA",
                  marginTop: 8,
                  paddingTop: 8,
                  color: C.navy,
                  fontWeight: 700,
                }}
              >
                Sell price: <span style={{ color: C.gold }}>{fmt(preview.sell)}</span> excl. VAT
                <div style={{ color: C.muted, fontSize: 10, fontWeight: 400, marginTop: 2 }}>
                  (× {(1 + form.marginPct / 100).toFixed(2)} = {fmt(preview.sell)})
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: C.slate, lineHeight: 1.6 }}>
            <strong>
              Margin % is markup on cost (×{(1 + form.marginPct / 100).toFixed(2)}), not gross
              margin.
            </strong>{" "}
            Changing to 30% means selling at cost × 1.30. All percentages compound on the running
            total, in the order shown.
          </div>
        </Card>

        {/* Section C — Labour Rates */}
        <Card title="C · Labour Rates">
          <div style={grid2}>
            <div>
              <Label>Plumber day rate (R)</Label>
              <input
                type="number"
                style={inputStyle()}
                value={form.plumberDayRate}
                onChange={(e) => setNum("plumberDayRate", e.target.value)}
              />
            </div>
            <div>
              <Label>Assistant day rate (R)</Label>
              <input
                type="number"
                style={inputStyle()}
                value={form.assistantDayRate}
                onChange={(e) => setNum("assistantDayRate", e.target.value)}
              />
            </div>
          </div>
          <div style={grid2}>
            <div>
              <Label hint="used to calculate hourly rate">Working hours per day</Label>
              <input
                type="number"
                step="0.5"
                style={inputStyle()}
                value={form.hoursPerDay}
                onChange={(e) => setNum("hoursPerDay", e.target.value)}
              />
            </div>
          </div>
          <div
            style={{
              background: C.bg,
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 12,
              color: C.navy,
              marginBottom: 12,
            }}
          >
            → Composite crew: <strong>R{crewPerDay.toLocaleString("en-ZA")}/day</strong> = R
            {crewPerHr.toLocaleString("en-ZA", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            /hr
          </div>
          <div style={grid2}>
            <div>
              <Label hint="optional — charged as fixed line item">Callout fee (R)</Label>
              <input
                type="number"
                style={inputStyle()}
                value={form.calloutFee ?? ""}
                onChange={(e) => setNum("calloutFee", e.target.value, true)}
              />
            </div>
            <div>
              <Label hint="optional — charged per km on callout jobs">Travel rate (R/km)</Label>
              <input
                type="number"
                style={inputStyle()}
                value={form.travelRatePerKm ?? ""}
                onChange={(e) => setNum("travelRatePerKm", e.target.value, true)}
              />
            </div>
          </div>
        </Card>

        {/* Section D — Document Settings */}
        <Card title="D · Document Settings">
          <div style={grid2}>
            <div>
              <Label hint="references will be PREFIX-202606-001…">Quote prefix</Label>
              <input
                style={inputStyle()}
                value={form.quotePrefix}
                onChange={(e) => set("quotePrefix", e.target.value.toUpperCase())}
              />
            </div>
            <div>
              <Label>Quote valid for (days)</Label>
              <input
                type="number"
                style={inputStyle()}
                value={form.quoteValidityDays}
                onChange={(e) => setNum("quoteValidityDays", e.target.value)}
              />
            </div>
          </div>
          <div style={grid2}>
            <div>
              <Label>Invoice due after (days)</Label>
              <input
                type="number"
                style={inputStyle()}
                value={form.invoicePaymentDays}
                onChange={(e) => setNum("invoicePaymentDays", e.target.value)}
              />
            </div>
            <div>
              <Label hint="⚠ only change if SARS regulations change">VAT rate %</Label>
              <input
                type="number"
                step="0.5"
                style={inputStyle()}
                value={form.vatRatePct}
                onChange={(e) => setNum("vatRatePct", e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label hint="Printed at the bottom of every quote and invoice">
              Terms &amp; conditions
            </Label>
            <textarea
              style={{ ...inputStyle(), resize: "vertical" }}
              rows={6}
              value={form.termsConditions ?? ""}
              onChange={(e) => set("termsConditions", e.target.value)}
            />
          </div>
        </Card>

        {/* Save bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 40 }}>
          <button
            onClick={onSave}
            style={{
              padding: "11px 24px",
              borderRadius: 8,
              border: "none",
              background: C.gold,
              color: C.navy,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Save settings
          </button>
          {saved && (
            <span style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>
              ✓ Settings saved.{" "}
              <button
                onClick={() => router.navigate({ to: "/" })}
                style={{
                  background: "none",
                  border: "none",
                  color: C.slate,
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontSize: 13,
                }}
              >
                Back to home
              </button>
            </span>
          )}
          {showErrors && (
            <span style={{ color: C.red, fontSize: 13, fontWeight: 600 }}>
              Business name and contact name are required.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
