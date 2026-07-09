import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// ─── SETTINGS SHAPE ───────────────────────────────────────────────────────────
// The configurable per-contractor settings that drive the estimate engine and
// the client-facing documents. Percentages are whole numbers (e.g. 5 = 5%).
export interface OrgSettings {
  // Organization identity (Supabase org_id)
  organizationId: string;

  // Business identity
  businessName: string;
  tradingName?: string;
  contactName: string;
  phone?: string;
  email?: string;
  address?: string;
  vatNumber?: string; // blank/undefined = not VAT registered
  bankingDetails?: string;
  logoUrl?: string;

  // Commercial ladder (as percentages, e.g. 5 = 5%)
  wastePct: number;
  riskPct: number;
  contingencyPct: number;
  marginPct: number;

  // Labour rates
  plumberDayRate: number;
  assistantDayRate: number;
  hoursPerDay: number;
  calloutFee?: number;
  travelRatePerKm?: number;
  afterHoursMultiplier: number;
  // Scheduled start time (HH:MM, org-wide) — used by the attendance report to
  // flag a marked arrival_time as late.
  scheduledStartTime: string;

  // Document settings
  quoteValidityDays: number;
  invoicePaymentDays: number;
  quotePrefix: string;
  vatRatePct: number;
  termsConditions?: string;
}

// Hardcoded defaults — used if no saved settings exist yet. These mirror the
// values that were previously hardcoded inside EstimatePage (Vissi defaults),
// so a first-time user gets identical behaviour to before this feature landed.
export const DEFAULT_SETTINGS: OrgSettings = {
  organizationId: "d2d278de-9286-4859-afd7-be4e657d6fda",
  businessName: "",
  contactName: "",
  wastePct: 5,
  riskPct: 5,
  contingencyPct: 10,
  marginPct: 25,
  plumberDayRate: 600,
  assistantDayRate: 260,
  hoursPerDay: 8,
  afterHoursMultiplier: 1.5,
  scheduledStartTime: "07:00",
  quoteValidityDays: 30,
  invoicePaymentDays: 7,
  quotePrefix: "PLB",
  vatRatePct: 15,
};

// localStorage key. Local-first persistence: settings are stored in the browser
// until an authenticated, multi-tenant backend exists. The organization_settings
// Supabase table + RLS already exist for that future wiring.
const STORAGE_KEY = "cos_org_settings_v1";

function loadFromStorage(): OrgSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<OrgSettings>;
    // Merge over defaults so newly-added fields are always populated.
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsContextValue {
  settings: OrgSettings;
  saveSettings: (partial: Partial<OrgSettings>) => void;
  /** true only when the business is identifiable enough to issue documents */
  profileComplete: boolean;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<OrgSettings>(DEFAULT_SETTINGS);

  // Hydrate from localStorage after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    setSettings(loadFromStorage());
  }, []);

  const saveSettings = useCallback((partial: Partial<OrgSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage may be unavailable (private mode) — keep in-memory */
      }
      return next;
    });
  }, []);

  const profileComplete = useMemo(
    () =>
      settings.businessName.trim().length > 0 && (settings.bankingDetails ?? "").trim().length > 0,
    [settings.businessName, settings.bankingDetails],
  );

  const value = useMemo(
    () => ({ settings, saveSettings, profileComplete }),
    [settings, saveSettings, profileComplete],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    // Defensive fallback: never break the app if a consumer renders outside the
    // provider. Returns defaults and a no-op save.
    return { settings: DEFAULT_SETTINGS, saveSettings: () => {}, profileComplete: false };
  }
  return ctx;
}
