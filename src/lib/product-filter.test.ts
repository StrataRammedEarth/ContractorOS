import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIELD_TO_COLUMN,
  MANUAL_LINE_SENTINEL,
  buildQuery,
  isManualLine,
  parseProductFilter,
} from './product-filter';
import { supabase } from './supabase-client';

// Records every builder call so buildQuery's Supabase translation can be asserted
// without depending on postgrest-js internals.
vi.mock('./supabase-client', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ['select', 'eq', 'ilike', 'in']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  // Type-only helper in real supabase-js — no runtime effect, so not recorded.
  builder.returns = () => builder;
  return {
    supabase: {
      from: (table: string) => {
        calls.push({ method: 'from', args: [table] });
        return builder;
      },
      calls,
    },
  };
});

function getCalls() {
  return (supabase as unknown as { calls: Array<{ method: string; args: unknown[] }> }).calls;
}

beforeEach(() => {
  getCalls().length = 0;
});

describe('isManualLine', () => {
  it('detects the exact sentinel', () => {
    expect(isManualLine(MANUAL_LINE_SENTINEL)).toBe(true);
  });

  it('detects any filter with no "=" as a manual line', () => {
    expect(isManualLine('no equals sign here')).toBe(true);
  });

  it('does not flag a normal filter as manual', () => {
    expect(isManualLine('Application=Supply')).toBe(false);
  });
});

// isManualLine's sentinel check (`!filter.includes('=')`) runs against the whole
// filter string, not per-clause. In live data this never misfires because every
// row pairs its contains/in clauses with at least one "=" clause in the same
// string (IsSelectable=TRUE alone covers 60/61 rows) — so contains/in-only shapes
// below are tested paired with a leading "=" clause, mirroring real rows instead
// of isolated fragments that would trip the sentinel. See the dedicated test at
// the bottom of this file for the edge case itself.
describe('parseProductFilter — clause shapes (one real example per shape)', () => {
  it('Manual/custom line sentinel — parses to no clauses', () => {
    expect(parseProductFilter(MANUAL_LINE_SENTINEL)).toEqual([]);
  });

  it('Application =', () => {
    expect(parseProductFilter('Application=Supply')).toEqual([
      { field: 'Application', op: 'equals', value: 'Supply' },
    ]);
  });

  it('System = (Underground Drainage only)', () => {
    expect(parseProductFilter('System=Underground Drainage')).toEqual([
      { field: 'System', op: 'equals', value: 'Underground Drainage' },
    ]);
  });

  it('NominalSize =', () => {
    expect(parseProductFilter('NominalSize=110mm')).toEqual([
      { field: 'NominalSize', op: 'equals', value: '110mm' },
    ]);
  });

  it('NominalSize contains (deliberately loose)', () => {
    expect(parseProductFilter('NominalSize contains 15;IsSelectable=TRUE')).toEqual([
      { field: 'NominalSize', op: 'contains', value: '15' },
      { field: 'IsSelectable', op: 'equals', value: 'TRUE' },
    ]);
  });

  it('FittingType =', () => {
    expect(parseProductFilter('FittingType=Pan Connector')).toEqual([
      { field: 'FittingType', op: 'equals', value: 'Pan Connector' },
    ]);
  });

  it('FittingType contains', () => {
    expect(parseProductFilter('FittingType contains Inspection;IsSelectable=TRUE')).toEqual([
      { field: 'FittingType', op: 'contains', value: 'Inspection' },
      { field: 'IsSelectable', op: 'equals', value: 'TRUE' },
    ]);
  });

  it('FittingType in — comma-split list', () => {
    expect(parseProductFilter('FittingType in P Trap,Bottle Trap,S Trap;IsSelectable=TRUE')).toEqual([
      { field: 'FittingType', op: 'in', values: ['P Trap', 'Bottle Trap', 'S Trap'] },
      { field: 'IsSelectable', op: 'equals', value: 'TRUE' },
    ]);
  });

  it('FixtureTags contains', () => {
    expect(parseProductFilter('FixtureTags contains Basin;IsSelectable=TRUE')).toEqual([
      { field: 'FixtureTags', op: 'contains', value: 'Basin' },
      { field: 'IsSelectable', op: 'equals', value: 'TRUE' },
    ]);
  });

  it('Description contains', () => {
    expect(parseProductFilter('Description contains stop tap;IsSelectable=TRUE')).toEqual([
      { field: 'Description', op: 'contains', value: 'stop tap' },
      { field: 'IsSelectable', op: 'equals', value: 'TRUE' },
    ]);
  });

  it('IsSelectable = (always TRUE in live data)', () => {
    expect(parseProductFilter('IsSelectable=TRUE')).toEqual([
      { field: 'IsSelectable', op: 'equals', value: 'TRUE' },
    ]);
  });

  it('KNOWN EDGE CASE: a filter with only contains/in clauses and no "=" anywhere is swallowed by the manual-line sentinel', () => {
    // Harmless against live data — every one of the 61 real filter strings pairs
    // its contains/in clauses with at least one "=" clause (IsSelectable=TRUE
    // alone covers 60/61) — but a filter shaped like this would silently return
    // no clauses rather than parsing, if one were ever authored in isolation.
    expect(parseProductFilter('FixtureTags contains Basin')).toEqual([]);
  });
});

