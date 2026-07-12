import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDrainagePipeCatalogue } from './pipe-catalogue';
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
    for (const method of ['select', 'eq', 'not', 'in', 'returns']) {
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
    material_code: 'PLB-PL-PV01',
    supplier_sku: null,
    section: null,
    sub_category: 'PVC SV Pipes',
    description: 'PVC SV Pipe 110mm x6m plain ended SABS white',
    size: '110mm x6m',
    unit: '6m',
    brand: null,
    unit_price_excl_vat: 485.01,
    price_date: null,
    confidence: 'Sourced',
    source: null,
    status: null,
    notes: null,
    supplier_role: 'primary',
    unit_price_incl_vat: null,
    fixture_tags: null,
    application: 'Drainage',
    fitting_type: 'Pipe',
    system: 'Soil & Vent',
    ...overrides,
  };
}

describe('fetchDrainagePipeCatalogue', () => {
  it('queries plumblink_materials filtered to pipe rows in the drainage PVC sub_categories', async () => {
    setResponse('plumblink_materials', { data: [material()], error: null });

    await fetchDrainagePipeCatalogue();

    expect(getCalls()).toEqual([
      { table: 'plumblink_materials', method: 'from', args: [] },
      { table: 'plumblink_materials', method: 'select', args: ['*'] },
      { table: 'plumblink_materials', method: 'eq', args: ['fitting_type', 'Pipe'] },
      { table: 'plumblink_materials', method: 'eq', args: ['application', 'Drainage'] },
      { table: 'plumblink_materials', method: 'in', args: ['sub_category', ['PVC SV Pipes', 'PVC UG Pipes', 'PVC Drainage']] },
      { table: 'plumblink_materials', method: 'not', args: ['system', 'is', null] },
      { table: 'plumblink_materials', method: 'not', args: ['unit_price_excl_vat', 'is', null] },
      { table: 'plumblink_materials', method: 'returns', args: [] },
    ]);
  });

  it('returns [] on error rather than throwing', async () => {
    setResponse('plumblink_materials', { data: null, error: { message: 'boom' } });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await fetchDrainagePipeCatalogue();

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('buckets PVC SV Pipes -> SV PVC and PVC UG Pipes -> UG PVC, computing perMetre from the 6m pack', async () => {
    const rows = [
      material({ material_code: 'PLB-PL-PV05', sub_category: 'PVC SV Pipes', size: '40mm x6m', unit: '6m', unit_price_excl_vat: 485.01 }),
      material({ material_code: 'PLB-PL-PP01', sub_category: 'PVC UG Pipes', system: 'Underground Drainage', size: '110mm x6m', unit: '6m', unit_price_excl_vat: 332.29 }),
    ];
    setResponse('plumblink_materials', { data: rows, error: null });

    const result = await fetchDrainagePipeCatalogue();

    expect(result).toEqual([
      { code: 'PLB-PL-PV05', type: 'SV PVC', diameter: 40, use: 'drainage', packLength: 6, packPrice: 485.01, perMetre: 485.01 / 6, grade: 'Sourced', source: 'Plumblink', description: rows[0].description },
      { code: 'PLB-PL-PP01', type: 'UG PVC', diameter: 110, use: 'drainage', packLength: 6, packPrice: 332.29, perMetre: 332.29 / 6, grade: 'Sourced', source: 'Plumblink', description: rows[1].description },
    ]);
  });

  it('buckets PVC Drainage rows by system: Soil & Vent -> SV PVC, Underground Drainage -> UG PVC', async () => {
    const rows = [
      material({ material_code: 'PLB-PL-DR01', sub_category: 'PVC Drainage', system: 'Soil & Vent', size: '110mm x6m', unit: '6m', unit_price_excl_vat: 275.14 }),
      material({ material_code: 'PLB-PL-DR02', sub_category: 'PVC Drainage', system: 'Underground Drainage', size: '110mm x6m', unit: '6m', unit_price_excl_vat: 252.25 }),
    ];
    setResponse('plumblink_materials', { data: rows, error: null });

    const result = await fetchDrainagePipeCatalogue();

    expect(result.map(r => r.type)).toEqual(['SV PVC', 'UG PVC']);
  });

  it('excludes rows with system IS NULL rather than guessing a bucket', async () => {
    const rows = [
      material({ material_code: 'PLB-PL-PV03', sub_category: 'PVC SV Pipes', system: null, size: '75mm x6m' }),
    ];
    setResponse('plumblink_materials', { data: rows, error: null });

    const result = await fetchDrainagePipeCatalogue();

    expect(result).toEqual([]);
  });

  it('derives pack length from the size string when unit is not a plain metre length (roll-packaged HDPE)', async () => {
    const rows = [
      material({ material_code: 'PLB-PL-DR06', sub_category: 'PVC Drainage', system: 'Soil & Vent', size: '110x50m', unit: 'roll', unit_price_excl_vat: 2998.07 }),
    ];
    setResponse('plumblink_materials', { data: rows, error: null });

    const result = await fetchDrainagePipeCatalogue();

    expect(result).toEqual([
      expect.objectContaining({ code: 'PLB-PL-DR06', diameter: 110, packLength: 50, perMetre: 2998.07 / 50 }),
    ]);
  });

  it('surfaces multiple products at the same diameter (UG 110mm duty grades) rather than collapsing them', async () => {
    const rows = [
      material({ material_code: 'PLB-PL-PP01', sub_category: 'PVC UG Pipes', system: 'Underground Drainage', size: '110mm x6m', unit: '6m', unit_price_excl_vat: 332.29 }),
      material({ material_code: 'PLB-PL-PP02', sub_category: 'PVC UG Pipes', system: 'Underground Drainage', size: '110mm x6m', unit: '6m', unit_price_excl_vat: 514.72 }),
    ];
    setResponse('plumblink_materials', { data: rows, error: null });

    const result = await fetchDrainagePipeCatalogue();

    expect(result).toHaveLength(2);
    expect(result.map(r => r.code)).toEqual(['PLB-PL-PP01', 'PLB-PL-PP02']);
  });
});
