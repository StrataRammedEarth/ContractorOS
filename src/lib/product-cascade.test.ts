import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  distinctApplications,
  distinctFittingTypes,
  distinctSizes,
  fetchCascadeCatalogue,
  matchingProducts,
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
    for (const method of ['select', 'not', 'returns']) {
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
  it('queries plumblink_materials filtered to the cascade-eligible set', async () => {
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

describe('distinctSizes', () => {
  it('returns distinct sizes for the given application, naturally sorted', () => {
    const rows = [
      material({ application: 'Drainage', size: '110mm' }),
      material({ application: 'Drainage', size: '15mm' }),
      material({ application: 'Drainage', size: '15mm' }),
      material({ application: 'Supply', size: '22mm' }),
    ];
    expect(distinctSizes(rows, 'Drainage')).toEqual(['15mm', '110mm']);
  });

  it('surfaces a null entry (rendered as "—") when an eligible row has no size, sorted last', () => {
    const rows = [
      material({ application: 'Sanware', size: '15mm' }),
      material({ application: 'Sanware', size: null }),
    ];
    expect(distinctSizes(rows, 'Sanware')).toEqual(['15mm', null]);
  });
});

describe('distinctFittingTypes', () => {
  it('returns distinct fitting types for the given application+size, sorted alphabetically', () => {
    const rows = [
      material({ application: 'Drainage', size: '110mm', fitting_type: 'Pan Connector' }),
      material({ application: 'Drainage', size: '110mm', fitting_type: 'Bend' }),
      material({ application: 'Drainage', size: '15mm', fitting_type: 'Coupler' }),
    ];
    expect(distinctFittingTypes(rows, 'Drainage', '110mm')).toEqual(['Bend', 'Pan Connector']);
  });

  it('matches size === null correctly rather than dropping null-size rows', () => {
    const rows = [
      material({ application: 'Sanware', size: null, fitting_type: 'Coupler' }),
      material({ application: 'Sanware', size: '15mm', fitting_type: 'Valve/Stop Tap' }),
    ];
    expect(distinctFittingTypes(rows, 'Sanware', null)).toEqual(['Coupler']);
  });
});

describe('matchingProducts', () => {
  it('returns rows matching application+size+fittingType exactly', () => {
    const target = material({ application: 'Drainage', size: '110mm', fitting_type: 'Bend', material_code: 'PLB-BEND-1' });
    const rows = [
      target,
      material({ application: 'Drainage', size: '110mm', fitting_type: 'Pan Connector', material_code: 'PLB-PAN-1' }),
      material({ application: 'Drainage', size: '15mm', fitting_type: 'Bend', material_code: 'PLB-BEND-2' }),
    ];
    expect(matchingProducts(rows, 'Drainage', '110mm', 'Bend')).toEqual([target]);
  });

  it('matches a null size correctly', () => {
    const target = material({ application: 'Sanware', size: null, fitting_type: 'Coupler', material_code: 'PLB-COUP-1' });
    const rows = [target, material({ application: 'Sanware', size: '15mm', fitting_type: 'Coupler', material_code: 'PLB-COUP-2' })];
    expect(matchingProducts(rows, 'Sanware', null, 'Coupler')).toEqual([target]);
  });
});