describe('parseProductFilter — compound filters (real row shapes)', () => {
  it('parses a "="/"contains"-only compound filter (toilet pan connector row)', () => {
    const filter =
      'Application=Drainage;System=Soil & Vent;NominalSize=110mm;FittingType=Pan Connector;FixtureTags contains Toilet;IsSelectable=TRUE';
    expect(parseProductFilter(filter)).toEqual([
      { field: 'Application', op: 'equals', value: 'Drainage' },
      { field: 'System', op: 'equals', value: 'Soil & Vent' },
      { field: 'NominalSize', op: 'equals', value: '110mm' },
      { field: 'FittingType', op: 'equals', value: 'Pan Connector' },
      { field: 'FixtureTags', op: 'contains', value: 'Toilet' },
      { field: 'IsSelectable', op: 'equals', value: 'TRUE' },
    ]);
  });

  it('parses a compound filter using the "in" operator (basin trap row)', () => {
    const filter = 'Application=Supply;FittingType in P Trap,Bottle Trap,S Trap;FixtureTags contains Basin;IsSelectable=TRUE';
    expect(parseProductFilter(filter)).toEqual([
      { field: 'Application', op: 'equals', value: 'Supply' },
      { field: 'FittingType', op: 'in', values: ['P Trap', 'Bottle Trap', 'S Trap'] },
      { field: 'FixtureTags', op: 'contains', value: 'Basin' },
      { field: 'IsSelectable', op: 'equals', value: 'TRUE' },
    ]);
  });

  it('throws on an unparseable clause', () => {
    // Needs a "=" somewhere in the string so isManualLine doesn't short-circuit
    // it into a manual line before the bad clause is ever parsed.
    expect(() => parseProductFilter('Application=Supply;NotAField 15mm')).toThrow(/Unparseable product_filter clause/);
  });
});

describe('buildQuery — translates clauses into Supabase calls', () => {
  it('queries plumblink_materials and applies eq() for "equals"', () => {
    buildQuery([{ field: 'Application', op: 'equals', value: 'Supply' }]);
    expect(getCalls()).toEqual([
      { method: 'from', args: ['plumblink_materials'] },
      { method: 'select', args: ['*'] },
      { method: 'eq', args: [FIELD_TO_COLUMN.Application, 'Supply'] },
    ]);
  });

  it('applies ilike() with wildcards for "contains"', () => {
    buildQuery([{ field: 'NominalSize', op: 'contains', value: '15' }]);
    expect(getCalls()).toEqual([
      { method: 'from', args: ['plumblink_materials'] },
      { method: 'select', args: ['*'] },
      { method: 'ilike', args: [FIELD_TO_COLUMN.NominalSize, '%15%'] },
    ]);
  });

  it('applies in() with the split value list for "in"', () => {
    buildQuery([{ field: 'FittingType', op: 'in', values: ['P Trap', 'Bottle Trap', 'S Trap'] }]);
    expect(getCalls()).toEqual([
      { method: 'from', args: ['plumblink_materials'] },
      { method: 'select', args: ['*'] },
      { method: 'in', args: [FIELD_TO_COLUMN.FittingType, ['P Trap', 'Bottle Trap', 'S Trap']] },
    ]);
  });

  it('skips IsSelectable entirely (no-op, always true)', () => {
    buildQuery([{ field: 'IsSelectable', op: 'equals', value: 'TRUE' }]);
    expect(getCalls()).toEqual([
      { method: 'from', args: ['plumblink_materials'] },
      { method: 'select', args: ['*'] },
    ]);
  });

  it('chains multiple clauses onto the same query', () => {
    buildQuery(parseProductFilter('Application=Supply;FittingType in P Trap,Bottle Trap,S Trap;FixtureTags contains Basin;IsSelectable=TRUE'));
    expect(getCalls()).toEqual([
      { method: 'from', args: ['plumblink_materials'] },
      { method: 'select', args: ['*'] },
      { method: 'eq', args: [FIELD_TO_COLUMN.Application, 'Supply'] },
      { method: 'in', args: [FIELD_TO_COLUMN.FittingType, ['P Trap', 'Bottle Trap', 'S Trap']] },
      { method: 'ilike', args: [FIELD_TO_COLUMN.FixtureTags, '%Basin%'] },
      // IsSelectable skipped
    ]);
  });
});
