import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCandidateMaterials,
  fetchFixtureTemplates,
  fetchMaterialByCode,
  fetchTemplateRows,
  findSystemTemplate,
  findTemplateForFixtureType,
  type FixtureTemplate,
  type FixtureTemplateRow,
} from './fixture-templates';
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

// A single mocked Supabase client shared by fixture-templates.ts (queries
// fixture_templates / fixture_template_rows directly) and product-filter.ts's
// buildQuery (queries plumblink_materials) — both resolve to this same mock
// under vi.mock, so one setup covers the whole chain end-to-end.
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
    for (const method of ['select', 'eq', 'ilike', 'in', 'order', 'returns']) {
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

const TOILET_ROW: FixtureTemplateRow = {
  id: 'row-1',
  template_id: 'FIXTURE_TOILET_REPLACEMENT',
  line_number: 10,
  line_type: 'Suggested',
  application: 'Drainage',
  system: null,
  nominal_size: '110mm',
  fitting_type: 'Pan Connector',
  product_role: null,
  default_material_code: 'PLB-P1-046',
  default_qty: 1,
  include_by_default: true,
  allow_alternatives: true,
  product_filter: 'Application=Drainage;NominalSize=110mm;FittingType=Pan Connector;FixtureTags contains Toilet;IsSelectable=TRUE',
  initial_validation_grade: 'TemplateSuggested',
  confirmed_validation_grade: 'Sourced',
  notes: null,
};

describe('fetchFixtureTemplates', () => {
  it('returns template rows on success', async () => {
    const templates: FixtureTemplate[] = [
      { template_id: 'FIXTURE_TOILET_REPLACEMENT', fixture_type: 'Toilet', template_name: 'Toilet replacement', template_variant: 'Replacement', scope: 'fixture' },
    ];
    setResponse('fixture_templates', { data: templates, error: null });

    const result = await fetchFixtureTemplates();
    expect(result).toEqual(templates);
    expect(getCalls()).toEqual([
      { table: 'fixture_templates', method: 'from', args: [] },
      { table: 'fixture_templates', method: 'select', args: ['*'] },
      { table: 'fixture_templates', method: 'returns', args: [] },
    ]);
  });

  it('returns [] on error rather than throwing', async () => {
    setResponse('fixture_templates', { data: null, error: { message: 'boom' } });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await fetchFixtureTemplates();

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('fetchTemplateRows', () => {
  it('queries fixture_template_rows filtered by template_id, ordered by line_number', async () => {
    setResponse('fixture_template_rows', { data: [TOILET_ROW], error: null });

    const result = await fetchTemplateRows('FIXTURE_TOILET_REPLACEMENT');

    expect(result).toEqual([TOILET_ROW]);
    expect(getCalls()).toEqual([
      { table: 'fixture_template_rows', method: 'from', args: [] },
      { table: 'fixture_template_rows', method: 'select', args: ['*'] },
      { table: 'fixture_template_rows', method: 'eq', args: ['template_id', 'FIXTURE_TOILET_REPLACEMENT'] },
      { table: 'fixture_template_rows', method: 'order', args: ['line_number', { ascending: true }] },
      { table: 'fixture_template_rows', method: 'returns', args: [] },
    ]);
  });

  it('returns [] on error rather than throwing', async () => {
    setResponse('fixture_template_rows', { data: null, error: { message: 'boom' } });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await fetchTemplateRows('FIXTURE_TOILET_REPLACEMENT');

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('fetchCandidateMaterials', () => {
  it('skips the query entirely for the Manual/custom line sentinel', async () => {
    const result = await fetchCandidateMaterials({ product_filter: 'Manual/custom line' });

    expect(result).toEqual([]);
    expect(getCalls().some((c) => c.table === 'plumblink_materials')).toBe(false);
  });

  it('parses the row filter and queries plumblink_materials', async () => {
    const material = { material_code: 'PLB-P1-046', description: 'PVC UG Gulley P-Trap 110mm' };
    setResponse('plumblink_materials', { data: [material], error: null });

    const result = await fetchCandidateMaterials(TOILET_ROW);

    expect(result).toEqual([material]);
    expect(getCalls()).toEqual([
      { table: 'plumblink_materials', method: 'from', args: [] },
      { table: 'plumblink_materials', method: 'select', args: ['*'] },
      { table: 'plumblink_materials', method: 'eq', args: ['application', 'Drainage'] },
      { table: 'plumblink_materials', method: 'eq', args: ['size', '110mm'] },
      { table: 'plumblink_materials', method: 'eq', args: ['fitting_type', 'Pan Connector'] },
      { table: 'plumblink_materials', method: 'ilike', args: ['fixture_tags', '%Toilet%'] },
      { table: 'plumblink_materials', method: 'returns', args: [] },
    ]);
  });

  it('returns [] on error rather than throwing', async () => {
    setResponse('plumblink_materials', { data: null, error: { message: 'boom' } });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await fetchCandidateMaterials(TOILET_ROW);

    expect(result).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('fetchMaterialByCode', () => {
  it('queries plumblink_materials by material_code and returns the first match', async () => {
    const material = { material_code: 'PLB-GEY-PCV01', description: 'Advanced Plastic Multi PCV Valve Relief & Isolator 400kPa 22mm', unit_price_excl_vat: 549 };
    setResponse('plumblink_materials', { data: [material], error: null });

    const result = await fetchMaterialByCode('PLB-GEY-PCV01');

    expect(result).toEqual(material);
    expect(getCalls()).toEqual([
      { table: 'plumblink_materials', method: 'from', args: [] },
      { table: 'plumblink_materials', method: 'select', args: ['*'] },
      { table: 'plumblink_materials', method: 'eq', args: ['material_code', 'PLB-GEY-PCV01'] },
      { table: 'plumblink_materials', method: 'returns', args: [] },
    ]);
  });

  it('returns null when no material matches the code', async () => {
    setResponse('plumblink_materials', { data: [], error: null });

    const result = await fetchMaterialByCode('PLB-DOES-NOT-EXIST');

    expect(result).toBeNull();
  });

  it('returns null on error rather than throwing', async () => {
    setResponse('plumblink_materials', { data: null, error: { message: 'boom' } });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await fetchMaterialByCode('PLB-GEY-PCV01');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('findTemplateForFixtureType / findSystemTemplate', () => {
  const templates: FixtureTemplate[] = [
    { template_id: 'FIXTURE_TOILET_REPLACEMENT', fixture_type: 'Toilet', template_name: 'Toilet replacement', template_variant: 'Replacement', scope: 'fixture' },
    { template_id: 'SYSTEM_UNDERGROUND_DRAINAGE_STANDARD_RUN', fixture_type: 'Underground Drainage', template_name: 'Underground drainage standard run', template_variant: 'Standard run', scope: 'system' },
  ];

  it('finds a fixture-scoped template by fixture_type', () => {
    expect(findTemplateForFixtureType(templates, 'Toilet')?.template_id).toBe('FIXTURE_TOILET_REPLACEMENT');
  });

  it('does not match a system-scoped template as a fixture template', () => {
    expect(findTemplateForFixtureType(templates, 'Underground Drainage')).toBeUndefined();
  });

  it('finds a system-scoped template by fixture_type', () => {
    expect(findSystemTemplate(templates, 'Underground Drainage')?.template_id).toBe('SYSTEM_UNDERGROUND_DRAINAGE_STANDARD_RUN');
  });

  it('does not match a fixture-scoped template as a system template', () => {
    expect(findSystemTemplate(templates, 'Toilet')).toBeUndefined();
  });
});
