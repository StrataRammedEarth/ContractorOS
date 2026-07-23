import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  loadAttendance,
  loadDriverLogs,
  loadEmployees,
  loadVehicles,
  saveAttendance,
  saveDriverLog,
  removeDriverLog,
  getStoredOwnerSecret,
  setStoredOwnerSecret,
  clearStoredOwnerSecret,
  loadCallOutTemplates,
  saveCallOutTemplate,
  loadCallOuts,
  loadCallOut,
  saveCallOut,
  removeCallOut,
  loadTools,
  saveTool,
  removeTool,
  loadToolsStarterTemplate,
  loadCustomMaterials,
  saveCustomMaterial,
  removeCustomMaterial,
  loadCustomMaterialsStarterTemplate,
  supabase,
  type AttendanceRecord,
  type AttendanceStatus,
  type DriverLog,
  type Employee,
  type Vehicle,
  type Tool,
  type CustomMaterial,
  type CallOutTemplate,
  type CallOutSummary,
  type CallOutFull,
  type CallOutLineClass,
  type CallOutLineKind,
} from "@/lib/supabase-client";
import { useSettings } from "@/lib/settings-context";
import { ClockIcon, ClipboardDollarIcon } from "@/components/nav-icons";
import { generateCallOutPdf } from "@/lib/call-out-pdf";
import {
  Label,
  inputStyle,
  Card,
  addLineBtnStyle,
  rowDeleteBtnStyle,
} from "@/components/settings-ui";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Planner — ContractorOS" }] }),
  component: TeamPage,
});

// ─── THEME (matches profile.tsx / index.tsx conventions) ───────────────────────
const C = {
  navy: "#0D1B2A",
  navyMid: "#152436",
  gold: "#F5A623",
  goldPale: "#FDF3DC",
  slate: "#4A6080",
  slateL: "#6B859E",
  muted: "#8FA3B8",
  bg: "#F1F4F8",
  red: "#E74C3C",
  green: "#27AE60",
};

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: C.green,
  absent: C.red,
  sick: "#C0392B",
  on_leave: C.slate,
  public_holiday: C.gold,
  half_day: "#8E7CC3",
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  sick: "Sick",
  on_leave: "On leave",
  public_holiday: "Public holiday",
  half_day: "Half day",
};

const STATUS_OPTIONS: AttendanceStatus[] = [
  "present",
  "absent",
  "on_leave",
  "sick",
  "public_holiday",
  "half_day",
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Local-date key (not toISOString, which is UTC and can shift the day).
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + n);
  return copy;
}

// Parses "HH:MM" or "HH:MM:SS" (Postgres `time` round-trips with seconds,
// the <input type="time"> only produces HH:MM) into minutes-since-midnight.
function toMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{2}):(\d{2})/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

const STATUSES_WITH_ARRIVAL: AttendanceStatus[] = ["present", "half_day"];

// ─── CALENDAR GRID ──────────────────────────────────────────────────────────────

function buildMonthGrid(monthAnchor: Date): { date: Date; inMonth: boolean }[][] {
  const firstOfMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
  const lastOfMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  const gridEnd = addDays(lastOfMonth, 6 - lastOfMonth.getDay());

  const days: { date: Date; inMonth: boolean }[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    days.push({ date: d, inMonth: d.getMonth() === monthAnchor.getMonth() });
  }

  const weeks: { date: Date; inMonth: boolean }[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

// Present-count summary for a day cell — collapses the per-employee badge list
// into a single indicator, reusing the same green/amber/red convention as
// AttendanceBadge's per-status colors rather than inventing a new palette.
function PresentCountBadge({
  present,
  total,
  richer,
}: {
  present: number;
  total: number;
  richer?: boolean;
}) {
  if (total === 0) return null;
  const color = present === 0 ? C.red : present === total ? C.green : C.gold;
  return (
    <div
      title={`${present} of ${total} present`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: `${color}1A`,
        border: `1px solid ${color}66`,
        borderRadius: 4,
        padding: richer ? "3px 7px" : "1px 5px",
        fontSize: richer ? 12 : 10,
        fontWeight: 700,
        color: C.navy,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: richer ? 7 : 6,
          height: richer ? 7 : 6,
          minWidth: richer ? 7 : 6,
          borderRadius: "50%",
          background: color,
        }}
      />
      {present}/{total}
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  attendance,
  totalEmployees,
  richer,
  onClick,
}: {
  date: Date;
  inMonth: boolean;
  attendance: AttendanceRecord[];
  totalEmployees: number;
  richer?: boolean;
  onClick: () => void;
}) {
  const isToday = dateKey(date) === dateKey(new Date());
  const presentCount = attendance.filter(
    (a) => a.status === "present" || a.status === "half_day",
  ).length;
  return (
    <div
      style={{
        minHeight: richer ? 220 : 92,
        border: "1px solid #DDE3EA",
        borderRadius: 6,
        padding: richer ? 10 : 6,
        background: inMonth ? "#fff" : "#F7F9FB",
        opacity: inMonth ? 1 : 0.55,
        display: "flex",
        flexDirection: "column",
        gap: richer ? 8 : 4,
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}
      >
        <div
          style={{
            fontSize: richer ? 13 : 11,
            fontWeight: isToday ? 800 : 600,
            color: isToday ? C.gold : inMonth ? C.navy : C.muted,
          }}
        >
          {richer
            ? date.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })
            : date.getDate()}
        </div>
        {attendance.length > 0 && (
          <PresentCountBadge present={presentCount} total={totalEmployees} richer={richer} />
        )}
      </div>
      <button
        onClick={onClick}
        title="View team attendance & driver logs for this day"
        style={{
          marginTop: "auto",
          alignSelf: "flex-start",
          padding: richer ? "6px 10px" : "3px 6px",
          borderRadius: 6,
          border: "1px solid #C8D0DB",
          background: "#fff",
          color: C.navy,
          fontWeight: 700,
          fontSize: richer ? 12 : 10,
          cursor: "pointer",
        }}
      >
        Team
      </button>
    </div>
  );
}

type AttendanceDraft = { status: AttendanceStatus | ""; note: string; arrivalTime: string };

const fieldStyle: CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid #C8D0DB",
  fontSize: 12,
  color: "#0D1B2A",
};

type DriverLogDraft = { employeeId: string; vehicleId: string; startTime: string; endTime: string };

