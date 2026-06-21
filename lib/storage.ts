"use client";

import { normalizeLibraryData } from "./library";
import { seedLibrary } from "./seed";
import type { ActualRecord, EstimateSnapshot, LibraryData } from "./types";

const LIBRARY_KEY = "contractoros.library.v1";
const ESTIMATES_KEY = "contractoros.estimates.v1";
const ACTUALS_KEY = "contractoros.actuals.v1";

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
};

export const localStore = {
  getLibrary: () => normalizeLibraryData(read<LibraryData>(LIBRARY_KEY, structuredClone(seedLibrary))),
  saveLibrary: (library: LibraryData) => window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(library)),
  resetLibrary: () => {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(seedLibrary));
    return structuredClone(seedLibrary);
  },
  getEstimates: () => read<EstimateSnapshot[]>(ESTIMATES_KEY, []),
  saveEstimate: (snapshot: EstimateSnapshot) => {
    const estimates = read<EstimateSnapshot[]>(ESTIMATES_KEY, []);
    const version = estimates.filter((item) => item.input.reference === snapshot.input.reference).length + 1;
    const saved = { ...snapshot, version };
    window.localStorage.setItem(ESTIMATES_KEY, JSON.stringify([saved, ...estimates]));
    return saved;
  },
  getActuals: () => read<ActualRecord[]>(ACTUALS_KEY, []),
  saveActual: (actual: ActualRecord) => {
    const actuals = read<ActualRecord[]>(ACTUALS_KEY, []);
    window.localStorage.setItem(ACTUALS_KEY, JSON.stringify([actual, ...actuals]));
  },
};
