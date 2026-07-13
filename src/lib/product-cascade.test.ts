import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  distinctApplications,
  distinctFittingTypes,
  distinctMaterials,
  distinctSizes,
  fetchCascadeCatalogue,
  filterByFixtureTag,
  matchingProducts,
  matchingProductsNoSize,
  nominalDiameter,
  nominalSizeFor,
  supplyNominalSize,
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
    for (const method of ['select', 'not', 'neq', 'in', 'returns']) {
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
  it('queries plumblink_materials filtered to the cascade-eligible set: no Pipe, Drainage/Supply/Waste-Trap', async () => {
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
      { table: 'plumblink_materials', method: 'in', args: ['application', ['Drainage', 'Supply', 'Waste / Trap']] },
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
      material({ application: 'Supply' }),
    ];
    expect(distinctApplications(rows)).toEqual(['Drainage', 'Supply']);
  });

  // Waste / Trap has no Size cascade step (owner decision) and gets its own
  // dedicated Fitting Type -> Product cascade elsewhere — it must never appear
  // in the generic Application picker's options, or a user could route into the
  // unsuited 4-step App->FittingType->Size->Product cascade for it.
  it('excludes Waste / Trap even when present in the catalogue', () => {
    const rows = [
      material({ application: 'Supply' }),
      material({ application: 'Waste / Trap' }),
      material({ application: 'Drainage' }),
    ];
    expect(distinctApplications(rows)).toEqual(['Drainage', 'Supply']);
  });
});

