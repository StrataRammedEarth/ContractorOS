// Confidence-grade ranking, shared by EstimatePage (live scope) and
// DocumentDetailPage (saved-snapshot Buy list) so merge/grade logic stays a
// single source of truth across both.
export const GRADES: Record<string, { rank: number; color: string; bg: string }> = {
  Locked:      { rank:6, color:"#0D1B2A", bg:"#E8EDF2" },
  Validated:   { rank:5, color:"#27AE60", bg:"#EBF9EE" },
  Sourced:     { rank:4, color:"#2E86AB", bg:"#E8F4F8" },
  Derived:     { rank:3, color:"#8E44AD", bg:"#F5EEF8" },
  Assumption:  { rank:2, color:"#E67E22", bg:"#FEF5E7" },
  Placeholder: { rank:1, color:"#E74C3C", bg:"#FDEDEC" },
};

export const lowestGrade = (...gs: string[]) =>
  gs.reduce((m, g) => (GRADES[g]?.rank < GRADES[m]?.rank ? g : m), "Validated");
