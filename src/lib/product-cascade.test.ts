import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  distinctApplications,
  distinctFittingTypes,
  distinctSizes,
  fetchCascadeCatalogue,
  matchingProducts,
  nominalDiameter,
} from './product-cascade';
import type { PlumblinkMaterial } from './product-filter';
import { supabase } from './supabase-client';

interface MockResponse {
  data: unknown;
  error: unknown;
}
interface MockCall {
  table: string;
  method: string;
  args: unknown[];
}

vi.mock('./supabase-client', () => {
  const calls: MockCall[] = [];
  const responses: Record<string, MockResponse> = {};

  function makeBuilder(table: string) {
    const builder: Record<string, unknown> = {
      then: (resolve: (v: MockResponse) => unknown, reject?: (e: unknown) => unknown) => {
        const response = responses[table] ?? { data: [], error: null };
        return Promise.resolve(response).then(resolve, reject);
      },
    };
    for (const method of ['select', 'not', 'neq', 'returns']) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    }
    return builder;
  }

  return {
    supabase: {
      from: (table: string) => {
        calls.push({ table, method: 'from', args: [] });
        return makeBuilder(table);
      },
      __calls: calls,
      __responses: responses,
    },
  };
});

function getCalls(): MockCall[] {
  return (supabase as unknown as { __calls: MockCall[] }).__calls;
}
function setResponse(table: string, response: MockResponse) {
  (supabase as unknown as { __responses: Record<string, MockResponse> }).__responses[table] = response;
}

beforeEach(() => {
  getCalls().length = 0;
  const responses = (supabase as unknown as { __responses: Record<string, MockResponse> }).__responses;
  for (const key of Object.keys(responses)) delete responses[key];
});

function material(overrides: Partial<PlumblinkMaterial> = {}): PlumblinkMaterial {
  return {
    material_code: 'PLB-0001',
    supplier_sku: null,
    section: null,
    sub_category: null,
    description: 'Some fitting',
    size: '15mm',
    unit: 'each',
    brand: null,
    unit_price_excl_vat: 25,
    price_date: null,
    confidence: 'Sourced',
    source: null,
    status: null,
    notes: null,
    supplier_role: 'primary',
    unit_price_incl_vat: null,
    fixture_tags: null,
    application: 'Drainage',
    fitting_type: 'Bend',
    system: null,
    ...overrides,
  };
}