describe('distinctMaterials', () => {
  it('returns SV PVC and UG PVC, in that order, when both sub_category groups are present', () => {
    const rows = [
      material({ application: 'Drainage', sub_category: 'PVC Pressure Fittings' }),
      material({ application: 'Drainage', sub_category: 'PVC UG Fittings' }),
    ];
    expect(distinctMaterials(rows, 'Drainage')).toEqual(['SV PVC', 'UG PVC']);
  });

  it('includes PVC SV Fittings under SV PVC (duplicates included per confirmed scope)', () => {
    const rows = [material({ application: 'Drainage', sub_category: 'PVC SV Fittings' })];
    expect(distinctMaterials(rows, 'Drainage')).toEqual(['SV PVC']);
  });

  it('omits a material with no matching rows rather than always returning both', () => {
    const rows = [material({ application: 'Drainage', sub_category: 'PVC Pressure Fittings' })];
    expect(distinctMaterials(rows, 'Drainage')).toEqual(['SV PVC']);
  });

  it('ignores rows for a different application', () => {
    const rows = [material({ application: 'Supply', sub_category: 'PVC UG Fittings' })];
    expect(distinctMaterials(rows, 'Drainage')).toEqual([]);
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

describe('supplyNominalSize', () => {
  it.each([
    ['22x15mm', '22mm'],
    ['3/4x15mm', '15mm'],   // skips the leading inch component
    ['15x1/2"', '15mm'],
    ['22x22x1/2', '22mm'],
    ['22x15x15', '22mm'],   // bare compound dimension, mm by convention
    ['400kPa', null],       // pressure rating — not a dimension
    [null, null],
  ])('supplyNominalSize(%s) -> %s', (input, expected) => {
    expect(supplyNominalSize(input)).toBe(expected);
  });

  it('returns null (not "400"/"400mm") for the pressure-rating row so it is unreachable via the cascade', () => {
    expect(supplyNominalSize('400kPa')).toBeNull();
  });
});

describe('nominalSizeFor', () => {
  it('uses supplyNominalSize for the Supply application', () => {
    expect(nominalSizeFor('3/4x15mm', 'Supply')).toBe('15mm');
    expect(nominalSizeFor('400kPa', 'Supply')).toBeNull();
  });
  it('uses nominalDiameter for Drainage (and any non-Supply application)', () => {
    expect(nominalSizeFor('110x87', 'Drainage')).toBe('110mm');
    // The leading-integer rule would read "3" here — the fraction-skipping
    // Supply rule is deliberately NOT applied outside Supply.
    expect(nominalSizeFor('3/4x15mm', 'Drainage')).toBe('3mm');
  });
});

describe('distinctSizes', () => {
  it('Drainage: distinct nominal diameters, sorted numerically (not lexically)', () => {
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

  it('Supply: normalises via supplyNominalSize and drops the pressure-rating row (no "—")', () => {
    const rows = [
      material({ application: 'Supply', size: '15x1/2"' }),
      material({ application: 'Supply', size: '22x15mm' }),
      material({ application: 'Supply', size: '3/4x15mm' }), // -> 15mm, collapses with the first
      material({ application: 'Supply', size: '400kPa' }),   // -> null, excluded
    ];
    expect(distinctSizes(rows, 'Supply')).toEqual(['15mm', '22mm']);
  });

  it('narrows to a single fitting type when one is given (App -> Fitting Type -> Size cascade)', () => {
    const rows = [
      material({ application: 'Drainage', size: '40mm', fitting_type: 'Bend' }),
      material({ application: 'Drainage', size: '110x87', fitting_type: 'Bend' }),
      material({ application: 'Drainage', size: '50mm', fitting_type: 'Gulley' }),
    ];
    expect(distinctSizes(rows, 'Drainage', 'Bend')).toEqual(['40mm', '110mm']);
  });

  it('never surfaces a null/"—" entry — a null-size row is simply excluded', () => {
    const rows = [
      material({ application: 'Supply', size: '15mm' }),
      material({ application: 'Supply', size: null }),
    ];
    expect(distinctSizes(rows, 'Supply')).toEqual(['15mm']);
  });

  it('narrows to a single material (Drainage SV PVC vs UG PVC) when one is given', () => {
    const rows = [
      material({ application: 'Drainage', sub_category: 'PVC Pressure Fittings', size: '110x87' }),
      material({ application: 'Drainage', sub_category: 'PVC UG Fittings', size: '160mm' }),
    ];
    expect(distinctSizes(rows, 'Drainage', undefined, 'SV PVC')).toEqual(['110mm']);
    expect(distinctSizes(rows, 'Drainage', undefined, 'UG PVC')).toEqual(['160mm']);
  });
});

describe('distinctFittingTypes', () => {
  it('returns every fitting type for the application when no size is given (App -> Fitting Type cascade)', () => {
    const rows = [
      material({ application: 'Drainage', size: '110x90', fitting_type: 'Pan Connector' }),
      material({ application: 'Drainage', size: '40mm', fitting_type: 'Bend' }),
      material({ application: 'Drainage', size: '50mm', fitting_type: 'Coupler' }),
      material({ application: 'Supply', size: '22mm', fitting_type: 'Tee' }),
    ];
    expect(distinctFittingTypes(rows, 'Drainage')).toEqual(['Bend', 'Coupler', 'Pan Connector']);
  });

  it('narrows to a single nominal size when one is given (Size -> Fitting Type standalone cascade)', () => {
    const rows = [
      material({ application: 'Drainage', size: '110x90', fitting_type: 'Pan Connector' }),
      material({ application: 'Drainage', size: '110x87', fitting_type: 'Bend' }),
      material({ application: 'Drainage', size: '40mm', fitting_type: 'Coupler' }),
    ];
    expect(distinctFittingTypes(rows, 'Drainage', '110mm')).toEqual(['Bend', 'Pan Connector']);
  });

  it('matches on nominalSizeFor so raw case-duplicates (110x45/110X45) collapse into one bucket', () => {
    const rows = [
      material({ application: 'Drainage', size: '110x45', fitting_type: 'Bend' }),
      material({ application: 'Drainage', size: '110X45', fitting_type: 'Bend' }),
    ];
    expect(distinctFittingTypes(rows, 'Drainage', '110mm')).toEqual(['Bend']);
  });

  it('narrows to a single material — UG PVC surfaces far fewer types than SV PVC, as expected', () => {
    const rows = [
      material({ application: 'Drainage', sub_category: 'PVC Pressure Fittings', fitting_type: 'Vent Valve' }),
      material({ application: 'Drainage', sub_category: 'PVC Pressure Fittings', fitting_type: 'Socket' }),
      material({ application: 'Drainage', sub_category: 'PVC UG Fittings', fitting_type: 'Gulley' }),
    ];
    expect(distinctFittingTypes(rows, 'Drainage', undefined, 'SV PVC')).toEqual(['Socket', 'Vent Valve']);
    expect(distinctFittingTypes(rows, 'Drainage', undefined, 'UG PVC')).toEqual(['Gulley']);
  });

  // Wastes & Traps: no size dimension, so the App -> Fitting Type list must be
  // reachable with size omitted, same as any other application.
  it('returns the distinct trap types present when called with application=Waste / Trap and no size', () => {
    const rows = [
      material({ application: 'Waste / Trap', fitting_type: 'Bottle Trap', size: '32mm', brand: 'Wirquin' }),
      material({ application: 'Waste / Trap', fitting_type: 'P Trap', size: null, brand: 'Du Bois' }),
      material({ application: 'Waste / Trap', fitting_type: 'P Trap', size: '32X40', brand: 'Geberit' }),
      material({ application: 'Waste / Trap', fitting_type: 'Shower Trap', size: null, brand: 'Plumline' }),
      material({ application: 'Drainage', fitting_type: 'Bend', size: '110mm' }),
    ];
    expect(distinctFittingTypes(rows, 'Waste / Trap')).toEqual(['Bottle Trap', 'P Trap', 'Shower Trap']);
  });
});

describe('matchingProducts', () => {
  it('returns rows matching application + fittingType + size, collapsing raw size variants', () => {
    const target1 = material({ application: 'Drainage', size: '110x45', fitting_type: 'Bend', material_code: 'PLB-BEND-1' });
    const target2 = material({ application: 'Drainage', size: '110X45', fitting_type: 'Bend', material_code: 'PLB-BEND-2' });
    const other = material({ application: 'Drainage', size: '110x90', fitting_type: 'Pan Connector', material_code: 'PLB-PAN-1' });
    const smaller = material({ application: 'Drainage', size: '40x87', fitting_type: 'Bend', material_code: 'PLB-BEND-3' });
    expect(matchingProducts([target1, target2, other, smaller], 'Drainage', 'Bend', '110mm')).toEqual([target1, target2]);
  });

  it('applies the Supply normaliser when the application is Supply', () => {
    const t1 = material({ application: 'Supply', size: '3/4x15mm', fitting_type: 'Coupler', material_code: 'CF-1' });
    const t2 = material({ application: 'Supply', size: '15x1/2"', fitting_type: 'Coupler', material_code: 'CF-2' });
    const other = material({ application: 'Supply', size: '22x22mm', fitting_type: 'Coupler', material_code: 'CF-3' });
    expect(matchingProducts([t1, t2, other], 'Supply', 'Coupler', '15mm')).toEqual([t1, t2]);
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
    expect(matchingProducts([...bends110, ...noise], 'Drainage', 'Bend', '110mm')).toHaveLength(11);
  });

  it('narrows to a single material, keeping the two confirmed-duplicate SV bends distinct rows', () => {
    const svBend1 = material({ application: 'Drainage', sub_category: 'PVC Pressure Fittings', fitting_type: 'Bend', size: '110x87', material_code: 'PLB-PL-PF015' });
    const svBend2 = material({ application: 'Drainage', sub_category: 'PVC SV Fittings', fitting_type: 'Bend', size: '110x87', material_code: 'PLB-PL-PF08' });
    const ugBend = material({ application: 'Drainage', sub_category: 'PVC UG Fittings', fitting_type: 'Bend', size: '110x45', material_code: 'PLB-PL-PF02' });
    const rows = [svBend1, svBend2, ugBend];
    expect(matchingProducts(rows, 'Drainage', 'Bend', '110mm', 'SV PVC')).toEqual([svBend1, svBend2]);
    expect(matchingProducts(rows, 'Drainage', 'Bend', '110mm', 'UG PVC')).toEqual([ugBend]);
  });
});

describe('matchingProductsNoSize', () => {
  it('returns exactly the P Trap rows for (Waste / Trap, P Trap), including the null-size one', () => {
    const pTrap1 = material({ application: 'Waste / Trap', fitting_type: 'P Trap', size: '32mm', brand: 'Du Bois', material_code: 'DB-PT-1' });
    const pTrap2 = material({ application: 'Waste / Trap', fitting_type: 'P Trap', size: null, brand: 'Geberit', material_code: 'GB-PT-2' });
    const pTrap3 = material({ application: 'Waste / Trap', fitting_type: 'P Trap', size: '32X40', brand: 'Wirquin', material_code: 'WQ-PT-3' });
    const bottleTrap = material({ application: 'Waste / Trap', fitting_type: 'Bottle Trap', size: '32mm', brand: 'Plumline', material_code: 'PL-BT-1' });
    const drainageBend = material({ application: 'Drainage', fitting_type: 'P Trap', size: '32mm', material_code: 'NOISE-1' });
    const rows = [pTrap1, pTrap2, pTrap3, bottleTrap, drainageBend];
    expect(matchingProductsNoSize(rows, 'Waste / Trap', 'P Trap')).toEqual([pTrap1, pTrap2, pTrap3]);
  });

  it('application scoping holds: Drainage rows never leak into a Waste / Trap match and vice-versa', () => {
    const trap = material({ application: 'Waste / Trap', fitting_type: 'Bend', size: null, material_code: 'TRAP-BEND' });
    const drainageBend = material({ application: 'Drainage', fitting_type: 'Bend', size: '110mm', material_code: 'DRAIN-BEND' });
    const rows = [trap, drainageBend];
    expect(matchingProductsNoSize(rows, 'Drainage', 'Bend')).toEqual([drainageBend]);
    expect(matchingProductsNoSize(rows, 'Waste / Trap', 'Bend')).toEqual([trap]);
  });
});

describe('filterByFixtureTag', () => {
  it("returns rows whose fixture_tags contains the tag, excluding a row tagged only 'Shower;General'", () => {
    const basinTrap = material({ application: 'Waste / Trap', fitting_type: 'Bottle Trap', fixture_tags: 'Basin;Kitchen Sink;General' });
    const showerTrap = material({ application: 'Waste / Trap', fitting_type: 'Shower Trap', fixture_tags: 'Shower;General' });
    expect(filterByFixtureTag([basinTrap, showerTrap], 'Basin')).toEqual([basinTrap]);
  });

  it('matches case- and space-insensitively', () => {
    const basinTrap = material({ application: 'Waste / Trap', fitting_type: 'Bottle Trap', fixture_tags: 'Basin;Kitchen Sink' });
    expect(filterByFixtureTag([basinTrap], 'basin ')).toEqual([basinTrap]);
  });

  it('returns the input unchanged when tag is null (show-all fallback)', () => {
    const rows = [
      material({ application: 'Waste / Trap', fitting_type: 'Bottle Trap', fixture_tags: 'Basin;General' }),
      material({ application: 'Waste / Trap', fitting_type: 'Shower Trap', fixture_tags: 'Shower;General' }),
    ];
    expect(filterByFixtureTag(rows, null)).toEqual(rows);
  });

  it('excludes a row with fixture_tags=null for a non-null tag, includes it when tag=null', () => {
    const untagged = material({ application: 'Waste / Trap', fitting_type: 'Trap', fixture_tags: null });
    expect(filterByFixtureTag([untagged], 'Basin')).toEqual([]);
    expect(filterByFixtureTag([untagged], null)).toEqual([untagged]);
  });
});
