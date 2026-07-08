import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder_key'
);

function edgeHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseAnonKey}`,
  };
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface LibraryRecord {
  id?: string;
  code: string;
  description: string;
  unit?: string;
  price: number;
  confidence: 'Locked' | 'Validated' | 'Sourced' | 'Derived' | 'Assumption' | 'Placeholder';
  supplier?: string;
  record_type: 'material' | 'resource' | 'productivity_record';
  status?: 'active' | 'inactive';
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
  estimate?: { id: string; reference: string; status: string };
  error?: string;
}

export interface Employee {
  id: string;
  name: string;
  position: string | null;
  hourly_rate: number | null;
  created_at: string;
}

// ─── LIBRARY LOADING ──────────────────────────────────────────────────────────

export async function loadLibrary(
  recordType: 'material' | 'resource' | 'productivity_record' | 'all' = 'all',
  status: 'active' | 'inactive' = 'active'
): Promise<LibraryRecord[]> {
  try {
    const params = new URLSearchParams({ record_type: recordType, status });
    const res = await fetch(`${supabaseUrl}/functions/v1/get-library?${params}`, {
      headers: edgeHeaders(),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (!data.success) { console.warn(`⚠️ Failed to load ${recordType}:`, data.error); return []; }
    console.log(`✅ Loaded ${data.records?.length ?? 0} ${recordType} records`);
    return data.records ?? [];
  } catch (err) {
    console.error(`❌ Error loading ${recordType}:`, err);
    return [];
  }
}

// ─── VALIDATE ─────────────────────────────────────────────────────────────────

export async function validateEstimate(estimateData: Partial<EstimateData>): Promise<ValidationResult> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/validate-estimate`, {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify({ estimate_data: estimateData, lines: estimateData.scope ?? [], totals: estimateData.totals ?? {} }),
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
  estimateData: Partial<EstimateData>,
  projectName: string,
  clientName: string,
  trade = 'plumbing',
  status: 'draft' | 'submitted' | 'approved' = 'draft'
): Promise<SaveResult> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/save-estimate`, {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify({ estimate_data: estimateData, project_name: projectName, client_name: clientName, trade, status }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) return { success: false, error: data.error };
    console.log(`✅ Quote saved as ${data.estimate.reference}`);
    return { success: true, estimate: data.estimate };
  } catch (err) {
    return { success: false, error: String(err) };
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
    if (!data.success) { console.warn('⚠️ Failed to load employees:', data.error); return []; }
    return data.employees ?? [];
  } catch (err) {
    console.error('❌ Error loading employees:', err);
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
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify(employee),
    });
    const data = await res.json();
    if (!res.ok || !data.success) return { success: false, error: data.error ?? `HTTP ${res.status}` };
    return { success: true, employee: data.employee };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function removeEmployee(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/remove-employee`, {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) return { success: false, error: data.error ?? `HTTP ${res.status}` };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

export async function testConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/get-library?record_type=material&status=active`, { method: 'HEAD', headers: edgeHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}

export function recordsToLookup(records: LibraryRecord[]): Record<string, LibraryRecord> {
  return Object.fromEntries(records.map((r) => [r.code, r]));
}
