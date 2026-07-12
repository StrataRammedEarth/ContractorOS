import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "❌ Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder_key",
);

function edgeHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${supabaseAnonKey}`,
  };
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface LibraryRecord {
  id?: string;
  code: string;
  description: string;
  unit?: string;
  price: number;
  confidence: "Locked" | "Validated" | "Sourced" | "Derived" | "Assumption" | "Placeholder";
  supplier?: string;
  record_type: "material" | "resource" | "productivity_record";
  status?: "active" | "inactive";
  created_at?: string;
}

export interface CrewRate extends LibraryRecord {
  crew_role: string;
  daily_rate: number;
  hourly_rate?: number;
}

export interface EstimateData {
  inputs: {
    projectName: string;
    clientName: string;
    supplyMetres: number;
    pipeType: string;
    points: number;
    drainMetres: number;
    trenching: boolean;
    fixtures: {
      toilet: number;
      basin: number;
      shower: number;
      showerDoor: number;
      showerRose: number;
      showerArm: number;
      kitchenMixer: number;
    };
  };
  scope: Array<{
    code: string;
    description: string;
    unit: string;
    quantity: number;
    price: number;
    total: number;
    confidence: string;
  }>;
  labour: Array<{
    description: string;
    hours: number;
    rate: number;
    cost: number;
  }>;
  totals: {
    material_cost: number;
    waste_5pct: number;
    direct_cost: number;
    risk_5pct: number;
    contingency_10pct: number;
    subtotal: number;
    margin_25pct: number;
    final_total: number;
  };
}

export interface ValidationResult {
  success: boolean;
  is_valid?: boolean;
  confidence_grade?: string;
  estimate_range?: { low: number; high: number; range_percent: { low: number; high: number } };
  blockage_reason?: string;
  error?: string;
}

export interface SaveResult {
  success: boolean;
  estimate?: { id: string; reference: string; status: string; version?: number };
  error?: string;
  unauthorized?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  position: string | null;
  hourly_rate: number | null;
  created_at: string;
}

export interface Vehicle {
  id: string;
  registration_number: string;
  make: string | null;
  model: string | null;
  created_at: string;
}

export type AttendanceStatus =
  | "present"
  | "absent"
  | "on_leave"
  | "sick"
  | "public_holiday"
  | "half_day";

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string | null;
  date: string;
  status: AttendanceStatus;
  note: string | null;
  arrival_time: string | null;
  created_at: string;
}

export interface DriverLog {
  id: string;
  employee_id: string;
  employee_name: string | null;
  vehicle_id: string;
  vehicle_registration: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
}

// ─── LIBRARY LOADING ──────────────────────────────────────────────────────────

export async function loadLibrary(
  recordType: "material" | "resource" | "productivity_record" | "all" = "all",
  status: "active" | "inactive" = "active",
): Promise<LibraryRecord[]> {
  try {
    const params = new URLSearchParams({ record_type: recordType, status });
    const res = await fetch(`${supabaseUrl}/functions/v1/get-library?${params}`, {
      headers: edgeHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (!data.success) {
      console.warn(`⚠️ Failed to load ${recordType}:`, data.error);
      return [];
    }
    console.log(`✅ Loaded ${data.records?.length ?? 0} ${recordType} records`);
    return data.records ?? [];
  } catch (err) {
    console.error(`❌ Error loading ${recordType}:`, err);
    return [];
  }
}

// ─── VALIDATE ─────────────────────────────────────────────────────────────────

export async function validateEstimate(
  estimateData: Partial<EstimateData>,
): Promise<ValidationResult> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/validate-estimate`, {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify({
        estimate_data: estimateData,
        lines: estimateData.scope ?? [],
        totals: estimateData.totals ?? {},
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) return { success: false, error: data.error };
    return { success: true, ...data.validation };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── SAVE ─────────────────────────────────────────────────────────────────────

export async function saveEstimate(
  estimateData: Record<string, unknown>,
  projectName: string,
  clientName: string,
  documentType: "quote" | "invoice" = "quote",
  invoiceMeta: Record<string, unknown> = {},
  // Edit path (Brief: Edit Existing Estimates/Invoices): when set, this save
  // becomes a new version of the existing document (same reference) instead
  // of minting a brand-new one, and requires the owner passphrase.
  edit?: { reference: string; ownerSecret: string },
): Promise<SaveResult> {
  try {
    const body: Record<string, unknown> = {
      estimate_data: estimateData,
      project_name: projectName,
      client_name: clientName,
      document_type: documentType,
      invoice_meta: invoiceMeta,
    };
    if (edit) {
      body.edit_reference = edit.reference;
      body.owner_secret = edit.ownerSecret;
    }
    const res = await fetch(`${supabaseUrl}/functions/v1/save-estimate`, {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error ?? `HTTP ${res.status}`,
        unauthorized: res.status === 401,
      };
    }
    console.log(`✅ ${documentType === "invoice" ? "Invoice" : "Quote"} saved as ${data.estimate.reference}`);
    return { success: true, estimate: data.estimate };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── ESTIMATE / INVOICE LISTS ──────────────────────────────────────────────────
// estimate_versions has RLS requiring auth.uid(), and this app has no signed-in
// sessions yet, so reads go through the get-estimates edge function, same as
// employees/vehicles/attendance/driver_logs above.

export interface EstimateVersionRow {
  id: string;
  reference: string;
  version: number;
  status: string;
  document_type: "quote" | "invoice";
  snapshot: Record<string, unknown> | null;
  invoice_meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function loadEstimates(
  documentType?: "quote" | "invoice",
  limit?: number,
): Promise<EstimateVersionRow[]> {
  try {
    const params = new URLSearchParams();
    if (documentType) params.set("document_type", documentType);
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    const res = await fetch(`${supabaseUrl}/functions/v1/get-estimates${qs ? `?${qs}` : ""}`, {
      headers: edgeHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (!data.success) {
      console.warn("⚠️ Failed to load estimates:", data.error);
      return [];
    }
    return data.estimates ?? [];
  } catch (err) {
    console.error("❌ Error loading estimates:", err);
    return [];
  }
}

export async function loadEstimateById(id: string): Promise<EstimateVersionRow | null> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/get-estimates?id=${encodeURIComponent(id)}`, {
      headers: edgeHeaders(),
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    const data = await res.json();
    if (!data.success) {
      console.warn("⚠️ Failed to load estimate:", data.error);
      return null;
    }
    return data.estimate ?? null;
  } catch (err) {
    console.error("❌ Error loading estimate:", err);
    return null;
  }
}

// ─── EMPLOYEES ────────────────────────────────────────────────────────────────
// employees has RLS requiring auth.uid(), and this app has no signed-in
// sessions yet, so reads/writes go through service-role edge functions
// (get-employees / save-employee / remove-employee), same as save-estimate.

export async function loadEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/get-employees`, {
      headers: edgeHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (!data.success) {
      console.warn("⚠️ Failed to load employees:", data.error);
      return [];
    }
    return data.employees ?? [];
  } catch (err) {
    console.error("❌ Error loading employees:", err);
    return [];
  }
}

export async function saveEmployee(employee: {
  id?: string;
  name: string;
  position?: string;
  hourly_rate?: number | null;
}): Promise<{ success: boolean; employee?: Employee; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/save-employee`, {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify(employee),
    });
    const data = await res.json();
    if (!res.ok || !data.success)
      return { success: false, error: data.error ?? `HTTP ${res.status}` };
    return { success: true, employee: data.employee };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function removeEmployee(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/remove-employee`, {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok || !data.success)
      return { success: false, error: data.error ?? `HTTP ${res.status}` };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── VEHICLES ─────────────────────────────────────────────────────────────────
// Same reasoning as EMPLOYEES above: vehicles has RLS requiring auth.uid(), and
// this app has no signed-in sessions yet, so reads/writes go through
// service-role edge functions (get-vehicles / save-vehicle / remove-vehicle).

export async function loadVehicles(): Promise<Vehicle[]> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/get-vehicles`, {
      headers: edgeHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (!data.success) {
      console.warn("⚠️ Failed to load vehicles:", data.error);
      return [];
    }
    return data.vehicles ?? [];
  } catch (err) {
    console.error("❌ Error loading vehicles:", err);
    return [];
  }
}

export async function saveVehicle(vehicle: {
  id?: string;
  registration_number: string;
  make?: string;
  model?: string;
}): Promise<{ success: boolean; vehicle?: Vehicle; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/save-vehicle`, {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify(vehicle),
    });
    const data = await res.json();
    if (!res.ok || !data.success)
      return { success: false, error: data.error ?? `HTTP ${res.status}` };
    return { success: true, vehicle: data.vehicle };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function removeVehicle(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/remove-vehicle`, {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok || !data.success)
      return { success: false, error: data.error ?? `HTTP ${res.status}` };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── CALENDAR (read-only: attendance + driver logs) ────────────────────────────
// Same reasoning as EMPLOYEES/VEHICLES above: both tables have RLS requiring
// auth.uid(), and this app has no signed-in sessions yet, so reads go through
// service-role edge functions (get-attendance / get-driver-logs). Scoped to a
// date range (the visible calendar month) rather than loading all history.

export async function loadAttendance(start: string, end: string): Promise<AttendanceRecord[]> {
  try {
    const params = new URLSearchParams({ start, end });
    const res = await fetch(`${supabaseUrl}/functions/v1/get-attendance?${params}`, {
      headers: edgeHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (!data.success) {
      console.warn("⚠️ Failed to load attendance:", data.error);
      return [];
    }
    return data.attendance ?? [];
  } catch (err) {
    console.error("❌ Error loading attendance:", err);
    return [];
  }
}

export async function loadDriverLogs(start: string, end: string): Promise<DriverLog[]> {
  try {
    const params = new URLSearchParams({ start, end });
    const res = await fetch(`${supabaseUrl}/functions/v1/get-driver-logs?${params}`, {
      headers: edgeHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (!data.success) {
      console.warn("⚠️ Failed to load driver logs:", data.error);
      return [];
    }
    return data.driver_logs ?? [];
  } catch (err) {
    console.error("❌ Error loading driver logs:", err);
    return [];
  }
}

// Owner-only write gate, stopgap until real auth exists (see save-attendance
// edge function comment): a shared passphrase, kept in localStorage once
// entered so the owner isn't re-prompted every save.
const OWNER_SECRET_STORAGE_KEY = "contractoros_owner_secret";

export function getStoredOwnerSecret(): string | null {
  try {
    return localStorage.getItem(OWNER_SECRET_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredOwnerSecret(secret: string): void {
  try {
    localStorage.setItem(OWNER_SECRET_STORAGE_KEY, secret);
  } catch {
    // localStorage unavailable (e.g. private browsing); secret just won't persist.
  }
}

export function clearStoredOwnerSecret(): void {
  try {
    localStorage.removeItem(OWNER_SECRET_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function saveAttendance(
  date: string,
  entries: {
    employee_id: string;
    status: AttendanceStatus;
    note?: string | null;
    arrival_time?: string | null;
  }[],
  ownerSecret: string,
): Promise<{ success: boolean; error?: string; unauthorized?: boolean }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/save-attendance`, {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify({ date, entries, owner_secret: ownerSecret }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error ?? `HTTP ${res.status}`,
        unauthorized: res.status === 401,
      };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function updateEstimateStatus(
  id: string,
  status: string,
  dueDate: string | undefined,
  ownerSecret: string,
): Promise<{ success: boolean; error?: string; unauthorized?: boolean; estimate?: EstimateVersionRow }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/update-estimate-status`, {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify({ id, status, due_date: dueDate ?? null, owner_secret: ownerSecret }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error ?? `HTTP ${res.status}`,
        unauthorized: res.status === 401,
      };
    }
    return { success: true, estimate: data.estimate };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function saveDriverLog(
  entry: {
    employee_id: string;
    vehicle_id: string;
    date: string;
    start_time?: string | null;
    end_time?: string | null;
  },
  ownerSecret: string,
): Promise<{ success: boolean; error?: string; unauthorized?: boolean }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/save-driver-log`, {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify({ ...entry, owner_secret: ownerSecret }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error ?? `HTTP ${res.status}`,
        unauthorized: res.status === 401,
      };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function removeDriverLog(
  id: string,
  ownerSecret: string,
): Promise<{ success: boolean; error?: string; unauthorized?: boolean }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/remove-driver-log`, {
      method: "POST",
      headers: edgeHeaders(),
      body: JSON.stringify({ id, owner_secret: ownerSecret }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error ?? `HTTP ${res.status}`,
        unauthorized: res.status === 401,
      };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

export async function testConnection(): Promise<boolean> {
  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/get-library?record_type=material&status=active`,
      { method: "HEAD", headers: edgeHeaders() },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export function recordsToLookup(records: LibraryRecord[]): Record<string, LibraryRecord> {
  return Object.fromEntries(records.map((r) => [r.code, r]));
}
