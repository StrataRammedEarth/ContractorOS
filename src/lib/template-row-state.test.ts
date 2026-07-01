import { describe, expect, it } from 'vitest';
import type { FixtureTemplateRow } from './fixture-templates';
import {
  createCustomRowInstance,
  hasProductSelected,
  initialRowInstance,
  isCheckboxDisabled,
  isInBuyList,
  isPriced,
  pricingGrade,
  quantityInputLabel,
  resolvedGrade,
  resolvedQty,
  resolvedTotal,
  rowState,
  sectionCounts,
  selectMaterial,
  setChecked,
  setManualProduct,
  shouldShowGradeChip,
  usesManualEntry,
  type TemplateRowInstance,
} from './template-row-state';

function templateRow(overrides: Partial<FixtureTemplateRow> = {}): FixtureTemplateRow {
  return {
    id: 'row-1',
    template_id: 'FIXTURE_TOILET_REPLACEMENT',
    line_number: 10,
    line_type: 'Suggested',
    application: 'Drainage',
    system: null,
    nominal_size: '110mm',
    fitting_type: 'Pan Connector',
    product_role: 'Connects pan outlet to soil pipe',
    default_material_code: 'PLB-P1-046',
    default_qty: 1,
    include_by_default: true,
    allow_alternatives: true,
    product_filter: 'Application=Drainage;NominalSize=110mm;FittingType=Pan Connector;FixtureTags contains Toilet;IsSelectable=TRUE',
    initial_validation_grade: 'TemplateSuggested',
    confirmed_validation_grade: 'Sourced',
    notes: null,
    ...overrides,
  };
}

describe('initialRowInstance', () => {
  it('loads a Suggested row pre-checked, untouched, with its default product', () => {
    const inst = initialRowInstance(templateRow({ include_by_default: true, default_material_code: 'PLB-P1-046' }), 1);
    expect(inst.origin).toBe('suggested');
    expect(inst.checked).toBe(true);
    expect(inst.touched).toBe(false);
    expect(inst.materialCode).toBe('PLB-P1-046');
  });

  it('loads an Optional row unchecked and untouched', () => {
    const inst = initialRowInstance(templateRow({ include_by_default: false }), 1);
    expect(inst.origin).toBe('optional');
    expect(inst.checked).toBe(false);
    expect(inst.touched).toBe(false);
  });

  it('KNOWN LIVE EDGE CASE: a Suggested row with no default product (2 such rows exist) loads checked but unpriceable', () => {
    const inst = initialRowInstance(templateRow({ include_by_default: true, default_material_code: null, product_role: null }), 1);
    expect(inst.checked).toBe(true); // still pre-checked per template intent
    expect(hasProductSelected(inst)).toBe(false);
    expect(isPriced(inst)).toBe(false); // but not priced until a product is resolved
    expect(isCheckboxDisabled(inst)).toBe(true);
  });
});

describe('createCustomRowInstance', () => {
  it('is checked and touched from creation, but unpriced until a description is entered', () => {
    const inst = createCustomRowInstance(1);
    expect(inst.origin).toBe('custom');
    expect(inst.checked).toBe(true);
    expect(inst.touched).toBe(true);
    expect(isPriced(inst)).toBe(false);
    expect(rowState(inst)).toBe('custom');
  });
});

describe('usesManualEntry', () => {
  it('is true for Custom rows (no template filter)', () => {
    expect(usesManualEntry(createCustomRowInstance(1))).toBe(true);
  });

  it('is true for the Manual/custom line sentinel row (Underground Drainage bedding)', () => {
    const bedding = initialRowInstance(templateRow({ product_filter: 'Manual/custom line', default_material_code: null, product_role: null }), 1);
    expect(usesManualEntry(bedding)).toBe(true);
  });

  it('is false for a normal template row with a queryable filter', () => {
    expect(usesManualEntry(initialRowInstance(templateRow(), 1))).toBe(false);
  });
});

describe('hasProductSelected / isCheckboxDisabled', () => {
  it('is true when a catalog material is linked', () => {
    const inst = initialRowInstance(templateRow({ default_material_code: 'PLB-P1-046' }), 1);
    expect(hasProductSelected(inst)).toBe(true);
    expect(isCheckboxDisabled(inst)).toBe(false);
  });

  it('is true when a manual description has been typed, even with no material code', () => {
    const inst = setManualProduct(initialRowInstance(templateRow({ default_material_code: null, product_role: null }), 1), 'Generic pan connector', 80);
    expect(hasProductSelected(inst)).toBe(true);
    expect(isCheckboxDisabled(inst)).toBe(false);
  });

  it('is false with no material code and no description', () => {
    const inst = initialRowInstance(templateRow({ default_material_code: null, product_role: null }), 1);
    expect(hasProductSelected(inst)).toBe(false);
    expect(isCheckboxDisabled(inst)).toBe(true);
  });

  it('REGRESSION: a placeholder row WITH a product_role is still checkbox-disabled — product_role text is not a product selection', () => {
    // Caught in browser verification: live placeholder rows carry a product_role
    // (e.g. "Compression coupler for 15mm supply"); it must not be mistaken for a
    // resolved product and wrongly enable the checkbox.
    const inst = initialRowInstance(templateRow({ default_material_code: null, product_role: 'Compression coupler for 15mm supply' }), 1);
    expect(inst.productRole).toBe('Compression coupler for 15mm supply');
    expect(inst.description).toBe('');
    expect(hasProductSelected(inst)).toBe(false);
    expect(isCheckboxDisabled(inst)).toBe(true);
  });
});

