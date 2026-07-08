import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  loadAttendance,
  loadDriverLogs,
  loadEmployees,
  saveAttendance,
  getStoredOwnerSecret,
  setStoredOwnerSecret,
  clearStoredOwnerSecret,
  type AttendanceRecord,
  type AttendanceStatus,
  type DriverLog,
  type Employee,
} from "@/lib/supabase-client";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Team — ContractorOS" }] }),
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

function AttendanceBadge({ record }: { record: AttendanceRecord }) {
  const color = STATUS_COLORS[record.status];
  const label = STATUS_LABELS[record.status] ?? record.status;
  const shortName = (record.employee_name ?? "Unknown").split(" ")[0];
  return (
    <div
      title={`${record.employee_name ?? "Unknown"} — ${label}`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: `${color}1A`,
        border: `1px solid ${color}66`,
        borderRadius: 4,
        padding: "1px 5px",
        fontSize: 10,
        color: C.navy,
        marginBottom: 2,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      }}
    >
      <span style={{ width: 6, height: 6, minWidth: 6, borderRadius: "50%", background: color }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{shortName}</span>
    </div>
  );
}

function DriverLogEntry({ log }: { log: DriverLog }) {
  const label = [log.vehicle_registration ?? "Unknown vehicle", log.employee_name]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      title={label}
      style={{
        fontSize: 10,
        color: C.slate,
        marginBottom: 2,
        overflow: "hidden",
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
      }}
    >
      🚚 {label}
    </div>
  );
}

function DayCell({
  date,
  inMonth,
  attendance,
  driverLogs,
  onClick,
}: {
  date: Date;
  inMonth: boolean;
  attendance: AttendanceRecord[];
  driverLogs: DriverLog[];
  onClick: () => void;
}) {
  const isToday = dateKey(date) === dateKey(new Date());
  return (
    <div
      onClick={onClick}
      title="Click to mark attendance"
      style={{
        minHeight: 92,
        border: "1px solid #DDE3EA",
        borderRadius: 6,
        padding: 6,
        background: inMonth ? "#fff" : "#F7F9FB",
        opacity: inMonth ? 1 : 0.55,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: isToday ? 800 : 600,
          color: isToday ? C.gold : inMonth ? C.navy : C.muted,
          marginBottom: 4,
        }}
      >
        {date.getDate()}
      </div>
      {attendance.map((a) => (
        <AttendanceBadge key={a.id} record={a} />
      ))}
      {driverLogs.map((l) => (
        <DriverLogEntry key={l.id} log={l} />
      ))}
    </div>
  );
}

type AttendanceDraft = { status: AttendanceStatus | ""; note: string };

function AttendanceModal({
  date,
  employees,
  existing,
  saving,
  error,
  onSave,
  onClose,
}: {
  date: Date;
  employees: Employee[];
  existing: AttendanceRecord[];
  saving: boolean;
  error: string | null;
  onSave: (
    entries: { employee_id: string; status: AttendanceStatus; note: string | null }[],
  ) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>(() => {
    const initial: Record<string, AttendanceDraft> = {};
    for (const emp of employees) {
      const record = existing.find((a) => a.employee_id === emp.id);
      initial[emp.id] = { status: record?.status ?? "", note: record?.note ?? "" };
    }
    return initial;
  });

  const setDraft = (employeeId: string, patch: Partial<AttendanceDraft>) => {
    setDrafts((prev) => ({ ...prev, [employeeId]: { ...prev[employeeId], ...patch } }));
  };

  const dateLabel = date.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const handleSave = () => {
    const entries: { employee_id: string; status: AttendanceStatus; note: string | null }[] = [];
    for (const emp of employees) {
      const draft = drafts[emp.id];
      if (draft && draft.status !== "") {
        entries.push({
          employee_id: emp.id,
          status: draft.status,
          note: draft.note.trim() === "" ? null : draft.note.trim(),
        });
      }
    }
    onSave(entries);
  };

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
      </div>
    </div>
  );
}

function TeamPage() {
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [driverLogs, setDriverLogs] = useState<DriverLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [openDate, setOpenDate] = useState<Date | null>(null);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const weeks = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const gridStart = weeks[0][0].date;
  const gridEnd = weeks[weeks.length - 1][6].date;

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
    // gridStart/gridEnd are derived from monthAnchor; re-fetch only on month change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthAnchor]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadEmployees();
      if (!cancelled) setEmployees(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const goPrevMonth = () => setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNextMonth = () => setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));

  const closeModal = () => {
    setOpenDate(null);
    setSaveError(null);
  };

  const handleSaveAttendance = async (
    entries: { employee_id: string; status: AttendanceStatus; note: string | null }[],
  ) => {
    if (!openDate) return;
    let ownerSecret = getStoredOwnerSecret();
    if (!ownerSecret) {
      ownerSecret = window.prompt("Enter the owner passphrase to save attendance:");
      if (!ownerSecret) return;
      setStoredOwnerSecret(ownerSecret);
    }

    setSavingAttendance(true);
    setSaveError(null);
    const result = await saveAttendance(dateKey(openDate), entries, ownerSecret);
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
    closeModal();
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
          <div style={{ color: C.gold, fontWeight: 900, fontSize: 16 }}>Team</div>
          <span style={{ width: 40 }} />
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: 20 }}>
        {/* Month navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <button
            onClick={goPrevMonth}
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
          <div style={{ fontWeight: 800, fontSize: 16, color: C.navy }}>
            {MONTH_LABELS[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}
          </div>
          <button
            onClick={goNextMonth}
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

        {loading ? (
          <div style={{ fontSize: 12, color: C.slateL, padding: 20, textAlign: "center" }}>
            Loading calendar…
          </div>
        ) : (
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
                      driverLogs={driverLogsByDate.get(key) ?? []}
                      onClick={() => setOpenDate(date)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {openDate && (
        <AttendanceModal
          date={openDate}
          employees={employees}
          existing={attendanceByDate.get(dateKey(openDate)) ?? []}
          saving={savingAttendance}
          error={saveError}
          onSave={handleSaveAttendance}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