describe('fetchCascadeCatalogue', () => {
  it('queries plumblink_materials filtered to the cascade-eligible set, excluding Pipe', async () => {
    const rows = [material()];
    setResponse('plumblink_materials', { data: rows, error: null });

    const result = await fetchCascadeCatalogue();

    expect(result).toEqual(rows);
    expect(getCalls()).toEqual([
      { table: 'plumblink_materials', method: 'from', args: [] },
      { table: 'plumblink_materials', method: 'select', args: ['*'] },
      { table: 'plumblink_materials', method: 'not', args: ['application', 'is', null] },
      { table: 'plumblink_materials', method: 'not', args: ['fitting_type', 'is', null] },
      { table: 'plumblink_materials', method: 'not', args: ['unit_price_excl_vat', 'is', null] },
      { table: 'plumblink_materials', method: 'neq', args: ['fitting_type', 'Pipe'] },
      { table: 'plumblink_materials', method: 'returns', args: [] },
    ]);
  });

  it('returns [] on error rather than throwing', async () => {
    setResponse('plumblink_materials', { data: null, error: { message: 'boom' } });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await fetchCascadeCatalogue();

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('distinctApplications', () => {
  it('returns distinct applications sorted alphabetically', () => {
    const rows = [
      material({ application: 'Supply' }),
      material({ application: 'Drainage' }),
      material({ application: 'Sanware' }),
      material({ application: 'Drainage' }),
    ];
    expect(distinctApplications(rows)).toEqual(['Drainage', 'Sanware', 'Supply']);
  });
});

describe('nominalDiameter', () => {
  it.each([
    ['110mm', '110mm'],
    ['110x87', '110mm'],
    ['110mm x6m', '110mm'],
    ['110X45', '110mm'],
    [null, null],
  ])('nominalDiameter(%s) -> %s', (input, expected) => {
    expect(nominalDiameter(input)).toBe(expected);
  });
});

describe('distinctSizes', () => {
  it('returns distinct nominal diameters for the application, sorted numerically (not lexically)', () => {
    const rows = [
      material({ application: 'Drainage', size: '110x87' }),
      material({ application: 'Drainage', size: '110X45' }), // case-duplicate of the same diameter
      material({ application: 'Drainage', size: '40mm' }),
      material({ application: 'Drainage', size: '50x87' }),
      material({ application: 'Supply', size: '22mm' }),
    ];
    // Numeric sort must not put "110mm" before "40mm" the way a lexical sort would.
    expect(distinctSizes(rows, 'Drainage')).toEqual(['40mm', '50mm', '110mm']);
  });

  it('never surfaces a null/"—" entry — a null-size row is simply excluded', () => {
    const rows = [
      material({ application: 'Supply', size: '15mm' }),
      material({ application: 'Supply', size: null }),
    ];
    expect(distinctSizes(rows, 'Supply')).toEqual(['15mm']);
  });

  it('collapses raw pipe-stock/typo variants into the same diameter bucket as production data does', () => {
    const rows = [
      material({ size: '110mm x6m' }),
      material({ size: '110x50m' }), // typo variant, still leading "110"
      material({ size: '110x87' }),
    ];
    expect(distinctSizes(rows, 'Drainage')).toEqual(['110mm']);
  });
});

describe('distinctFittingTypes', () => {
  it('returns distinct fitting types for the given application+diameter, sorted alphabetically', () => {
    const rows = [
      material({ application: 'Drainage', size: '110x90', fitting_type: 'Pan Connector' }),
      material({ application: 'Drainage', size: '110x87', fitting_type: 'Bend' }),
      material({ application: 'Drainage', size: '40mm', fitting_type: 'Coupler' }),
    ];
    expect(distinctFittingTypes(rows, 'Drainage', '110mm')).toEqual(['Bend', 'Pan Connector']);
  });

  it('matches on nominalDiameter so raw case-duplicates (110x45/110X45) collapse into one bucket', () => {
    const rows = [
      material({ application: 'Drainage', size: '110x45', fitting_type: 'Bend' }),
      material({ application: 'Drainage', size: '110X45', fitting_type: 'Bend' }),
    ];
    expect(distinctFittingTypes(rows, 'Drainage', '110mm')).toEqual(['Bend']);
  });
});

describe('matchingProducts', () => {
  it('returns rows matching application+diameter+fittingType, collapsing raw size variants', () => {
    const target1 = material({ application: 'Drainage', size: '110x45', fitting_type: 'Bend', material_code: 'PLB-BEND-1' });
    const target2 = material({ application: 'Drainage', size: '110X45', fitting_type: 'Bend', material_code: 'PLB-BEND-2' });
    const other = material({ application: 'Drainage', size: '110x90', fitting_type: 'Pan Connector', material_code: 'PLB-PAN-1' });
    const smaller = material({ application: 'Drainage', size: '40x87', fitting_type: 'Bend', material_code: 'PLB-BEND-3' });
    expect(matchingProducts([target1, target2, other, smaller], 'Drainage', '110mm', 'Bend')).toEqual([target1, target2]);
  });

  // Mirrors the brief's verified live fact: Drainage 110mm -> Bend returns all
  // 11 products (raw sizes 110x45 x3, 110x87 x7, 110x90 x1 across case variants).
  it('REGRESSION: Drainage 110mm -> Bend returns all 11 products across raw size/case variants', () => {
    const bends110 = [
      ...Array(3).fill(0).map((_, i) => material({ application: 'Drainage', size: '110x45', fitting_type: 'Bend', material_code: `B45-${i}` })),
      ...Array(7).fill(0).map((_, i) => material({ application: 'Drainage', size: i % 2 === 0 ? '110x87' : '110X87', fitting_type: 'Bend', material_code: `B87-${i}` })),
      material({ application: 'Drainage', size: '110x90', fitting_type: 'Bend', material_code: 'B90-0' }),
    ];
    const noise = [
      material({ application: 'Drainage', size: '40x87', fitting_type: 'Bend', material_code: 'NOISE-1' }),
      material({ application: 'Drainage', size: '110mm x6m', fitting_type: 'Pipe', material_code: 'NOISE-2' }),
    ];
    expect(matchingProducts([...bends110, ...noise], 'Drainage', '110mm', 'Bend')).toHaveLength(11);
  });
});
