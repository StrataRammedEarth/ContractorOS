// Buy-list aggregation (brief §2). Identical material codes across fixtures/rows
// collapse into one procurement line with summed quantity — e.g. two toilets each
// confirming the same pan connector become one buy-list line, qty 2. Custom lines
// (user-entered, no real material code) never aggregate: each stays its own line.

export interface BuyListSource {
  code: string;
  description: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
  conf: string;
  supplier: string;
}

export interface BuyListLine extends BuyListSource {
  sourceCount: number; // how many scope lines merged into this one
}

// Placeholder codes for user-entered items — these must never merge with each
// other (two different custom parts can share the "CUSTOM" placeholder code but
// are distinct products). Matches the codes buildScope emits for custom lines.
const NON_AGGREGATING_CODES = new Set(['', 'CUSTOM', 'CUSTOM-PIPE']);

export function isAggregatable(code: string): boolean {
  return !NON_AGGREGATING_CODES.has(code.trim());
}

export function aggregateBuyList(
  lines: BuyListSource[],
  // Supplied by the caller so grade-merge uses the app's own grade ranking;
  // defaults to keeping the first line's grade if none is provided.
  lowestGrade: (a: string, b: string) => string = (a) => a,
): BuyListLine[] {
  const out: BuyListLine[] = [];
  const indexByCode = new Map<string, number>();

  for (const line of lines) {
    if (!isAggregatable(line.code)) {
      out.push({ ...line, sourceCount: 1 });
      continue;
    }
    const existingIdx = indexByCode.get(line.code);
    if (existingIdx === undefined) {
      indexByCode.set(line.code, out.length);
      out.push({ ...line, sourceCount: 1 });
    } else {
      const agg = out[existingIdx];
      const qty = agg.qty + line.qty;
      const total = agg.total + line.total;
      out[existingIdx] = {
        ...agg,
        qty,
        total,
        // Recompute so a blended rate stays consistent if two lines of the same
        // code ever carry different unit prices.
        unitPrice: qty > 0 ? total / qty : agg.unitPrice,
        conf: lowestGrade(agg.conf, line.conf),
        sourceCount: agg.sourceCount + 1,
      };
    }
  }
  return out;
}
