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

// Label for lines with no category/subCategory match (e.g. a code with no
// plumblink_materials/library_records row — the geyser fixed-composition path
// is the main real-world case, where every line on the job resolves this way).
export const UNCATEGORIZED = 'Uncategorized';

export interface CategorizedSource {
  category?: string | null;
  subCategory?: string | null;
  total: number;
}

export interface SubCategoryGroup<T> {
  subCategory: string;
  lines: T[];
  total: number;
}

export interface CategoryGroup<T> {
  category: string;
  subGroups: SubCategoryGroup<T>[];
  total: number;
}

// Two-level grouping (category → subCategory) over already-merged buy-list
// lines. Named groups sort alphabetically; Uncategorized always sorts last
// since it's a fallback bucket, not a real catalogue section — and it may be
// the *only* group present (e.g. every line on a geyser job), so callers must
// not assume a named group always exists.
export function groupByCategory<T extends CategorizedSource>(lines: T[]): CategoryGroup<T>[] {
  const byCategory = new Map<string, Map<string, T[]>>();

  for (const line of lines) {
    const category = line.category ?? UNCATEGORIZED;
    const subCategory = line.subCategory ?? UNCATEGORIZED;
    if (!byCategory.has(category)) byCategory.set(category, new Map());
    const bySubCategory = byCategory.get(category)!;
    if (!bySubCategory.has(subCategory)) bySubCategory.set(subCategory, []);
    bySubCategory.get(subCategory)!.push(line);
  }

  const sortNamedThenUncategorizedLast = (a: string, b: string) => {
    if (a === UNCATEGORIZED) return b === UNCATEGORIZED ? 0 : 1;
    if (b === UNCATEGORIZED) return -1;
    return a.localeCompare(b);
  };

  return Array.from(byCategory.entries())
    .sort(([a], [b]) => sortNamedThenUncategorizedLast(a, b))
    .map(([category, bySubCategory]) => {
      const subGroups = Array.from(bySubCategory.entries())
        .sort(([a], [b]) => sortNamedThenUncategorizedLast(a, b))
        .map(([subCategory, subLines]) => ({
          subCategory,
          lines: subLines,
          total: subLines.reduce((s, l) => s + l.total, 0),
        }));
      return {
        category,
        subGroups,
        total: subGroups.reduce((s, g) => s + g.total, 0),
      };
    });
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
