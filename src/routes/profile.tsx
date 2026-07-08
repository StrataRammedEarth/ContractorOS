import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useSettings, type OrgSettings } from "@/lib/settings-context";
import { loadEmployees, saveEmployee, removeEmployee, type Employee } from "@/lib/supabase-client";
import { loadVehicles, saveVehicle, removeVehicle, type Vehicle } from "@/lib/supabase-client";

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

// ─── EMPLOYEE DETAILS (Section E) ──────────────────────────────────────────────
// Separate from Section C · Labour Rates (E4/Option B): no shared state, no
// cross-references. Reads/writes go through the get-employees / save-employee /
// remove-employee edge functions (employees has RLS with no client-auth session
// in this app yet, so direct table access from the browser is blocked — same
// reason estimate saves route through save-estimate rather than a direct insert).

type EmployeeDraft = { name: string; position: string; hourly_rate: string };
const emptyEmployeeDraft: EmployeeDraft = { name: "", position: "", hourly_rate: "" };

const addLineBtnStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 6,
  border: `1px dashed ${C.gold}`,
  background: "#FDF3DC",
  color: C.navy,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

const rowDeleteBtnStyle: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 6,
  border: "1px solid #E0B4B4",
  background: "#fff",
  color: C.red,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};

function EmployeeSummaryRow({
  employee,
  removing,
  onEdit,
  onRemove,
}: {
  employee: Employee;
  removing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const parts = [employee.name];
  if (employee.position) parts.push(employee.position);
  if (employee.hourly_rate != null) {
    parts.push(`R${Number(employee.hourly_rate).toLocaleString("en-ZA")}/hr`);
  }

  return (
    <div
      style={{
        border: `1px solid ${C.gold}55`,
        borderRadius: 8,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "#FDF3DC",
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{parts.join(" · ")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={onEdit}
            title="Edit employee"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: C.slate,
              fontSize: 13,
            }}
          >
            ✎
          </button>
          <button
            onClick={onRemove}
            disabled={removing}
            title="Remove employee"
            style={{
              ...rowDeleteBtnStyle,
              opacity: removing ? 0.5 : 1,
              cursor: removing ? "not-allowed" : "pointer",
            }}
          >
            {removing ? "…" : "✕"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmployeeEditRow({
  draft,
  setDraft,
  error,
  saving,
  onSave,
  onCancel,
  isNew,
}: {
  draft: EmployeeDraft;
  setDraft: React.Dispatch<React.SetStateAction<EmployeeDraft>>;
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const nameInvalid = !!error && draft.name.trim() === "";
  return (
    <div
      style={{
        border: `1px solid ${C.gold}55`,
        borderRadius: 8,
        marginBottom: 10,
        padding: 12,
        background: "#fff",
      }}
    >
      <div
        style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 10, marginBottom: 10 }}
      >
        <div>
          <Label>Name *</Label>
          <input
            style={inputStyle(nameInvalid)}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Employee name"
          />
        </div>
        <div>
          <Label>Position</Label>
          <input
            style={inputStyle()}
            value={draft.position}
            onChange={(e) => setDraft((d) => ({ ...d, position: e.target.value }))}
            placeholder="e.g. Plumber"
          />
        </div>
        <div>
          <Label hint="optional">Rate (R/hr)</Label>
          <input
            type="number"
            style={inputStyle()}
            value={draft.hourly_rate}
            onChange={(e) => setDraft((d) => ({ ...d, hourly_rate: e.target.value }))}
          />
        </div>
      </div>
      {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: "7px 16px",
            borderRadius: 6,
            border: "none",
            background: C.gold,
            color: C.navy,
            fontWeight: 700,
            fontSize: 12,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : isNew ? "Add employee" : "Save"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: "7px 16px",
            borderRadius: 6,
            border: "1px solid #C8D0DB",
            background: "#fff",
            color: C.slate,
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EmployeeDetailsCard({ hoursPerDay }: { hoursPerDay: number }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<EmployeeDraft>(emptyEmployeeDraft);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EmployeeDraft>(emptyEmployeeDraft);
  const [editError, setEditError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadEmployees();
      if (!cancelled) {
        setEmployees(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startAdd = () => {
    setAdding(true);
    setAddDraft(emptyEmployeeDraft);
    setAddError(null);
  };
  const cancelAdd = () => {
    setAdding(false);
    setAddDraft(emptyEmployeeDraft);
    setAddError(null);
  };
  const submitAdd = async () => {
    if (addDraft.name.trim() === "") {
      setAddError("Name is required.");
      return;
    }
    setSaving(true);
    setAddError(null);
    const res = await saveEmployee({
      name: addDraft.name,
      position: addDraft.position || undefined,
      hourly_rate: addDraft.hourly_rate.trim() === "" ? null : Number(addDraft.hourly_rate),
    });
    setSaving(false);
    if (!res.success || !res.employee) {
      setAddError(res.error ?? "Failed to save employee.");
      return;
    }
    setEmployees((prev) => [...prev, res.employee as Employee]);
    setAdding(false);
    setAddDraft(emptyEmployeeDraft);
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEditDraft({
      name: emp.name,
      position: emp.position ?? "",
      hourly_rate: emp.hourly_rate != null ? String(emp.hourly_rate) : "",
    });
    setEditError(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };
  const submitEdit = async () => {
    if (!editingId) return;
    if (editDraft.name.trim() === "") {
      setEditError("Name is required.");
      return;
    }
    setSaving(true);
    setEditError(null);
    const res = await saveEmployee({
      id: editingId,
      name: editDraft.name,
      position: editDraft.position || undefined,
      hourly_rate: editDraft.hourly_rate.trim() === "" ? null : Number(editDraft.hourly_rate),
    });
    setSaving(false);
    if (!res.success || !res.employee) {
      setEditError(res.error ?? "Failed to save employee.");
      return;
    }
    const saved = res.employee;
    setEmployees((prev) => prev.map((e) => (e.id === editingId ? saved : e)));
    setEditingId(null);
  };

  const handleRemove = async (emp: Employee) => {
    if (!window.confirm(`Remove ${emp.name}? They can be re-added later.`)) return;
    setRemovingId(emp.id);
    const res = await removeEmployee(emp.id);
    setRemovingId(null);
    if (!res.success) {
      window.alert(res.error ?? "Failed to remove employee.");
      return;
    }
    setEmployees((prev) => prev.filter((e) => e.id !== emp.id));
    if (editingId === emp.id) setEditingId(null);
  };

  const { dailyTotal, weeklyTotal } = useMemo(() => {
    const daily = employees.reduce(
      (sum, e) => (e.hourly_rate != null ? sum + Number(e.hourly_rate) * hoursPerDay : sum),
      0,
    );
    return { dailyTotal: daily, weeklyTotal: daily * 5 };
  }, [employees, hoursPerDay]);

  return (
    <Card title="E · Employee Details">
      {loading ? (
        <div style={{ fontSize: 12, color: C.slateL }}>Loading employees…</div>
      ) : (
        <>
          {employees.length === 0 && !adding && (
            <div style={{ fontSize: 12, color: C.slateL, marginBottom: 10 }}>
              No employees added yet.
            </div>
          )}

          {employees.map((emp) =>
            editingId === emp.id ? (
              <EmployeeEditRow
                key={emp.id}
                draft={editDraft}
                setDraft={setEditDraft}
                error={editError}
                saving={saving}
                onSave={submitEdit}
                onCancel={cancelEdit}
              />
            ) : (
              <EmployeeSummaryRow
                key={emp.id}
                employee={emp}
                removing={removingId === emp.id}
                onEdit={() => startEdit(emp)}
                onRemove={() => handleRemove(emp)}
              />
            ),
          )}

          {adding ? (
            <EmployeeEditRow
              draft={addDraft}
              setDraft={setAddDraft}
              error={addError}
              saving={saving}
              onSave={submitAdd}
              onCancel={cancelAdd}
              isNew
            />
          ) : (
            <button onClick={startAdd} style={addLineBtnStyle}>
              + Add Employee
            </button>
          )}

          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px solid #DDE3EA",
              fontSize: 12,
              color: C.slate,
            }}
          >
            Total team cost (reference only) —{" "}
            <strong style={{ color: C.navy }}>{fmt(dailyTotal)}/day</strong> ·{" "}
            <strong style={{ color: C.navy }}>{fmt(weeklyTotal)}/week</strong>.
            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
              Does not affect job pricing.
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── VEHICLES (Section F) ──────────────────────────────────────────────────────
// Same pattern as Section E · Employee Details: reads/writes go through the
// get-vehicles / save-vehicle / remove-vehicle edge functions (vehicles has RLS
// with no client-auth session in this app yet, so direct table access from the
// browser is blocked — same reason as employees above).

type VehicleDraft = { registration_number: string; make: string; model: string };
const emptyVehicleDraft: VehicleDraft = { registration_number: "", make: "", model: "" };

function VehicleSummaryRow({
  vehicle,
  removing,
  onEdit,
  onRemove,
}: {
  vehicle: Vehicle;
  removing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const parts = [vehicle.registration_number];
  if (vehicle.make) parts.push(vehicle.make);
  if (vehicle.model) parts.push(vehicle.model);

  return (
    <div
      style={{
        border: `1px solid ${C.gold}55`,
        borderRadius: 8,
        marginBottom: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "#FDF3DC",
          padding: "8px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{parts.join(" · ")}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={onEdit}
            title="Edit vehicle"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              color: C.slate,
              fontSize: 13,
            }}
          >
            ✎
          </button>
          <button
            onClick={onRemove}
            disabled={removing}
            title="Remove vehicle"
            style={{
              ...rowDeleteBtnStyle,
              opacity: removing ? 0.5 : 1,
              cursor: removing ? "not-allowed" : "pointer",
            }}
          >
            {removing ? "…" : "✕"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VehicleEditRow({
  draft,
  setDraft,
  error,
  saving,
  onSave,
  onCancel,
  isNew,
}: {
  draft: VehicleDraft;
  setDraft: React.Dispatch<React.SetStateAction<VehicleDraft>>;
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
}) {
  const regInvalid = !!error && draft.registration_number.trim() === "";
  return (
    <div
      style={{
        border: `1px solid ${C.gold}55`,
        borderRadius: 8,
        marginBottom: 10,
        padding: 12,
        background: "#fff",
      }}
    >
      <div
        style={{ display: "grid", gridTemplateColumns: "2fr 2fr 2fr", gap: 10, marginBottom: 10 }}
      >
        <div>
          <Label>Registration Number *</Label>
          <input
            style={inputStyle(regInvalid)}
            value={draft.registration_number}
            onChange={(e) => setDraft((d) => ({ ...d, registration_number: e.target.value }))}
            placeholder="e.g. CA 123-456"
          />
        </div>
        <div>
          <Label hint="optional">Make</Label>
          <input
            style={inputStyle()}
            value={draft.make}
            onChange={(e) => setDraft((d) => ({ ...d, make: e.target.value }))}
            placeholder="e.g. Toyota"
          />
        </div>
        <div>
          <Label hint="optional">Model</Label>
          <input
            style={inputStyle()}
            value={draft.model}
            onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
            placeholder="e.g. Hilux"
          />
        </div>
      </div>
      {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onSave}
          disabled={saving}
          style={{
            padding: "7px 16px",
            borderRadius: 6,
            border: "none",
            background: C.gold,
            color: C.navy,
            fontWeight: 700,
            fontSize: 12,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : isNew ? "Add vehicle" : "Save"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            padding: "7px 16px",
            borderRadius: 6,
            border: "1px solid #C8D0DB",
            background: "#fff",
            color: C.slate,
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function VehicleDetailsCard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<VehicleDraft>(emptyVehicleDraft);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<VehicleDraft>(emptyVehicleDraft);
  const [editError, setEditError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadVehicles();
      if (!cancelled) {
        setVehicles(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startAdd = () => {
    setAdding(true);
    setAddDraft(emptyVehicleDraft);
    setAddError(null);
  };
  const cancelAdd = () => {
    setAdding(false);
    setAddDraft(emptyVehicleDraft);
    setAddError(null);
  };
  const submitAdd = async () => {
    if (addDraft.registration_number.trim() === "") {
      setAddError("Registration number is required.");
      return;
    }
    setSaving(true);
    setAddError(null);
    const res = await saveVehicle({
      registration_number: addDraft.registration_number,
      make: addDraft.make || undefined,
      model: addDraft.model || undefined,
    });
    setSaving(false);
    if (!res.success || !res.vehicle) {
      setAddError(res.error ?? "Failed to save vehicle.");
      return;
    }
    setVehicles((prev) => [...prev, res.vehicle as Vehicle]);
    setAdding(false);
    setAddDraft(emptyVehicleDraft);
  };

  const startEdit = (veh: Vehicle) => {
    setEditingId(veh.id);
    setEditDraft({
      registration_number: veh.registration_number,
      make: veh.make ?? "",
      model: veh.model ?? "",
    });
    setEditError(null);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditError(null);
  };
  const submitEdit = async () => {
    if (!editingId) return;
    if (editDraft.registration_number.trim() === "") {
      setEditError("Registration number is required.");
      return;
    }
    setSaving(true);
    setEditError(null);
    const res = await saveVehicle({
      id: editingId,
      registration_number: editDraft.registration_number,
      make: editDraft.make || undefined,
      model: editDraft.model || undefined,
    });
    setSaving(false);
    if (!res.success || !res.vehicle) {
      setEditError(res.error ?? "Failed to save vehicle.");
      return;
    }
    const saved = res.vehicle;
    setVehicles((prev) => prev.map((v) => (v.id === editingId ? saved : v)));
    setEditingId(null);
  };

  const handleRemove = async (veh: Vehicle) => {
    if (!window.confirm(`Remove ${veh.registration_number}? It can be re-added later.`)) return;
    setRemovingId(veh.id);
    const res = await removeVehicle(veh.id);
    setRemovingId(null);
    if (!res.success) {
      window.alert(res.error ?? "Failed to remove vehicle.");
      return;
    }
    setVehicles((prev) => prev.filter((v) => v.id !== veh.id));
    if (editingId === veh.id) setEditingId(null);
  };

  return (
    <Card title="F · Vehicles">
      {loading ? (
        <div style={{ fontSize: 12, color: C.slateL }}>Loading vehicles…</div>
      ) : (
        <>
          {vehicles.length === 0 && !adding && (
            <div style={{ fontSize: 12, color: C.slateL, marginBottom: 10 }}>
              No vehicles added yet.
            </div>
          )}

          {vehicles.map((veh) =>
            editingId === veh.id ? (
              <VehicleEditRow
                key={veh.id}
                draft={editDraft}
                setDraft={setEditDraft}
                error={editError}
                saving={saving}
                onSave={submitEdit}
                onCancel={cancelEdit}
              />
            ) : (
              <VehicleSummaryRow
                key={veh.id}
                vehicle={veh}
                removing={removingId === veh.id}
                onEdit={() => startEdit(veh)}
                onRemove={() => handleRemove(veh)}
              />
            ),
          )}

          {adding ? (
            <VehicleEditRow
              draft={addDraft}
              setDraft={setAddDraft}
              error={addError}
              saving={saving}
              onSave={submitAdd}
              onCancel={cancelAdd}
              isNew
            />
          ) : (
            <button onClick={startAdd} style={addLineBtnStyle}>
              + Add Vehicle
            </button>
          )}
        </>
      )}
    </Card>
  );
}

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

        {/* Section E — Employee Details */}
        <EmployeeDetailsCard hoursPerDay={form.hoursPerDay} />

        {/* Section F — Vehicles */}
        <VehicleDetailsCard />

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