describe('rowState transitions', () => {
  it('Optional -> Confirmed when checked with a product resolved', () => {
    const optional = initialRowInstance(templateRow({ include_by_default: false }), 1);
    const confirmed = setChecked(optional, true);
    expect(rowState(confirmed)).toBe('confirmed');
  });

  it('Confirmed -> Removed when unchecked', () => {
    const optional = initialRowInstance(templateRow({ include_by_default: false }), 1);
    const confirmed = setChecked(optional, true);
    const removed = setChecked(confirmed, false);
    expect(rowState(removed)).toBe('removed');
  });

  it('Removed -> Confirmed again when re-checked', () => {
    const optional = initialRowInstance(templateRow({ include_by_default: false }), 1);
    const removed = setChecked(setChecked(optional, true), false);
    const reconfirmed = setChecked(removed, true);
    expect(rowState(reconfirmed)).toBe('confirmed');
  });

  it('a pre-checked Suggested row stays in the "suggested" (unconfirmed) state until touched', () => {
    const suggested = initialRowInstance(templateRow({ include_by_default: true }), 1);
    expect(rowState(suggested)).toBe('suggested');
    expect(isPriced(suggested)).toBe(true); // priced despite being unconfirmed — per the brief's table
  });

  it('Custom rows report state "custom" regardless of checked/touched history', () => {
    const inst = setChecked(createCustomRowInstance(1), false);
    expect(rowState(inst)).toBe('custom');
  });

  it('checking is blocked while no product is resolved', () => {
    const placeholder = initialRowInstance(templateRow({ include_by_default: false, default_material_code: null, product_role: null }), 1);
    const attempt = setChecked(placeholder, true);
    expect(attempt).toBe(placeholder); // unchanged — the attempt is a no-op
    expect(rowState(attempt)).toBe('optional');
  });
});

describe('isPriced / isInBuyList (identical per the brief\'s table)', () => {
  const cases: Array<[string, TemplateRowInstance, boolean]> = [
    ['Suggested, resolved', initialRowInstance(templateRow({ include_by_default: true }), 1), true],
    ['Optional, untouched', initialRowInstance(templateRow({ include_by_default: false }), 1), false],
    ['Confirmed', setChecked(initialRowInstance(templateRow({ include_by_default: false }), 1), true), true],
    ['Removed', setChecked(setChecked(initialRowInstance(templateRow({ include_by_default: false }), 1), true), false), false],
    ['Custom, resolved', setManualProduct(createCustomRowInstance(1), 'Custom part', 50), true],
    ['Custom, unresolved', createCustomRowInstance(1), false],
  ];

  it.each(cases)('%s -> isPriced=%s', (_label, row, expected) => {
    expect(isPriced(row)).toBe(expected);
    expect(isInBuyList(row)).toBe(expected);
  });
});

describe('grade chip visibility and value', () => {
  it('shows no chip for Suggested/Optional/Removed', () => {
    const suggested = initialRowInstance(templateRow({ include_by_default: true }), 1);
    const optional = initialRowInstance(templateRow({ include_by_default: false }), 1);
    const removed = setChecked(setChecked(optional, true), false);
    expect(shouldShowGradeChip(suggested)).toBe(false);
    expect(shouldShowGradeChip(optional)).toBe(false);
    expect(shouldShowGradeChip(removed)).toBe(false);
    expect(resolvedGrade(suggested)).toBeNull();
  });

  it('grades Confirmed as Sourced when linked to a real catalog material', () => {
    const confirmed = setChecked(initialRowInstance(templateRow({ include_by_default: false, default_material_code: 'PLB-P1-046' }), 1), true);
    expect(shouldShowGradeChip(confirmed)).toBe(true);
    expect(resolvedGrade(confirmed)).toBe('Sourced');
  });

  it('grades Confirmed as Assumption when the Placeholder product was entered manually', () => {
    const placeholder = initialRowInstance(templateRow({ include_by_default: false, default_material_code: null, product_role: null }), 1);
    const withProduct = setManualProduct(placeholder, 'Generic pan connector', 80);
    const confirmed = setChecked(withProduct, true);
    expect(resolvedGrade(confirmed)).toBe('Assumption');
  });

  it('grades a Custom row Assumption by default, Sourced if linked to a catalog material', () => {
    const manualCustom = setManualProduct(createCustomRowInstance(1), 'Off-brand elbow', 20);
    expect(resolvedGrade(manualCustom)).toBe('Assumption');

    const linkedCustom = selectMaterial(createCustomRowInstance(1), { materialCode: 'PLB-PL-CF07', description: 'Compression elbow 15mm', unitPrice: 35.31 });
    expect(resolvedGrade(linkedCustom)).toBe('Sourced');
  });
});

