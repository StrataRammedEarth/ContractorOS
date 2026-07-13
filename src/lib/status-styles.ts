// Estimate/invoice status pill colours — same shape convention as GRADES
// (src/lib/grades.ts), a single source of truth so status colour meaning
// stays consistent wherever a status pill renders.
//
// StatusToggle serves both document types, whose statuses only partially
// overlap (quote: draft/sent/accepted/final/archived; invoice: draft/issued/
// paid/archived). issued and paid have no brief-specified colour, so they
// reuse their nearest quote analog: issued is in-flight like Sent, paid is a
// positive terminal state like Accepted.
export const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  draft:     { color: "#8FA3B8", bg: "#F1F4F8" }, // muted — not yet actionable
  sent:      { color: "#2E86AB", bg: "#E8F4F8" }, // in-flight (reuses Sourced blue)
  issued:    { color: "#2E86AB", bg: "#E8F4F8" }, // in-flight, invoice analog of Sent
  accepted:  { color: "#27AE60", bg: "#EBF9EE" }, // positive terminal-ish (reuses Validated green)
  paid:      { color: "#27AE60", bg: "#EBF9EE" }, // positive terminal, invoice analog of Accepted
  final:     { color: "#0D1B2A", bg: "#FDF3DC" }, // locked/complete — keeps the gold association
  archived:  { color: "#6B859E", bg: "#F1F4F8" }, // closed, de-emphasised
};

export const DEFAULT_STATUS_STYLE = { color: "#0D1B2A", bg: "#F5A62326" };

export function statusStyle(status: string): { color: string; bg: string } {
  return STATUS_STYLES[status] ?? DEFAULT_STATUS_STYLE;
}