function DriverLogSection({
  employees,
  vehicles,
  logs,
  adding,
  removingId,
  error,
  onAdd,
  onRemove,
}: {
  employees: Employee[];
  vehicles: Vehicle[];
  logs: DriverLog[];
  adding: boolean;
  removingId: string | null;
  error: string | null;
  onAdd: (entry: {
    employee_id: string;
    vehicle_id: string;
    start_time: string | null;
    end_time: string | null;
  }) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<DriverLogDraft>({
    employeeId: "",
    vehicleId: "",
    startTime: "",
    endTime: "",
  });

  const resetForm = () => {
    setDraft({ employeeId: "", vehicleId: "", startTime: "", endTime: "" });
    setShowForm(false);
  };

  const handleAdd = async () => {
    if (!draft.employeeId || !draft.vehicleId) return;
    const success = await onAdd({
      employee_id: draft.employeeId,
      vehicle_id: draft.vehicleId,
      start_time: draft.startTime || null,
      end_time: draft.endTime || null,
    });
    if (success) resetForm();
  };

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: `2px solid ${C.navy}22` }}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: C.navy,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: 0.3,
        }}
      >
        Driver Logs
      </div>

      {logs.length === 0 && !showForm && (
        <div style={{ fontSize: 12, color: C.slateL, marginBottom: 8 }}>
          No driver log entries for this day.
        </div>
      )}

      {logs.map((log) => (
        <div
          key={log.id}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            fontSize: 12,
            color: C.navy,
            padding: "6px 0",
            borderBottom: "1px solid #EEF1F5",
          }}
        >
          <span>
            🚚 {log.vehicle_registration ?? "Unknown vehicle"} · {log.employee_name ?? "Unknown"}
            {(log.start_time || log.end_time) &&
              ` · ${log.start_time ?? "?"}–${log.end_time ?? "?"}`}
          </span>
          <button
            onClick={() => onRemove(log.id)}
            disabled={removingId === log.id}
            style={{
              background: "none",
              border: "none",
              color: C.red,
              cursor: removingId === log.id ? "not-allowed" : "pointer",
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {removingId === log.id ? "Removing…" : "Remove"}
          </button>
        </div>
      ))}

      {showForm ? (
        <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
          <select
            value={draft.employeeId}
            onChange={(e) => setDraft((d) => ({ ...d, employeeId: e.target.value }))}
            style={fieldStyle}
          >
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <select
            value={draft.vehicleId}
            onChange={(e) => setDraft((d) => ({ ...d, vehicleId: e.target.value }))}
            style={fieldStyle}
          >
            <option value="">Select vehicle…</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registration_number}
              </option>
            ))}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input
              type="time"
              value={draft.startTime}
              onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))}
              style={fieldStyle}
            />
            <input
              type="time"
              value={draft.endTime}
              onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))}
              style={fieldStyle}
            />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              onClick={resetForm}
              disabled={adding}
              style={{
                padding: "6px 12px",
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
            <button
              onClick={handleAdd}
              disabled={adding || !draft.employeeId || !draft.vehicleId}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: C.gold,
                color: C.navy,
                fontWeight: 700,
                fontSize: 12,
                cursor: adding ? "not-allowed" : "pointer",
                opacity: adding || !draft.employeeId || !draft.vehicleId ? 0.6 : 1,
              }}
            >
              {adding ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{
            marginTop: 8,
            background: "none",
            border: "none",
            color: C.gold,
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            padding: 0,
          }}
        >
          + Add entry
        </button>
      )}

      {error && <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

interface DayDetailProps {
  employees: Employee[];
  vehicles: Vehicle[];
  existing: AttendanceRecord[];
  saving: boolean;
  error: string | null;
  driverLogs: DriverLog[];
  addingDriverLog: boolean;
  removingDriverLogId: string | null;
  driverLogError: string | null;
  onSave: (
    entries: {
      employee_id: string;
      status: AttendanceStatus;
      note: string | null;
      arrival_time: string | null;
    }[],
  ) => void;
  onAddDriverLog: (entry: {
    employee_id: string;
    vehicle_id: string;
    start_time: string | null;
    end_time: string | null;
  }) => Promise<boolean>;
  onRemoveDriverLog: (id: string) => void;
  onClose?: () => void;
}

function DayDetail({
  employees,
  vehicles,
  existing,
  saving,
  error,
  driverLogs,
  addingDriverLog,
  removingDriverLogId,
  driverLogError,
  onSave,
  onAddDriverLog,
  onRemoveDriverLog,
  onClose,
}: DayDetailProps) {
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>(() => {
    const initial: Record<string, AttendanceDraft> = {};
    for (const emp of employees) {
      const record = existing.find((a) => a.employee_id === emp.id);
      initial[emp.id] = {
        status: record?.status ?? "",
        note: record?.note ?? "",
        arrivalTime: record?.arrival_time?.slice(0, 5) ?? "",
      };
    }
    return initial;
  });

  const setDraft = (employeeId: string, patch: Partial<AttendanceDraft>) => {
    setDrafts((prev) => ({ ...prev, [employeeId]: { ...prev[employeeId], ...patch } }));
  };

  const [noteExpanded, setNoteExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const emp of employees) {
      const record = existing.find((a) => a.employee_id === emp.id);
      initial[emp.id] = !!record?.note;
    }
    return initial;
  });

  const toggleNote = (employeeId: string) => {
    setNoteExpanded((prev) => ({ ...prev, [employeeId]: !prev[employeeId] }));
  };

  const handleSave = () => {
    const entries: {
      employee_id: string;
      status: AttendanceStatus;
      note: string | null;
      arrival_time: string | null;
    }[] = [];
    for (const emp of employees) {
      const draft = drafts[emp.id];
      if (draft && draft.status !== "") {
        const showsArrival = STATUSES_WITH_ARRIVAL.includes(draft.status);
        entries.push({
          employee_id: emp.id,
          status: draft.status,
          note: draft.note.trim() === "" ? null : draft.note.trim(),
          arrival_time: showsArrival && draft.arrivalTime.trim() !== "" ? draft.arrivalTime : null,
        });
      }
    }
    onSave(entries);
  };

  return (
    <>
      <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
        {employees.length === 0 ? (
          <div style={{ fontSize: 12, color: C.slateL }}>No active employees.</div>
        ) : (
          employees.map((emp) => {
            const draft = drafts[emp.id] ?? { status: "", note: "" };
            const isNoteExpanded = noteExpanded[emp.id] ?? false;
            return (
              <div
                key={emp.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 10,
                  paddingBottom: 10,
                  borderBottom: "1px solid #EEF1F5",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{emp.name}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft(emp.id, { status: e.target.value as AttendanceStatus | "" })
                    }
                    style={{
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: `1px solid ${draft.status !== "" ? STATUS_COLORS[draft.status as AttendanceStatus] : "#C8D0DB"}`,
                      fontSize: 12,
                      fontWeight: draft.status !== "" ? 700 : 400,
                      color:
                        draft.status !== ""
                          ? STATUS_COLORS[draft.status as AttendanceStatus]
                          : C.navy,
                    }}
                  >
                    <option value="">— Not marked —</option>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => toggleNote(emp.id)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid #C8D0DB",
                      background: "#fff",
                      color: C.slate,
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    {isNoteExpanded ? "− Remove note" : "+ Add note"}
                  </button>
                </div>
                {draft.status !== "" && STATUSES_WITH_ARRIVAL.includes(draft.status) && (
                  <div
                    style={{
                      gridColumn: "1 / span 2",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <label style={{ fontSize: 11, color: C.slateL, whiteSpace: "nowrap" }}>
                      Arrival time
                    </label>
                    <input
                      type="time"
                      value={draft.arrivalTime}
                      onChange={(e) => setDraft(emp.id, { arrivalTime: e.target.value })}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid #C8D0DB",
                        fontSize: 12,
                        color: C.navy,
                      }}
                    />
                  </div>
                )}
                {isNoteExpanded && (
                  <input
                    value={draft.note}
                    onChange={(e) => setDraft(emp.id, { note: e.target.value })}
                    placeholder="Note (optional)"
                    style={{
                      gridColumn: "1 / span 2",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #C8D0DB",
                      fontSize: 12,
                      color: C.navy,
                    }}
                  />
                )}
              </div>
            );
          })
        )}
        {error && <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>{error}</div>}

        <DriverLogSection
          employees={employees}
          vehicles={vehicles}
          logs={driverLogs}
          adding={addingDriverLog}
          removingId={removingDriverLogId}
          error={driverLogError}
          onAdd={onAddDriverLog}
          onRemove={onRemoveDriverLog}
        />
      </div>
      <div
        style={{
          padding: 16,
          borderTop: "1px solid #DDE3EA",
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "8px 16px",
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
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 16px",
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
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}

function DayModal({
  date,
  onClose,
  ...detailProps
}: DayDetailProps & { date: Date; onClose: () => void }) {
  const dateLabel = date.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(13,27,42,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 10,
          overflow: "hidden",
          width: "100%",
          maxWidth: 520,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            background: C.navyMid,
            color: C.gold,
            fontWeight: 700,
            fontSize: 13,
            padding: "12px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{dateLabel}</span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: C.gold,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
        <DayDetail key={dateKey(date)} {...detailProps} onClose={onClose} />
      </div>
    </div>
  );
}

// ─── MONTHLY REPORT ─────────────────────────────────────────────────────────

const fmtRand = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function isLateRecord(record: AttendanceRecord, scheduledMinutes: number | null): boolean {
  if (!STATUSES_WITH_ARRIVAL.includes(record.status)) return false;
  const arrival = toMinutes(record.arrival_time);
  if (arrival === null || scheduledMinutes === null) return false;
  return arrival > scheduledMinutes;
}

interface EmployeeMonthReport {
  employee: Employee;
  counts: Record<AttendanceStatus, number>;
  lateCount: number;
  wageEstimate: number | null;
  // Non-present days plus late present/half-day days — the days worth a closer look.
  exceptions: (AttendanceRecord & { late: boolean })[];
}

function buildEmployeeReports(
  employees: Employee[],
  records: AttendanceRecord[],
  scheduledStartTime: string,
  hoursPerDay: number,
): EmployeeMonthReport[] {
  const scheduledMinutes = toMinutes(scheduledStartTime);
  return employees.map((employee) => {
    const empRecords = records
      .filter((r) => r.employee_id === employee.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const counts = STATUS_OPTIONS.reduce(
      (acc, s) => {
        acc[s] = 0;
        return acc;
      },
      {} as Record<AttendanceStatus, number>,
    );
    let lateCount = 0;
    const exceptions: (AttendanceRecord & { late: boolean })[] = [];

    for (const r of empRecords) {
      counts[r.status] += 1;
      const late = isLateRecord(r, scheduledMinutes);
      if (late) lateCount += 1;
      if (r.status !== "present" || late) exceptions.push({ ...r, late });
    }

    // Half-day counted as 0.5 of a full wage day — an assumption, not a confirmed
    // payroll rule; flagged in the UI note below pending owner sign-off.
    const wageDays = counts.present + counts.half_day * 0.5;
    const wageEstimate =
      employee.hourly_rate != null ? wageDays * Number(employee.hourly_rate) * hoursPerDay : null;

    return { employee, counts, lateCount, wageEstimate, exceptions };
  });
}

// Column order for the report table: Employee, then the five non-present
// statuses, then Late, then Present (the "days worked" figure the wage calc
// uses), then Salary — Present sits immediately before Salary rather than in
// STATUS_OPTIONS's original position. Layout-only ordering; no data change.
const REPORT_STATUS_COLUMNS: AttendanceStatus[] = [
  "absent",
  "on_leave",
  "sick",
  "public_holiday",
  "half_day",
];

// Small colored dot matching STATUS_COLORS — the app's existing per-status
// visual marker (see AttendanceBadge in the calendar view above). Reused here
// as the column-header "icon" rather than introducing a new icon set: no
// person/per-status icon set exists anywhere else in the codebase to draw on
// (nav-icons.tsx only has Document/ClipboardDollar/Clock/Gear/Dashboard/
// Hamburger/Checkbox/Search — Clock and ClipboardDollar below are reused
// where they actually fit; a dedicated icon per status was not invented).
function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        marginRight: 5,
      }}
    />
  );
}

const reportTh: CSSProperties = {
  padding: "8px 10px",
  fontWeight: 800,
  whiteSpace: "nowrap",
};
const reportTd: CSSProperties = {
  padding: "10px 10px",
  color: C.navy,
  whiteSpace: "nowrap",
};

