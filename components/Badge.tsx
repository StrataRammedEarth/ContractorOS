import type { Confidence } from "@/lib/types";

export function Badge({ value }: { value: Confidence }) {
  return <span className={`badge badge-${value.toLowerCase()}`}>{value}</span>;
}