describe('pricingGrade — the grade a priced row contributes to scope', () => {
  it('REGRESSION: an unconfirmed Suggested row (no chip) still prices as Sourced when its default is a real material', () => {
    const suggested = initialRowInstance(templateRow({ include_by_default: true, default_material_code: 'PLB-PL-PF019' }), 1);
    // Chip is hidden for the unconfirmed row...
    expect(resolvedGrade(suggested)).toBeNull();
    // ...but the scope line must be graded Sourced, not fall back to Assumption.
    expect(pricingGrade(suggested)).toBe('Sourced');
    expect(isPriced(suggested)).toBe(true);
  });

  it('prices as Assumption when no real material is linked', () => {
    const manualCustom = setManualProduct(createCustomRowInstance(1), 'Off-brand elbow', 20);
    expect(pricingGrade(manualCustom)).toBe('Assumption');
  });
});

describe('selectMaterial / setManualProduct — confirming via product resolution', () => {
  it('resolving a product on an already-checked row (pre-checked Suggested Placeholder) confirms it without a separate checkbox click', () => {
    const placeholderSuggested = initialRowInstance(templateRow({ include_by_default: true, default_material_code: null, product_role: null }), 1);
    expect(rowState(placeholderSuggested)).toBe('suggested');

    const resolved = selectMaterial(placeholderSuggested, { materialCode: 'PLB-P1-046', description: 'PVC UG Gulley P-Trap 110mm', unitPrice: 123.26 });
    expect(rowState(resolved)).toBe('confirmed');
    expect(isPriced(resolved)).toBe(true);
  });

  it('resolving a product on an unchecked Optional row does not auto-confirm it', () => {
    const optional = initialRowInstance(templateRow({ include_by_default: false, default_material_code: null, product_role: null }), 1);
    const resolved = selectMaterial(optional, { materialCode: 'PLB-P1-046', description: 'PVC UG Gulley P-Trap 110mm', unitPrice: 123.26 });
    expect(rowState(resolved)).toBe('optional');
    expect(isPriced(resolved)).toBe(false);
    expect(isCheckboxDisabled(resolved)).toBe(false); // now resolvable, just not yet checked
  });
});

describe('resolvedQty / resolvedTotal', () => {
  it('multiplies defaultQty by quantityBasis', () => {
    const inst = initialRowInstance(templateRow({ default_qty: 2 }), 5);
    expect(resolvedQty(inst)).toBe(10);
  });

  it('totals qty × unitPrice only when priced, 0 otherwise', () => {
    const priced = selectMaterial(initialRowInstance(templateRow({ include_by_default: true, default_qty: 2 }), 3), { materialCode: 'X', description: 'd', unitPrice: 10 });
    expect(resolvedTotal(priced)).toBe(60); // 2 * 3 * 10

    const unpriced = initialRowInstance(templateRow({ include_by_default: false, default_material_code: null, product_role: null }), 3);
    expect(resolvedTotal(unpriced)).toBe(0);
  });
});

describe('quantityInputLabel', () => {
  it('labels system-scope templates by pipe run length', () => {
    expect(quantityInputLabel('system')).toBe('Pipe run length (m)');
  });

  it('labels fixture-scope templates by fixture count', () => {
    expect(quantityInputLabel('fixture')).toBe('Fixture count');
  });
});

describe('sectionCounts', () => {
  it('counts only rows of the given origin, tallying how many are currently priced', () => {
    const suggestedResolved = initialRowInstance(templateRow({ include_by_default: true }), 1);
    const suggestedPlaceholder = initialRowInstance(templateRow({ include_by_default: true, default_material_code: null, product_role: null }), 1);
    const optionalUnchecked = initialRowInstance(templateRow({ include_by_default: false }), 1);
    const optionalConfirmed = setChecked(initialRowInstance(templateRow({ include_by_default: false }), 1), true);
    const custom = createCustomRowInstance(1);

    const rows = [suggestedResolved, suggestedPlaceholder, optionalUnchecked, optionalConfirmed, custom];

    expect(sectionCounts(rows, 'suggested')).toEqual({ total: 2, active: 1 }); // placeholder one isn't priced yet
    expect(sectionCounts(rows, 'optional')).toEqual({ total: 2, active: 1 });
  });
});