function MonthlyReportView({
  employees,
  attendance,
  scheduledStartTime,
  hoursPerDay,
  loading,
  viewLabel,
}: {
  employees: Employee[];
  attendance: AttendanceRecord[];
  scheduledStartTime: string;
  hoursPerDay: number;
  loading: boolean;
  viewLabel: string;
}) {
  const reports = useMemo(
    () => buildEmployeeReports(employees, attendance, scheduledStartTime, hoursPerDay),
    [employees, attendance, scheduledStartTime, hoursPerDay],
  );
  const totals = useMemo(() => {
    const statusTotals = REPORT_STATUS_COLUMNS.reduce(
      (acc, s) => {
        acc[s] = reports.reduce((sum, r) => sum + r.counts[s], 0);
        return acc;
      },
      {} as Record<AttendanceStatus, number>,
    );
    const lateTotal = reports.reduce((sum, r) => sum + r.lateCount, 0);
    const presentTotal = reports.reduce((sum, r) => sum + r.counts.present, 0);
    const salaryTotal = reports.reduce((sum, r) => sum + (r.wageEstimate ?? 0), 0);
    return { statusTotals, lateTotal, presentTotal, salaryTotal };
  }, [reports]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return (
      <div style={{ fontSize: 12, color: C.slateL, padding: 20, textAlign: "center" }}>
        Loading report…
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div style={{ fontSize: 12, color: C.slateL, padding: 20, textAlign: "center" }}>
        No active employees.
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #DDE3EA",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: C.navy,
          color: C.gold,
          padding: "14px 16px",
          fontWeight: 900,
          fontSize: 16,
          textAlign: "center",
          letterSpacing: 0.3,
        }}
      >
        {viewLabel} Staff Report
      </div>
      <div
        style={{
          padding: "10px 16px",
          fontSize: 11,
          color: C.slate,
          borderBottom: "1px solid #EEF1F5",
          background: C.bg,
          lineHeight: 1.5,
        }}
      >
        Wage estimate = (present days + half-day days × 0.5) × hourly rate × hours/day — for payroll
        reference only, not a final payslip. Late = arrival after{" "}
        <strong>{scheduledStartTime}</strong> (scheduled start, set in Profile &amp; Settings).
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr
              style={{
                textAlign: "center",
                color: C.navy,
                fontSize: 11,
                textTransform: "uppercase",
                borderBottom: "1px solid #DDE3EA",
              }}
            >
              <th style={{ ...reportTh, textAlign: "left" }}>Employee</th>
              {REPORT_STATUS_COLUMNS.map((s) => (
                <th key={s} style={reportTh}>
                  <Dot color={STATUS_COLORS[s]} />
                  {STATUS_LABELS[s]}
                </th>
              ))}
              <th style={reportTh}>
                <ClockIcon size={12} color={C.red} strokeWidth={2} />
                <span style={{ marginLeft: 4 }}>Late</span>
              </th>
              <th style={reportTh}>
                <Dot color={STATUS_COLORS.present} />
                {STATUS_LABELS.present}
              </th>
              <th style={{ ...reportTh, textAlign: "right" }}>
                <ClipboardDollarIcon size={12} color={C.navy} strokeWidth={2} />
                <span style={{ marginLeft: 4 }}>Salary</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map(({ employee, counts, lateCount, wageEstimate, exceptions }) => {
              const expanded = expandedId === employee.id;
              return (
                <Fragment key={employee.id}>
                  <tr
                    onClick={() => setExpandedId(expanded ? null : employee.id)}
                    style={{ borderTop: "1px solid #EEF1F5", cursor: "pointer" }}
                  >
                    <td style={{ ...reportTd, fontWeight: 700 }}>
                      {expanded ? "▾" : "▸"} {employee.name}
                    </td>
                    {REPORT_STATUS_COLUMNS.map((s) => (
                      <td key={s} style={{ ...reportTd, textAlign: "center" }}>
                        {counts[s]}
                      </td>
                    ))}
                    <td
                      style={{
                        ...reportTd,
                        textAlign: "center",
                        color: lateCount > 0 ? C.red : C.navy,
                        fontWeight: lateCount > 0 ? 700 : 400,
                      }}
                    >
                      {lateCount}
                    </td>
                    <td style={{ ...reportTd, textAlign: "center", fontWeight: 700 }}>
                      {counts.present}
                    </td>
                    <td style={{ ...reportTd, textAlign: "right", fontWeight: 700 }}>
                      {wageEstimate != null ? `~${fmtRand(wageEstimate)}` : "—"}
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td
                        colSpan={REPORT_STATUS_COLUMNS.length + 3}
                        style={{ padding: "0 10px 14px 10px" }}
                      >
                        {exceptions.length === 0 ? (
                          <div style={{ fontSize: 12, color: C.slateL }}>
                            No absences, sick days, or late arrivals this month.
                          </div>
                        ) : (
                          <table
                            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
                          >
                            <thead>
                              <tr
                                style={{
                                  textAlign: "left",
                                  color: C.muted,
                                  fontSize: 10,
                                  textTransform: "uppercase",
                                }}
                              >
                                <th style={{ padding: "4px 6px" }}>Date</th>
                                <th style={{ padding: "4px 6px" }}>Status</th>
                                <th style={{ padding: "4px 6px" }}>Arrival</th>
                                <th style={{ padding: "4px 6px" }}>Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {exceptions.map((r) => (
                                <tr key={r.id} style={{ borderTop: "1px solid #F1F4F8" }}>
                                  <td
                                    style={{
                                      padding: "4px 6px",
                                      color: C.navy,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {new Date(`${r.date}T00:00:00`).toLocaleDateString("en-ZA", {
                                      weekday: "short",
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </td>
                                  <td style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>
                                    <span
                                      style={{ color: STATUS_COLORS[r.status], fontWeight: 700 }}
                                    >
                                      {STATUS_LABELS[r.status]}
                                    </span>
                                    {r.late && (
                                      <span style={{ color: C.red, marginLeft: 6 }}>· Late</span>
                                    )}
                                  </td>
                                  <td
                                    style={{
                                      padding: "4px 6px",
                                      color: C.slate,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {r.arrival_time ? r.arrival_time.slice(0, 5) : "—"}
                                  </td>
                                  <td style={{ padding: "4px 6px", color: C.slate }}>
                                    {r.note ?? "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr
              style={{
                borderTop: `2px solid ${C.navy}`,
                background: C.bg,
                fontWeight: 800,
              }}
            >
              <td style={{ ...reportTd, fontWeight: 800 }}>Total</td>
              {REPORT_STATUS_COLUMNS.map((s) => (
                <td key={s} style={{ ...reportTd, textAlign: "center", fontWeight: 800 }}>
                  {totals.statusTotals[s]}
                </td>
              ))}
              <td style={{ ...reportTd, textAlign: "center", fontWeight: 800 }}>
                {totals.lateTotal}
              </td>
              <td style={{ ...reportTd, textAlign: "center", fontWeight: 800 }}>
                {totals.presentTotal}
              </td>
              <td style={{ ...reportTd, textAlign: "right", fontWeight: 800 }}>
                ~{fmtRand(totals.salaryTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Toggle-button look shared by the Calendar/Reports and Day/Week/Month
// pairs — the same dashed-gold "actionable" style as EstimatePage's
// addLineBtn (cream fill, dashed gold border, navy text) for the inactive
// state, with a solid-gold fill for the active/selected option so the two
// read as clearly distinct states.
const toggleBtnBase: CSSProperties = {
  padding: "6px 14px",
  borderRadius: 6,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  textTransform: "capitalize",
};
const toggleBtnInactive: CSSProperties = {
  ...toggleBtnBase,
  border: `1px dashed ${C.gold}`,
  background: C.goldPale,
  color: C.navy,
};
const toggleBtnActive: CSSProperties = {
  ...toggleBtnBase,
  border: `1px solid ${C.gold}`,
  background: C.gold,
  color: C.navy,
};
const navBtn: CSSProperties = {
  padding: "7px 14px",
  borderRadius: 6,
  border: "1px solid #C8D0DB",
  background: "#fff",
  color: C.slate,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};

// ─── CALL-OUT VIEW ──────────────────────────────────────────────────────────────
// Draft shape mirrors the save-call-out body (Brief 4 §5a) so a save is just
// spreading the draft plus owner_secret — no separate mapping step.

interface CallOutDraftLine {
  id?: string;
  line_number: number;
  line_class: CallOutLineClass;
  line_kind: CallOutLineKind;
  material_code: string | null;
  custom_material_id: string | null;
  label: string;
  qty: number;
  unit: string | null;
  is_checked: boolean;
  notes: string | null;
  checklist_section: string | null;
}

interface CallOutDraft {
  id?: string;
  template_id: string | null;
  job_category: string;
  issue_name: string;
  call_out_date: string;
  client_name: string;
  client_address: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  employee_ids: string[];
  lines: CallOutDraftLine[];
}

// Draft shape for authoring a custom issue (Brief 6) — a template, not a
// call-out record, so no date/client/crew fields.
interface CallOutTemplateAuthorDraft {
  job_category: string;
  issue_name: string;
  lines: CallOutDraftLine[];
}

function emptyTemplateAuthorDraft(job_category: string): CallOutTemplateAuthorDraft {
  return { job_category, issue_name: "", lines: [] };
}

function draftFromTemplate(template: CallOutTemplate): CallOutDraft {
  return {
    template_id: template.template_id,
    job_category: template.job_category,
    issue_name: template.issue_name,
    call_out_date: "",
    client_name: "",
    client_address: "",
    clocked_in_at: null,
    clocked_out_at: null,
    employee_ids: [],
    lines: template.rows
      .slice()
      .sort((a, b) => a.line_number - b.line_number)
      .map((row) => ({
        line_number: row.line_number,
        line_class: row.line_class,
        line_kind: row.line_kind,
        material_code: row.line_kind === "catalogue" ? row.material_code : null,
        custom_material_id: null,
        label: row.label,
        qty: row.default_qty,
        unit: row.unit,
        is_checked: row.include_by_default,
        notes: row.notes,
        checklist_section: null,
      })),
  };
}

function draftFromCallOut(full: CallOutFull): CallOutDraft {
  return {
    id: full.id,
    template_id: full.template_id,
    job_category: full.job_category,
    issue_name: full.issue_name,
    call_out_date: full.call_out_date ?? "",
    client_name: full.client_name ?? "",
    client_address: full.client_address ?? "",
    clocked_in_at: full.clocked_in_at,
    clocked_out_at: full.clocked_out_at,
    employee_ids: full.employees.map((e) => e.id),
    lines: full.lines.map((l) => ({
      id: l.id,
      line_number: l.line_number,
      line_class: l.line_class,
      line_kind: l.line_kind,
      material_code: l.material_code,
      custom_material_id: l.custom_material_id,
      label: l.label,
      qty: l.qty,
      unit: l.unit,
      is_checked: l.is_checked,
      notes: l.notes,
      checklist_section: l.checklist_section,
    })),
  };
}

function nextLineNumber(lines: CallOutDraftLine[]): number {
  if (lines.length === 0) return 10;
  return Math.max(...lines.map((l) => l.line_number)) + 10;
}

// datetime-local inputs work in local wall-clock time with no timezone
// suffix; clocked_in_at/clocked_out_at round-trip as ISO timestamptz strings.
function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const coCard: CSSProperties = {
  background: "#fff",
  border: "1px solid #DDE3EA",
  borderRadius: 10,
  overflow: "hidden",
};
const coCardHeader: CSSProperties = {
  background: C.navyMid,
  padding: "10px 16px",
};
const coBackBtn: CSSProperties = {
  background: "none",
  border: "none",
  color: C.gold,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  padding: 0,
};
const coSectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: C.slateL,
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginBottom: 6,
};
const coInput: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid #C8D0DB",
  fontSize: 13,
  color: C.navy,
  boxSizing: "border-box",
};
const coInputSmall: CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid #C8D0DB",
  fontSize: 12,
  color: C.navy,
  width: "100%",
  boxSizing: "border-box",
};
const coHint: CSSProperties = { fontSize: 12, color: C.slateL, padding: "6px 0" };
const coAddBtn: CSSProperties = {
  marginTop: 8,
  padding: "6px 12px",
  borderRadius: 6,
  border: `1px dashed ${C.gold}`,
  background: C.goldPale,
  color: C.navy,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};
const coAddPanel: CSSProperties = {
  marginTop: 8,
  padding: 10,
  borderRadius: 6,
  border: "1px solid #DDE3EA",
  background: C.bg,
};
const coTabActive: CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  border: `1px solid ${C.gold}`,
  background: C.gold,
  color: C.navy,
  fontWeight: 700,
  fontSize: 11,
  cursor: "pointer",
};
const coTabInactive: CSSProperties = {
  ...coTabActive,
  border: "1px solid #C8D0DB",
  background: "#fff",
  color: C.slate,
};
const coResultRow: CSSProperties = {
  padding: "6px 8px",
  fontSize: 12,
  color: C.navy,
  cursor: "pointer",
  borderBottom: "1px solid #EEF1F5",
};
const coSmallBtn: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  border: "1px solid #C8D0DB",
  background: "#fff",
  color: C.slate,
  fontWeight: 600,
  fontSize: 12,
  cursor: "pointer",
};
const coPrimaryBtn: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 6,
  border: "none",
  background: C.gold,
  color: C.navy,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};
const coRemoveBtn: CSSProperties = {
  background: "none",
  border: "none",
  color: C.red,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const coDownloadBtn: CSSProperties = {
  background: "none",
  border: "none",
  color: C.slate,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const coToggleLink: CSSProperties = {
  background: "none",
  border: "none",
  color: C.gold,
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
  padding: 0,
};
const coBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: C.navy,
  background: C.goldPale,
  border: `1px solid ${C.gold}`,
  borderRadius: 4,
  padding: "2px 6px",
};
const coCategoryBtn: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 8,
  border: `1px solid ${C.gold}`,
  background: C.goldPale,
  color: C.navy,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const coTemplateBtn: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid #C8D0DB",
  background: "#fff",
  color: C.navy,
  fontWeight: 600,
  fontSize: 13,
  textAlign: "left",
  cursor: "pointer",
};

// A simple text-filter search against plumblink_materials, read directly via the
// anon-key `supabase` client (public-read RLS, same posture as fixture_templates).
// EstimatePage.tsx's product_filter-driven lookup is built around fixture-template
// rows and too entangled to lift for a free-form "search anything" picker here —
// this is deliberately the simpler alternative the brief allows for.
function useMaterialCatalogueSearch(query: string) {
  const [results, setResults] = useState<
    { material_code: string; label: string; unit: string | null }[]
  >([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      const [byDescription, byDisplayName] = await Promise.all([
        supabase
          .from("plumblink_materials")
          .select("material_code, display_name, description, unit")
          .ilike("description", `%${q}%`)
          .limit(15),
        supabase
          .from("plumblink_materials")
          .select("material_code, display_name, description, unit")
          .ilike("display_name", `%${q}%`)
          .limit(15),
      ]);
      if (cancelled) return;
      const byCode = new Map<
        string,
        { material_code: string; label: string; unit: string | null }
      >();
      for (const row of [...(byDescription.data ?? []), ...(byDisplayName.data ?? [])]) {
        if (!byCode.has(row.material_code)) {
          byCode.set(row.material_code, {
            material_code: row.material_code,
            label: row.display_name ?? row.description ?? row.material_code,
            unit: row.unit,
          });
        }
      }
      setResults(Array.from(byCode.values()).slice(0, 15));
      setSearching(false);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  return { results, searching };
}

function CallOutLineRow({
  line,
  showUnit,
  onChange,
  onRemove,
}: {
  line: CallOutDraftLine;
  showUnit: boolean;
  onChange: (patch: Partial<CallOutDraftLine>) => void;
  onRemove: () => void;
}) {
  const editableLabel = line.line_kind === "free_text";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: showUnit ? "24px 1fr 70px 70px 28px" : "24px 1fr 70px 28px",
        gap: 8,
        alignItems: "center",
        padding: "6px 0",
        borderBottom: "1px solid #EEF1F5",
      }}
    >
      <input
        type="checkbox"
        checked={line.is_checked}
        onChange={(e) => onChange({ is_checked: e.target.checked })}
      />
      {editableLabel ? (
        <input
          value={line.label}
          onChange={(e) => onChange({ label: e.target.value })}
          style={coInputSmall}
        />
      ) : (
        <div style={{ fontSize: 12, color: C.navy }}>{line.label}</div>
      )}
      <input
        type="number"
        min={0}
        step="any"
        value={line.qty}
        onChange={(e) => onChange({ qty: Number(e.target.value) || 0 })}
        style={coInputSmall}
      />
      {showUnit && (
        <input
          value={line.unit ?? ""}
          onChange={(e) => onChange({ unit: e.target.value || null })}
          style={coInputSmall}
        />
      )}
      <button onClick={onRemove} style={coRemoveBtn} title="Remove line">
        ✕
      </button>
    </div>
  );
}

function EmployeeMultiSelect({
  employees,
  selectedIds,
  onChange,
}: {
  employees: Employee[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };
  if (employees.length === 0) {
    return <div style={coHint}>No active employees.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {employees.map((emp) => (
        <label
          key={emp.id}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.navy }}
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(emp.id)}
            onChange={() => toggle(emp.id)}
          />
          {emp.name}
        </label>
      ))}
    </div>
  );
}

function AddMaterialRow({
  customMaterials,
  allowCustomMaterialLines,
  onAdd,
}: {
  customMaterials: CustomMaterial[];
  allowCustomMaterialLines: boolean;
  onAdd: (line: Omit<CallOutDraftLine, "line_number">) => void;
}) {
  const [mode, setMode] = useState<"closed" | "catalogue" | "custom" | "free_text">("closed");
  const [query, setQuery] = useState("");
  const [freeText, setFreeText] = useState("");
  const [customId, setCustomId] = useState("");
  const { results, searching } = useMaterialCatalogueSearch(query);

  if (mode === "closed") {
    return (
      <button style={coAddBtn} onClick={() => setMode("catalogue")}>
        + Add material
      </button>
    );
  }

  const modes = allowCustomMaterialLines
    ? (["catalogue", "custom", "free_text"] as const)
    : (["catalogue", "free_text"] as const);

  return (
    <div style={coAddPanel}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {modes.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={mode === m ? coTabActive : coTabInactive}
          >
            {m === "catalogue" ? "Catalogue" : m === "custom" ? "Custom material" : "Free text"}
          </button>
        ))}
      </div>

      {mode === "catalogue" && (
        <div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search materials…"
            style={coInput}
          />
          {searching && <div style={coHint}>Searching…</div>}
          {results.map((r) => (
            <div
              key={r.material_code}
              onClick={() => {
                onAdd({
                  line_class: "material",
                  line_kind: "catalogue",
                  material_code: r.material_code,
                  custom_material_id: null,
                  label: r.label,
                  qty: 1,
                  unit: r.unit,
                  is_checked: true,
                  notes: null,
                  checklist_section: null,
                });
                setQuery("");
                setMode("closed");
              }}
              style={coResultRow}
            >
              {r.label} <span style={{ color: C.slateL }}>({r.material_code})</span>
            </div>
          ))}
        </div>
      )}

      {mode === "custom" && (
        <div style={{ display: "flex", gap: 6 }}>
          <select value={customId} onChange={(e) => setCustomId(e.target.value)} style={coInput}>
            <option value="">— Select custom material —</option>
            {groupByChecklistSection(customMaterials).map(({ section, items }) => (
              <optgroup key={section} label={section}>
                {items.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            style={coSmallBtn}
            disabled={!customId}
            onClick={() => {
              const material = customMaterials.find((m) => m.id === customId);
              if (!material) return;
              onAdd({
                line_class: "material",
                line_kind: "custom",
                material_code: null,
                custom_material_id: material.id,
                label: material.name,
                qty: 1,
                unit: material.unit,
                is_checked: true,
                notes: null,
                checklist_section: material.checklist_section,
              });
              setCustomId("");
              setMode("closed");
            }}
          >
            Add
          </button>
        </div>
      )}

      {mode === "free_text" && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Material name"
            style={coInput}
          />
          <button
            style={coSmallBtn}
            disabled={!freeText.trim()}
            onClick={() => {
              onAdd({
                line_class: "material",
                line_kind: "free_text",
                material_code: null,
                custom_material_id: null,
                label: freeText.trim(),
                qty: 1,
                unit: null,
                is_checked: true,
                notes: null,
                checklist_section: null,
              });
              setFreeText("");
              setMode("closed");
            }}
          >
            Add
          </button>
        </div>
      )}

      <button style={{ ...coSmallBtn, marginTop: 8 }} onClick={() => setMode("closed")}>
        Cancel
      </button>
    </div>
  );
}

function AddToolRow({
  tools,
  onAdd,
}: {
  tools: Tool[];
  onAdd: (line: Omit<CallOutDraftLine, "line_number">) => void;
}) {
  const [mode, setMode] = useState<"closed" | "tool" | "free_text">("closed");
  const [toolId, setToolId] = useState("");
  const [freeText, setFreeText] = useState("");

  if (mode === "closed") {
    return (
      <button style={coAddBtn} onClick={() => setMode("tool")}>
        + Add tool
      </button>
    );
  }

  return (
    <div style={coAddPanel}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {(["tool", "free_text"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={mode === m ? coTabActive : coTabInactive}
          >
            {m === "tool" ? "From tools list" : "Free text"}
          </button>
        ))}
      </div>

      {mode === "tool" && (
        <div style={{ display: "flex", gap: 6 }}>
          <select value={toolId} onChange={(e) => setToolId(e.target.value)} style={coInput}>
            <option value="">— Select tool —</option>
            {groupByChecklistSection(tools).map(({ section, items }) => (
              <optgroup key={section} label={section}>
                {items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            style={coSmallBtn}
            disabled={!toolId}
            onClick={() => {
              const tool = tools.find((t) => t.id === toolId);
              if (!tool) return;
              // Tool lines are always free_text, even when picked from the tools
              // list — call_out_lines_tools_are_free_text forbids a catalogue/
              // custom FK on a tool row. The UI matches by name, not by id.
              onAdd({
                line_class: "tool",
                line_kind: "free_text",
                material_code: null,
                custom_material_id: null,
                label: tool.name,
                qty: 1,
                unit: null,
                is_checked: true,
                notes: null,
                checklist_section: tool.checklist_section,
              });
              setToolId("");
              setMode("closed");
            }}
          >
            Add
          </button>
        </div>
      )}

      {mode === "free_text" && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder="Tool name"
            style={coInput}
          />
          <button
            style={coSmallBtn}
            disabled={!freeText.trim()}
            onClick={() => {
              onAdd({
                line_class: "tool",
                line_kind: "free_text",
                material_code: null,
                custom_material_id: null,
                label: freeText.trim(),
                qty: 1,
                unit: null,
                is_checked: true,
                notes: null,
                checklist_section: null,
              });
              setFreeText("");
              setMode("closed");
            }}
          >
            Add
          </button>
        </div>
      )}

      <button style={{ ...coSmallBtn, marginTop: 8 }} onClick={() => setMode("closed")}>
        Cancel
      </button>
    </div>
  );
}

function CallOutEditor({
  draft,
  tools,
  customMaterials,
  employees,
  saving,
  saveError,
  onChange,
  onSave,
  onCancel,
  onDownloadPdf,
}: {
  draft: CallOutDraft;
  tools: Tool[];
  customMaterials: CustomMaterial[];
  employees: Employee[];
  saving: boolean;
  saveError: string | null;
  onChange: (draft: CallOutDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onDownloadPdf: (id: string) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(
    !!(
      draft.call_out_date ||
      draft.client_name ||
      draft.client_address ||
      draft.employee_ids.length
    ),
  );
  const [employeesOpen, setEmployeesOpen] = useState(!!draft.employee_ids.length);
  const [materialsOpen, setMaterialsOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);

  const patch = (p: Partial<CallOutDraft>) => onChange({ ...draft, ...p });

  const materialLines = draft.lines.filter((l) => l.line_class === "material");
  const toolLines = draft.lines.filter((l) => l.line_class === "tool");
  const materialCheckedCount = materialLines.filter((l) => l.is_checked).length;
  const toolCheckedCount = toolLines.filter((l) => l.is_checked).length;

  return (
    <div style={coCard}>
      <div style={coCardHeader}>
        <button style={coBackBtn} onClick={onCancel}>
          ← Back to list
        </button>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={coSectionLabel}>Issue</div>
          <input
            value={draft.issue_name}
            onChange={(e) => patch({ issue_name: e.target.value })}
            style={coInput}
          />
        </div>

        <button style={coToggleLink} onClick={() => setDetailsOpen((v) => !v)}>
          {detailsOpen ? "− Hide" : "+ Add"} date, client & crew details
        </button>

        {detailsOpen && (
          <div
            style={{
              marginTop: 10,
              marginBottom: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div>
              <div style={coSectionLabel}>Date</div>
              <input
                type="date"
                value={draft.call_out_date}
                onChange={(e) => patch({ call_out_date: e.target.value })}
                style={coInput}
              />
            </div>
            <div>
              <div style={coSectionLabel}>Clocked in</div>
              <input
                type="datetime-local"
                value={isoToDatetimeLocal(draft.clocked_in_at)}
                onChange={(e) => patch({ clocked_in_at: datetimeLocalToIso(e.target.value) })}
                style={coInput}
              />
            </div>
            <div>
              <div style={coSectionLabel}>Clocked out</div>
              <input
                type="datetime-local"
                value={isoToDatetimeLocal(draft.clocked_out_at)}
                onChange={(e) => patch({ clocked_out_at: datetimeLocalToIso(e.target.value) })}
                style={coInput}
              />
            </div>
            <div>
              <div style={coSectionLabel}>Client name</div>
              <input
                value={draft.client_name}
                onChange={(e) => patch({ client_name: e.target.value })}
                style={coInput}
              />
            </div>
            <div>
              <div style={coSectionLabel}>Client address</div>
              <input
                value={draft.client_address}
                onChange={(e) => patch({ client_address: e.target.value })}
                style={coInput}
              />
            </div>
            <div>
              <button style={coToggleLink} onClick={() => setEmployeesOpen((v) => !v)}>
                {employeesOpen ? "− Hide" : "+ Show"} employees ({draft.employee_ids.length}{" "}
                selected)
              </button>
              {employeesOpen && (
                <div style={{ marginTop: 8 }}>
                  <EmployeeMultiSelect
                    employees={employees}
                    selectedIds={draft.employee_ids}
                    onChange={(ids) => patch({ employee_ids: ids })}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <button style={coToggleLink} onClick={() => setMaterialsOpen((v) => !v)}>
            {materialsOpen ? "− Hide" : "+ Show"} materials ({materialLines.length} items,{" "}
            {materialCheckedCount} checked)
          </button>
          {materialsOpen && (
            <CallOutLineEditor
              lines={draft.lines}
              tools={tools}
              customMaterials={customMaterials}
              allowCustomMaterialLines
              section="material"
              onChange={(lines) => patch({ lines })}
            />
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <button style={coToggleLink} onClick={() => setToolsOpen((v) => !v)}>
            {toolsOpen ? "− Hide" : "+ Show"} tools ({toolLines.length} items, {toolCheckedCount}{" "}
            checked)
          </button>
          {toolsOpen && (
            <CallOutLineEditor
              lines={draft.lines}
              tools={tools}
              customMaterials={customMaterials}
              allowCustomMaterialLines
              section="tool"
              onChange={(lines) => patch({ lines })}
            />
          )}
        </div>

        {saveError && <div style={{ color: C.red, fontSize: 12, marginTop: 12 }}>{saveError}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button
            disabled={!draft.id}
            title={draft.id ? undefined : "Save the call-out first to download a PDF."}
            onClick={() => draft.id && onDownloadPdf(draft.id)}
            style={draft.id ? coSmallBtn : { ...coSmallBtn, opacity: 0.5, cursor: "not-allowed" }}
          >
            Download PDF
          </button>
          <button
            onClick={onSave}
            disabled={saving || !draft.issue_name.trim() || draft.lines.length === 0}
            style={{
              ...coPrimaryBtn,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save Call-Out"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Extracted from CallOutEditor so the record editor and the (smaller) template
// author editor can share material/tool line-editing without duplicating it.
// `section` lets a caller render just the Materials or just the Tools half (so
// CallOutEditor can wrap each in its own collapsible); omitted renders both,
// as CallOutTemplateAuthorEditor still does.
function CallOutLineEditor({
  lines,
  tools,
  customMaterials,
  allowCustomMaterialLines,
  section,
  onChange,
}: {
  lines: CallOutDraftLine[];
  tools: Tool[];
  customMaterials: CustomMaterial[];
  allowCustomMaterialLines: boolean;
  section?: "material" | "tool";
  onChange: (lines: CallOutDraftLine[]) => void;
}) {
  const updateLine = (index: number, p: Partial<CallOutDraftLine>) => {
    const next = lines.slice();
    next[index] = { ...next[index], ...p };
    onChange(next);
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  const addLine = (line: Omit<CallOutDraftLine, "line_number">) => {
    onChange([...lines, { ...line, line_number: nextLineNumber(lines) }]);
  };

  const materialIndices = lines
    .map((l, i) => [l, i] as const)
    .filter(([l]) => l.line_class === "material");
  const toolIndices = lines.map((l, i) => [l, i] as const).filter(([l]) => l.line_class === "tool");

  const groupedMaterials = groupByChecklistSection(
    materialIndices.map(([line, index]) => ({
      checklist_section: line.checklist_section,
      line,
      index,
    })),
  );
  const groupedTools = groupByChecklistSection(
    toolIndices.map(([line, index]) => ({
      checklist_section: line.checklist_section,
      line,
      index,
    })),
  );

  return (
    <>
      {section !== "tool" && (
        <div style={{ marginTop: 14 }}>
          <div style={coSectionLabel}>Materials</div>
          {materialIndices.length === 0 && <div style={coHint}>No material lines yet.</div>}
          {groupedMaterials.map(({ section: groupSection, items }, i) => (
            <Fragment key={groupSection}>
              <div style={sectionHeadingStyle(i === 0)}>{groupSection}</div>
              {items.map(({ line, index }) => (
                <CallOutLineRow
                  key={index}
                  line={line}
                  showUnit
                  onChange={(p) => updateLine(index, p)}
                  onRemove={() => removeLine(index)}
                />
              ))}
            </Fragment>
          ))}
          <AddMaterialRow
            customMaterials={customMaterials}
            allowCustomMaterialLines={allowCustomMaterialLines}
            onAdd={addLine}
          />
        </div>
      )}

      {section !== "material" && (
        <div style={{ marginTop: 20 }}>
          <div style={coSectionLabel}>Tools</div>
          {toolIndices.length === 0 && <div style={coHint}>No tool lines yet.</div>}
          {groupedTools.map(({ section: groupSection, items }, i) => (
            <Fragment key={groupSection}>
              <div style={sectionHeadingStyle(i === 0)}>{groupSection}</div>
              {items.map(({ line, index }) => (
                <CallOutLineRow
                  key={index}
                  line={line}
                  showUnit={false}
                  onChange={(p) => updateLine(index, p)}
                  onRemove={() => removeLine(index)}
                />
              ))}
            </Fragment>
          ))}
          <AddToolRow tools={tools} onAdd={addLine} />
        </div>
      )}
    </>
  );
}

function CallOutTemplatePicker({
  templates,
  initialCategory,
  onPick,
  onAddCustomIssue,
  onCancel,
}: {
  templates: CallOutTemplate[];
  initialCategory?: string | null;
  onPick: (template: CallOutTemplate) => void;
  onAddCustomIssue: (category: string) => void;
  onCancel: () => void;
}) {
  // Derived, not hardcoded — Fixtures currently has two templates, the others one each.
  const categories = Array.from(new Set(templates.map((t) => t.job_category)));
  const [category, setCategory] = useState<string | null>(initialCategory ?? null);

  return (
    <div style={coCard}>
      <div style={coCardHeader}>
        <button style={coBackBtn} onClick={onCancel}>
          ← Back to list
        </button>
      </div>
      <div style={{ padding: 16 }}>
        <div style={coSectionLabel}>{category ? "Choose an issue" : "What kind of job?"}</div>
        {!category ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setCategory(cat)} style={coCategoryBtn}>
                {cat}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <button style={{ ...coSmallBtn, marginBottom: 10 }} onClick={() => setCategory(null)}>
              ← Change category
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {templates
                .filter((t) => t.job_category === category)
                .map((t) => (
                  <button key={t.template_id} onClick={() => onPick(t)} style={coTemplateBtn}>
                    {t.issue_name}
                  </button>
                ))}
              <button
                onClick={() => onAddCustomIssue(category)}
                style={{ ...addLineBtnStyle, textAlign: "left" }}
              >
                + Add custom issue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CallOutTemplateAuthorEditor({
  draft,
  tools,
  customMaterials,
  saving,
  saveError,
  onChange,
  onSave,
  onCancel,
}: {
  draft: CallOutTemplateAuthorDraft;
  tools: Tool[];
  customMaterials: CustomMaterial[];
  saving: boolean;
  saveError: string | null;
  onChange: (draft: CallOutTemplateAuthorDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const patch = (p: Partial<CallOutTemplateAuthorDraft>) => onChange({ ...draft, ...p });

  // A custom material picked here can't be stored as a `custom` line — templates
  // are FK-able but the schema stays two-valued (catalogue/free_text) regardless
  // of whether a given template is org-owned. Convert at the point lines enter
  // the draft so a `custom` line never reaches saveCallOutTemplate().
  const handleLinesChange = (lines: CallOutDraftLine[]) => {
    patch({
      lines: lines.map((l) =>
        l.line_kind === "custom"
          ? { ...l, line_kind: "free_text" as const, custom_material_id: null, material_code: null }
          : l,
      ),
    });
  };

  return (
    <div style={coCard}>
      <div style={coCardHeader}>
        <button style={coBackBtn} onClick={onCancel}>
          ← Back to list
        </button>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={coSectionLabel}>Category</div>
          <div style={{ fontSize: 13, color: C.navy, fontWeight: 700 }}>{draft.job_category}</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={coSectionLabel}>Issue name</div>
          <input
            value={draft.issue_name}
            onChange={(e) => patch({ issue_name: e.target.value })}
            style={coInput}
            placeholder="e.g. Burst geyser element"
          />
        </div>

        <CallOutLineEditor
          lines={draft.lines}
          tools={tools}
          customMaterials={customMaterials}
          allowCustomMaterialLines
          onChange={handleLinesChange}
        />

        {saveError && <div style={{ color: C.red, fontSize: 12, marginTop: 12 }}>{saveError}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" }}>
          <button
            onClick={onSave}
            disabled={saving || !draft.issue_name.trim() || draft.lines.length === 0}
            style={{
              ...coPrimaryBtn,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Saving…" : "Save Issue"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CallOutListView({
  callOuts,
  loading,
  removingCallOutId,
  saveError,
  onOpen,
  onNew,
  onManage,
  onRemove,
  onDownloadPdf,
}: {
  callOuts: CallOutSummary[];
  loading: boolean;
  removingCallOutId: string | null;
  saveError: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onManage: () => void;
  onRemove: (id: string) => void;
  onDownloadPdf: (id: string) => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <button onClick={onManage} style={coToggleLink}>
          Manage Tools &amp; Materials
        </button>
        <button onClick={onNew} style={coPrimaryBtn}>
          + New Call-Out
        </button>
      </div>
      {saveError && <div style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{saveError}</div>}
      {loading ? (
        <div style={{ fontSize: 12, color: C.slateL, padding: 20, textAlign: "center" }}>
          Loading call-outs…
        </div>
      ) : callOuts.length === 0 ? (
        <div style={{ fontSize: 12, color: C.slateL, padding: 20, textAlign: "center" }}>
          No call-outs yet. Start one when a client phones in.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {callOuts.map((co) => (
            <div
              key={co.id}
              onClick={() => onOpen(co.id)}
              style={{
                ...coCard,
                padding: 12,
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{co.issue_name}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                  <span style={coBadge}>{co.job_category}</span>
                  <span style={{ fontSize: 11, color: C.slateL }}>
                    {co.call_out_date
                      ? new Date(co.call_out_date).toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "No date set"}
                  </span>
                  {co.client_name && (
                    <span style={{ fontSize: 11, color: C.slateL }}>· {co.client_name}</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownloadPdf(co.id);
                  }}
                  style={coDownloadBtn}
                  title="Download PDF"
                >
                  ⬇
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(co.id);
                  }}
                  disabled={removingCallOutId === co.id}
                  style={coRemoveBtn}
                  title="Delete call-out"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MANAGE TOOLS & MATERIALS (relocated from profile.tsx Sections G/H) ────────
// Same pattern as everything else here: reads/writes go through the
// get-tools / save-tool / remove-tool and get-custom-materials /
// save-custom-material / remove-custom-material edge functions (both tables
// have RLS with no client-auth session in this app yet, so direct table
// access from the browser is blocked).

// Groups by checklist_section for the Tools/Custom Materials cards, with an
// "Other" bucket (ungrouped items) always sorted last regardless of alphabetical
// position, since it's a fallback rather than a named category.
function groupByChecklistSection<T extends { checklist_section: string | null }>(
  items: T[],
): { section: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = item.checklist_section?.trim() || "Other";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  const sections = [...map.keys()].filter((s) => s !== "Other").sort();
  if (map.has("Other")) sections.push("Other");
  return sections.map((section) => ({ section, items: map.get(section)! }));
}

const sectionHeadingStyle = (first: boolean): CSSProperties => ({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: C.slate,
  margin: first ? "0 0 8px" : "16px 0 8px",
  paddingBottom: 4,
  borderBottom: `1px solid ${C.gold}55`,
});

type ToolDraft = {
  name: string;
  category: "hand" | "power";
  notes: string;
  checklist_section: string;
};
const emptyToolDraft: ToolDraft = {
  name: "",
  category: "hand",
  notes: "",
  checklist_section: "",
};

function ToolSummaryRow({
  tool,
  removing,
  onEdit,
  onRemove,
}: {
  tool: Tool;
  removing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const parts = [tool.name, tool.category === "power" ? "Power" : "Hand"];

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
          background: C.goldPale,
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
            title="Edit tool"
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
            title="Remove tool"
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

function ToolEditRow({
  draft,
  setDraft,
  error,
  saving,
  onSave,
  onCancel,
  isNew,
  sectionSuggestions,
}: {
  draft: ToolDraft;
  setDraft: React.Dispatch<React.SetStateAction<ToolDraft>>;
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
  sectionSuggestions: string[];
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
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 2fr 2fr",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <Label>Name *</Label>
          <input
            style={inputStyle(nameInvalid)}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. 5 Pound Hammer"
          />
        </div>
        <div>
          <Label>Category</Label>
          <select
            style={inputStyle()}
            value={draft.category}
            onChange={(e) =>
              setDraft((d) => ({ ...d, category: e.target.value as "hand" | "power" }))
            }
          >
            <option value="hand">Hand</option>
            <option value="power">Power</option>
          </select>
        </div>
        <div>
          <Label hint="optional">Section</Label>
          <input
            style={inputStyle()}
            value={draft.checklist_section}
            onChange={(e) => setDraft((d) => ({ ...d, checklist_section: e.target.value }))}
            placeholder="e.g. Plumbing & Pipework"
            list="tool-section-suggestions"
          />
          <datalist id="tool-section-suggestions">
            {sectionSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <Label hint="optional">Notes</Label>
          <input
            style={inputStyle()}
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder="e.g. kept in the bakkie"
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
          {saving ? "Saving…" : isNew ? "Add tool" : "Save"}
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

function ToolsCard() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<ToolDraft>(emptyToolDraft);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ToolDraft>(emptyToolDraft);
  const [editError, setEditError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadTools();
      if (!cancelled) {
        setTools(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sectionSuggestions = useMemo(
    () =>
      Array.from(
        new Set(tools.map((t) => t.checklist_section?.trim()).filter(Boolean)),
      ).sort() as string[],
    [tools],
  );

  const startAdd = () => {
    setAdding(true);
    setAddDraft(emptyToolDraft);
    setAddError(null);
  };
  const cancelAdd = () => {
    setAdding(false);
    setAddDraft(emptyToolDraft);
    setAddError(null);
  };
  const submitAdd = async () => {
    if (addDraft.name.trim() === "") {
      setAddError("Name is required.");
      return;
    }
    setSaving(true);
    setAddError(null);
    const res = await saveTool({
      name: addDraft.name,
      category: addDraft.category,
      notes: addDraft.notes || undefined,
      checklist_section: addDraft.checklist_section || undefined,
    });
    setSaving(false);
    if (!res.success || !res.tool) {
      setAddError(res.error ?? "Failed to save tool.");
      return;
    }
    setTools((prev) => [...prev, res.tool as Tool]);
    setAdding(false);
    setAddDraft(emptyToolDraft);
  };

  const startEdit = (tool: Tool) => {
    setEditingId(tool.id);
    setEditDraft({
      name: tool.name,
      category: tool.category,
      notes: tool.notes ?? "",
      checklist_section: tool.checklist_section ?? "",
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
    const res = await saveTool({
      id: editingId,
      name: editDraft.name,
      category: editDraft.category,
      notes: editDraft.notes || undefined,
      checklist_section: editDraft.checklist_section || undefined,
    });
    setSaving(false);
    if (!res.success || !res.tool) {
      setEditError(res.error ?? "Failed to save tool.");
      return;
    }
    const saved = res.tool;
    setTools((prev) => prev.map((t) => (t.id === editingId ? saved : t)));
    setEditingId(null);
  };

  const handleRemove = async (tool: Tool) => {
    if (!window.confirm(`Remove ${tool.name}? It can be re-added later.`)) return;
    setRemovingId(tool.id);
    const res = await removeTool(tool.id);
    setRemovingId(null);
    if (!res.success) {
      window.alert(res.error ?? "Failed to remove tool.");
      return;
    }
    setTools((prev) => prev.filter((t) => t.id !== tool.id));
    if (editingId === tool.id) setEditingId(null);
  };

  const handleLoadTemplate = async () => {
    if (
      !window.confirm(
        "This will add any missing items from a starter plumbing template. Nothing you already have will be changed or duplicated.",
      )
    )
      return;
    setLoadingTemplate(true);
    const res = await loadToolsStarterTemplate();
    if (!res.success) {
      setLoadingTemplate(false);
      window.alert(res.error ?? "Failed to load starter template.");
      return;
    }
    const list = await loadTools();
    setTools(list);
    setLoadingTemplate(false);
    window.alert(
      `Added ${res.added} tool${res.added === 1 ? "" : "s"}, skipped ${res.skipped} already in your list.`,
    );
  };

  const grouped = groupByChecklistSection(tools);

  return (
    <Card title="Tools">
      {loading ? (
        <div style={{ fontSize: 12, color: C.slateL }}>Loading tools…</div>
      ) : (
        <>
          {tools.length === 0 && !adding && (
            <div style={{ fontSize: 12, color: C.slateL, marginBottom: 10 }}>
              No tools added yet.
            </div>
          )}

          {grouped.map(({ section, items }, i) => (
            <Fragment key={section}>
              <div style={sectionHeadingStyle(i === 0)}>{section}</div>
              {items.map((tool) =>
                editingId === tool.id ? (
                  <ToolEditRow
                    key={tool.id}
                    draft={editDraft}
                    setDraft={setEditDraft}
                    error={editError}
                    saving={saving}
                    onSave={submitEdit}
                    onCancel={cancelEdit}
                    sectionSuggestions={sectionSuggestions}
                  />
                ) : (
                  <ToolSummaryRow
                    key={tool.id}
                    tool={tool}
                    removing={removingId === tool.id}
                    onEdit={() => startEdit(tool)}
                    onRemove={() => handleRemove(tool)}
                  />
                ),
              )}
            </Fragment>
          ))}

          {adding ? (
            <ToolEditRow
              draft={addDraft}
              setDraft={setAddDraft}
              error={addError}
              saving={saving}
              onSave={submitAdd}
              onCancel={cancelAdd}
              isNew
              sectionSuggestions={sectionSuggestions}
            />
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <button onClick={startAdd} style={addLineBtnStyle}>
                + Add Tool
              </button>
              <button
                onClick={handleLoadTemplate}
                disabled={loadingTemplate}
                style={{
                  ...addLineBtnStyle,
                  opacity: loadingTemplate ? 0.6 : 1,
                  cursor: loadingTemplate ? "not-allowed" : "pointer",
                }}
              >
                {loadingTemplate ? "Loading…" : "Load Starter Template"}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

type CustomMaterialDraft = {
  name: string;
  unit: string;
  notes: string;
  checklist_section: string;
};
const emptyCustomMaterialDraft: CustomMaterialDraft = {
  name: "",
  unit: "",
  notes: "",
  checklist_section: "",
};

function CustomMaterialSummaryRow({
  material,
  removing,
  onEdit,
  onRemove,
}: {
  material: CustomMaterial;
  removing: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const parts = [material.name];
  if (material.unit) parts.push(material.unit);

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
          background: C.goldPale,
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
            title="Edit material"
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
            title="Remove material"
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

function CustomMaterialEditRow({
  draft,
  setDraft,
  error,
  saving,
  onSave,
  onCancel,
  isNew,
  sectionSuggestions,
}: {
  draft: CustomMaterialDraft;
  setDraft: React.Dispatch<React.SetStateAction<CustomMaterialDraft>>;
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
  sectionSuggestions: string[];
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
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 2fr 2fr",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div>
          <Label>Name *</Label>
          <input
            style={inputStyle(nameInvalid)}
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Drain Cleaner Acid"
          />
        </div>
        <div>
          <Label hint="optional">Unit</Label>
          <input
            style={inputStyle()}
            value={draft.unit}
            onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
            placeholder="e.g. ea"
          />
        </div>
        <div>
          <Label hint="optional">Section</Label>
          <input
            style={inputStyle()}
            value={draft.checklist_section}
            onChange={(e) => setDraft((d) => ({ ...d, checklist_section: e.target.value }))}
            placeholder="e.g. Pipes, Fittings & Hardware"
            list="material-section-suggestions"
          />
          <datalist id="material-section-suggestions">
            {sectionSuggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <Label hint="optional">Notes</Label>
          <input
            style={inputStyle()}
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder="e.g. 5L container"
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
          {saving ? "Saving…" : isNew ? "Add material" : "Save"}
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

function CustomMaterialsCard() {
  const [materials, setMaterials] = useState<CustomMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<CustomMaterialDraft>(emptyCustomMaterialDraft);
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CustomMaterialDraft>(emptyCustomMaterialDraft);
  const [editError, setEditError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadCustomMaterials();
      if (!cancelled) {
        setMaterials(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sectionSuggestions = useMemo(
    () =>
      Array.from(
        new Set(materials.map((m) => m.checklist_section?.trim()).filter(Boolean)),
      ).sort() as string[],
    [materials],
  );

  const startAdd = () => {
    setAdding(true);
    setAddDraft(emptyCustomMaterialDraft);
    setAddError(null);
  };
  const cancelAdd = () => {
    setAdding(false);
    setAddDraft(emptyCustomMaterialDraft);
    setAddError(null);
  };
  const submitAdd = async () => {
    if (addDraft.name.trim() === "") {
      setAddError("Name is required.");
      return;
    }
    setSaving(true);
    setAddError(null);
    const res = await saveCustomMaterial({
      name: addDraft.name,
      unit: addDraft.unit || undefined,
      notes: addDraft.notes || undefined,
      checklist_section: addDraft.checklist_section || undefined,
    });
    setSaving(false);
    if (!res.success || !res.material) {
      setAddError(res.error ?? "Failed to save material.");
      return;
    }
    setMaterials((prev) => [...prev, res.material as CustomMaterial]);
    setAdding(false);
    setAddDraft(emptyCustomMaterialDraft);
  };

  const startEdit = (material: CustomMaterial) => {
    setEditingId(material.id);
    setEditDraft({
      name: material.name,
      unit: material.unit ?? "",
      notes: material.notes ?? "",
      checklist_section: material.checklist_section ?? "",
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
    const res = await saveCustomMaterial({
      id: editingId,
      name: editDraft.name,
      unit: editDraft.unit || undefined,
      notes: editDraft.notes || undefined,
      checklist_section: editDraft.checklist_section || undefined,
    });
    setSaving(false);
    if (!res.success || !res.material) {
      setEditError(res.error ?? "Failed to save material.");
      return;
    }
    const saved = res.material;
    setMaterials((prev) => prev.map((m) => (m.id === editingId ? saved : m)));
    setEditingId(null);
  };

  const handleRemove = async (material: CustomMaterial) => {
    if (!window.confirm(`Remove ${material.name}? It can be re-added later.`)) return;
    setRemovingId(material.id);
    const res = await removeCustomMaterial(material.id);
    setRemovingId(null);
    if (!res.success) {
      window.alert(res.error ?? "Failed to remove material.");
      return;
    }
    setMaterials((prev) => prev.filter((m) => m.id !== material.id));
    if (editingId === material.id) setEditingId(null);
  };

  const handleLoadTemplate = async () => {
    if (
      !window.confirm(
        "This will add any missing items from a starter plumbing template. Nothing you already have will be changed or duplicated.",
      )
    )
      return;
    setLoadingTemplate(true);
    const res = await loadCustomMaterialsStarterTemplate();
    if (!res.success) {
      setLoadingTemplate(false);
      window.alert(res.error ?? "Failed to load starter template.");
      return;
    }
    const list = await loadCustomMaterials();
    setMaterials(list);
    setLoadingTemplate(false);
    window.alert(
      `Added ${res.added} material${res.added === 1 ? "" : "s"}, skipped ${res.skipped} already in your list.`,
    );
  };

  const grouped = groupByChecklistSection(materials);

  return (
    <Card title="Custom Materials">
      <div style={{ fontSize: 12, color: C.slateL, marginBottom: 10 }}>
        Items not in the supplier catalogue. Used on call-out checklists. Not priced.
      </div>
      {loading ? (
        <div style={{ fontSize: 12, color: C.slateL }}>Loading custom materials…</div>
      ) : (
        <>
          {materials.length === 0 && !adding && (
            <div style={{ fontSize: 12, color: C.slateL, marginBottom: 10 }}>
              No custom materials added yet.
            </div>
          )}

          {grouped.map(({ section, items }, i) => (
            <Fragment key={section}>
              <div style={sectionHeadingStyle(i === 0)}>{section}</div>
              {items.map((material) =>
                editingId === material.id ? (
                  <CustomMaterialEditRow
                    key={material.id}
                    draft={editDraft}
                    setDraft={setEditDraft}
                    error={editError}
                    saving={saving}
                    onSave={submitEdit}
                    onCancel={cancelEdit}
                    sectionSuggestions={sectionSuggestions}
                  />
                ) : (
                  <CustomMaterialSummaryRow
                    key={material.id}
                    material={material}
                    removing={removingId === material.id}
                    onEdit={() => startEdit(material)}
                    onRemove={() => handleRemove(material)}
                  />
                ),
              )}
            </Fragment>
          ))}

          {adding ? (
            <CustomMaterialEditRow
              draft={addDraft}
              setDraft={setAddDraft}
              error={addError}
              saving={saving}
              onSave={submitAdd}
              onCancel={cancelAdd}
              isNew
              sectionSuggestions={sectionSuggestions}
            />
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
              <button onClick={startAdd} style={addLineBtnStyle}>
                + Add Material
              </button>
              <button
                onClick={handleLoadTemplate}
                disabled={loadingTemplate}
                style={{
                  ...addLineBtnStyle,
                  opacity: loadingTemplate ? 0.6 : 1,
                  cursor: loadingTemplate ? "not-allowed" : "pointer",
                }}
              >
                {loadingTemplate ? "Loading…" : "Load Starter Template"}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ManageToolsAndMaterialsView({ onBack }: { onBack: () => void }) {
  return (
    <div style={coCard}>
      <div style={coCardHeader}>
        <button style={coBackBtn} onClick={onBack}>
          ← Back to list
        </button>
      </div>
      <div style={{ padding: 16 }}>
        <ToolsCard />
        <CustomMaterialsCard />
      </div>
    </div>
  );
}

interface CallOutSectionProps {
  employees: Employee[];
  tools: Tool[];
  customMaterials: CustomMaterial[];
  callOuts: CallOutSummary[];
  callOutsLoading: boolean;
  callOutTemplates: CallOutTemplate[];
  openCallOutId: string | null;
  setOpenCallOutId: (id: string | null) => void;
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
  newDraft: CallOutDraft | null;
  setNewDraft: (d: CallOutDraft | null) => void;
  savingCallOut: boolean;
  callOutSaveError: string | null;
  removingCallOutId: string | null;
  onSave: (draft: CallOutDraft) => void;
  onRemove: (id: string) => void;
  onDownloadPdf: (id: string) => void;
  showManage: boolean;
  setShowManage: (v: boolean) => void;
  pickerInitialCategory: string | null;
  setPickerInitialCategory: (c: string | null) => void;
  templateAuthorDraft: CallOutTemplateAuthorDraft | null;
  setTemplateAuthorDraft: (d: CallOutTemplateAuthorDraft | null) => void;
  savingCallOutTemplate: boolean;
  callOutTemplateSaveError: string | null;
  onSaveTemplate: (draft: CallOutTemplateAuthorDraft) => void;
}

function CallOutSection({
  employees,
  tools,
  customMaterials,
  callOuts,
  callOutsLoading,
  callOutTemplates,
  openCallOutId,
  setOpenCallOutId,
  showPicker,
  setShowPicker,
  newDraft,
  setNewDraft,
  savingCallOut,
  callOutSaveError,
  removingCallOutId,
  onSave,
  onRemove,
  onDownloadPdf,
  showManage,
  setShowManage,
  pickerInitialCategory,
  setPickerInitialCategory,
  templateAuthorDraft,
  setTemplateAuthorDraft,
  savingCallOutTemplate,
  callOutTemplateSaveError,
  onSaveTemplate,
}: CallOutSectionProps) {
  const [loadingCallOut, setLoadingCallOut] = useState(false);
  const [editDraft, setEditDraft] = useState<CallOutDraft | null>(null);

  useEffect(() => {
    if (!openCallOutId) {
      setEditDraft(null);
      return;
    }
    let cancelled = false;
    setLoadingCallOut(true);
    (async () => {
      const full = await loadCallOut(openCallOutId);
      if (!cancelled) {
        setEditDraft(full ? draftFromCallOut(full) : null);
        setLoadingCallOut(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openCallOutId]);

  if (showPicker) {
    return (
      <CallOutTemplatePicker
        templates={callOutTemplates}
        initialCategory={pickerInitialCategory}
        onCancel={() => setShowPicker(false)}
        onPick={(template) => {
          setShowPicker(false);
          setNewDraft(draftFromTemplate(template));
        }}
        onAddCustomIssue={(category) => {
          setShowPicker(false);
          setTemplateAuthorDraft(emptyTemplateAuthorDraft(category));
        }}
      />
    );
  }

  if (templateAuthorDraft) {
    return (
      <CallOutTemplateAuthorEditor
        draft={templateAuthorDraft}
        tools={tools}
        customMaterials={customMaterials}
        saving={savingCallOutTemplate}
        saveError={callOutTemplateSaveError}
        onChange={setTemplateAuthorDraft}
        onSave={() => onSaveTemplate(templateAuthorDraft)}
        onCancel={() => {
          setPickerInitialCategory(templateAuthorDraft.job_category);
          setTemplateAuthorDraft(null);
          setShowPicker(true);
        }}
      />
    );
  }

  if (newDraft) {
    return (
      <CallOutEditor
        draft={newDraft}
        tools={tools}
        customMaterials={customMaterials}
        employees={employees}
        saving={savingCallOut}
        saveError={callOutSaveError}
        onChange={setNewDraft}
        onSave={() => onSave(newDraft)}
        onCancel={() => setNewDraft(null)}
        onDownloadPdf={onDownloadPdf}
      />
    );
  }

  if (openCallOutId) {
    if (loadingCallOut || !editDraft) {
      return (
        <div style={{ fontSize: 12, color: C.slateL, padding: 20, textAlign: "center" }}>
          Loading call-out…
        </div>
      );
    }
    return (
      <CallOutEditor
        draft={editDraft}
        tools={tools}
        customMaterials={customMaterials}
        employees={employees}
        saving={savingCallOut}
        saveError={callOutSaveError}
        onChange={setEditDraft}
        onSave={() => onSave(editDraft)}
        onCancel={() => setOpenCallOutId(null)}
        onDownloadPdf={onDownloadPdf}
      />
    );
  }

  if (showManage) {
    return <ManageToolsAndMaterialsView onBack={() => setShowManage(false)} />;
  }

  return (
    <CallOutListView
      callOuts={callOuts}
      loading={callOutsLoading}
      removingCallOutId={removingCallOutId}
      saveError={callOutSaveError}
      onOpen={setOpenCallOutId}
      onNew={() => {
        setPickerInitialCategory(null);
        setShowPicker(true);
      }}
      onManage={() => setShowManage(true)}
      onRemove={onRemove}
      onDownloadPdf={onDownloadPdf}
    />
  );
}

type ViewMode = "day" | "week" | "month";
type PageMode = "calendar" | "reports" | "callout";
const PAGE_MODE_LABELS: Record<PageMode, string> = {
  calendar: "calendar",
  reports: "reports",
  callout: "Call-Out",
};

function TeamPage() {
  const { settings } = useSettings();
  const [pageMode, setPageMode] = useState<PageMode>("calendar");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  // The date the user is currently focused on — carries across view switches.
  // Clicking a day cell (any view) updates this; month prev/next resets it to
  // the 1st of the adjacent month (unchanged Brief 4 behavior).
  const [anchorDate, setAnchorDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [driverLogs, setDriverLogs] = useState<DriverLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [openDate, setOpenDate] = useState<Date | null>(null);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addingDriverLog, setAddingDriverLog] = useState(false);
  const [removingDriverLogId, setRemovingDriverLogId] = useState<string | null>(null);
  const [driverLogError, setDriverLogError] = useState<string | null>(null);

  const [callOuts, setCallOuts] = useState<CallOutSummary[]>([]);
  const [callOutsLoading, setCallOutsLoading] = useState(true);
  const [openCallOutId, setOpenCallOutId] = useState<string | null>(null);
  const [callOutTemplates, setCallOutTemplates] = useState<CallOutTemplate[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [customMaterials, setCustomMaterials] = useState<CustomMaterial[]>([]);
  const [showCallOutPicker, setShowCallOutPicker] = useState(false);
  const [newCallOutDraft, setNewCallOutDraft] = useState<CallOutDraft | null>(null);
  const [savingCallOut, setSavingCallOut] = useState(false);
  const [callOutSaveError, setCallOutSaveError] = useState<string | null>(null);
  const [removingCallOutId, setRemovingCallOutId] = useState<string | null>(null);
  const [showManageToolsMaterials, setShowManageToolsMaterials] = useState(false);
  const [pickerInitialCategory, setPickerInitialCategory] = useState<string | null>(null);
  const [templateAuthorDraft, setTemplateAuthorDraft] = useState<CallOutTemplateAuthorDraft | null>(
    null,
  );
  const [savingCallOutTemplate, setSavingCallOutTemplate] = useState(false);
  const [callOutTemplateSaveError, setCallOutTemplateSaveError] = useState<string | null>(null);

  const weeks = useMemo(() => buildMonthGrid(anchorDate), [anchorDate]);
  const weekDates = useMemo(() => {
    const start = addDays(anchorDate, -anchorDate.getDay());
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchorDate]);

  const gridStart =
    viewMode === "month" ? weeks[0][0].date : viewMode === "week" ? weekDates[0] : anchorDate;
  const gridEnd =
    viewMode === "month"
      ? weeks[weeks.length - 1][6].date
      : viewMode === "week"
        ? weekDates[6]
        : anchorDate;

  const refetchCalendarData = async () => {
    const start = dateKey(gridStart);
    const end = dateKey(gridEnd);
    const [attendanceList, driverLogList] = await Promise.all([
      loadAttendance(start, end),
      loadDriverLogs(start, end),
    ]);
    setAttendance(attendanceList);
    setDriverLogs(driverLogList);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const start = dateKey(gridStart);
      const end = dateKey(gridEnd);
      const [attendanceList, driverLogList] = await Promise.all([
        loadAttendance(start, end),
        loadDriverLogs(start, end),
      ]);
      if (!cancelled) {
        setAttendance(attendanceList);
        setDriverLogs(driverLogList);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // gridStart/gridEnd are derived from viewMode/anchorDate; re-fetch when
    // either the visible range's granularity or its anchor changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, anchorDate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [employeeList, vehicleList] = await Promise.all([loadEmployees(), loadVehicles()]);
      if (!cancelled) {
        setEmployees(employeeList);
        setVehicles(vehicleList);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pageMode !== "callout") return;
    let cancelled = false;
    setCallOutsLoading(true);
    (async () => {
      const [callOutList, templateList, toolList, materialList] = await Promise.all([
        loadCallOuts(),
        loadCallOutTemplates(),
        loadTools(),
        loadCustomMaterials(),
      ]);
      if (!cancelled) {
        setCallOuts(callOutList);
        setCallOutTemplates(templateList);
        setTools(toolList);
        setCustomMaterials(materialList);
        setCallOutsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageMode]);

  // Reports view is always monthly, independent of the calendar's day/week/month
  // toggle — fetch the full calendar month (not just the visible grid, which
  // pads into adjacent months) whenever Reports is open on a given month.
  const reportMonthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const reportMonthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const [reportAttendance, setReportAttendance] = useState<AttendanceRecord[]>([]);
  const [reportLoading, setReportLoading] = useState(true);

  useEffect(() => {
    if (pageMode !== "reports") return;
    let cancelled = false;
    setReportLoading(true);
    (async () => {
      const list = await loadAttendance(dateKey(reportMonthStart), dateKey(reportMonthEnd));
      if (!cancelled) {
        setReportAttendance(list);
        setReportLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // reportMonthStart/End are derived from anchorDate; re-fetch on month change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageMode, anchorDate.getFullYear(), anchorDate.getMonth()]);

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const a of attendance) {
      const list = map.get(a.date) ?? [];
      list.push(a);
      map.set(a.date, list);
    }
    return map;
  }, [attendance]);

  const driverLogsByDate = useMemo(() => {
    const map = new Map<string, DriverLog[]>();
    for (const l of driverLogs) {
      const list = map.get(l.date) ?? [];
      list.push(l);
      map.set(l.date, list);
    }
    return map;
  }, [driverLogs]);

  const goPrev = () => {
    if (pageMode === "reports" || viewMode === "month") {
      setAnchorDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    } else if (viewMode === "week") {
      setAnchorDate((d) => addDays(d, -7));
    } else {
      setAnchorDate((d) => addDays(d, -1));
    }
  };
  const goNext = () => {
    if (pageMode === "reports" || viewMode === "month") {
      setAnchorDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    } else if (viewMode === "week") {
      setAnchorDate((d) => addDays(d, 7));
    } else {
      setAnchorDate((d) => addDays(d, 1));
    }
  };

  const openDay = (date: Date) => {
    setAnchorDate(date);
    setOpenDate(date);
  };

  const viewLabel = useMemo(() => {
    if (pageMode === "reports" || viewMode === "month") {
      return `${MONTH_LABELS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
    }
    if (viewMode === "week") {
      const fmt = (d: Date) => `${MONTH_LABELS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
      return `${fmt(weekDates[0])} – ${fmt(weekDates[6])}, ${weekDates[6].getFullYear()}`;
    }
    return anchorDate.toLocaleDateString("en-ZA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [pageMode, viewMode, anchorDate, weekDates]);

  const closeModal = () => {
    setOpenDate(null);
    setSaveError(null);
    setDriverLogError(null);
  };

  const getOrPromptOwnerSecret = (promptMessage: string): string | null => {
    let ownerSecret = getStoredOwnerSecret();
    if (!ownerSecret) {
      ownerSecret = window.prompt(promptMessage);
      if (!ownerSecret) return null;
      setStoredOwnerSecret(ownerSecret);
    }
    return ownerSecret;
  };

  const handleSaveAttendance = async (
    date: Date,
    entries: {
      employee_id: string;
      status: AttendanceStatus;
      note: string | null;
      arrival_time: string | null;
    }[],
    closeAfter: boolean,
  ) => {
    const ownerSecret = getOrPromptOwnerSecret("Enter the owner passphrase to save attendance:");
    if (!ownerSecret) return;

    setSavingAttendance(true);
    setSaveError(null);
    const result = await saveAttendance(dateKey(date), entries, ownerSecret);
    setSavingAttendance(false);

    if (!result.success) {
      if (result.unauthorized) {
        clearStoredOwnerSecret();
        setSaveError("Incorrect owner passphrase. Please try saving again.");
      } else {
        setSaveError(result.error ?? "Failed to save attendance.");
      }
      return;
    }

    await refetchCalendarData();
    if (closeAfter) closeModal();
  };

  const handleAddDriverLog = async (
    date: Date,
    entry: {
      employee_id: string;
      vehicle_id: string;
      start_time: string | null;
      end_time: string | null;
    },
  ): Promise<boolean> => {
    const ownerSecret = getOrPromptOwnerSecret(
      "Enter the owner passphrase to add a driver log entry:",
    );
    if (!ownerSecret) return false;

    setAddingDriverLog(true);
    setDriverLogError(null);
    const result = await saveDriverLog({ ...entry, date: dateKey(date) }, ownerSecret);
    setAddingDriverLog(false);

    if (!result.success) {
      if (result.unauthorized) {
        clearStoredOwnerSecret();
        setDriverLogError("Incorrect owner passphrase. Please try again.");
      } else {
        setDriverLogError(result.error ?? "Failed to add driver log entry.");
      }
      return false;
    }

    await refetchCalendarData();
    return true;
  };

  const handleRemoveDriverLog = async (id: string) => {
    if (!window.confirm("Remove this driver log entry?")) return;
    const ownerSecret = getOrPromptOwnerSecret(
      "Enter the owner passphrase to remove this driver log entry:",
    );
    if (!ownerSecret) return;

    setRemovingDriverLogId(id);
    setDriverLogError(null);
    const result = await removeDriverLog(id, ownerSecret);
    setRemovingDriverLogId(null);

    if (!result.success) {
      if (result.unauthorized) {
        clearStoredOwnerSecret();
        setDriverLogError("Incorrect owner passphrase. Please try again.");
      } else {
        setDriverLogError(result.error ?? "Failed to remove driver log entry.");
      }
      return;
    }

    await refetchCalendarData();
  };

  const refetchCallOuts = async () => {
    setCallOuts(await loadCallOuts());
  };

  const handleSaveCallOut = async (draft: CallOutDraft) => {
    const ownerSecret = getOrPromptOwnerSecret("Enter the owner passphrase to save this call-out:");
    if (!ownerSecret) return;

    setSavingCallOut(true);
    setCallOutSaveError(null);
    const result = await saveCallOut(
      {
        id: draft.id,
        template_id: draft.template_id,
        job_category: draft.job_category,
        issue_name: draft.issue_name,
        call_out_date: draft.call_out_date || null,
        client_name: draft.client_name || null,
        client_address: draft.client_address || null,
        clocked_in_at: draft.clocked_in_at,
        clocked_out_at: draft.clocked_out_at,
        employee_ids: draft.employee_ids,
        lines: draft.lines,
      },
      ownerSecret,
    );
    setSavingCallOut(false);

    if (!result.success) {
      if (result.unauthorized) {
        clearStoredOwnerSecret();
        setCallOutSaveError("Incorrect owner passphrase. Please try saving again.");
      } else {
        setCallOutSaveError(result.error ?? "Failed to save call-out.");
      }
      return;
    }

    setNewCallOutDraft(null);
    if (result.callOut) setOpenCallOutId(result.callOut.id);
    await refetchCallOuts();
  };

  const handleSaveCallOutTemplate = async (draft: CallOutTemplateAuthorDraft) => {
    setSavingCallOutTemplate(true);
    setCallOutTemplateSaveError(null);
    const result = await saveCallOutTemplate({
      job_category: draft.job_category,
      issue_name: draft.issue_name,
      lines: draft.lines.map((l) => ({
        line_number: l.line_number,
        line_class: l.line_class,
        line_kind: l.line_kind as "catalogue" | "free_text",
        material_code: l.material_code,
        label: l.label,
        default_qty: l.qty,
        unit: l.unit,
        include_by_default: l.is_checked,
        notes: l.notes,
        checklist_section: l.checklist_section,
      })),
    });
    setSavingCallOutTemplate(false);

    if (!result.success) {
      setCallOutTemplateSaveError(result.error ?? "Failed to save issue.");
      return;
    }

    setTemplateAuthorDraft(null);
    setPickerInitialCategory(draft.job_category);
    setShowCallOutPicker(true);
    setCallOutTemplates(await loadCallOutTemplates());
  };

  const handleRemoveCallOut = async (id: string) => {
    if (!window.confirm("Delete this call-out? It can be restored by an administrator later."))
      return;
    const ownerSecret = getOrPromptOwnerSecret(
      "Enter the owner passphrase to delete this call-out:",
    );
    if (!ownerSecret) return;

    setRemovingCallOutId(id);
    setCallOutSaveError(null);
    const result = await removeCallOut(id, ownerSecret);
    setRemovingCallOutId(null);

    if (!result.success) {
      if (result.unauthorized) {
        clearStoredOwnerSecret();
        setCallOutSaveError("Incorrect owner passphrase. Please try again.");
      } else {
        setCallOutSaveError(result.error ?? "Failed to delete call-out.");
      }
      return;
    }

    if (openCallOutId === id) setOpenCallOutId(null);
    await refetchCallOuts();
  };

  const handleDownloadCallOutPdf = async (id: string) => {
    const full = await loadCallOut(id);
    if (full) generateCallOutPdf(full);
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
            maxWidth: 960,
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
          <div style={{ color: C.gold, fontWeight: 900, fontSize: 16 }}>Planner</div>
          <span style={{ width: 40 }} />
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: 20 }}>
        {/* View toggle (Calendar only — Reports is always monthly) */}
        {pageMode === "calendar" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(["day", "week", "month"] as ViewMode[]).map((vm) => (
              <button
                key={vm}
                onClick={() => setViewMode(vm)}
                style={viewMode === vm ? toggleBtnActive : toggleBtnInactive}
              >
                {vm}
              </button>
            ))}
          </div>
        )}

        {/* Month label, with Prev / Calendar-Reports toggle / Next below it */}
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              textAlign: "center",
              fontWeight: 800,
              fontSize: 16,
              color: C.navy,
              marginBottom: 8,
            }}
          >
            {viewLabel}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={goPrev} style={navBtn}>
              ← Prev
            </button>
            <div style={{ display: "flex", gap: 6 }}>
              {(["calendar", "reports", "callout"] as PageMode[]).map((pm) => (
                <button
                  key={pm}
                  onClick={() => setPageMode(pm)}
                  style={pageMode === pm ? toggleBtnActive : toggleBtnInactive}
                >
                  {PAGE_MODE_LABELS[pm]}
                </button>
              ))}
            </div>
            <button onClick={goNext} style={navBtn}>
              Next →
            </button>
          </div>
        </div>

        {pageMode === "callout" ? (
          <CallOutSection
            employees={employees}
            tools={tools}
            customMaterials={customMaterials}
            callOuts={callOuts}
            callOutsLoading={callOutsLoading}
            callOutTemplates={callOutTemplates}
            openCallOutId={openCallOutId}
            setOpenCallOutId={setOpenCallOutId}
            showPicker={showCallOutPicker}
            setShowPicker={setShowCallOutPicker}
            newDraft={newCallOutDraft}
            setNewDraft={setNewCallOutDraft}
            savingCallOut={savingCallOut}
            callOutSaveError={callOutSaveError}
            removingCallOutId={removingCallOutId}
            onSave={handleSaveCallOut}
            onRemove={handleRemoveCallOut}
            onDownloadPdf={handleDownloadCallOutPdf}
            showManage={showManageToolsMaterials}
            setShowManage={setShowManageToolsMaterials}
            pickerInitialCategory={pickerInitialCategory}
            setPickerInitialCategory={setPickerInitialCategory}
            templateAuthorDraft={templateAuthorDraft}
            setTemplateAuthorDraft={setTemplateAuthorDraft}
            savingCallOutTemplate={savingCallOutTemplate}
            callOutTemplateSaveError={callOutTemplateSaveError}
            onSaveTemplate={handleSaveCallOutTemplate}
          />
        ) : pageMode === "reports" ? (
          <MonthlyReportView
            employees={employees}
            attendance={reportAttendance}
            scheduledStartTime={settings.scheduledStartTime}
            hoursPerDay={settings.hoursPerDay}
            loading={reportLoading}
            viewLabel={viewLabel}
          />
        ) : loading ? (
          <div style={{ fontSize: 12, color: C.slateL, padding: 20, textAlign: "center" }}>
            Loading calendar…
          </div>
        ) : viewMode === "month" ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #DDE3EA",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 6,
                marginBottom: 6,
              }}
            >
              {WEEKDAY_LABELS.map((w) => (
                <div
                  key={w}
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: C.muted,
                    textTransform: "uppercase",
                    textAlign: "center",
                  }}
                >
                  {w}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div
                key={wi}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                {week.map(({ date, inMonth }) => {
                  const key = dateKey(date);
                  return (
                    <DayCell
                      key={key}
                      date={date}
                      inMonth={inMonth}
                      attendance={attendanceByDate.get(key) ?? []}
                      totalEmployees={employees.length}
                      onClick={() => openDay(date)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        ) : viewMode === "week" ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 8,
            }}
          >
            {weekDates.map((date) => {
              const key = dateKey(date);
              return (
                <DayCell
                  key={key}
                  date={date}
                  inMonth
                  richer
                  attendance={attendanceByDate.get(key) ?? []}
                  totalEmployees={employees.length}
                  onClick={() => openDay(date)}
                />
              );
            })}
          </div>
        ) : (
          <div
            style={{
              background: "#fff",
              border: "1px solid #DDE3EA",
              borderRadius: 10,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                background: C.navyMid,
                color: C.gold,
                fontWeight: 700,
                fontSize: 13,
                padding: "12px 16px",
              }}
            >
              {viewLabel}
            </div>
            <DayDetail
              key={dateKey(anchorDate)}
              employees={employees}
              vehicles={vehicles}
              existing={attendanceByDate.get(dateKey(anchorDate)) ?? []}
              saving={savingAttendance}
              error={saveError}
              driverLogs={driverLogsByDate.get(dateKey(anchorDate)) ?? []}
              addingDriverLog={addingDriverLog}
              removingDriverLogId={removingDriverLogId}
              driverLogError={driverLogError}
              onSave={(entries) => handleSaveAttendance(anchorDate, entries, false)}
              onAddDriverLog={(entry) => handleAddDriverLog(anchorDate, entry)}
              onRemoveDriverLog={handleRemoveDriverLog}
            />
          </div>
        )}
      </div>

      {openDate && (
        <DayModal
          date={openDate}
          employees={employees}
          vehicles={vehicles}
          existing={attendanceByDate.get(dateKey(openDate)) ?? []}
          saving={savingAttendance}
          error={saveError}
          driverLogs={driverLogsByDate.get(dateKey(openDate)) ?? []}
          addingDriverLog={addingDriverLog}
          removingDriverLogId={removingDriverLogId}
          driverLogError={driverLogError}
          onSave={(entries) => handleSaveAttendance(openDate, entries, true)}
          onAddDriverLog={(entry) => handleAddDriverLog(openDate, entry)}
          onRemoveDriverLog={handleRemoveDriverLog}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
