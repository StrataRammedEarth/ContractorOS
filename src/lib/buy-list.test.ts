import { describe, expect, it } from 'vitest';
import { aggregateBuyList, groupByCategory, isAggregatable, UNCATEGORIZED, type BuyListSource } from './buy-list';

// Mirrors the app's grade ranking closely enough for the merge tests.
const RANK: Record<string, number> = { Sourced: 4, Assumption: 2, Placeholder: 1 };
const lowestGrade = (a: string, b: string) => ((RANK[b] ?? 9) < (RANK[a] ?? 9) ? b : a);

function line(overrides: Partial<BuyListSource> = {}): BuyListSource {
  return {
    code: 'PLB-P1-046',
    description: 'PVC UG Gulley P-Trap 110mm',
    qty: 1,
    unit: 'ea',
    unitPrice: 100,
    total: 100,
    conf: 'Sourced',
    supplier: 'Plumblink',
    ...overrides,
  };
}

describe('isAggregatable', () => {
  it('is false for the custom placeholder codes and empty code', () => {
    expect(isAggregatable('CUSTOM')).toBe(false);
    expect(isAggregatable('CUSTOM-PIPE')).toBe(false);
    expect(isAggregatable('')).toBe(false);
    expect(isAggregatable('   ')).toBe(false);
  });

  it('is true for real material codes', () => {
    expect(isAggregatable('PLB-P1-046')).toBe(true);
  });
});

describe('aggregateBuyList', () => {
  it('collapses identical material codes into one line with summed qty and total', () => {
    const result = aggregateBuyList([
      line({ code: 'PLB-P1-046', qty: 1, total: 100 }),
      line({ code: 'PLB-P1-046', qty: 1, total: 100 }),
    ], lowestGrade);

    expect(result).toHaveLength(1);
    expect(result[0].qty).toBe(2);
    expect(result[0].total).toBe(200);
    expect(result[0].sourceCount).toBe(2);
  });

  it('keeps distinct material codes as separate lines, preserving first-seen order', () => {
    const result = aggregateBuyList([
      line({ code: 'AAA', qty: 1 }),
      line({ code: 'BBB', qty: 1 }),
      line({ code: 'AAA', qty: 3 }),
    ], lowestGrade);

    expect(result.map((l) => l.code)).toEqual(['AAA', 'BBB']);
    expect(result[0].qty).toBe(4); // 1 + 3
    expect(result[1].qty).toBe(1);
  });

  it('never merges custom lines — each stays its own line even with the same CUSTOM code', () => {
    const result = aggregateBuyList([
      line({ code: 'CUSTOM', description: 'Off-brand elbow', qty: 1, total: 20 }),
      line({ code: 'CUSTOM', description: 'Site-fabricated bracket', qty: 1, total: 35 }),
    ], lowestGrade);

    expect(result).toHaveLength(2);
    expect(result.every((l) => l.sourceCount === 1)).toBe(true);
  });

  it('merges a custom line and a real line independently (custom never absorbs into the SKU line)', () => {
    const result = aggregateBuyList([
      line({ code: 'PLB-P1-046', qty: 1, total: 100 }),
      line({ code: 'CUSTOM', qty: 1, total: 50 }),
      line({ code: 'PLB-P1-046', qty: 2, total: 200 }),
    ], lowestGrade);

    expect(result).toHaveLength(2);
    const sku = result.find((l) => l.code === 'PLB-P1-046')!;
    expect(sku.qty).toBe(3);
    expect(sku.total).toBe(300);
    expect(result.find((l) => l.code === 'CUSTOM')!.qty).toBe(1);
  });

  it('takes the lowest grade across merged lines', () => {
    const result = aggregateBuyList([
      line({ code: 'PLB-P1-046', conf: 'Sourced' }),
      line({ code: 'PLB-P1-046', conf: 'Assumption' }),
    ], lowestGrade);

    expect(result[0].conf).toBe('Assumption');
  });

  it('recomputes a blended unit price when merged lines differ in rate', () => {
    const result = aggregateBuyList([
      line({ code: 'PLB-P1-046', qty: 1, unitPrice: 100, total: 100 }),
      line({ code: 'PLB-P1-046', qty: 1, unitPrice: 200, total: 200 }),
    ], lowestGrade);

    expect(result[0].qty).toBe(2);
    expect(result[0].total).toBe(300);
    expect(result[0].unitPrice).toBe(150); // 300 / 2
  });

  it('preserves the aggregate total across the whole list (no lines lost or double-counted)', () => {
    const lines = [
      line({ code: 'AAA', total: 100 }),
      line({ code: 'CUSTOM', total: 50 }),
      line({ code: 'AAA', total: 100 }),
      line({ code: 'BBB', total: 75 }),
    ];
    const before = lines.reduce((s, l) => s + l.total, 0);
    const after = aggregateBuyList(lines, lowestGrade).reduce((s, l) => s + l.total, 0);
    expect(after).toBe(before);
  });
});

interface CatLine {
  category?: string | null;
  subCategory?: string | null;
  total: number;
}

describe('groupByCategory', () => {
  it('groups by category then subCategory, sorted alphabetically', () => {
    const groups = groupByCategory<CatLine>([
      { category: 'Valves', subCategory: 'Valves', total: 10 },
      { category: 'PVC Fittings', subCategory: 'PVC Pressure Fittings', total: 20 },
      { category: 'PVC Fittings', subCategory: 'PVC Pressure Fittings', total: 5 },
    ]);

    expect(groups.map((g) => g.category)).toEqual(['PVC Fittings', 'Valves']);
    expect(groups[0].subGroups).toHaveLength(1);
    expect(groups[0].subGroups[0].lines).toHaveLength(2);
    expect(groups[0].total).toBe(25);
    expect(groups[1].total).toBe(10);
  });

  it('buckets null category/subCategory under Uncategorized, sorted last', () => {
    const groups = groupByCategory<CatLine>([
      { category: null, subCategory: null, total: 100 },
      { category: 'Valves', subCategory: 'Valves', total: 10 },
    ]);

    expect(groups.map((g) => g.category)).toEqual(['Valves', UNCATEGORIZED]);
    expect(groups[1].subGroups[0].subCategory).toBe(UNCATEGORIZED);
    expect(groups[1].total).toBe(100);
  });

  it('handles the all-null case cleanly — Uncategorized as the only group present', () => {
    const groups = groupByCategory<CatLine>([
      { category: null, subCategory: null, total: 4173.04 },
      { category: null, subCategory: null, total: 668.7 },
      { category: null, subCategory: null, total: 199.13 },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe(UNCATEGORIZED);
    expect(groups[0].subGroups).toHaveLength(1);
    expect(groups[0].subGroups[0].lines).toHaveLength(3);
    expect(groups[0].total).toBeCloseTo(5040.87);
  });

  it('never merges across category/subCategory boundaries even for the same total shape', () => {
    const groups = groupByCategory<CatLine>([
      { category: 'A', subCategory: 'A1', total: 1 },
      { category: 'A', subCategory: 'A2', total: 1 },
      { category: 'B', subCategory: 'A1', total: 1 },
    ]);

    expect(groups).toHaveLength(2);
    const a = groups.find((g) => g.category === 'A')!;
    expect(a.subGroups.map((s) => s.subCategory)).toEqual(['A1', 'A2']);
  });
});
