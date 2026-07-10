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
  type AttendanceRecord,
  type AttendanceStatus,
  type DriverLog,
  type Employee,
  type Vehicle,
} from "@/lib/supabase-client";
import { useSettings } from "@/lib/settings-context";
import { ClockIcon, ClipboardDollarIcon } from "@/components/nav-icons";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Planner — ContractorOS" }] }),
  component: TeamPage,
});

// ─── THEME (matches profile.tsx / index.tsx conventions) ───────────────────────
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
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft(emp.id, { status: e.target.value as AttendanceStatus | "" })
                  }
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid #C8D0DB",
                    fontSize: 12,
                    color: C.navy,
                  }}
                >
                  <option value="">— Not marked —</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
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
  fontWeight: 700,
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
}: {
  employees: Employee[];
  attendance: AttendanceRecord[];
  scheduledStartTime: string;
  hoursPerDay: number;
  loading: boolean;
}) {
  const reports = useMemo(
    () => buildEmployeeReports(employees, attendance, scheduledStartTime, hoursPerDay),
    [employees, attendance, scheduledStartTime, hoursPerDay],
  );
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
                color: C.muted,
                fontSize: 10,
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
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ViewMode = "day" | "week" | "month";
type PageMode = "calendar" | "reports";

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
        {/* Calendar / Reports toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {(["calendar", "reports"] as PageMode[]).map((pm) => (
            <button
              key={pm}
              onClick={() => setPageMode(pm)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: `1px solid ${pageMode === pm ? C.gold : "#C8D0DB"}`,
                background: pageMode === pm ? C.gold : "#fff",
                color: pageMode === pm ? C.navy : C.slate,
                fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {pm}
            </button>
          ))}
        </div>

        {/* View toggle (Calendar only — Reports is always monthly) */}
        {pageMode === "calendar" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(["day", "week", "month"] as ViewMode[]).map((vm) => (
              <button
                key={vm}
                onClick={() => setViewMode(vm)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: `1px solid ${viewMode === vm ? C.gold : "#C8D0DB"}`,
                  background: viewMode === vm ? C.gold : "#fff",
                  color: viewMode === vm ? C.navy : C.slate,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {vm}
              </button>
            ))}
          </div>
        )}

        {/* Prev/next navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <button
            onClick={goPrev}
            style={{
              padding: "7px 14px",
              borderRadius: 6,
              border: "1px solid #C8D0DB",
              background: "#fff",
              color: C.slate,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ← Prev
          </button>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.navy }}>{viewLabel}</div>
          <button
            onClick={goNext}
            style={{
              padding: "7px 14px",
              borderRadius: 6,
              border: "1px solid #C8D0DB",
              background: "#fff",
              color: C.slate,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Next →
          </button>
        </div>

        {pageMode === "reports" ? (
          <MonthlyReportView
            employees={employees}
            attendance={reportAttendance}
            scheduledStartTime={settings.scheduledStartTime}
            hoursPerDay={settings.hoursPerDay}
            loading={reportLoading}
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
