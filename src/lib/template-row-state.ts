import type { FixtureTemplateRow } from './fixture-templates';
import { isManualLine } from './product-filter';

// The 5-state row model from claude_code_brief_fixture_templates.md §2 — governs
// both pricing and visual treatment for a fixture/system template's fitting rows.
// "A template suggests scope; the plumber confirms scope": nothing here prices
// until a row is both checked AND resolved to an actual product.

export type RowOrigin = 'suggested' | 'optional' | 'custom' | 'catalog';
export type RowState = 'suggested' | 'optional' | 'confirmed' | 'removed' | 'custom' | 'catalog';
export type Grade = 'Sourced' | 'Assumption';

export interface TemplateRowInstance {
  id: string;                    // instance id, distinct from fixture_template_rows.id
  templateRowId: string | null;  // FK to fixture_template_rows.id; null for Custom rows
  origin: RowOrigin;
  checked: boolean;               // checkbox visual state
  touched: boolean;                // has the user ever explicitly acted on this row?
  application: string;
  system: string | null;
  nominalSize: string | null;
  fittingType: string;
  materialCode: string | null;    // linked catalog code; null = no product resolved yet
  description: string;             // resolved PRODUCT description; '' until a product is picked/resolved
  productRole: string | null;     // template's human-readable row purpose (display only, not a product)
  unitPrice: number;
  quantityBasis: number;          // fixture count (scope='fixture') or run length in metres (scope='system')
  defaultQty: number;             // fixture_template_rows.default_qty; 1 for Custom rows
  allowAlternatives: boolean;
  productFilter: string;          // raw filter; drives the Product dropdown. '' for Custom rows
}

const _uid = () => Math.random().toString(36).slice(2, 9);

export function initialRowInstance(row: FixtureTemplateRow, quantityBasis: number): TemplateRowInstance {
  return {
    id: _uid(),
    templateRowId: row.id,
    origin: row.include_by_default ? 'suggested' : 'optional',
    // Pre-checked per §4 even when the row is a Placeholder with no default
    // product (2 such rows exist live) — checked reflects template intent,
    // not pricing eligibility. isPriced() below is the real gate.
    checked: row.include_by_default,
    touched: false,
    application: row.application,
    system: row.system,
    nominalSize: row.nominal_size,
    fittingType: row.fitting_type,
    materialCode: row.default_material_code,
    // description tracks the RESOLVED product only — NOT product_role. Seeding it
    // from product_role would make hasProductSelected() report true for a
    // placeholder row that has descriptive text but no actual product, wrongly
    // enabling its checkbox. product_role is carried separately for display.
    description: '',
    productRole: row.product_role,
    unitPrice: 0, // resolved once the linked material's price is looked up (Phase 5)
    quantityBasis,
    defaultQty: row.default_qty,
    allowAlternatives: row.allow_alternatives,
    productFilter: row.product_filter,
  };
}

export function createCustomRowInstance(quantityBasis: number): TemplateRowInstance {
  return {
    id: _uid(),
    templateRowId: null,
    origin: 'custom',
    checked: true,       // "Checked (auto-confirmed on creation)"
    touched: true,
    application: '',
    system: null,
    nominalSize: null,
    fittingType: '',
    materialCode: null,
    description: '',
    productRole: null,
    unitPrice: 0,
    quantityBasis,
    defaultQty: 1,
    allowAlternatives: true,
    productFilter: '', // Custom rows have no template filter — manual entry only
  };
}

// A catalogue-cascade row ("+ Add fitting") — like Custom, auto-confirmed and
// terminal, but its identity fields are resolved via the Application → Fitting
// Type → Size → Product dropdown chain instead of free text.
export function createCatalogRowInstance(quantityBasis: number): TemplateRowInstance {
  return {
    id: _uid(),
    templateRowId: null,
    origin: 'catalog',
    checked: true,
    touched: true,
    application: '',
    system: null,
    nominalSize: null,
    fittingType: '',
    materialCode: null,
    description: '',
    productRole: null,
    unitPrice: 0,
    quantityBasis,
    defaultQty: 1,
    allowAlternatives: true,
    productFilter: '',
  };
}

// A standalone-section fitting row (the "Supply Fittings" / "Drainage Fittings"
// tables) — a catalog row whose application is fixed by its section, so the
// cascade there is just Size → Fitting Type → Product with no Application step.
export function createStandaloneRowInstance(application: string): TemplateRowInstance {
  return { ...createCatalogRowInstance(1), application };
}

// A row takes free-text manual entry (no catalog dropdown) when it's a Custom
// row, or when its filter is the Manual/custom line sentinel (the Underground
// Drainage "Bedding / Backfill" row). Everything else drives a Product dropdown
// from a product_filter query. Catalog rows are the exception to the sentinel
// check below — their productFilter is always '' (they drive the cascade
// dropdowns instead), which would otherwise misread as the manual-line case.
export function usesManualEntry(row: Pick<TemplateRowInstance, 'origin' | 'productFilter'>): boolean {
  if (row.origin === 'catalog') return false;
  return row.origin === 'custom' || isManualLine(row.productFilter);
}

// "The product field still shows 'Select product'" — true whenever nothing has
// been resolved yet, whether via the catalog dropdown or manual free text.
export function hasProductSelected(row: Pick<TemplateRowInstance, 'materialCode' | 'description'>): boolean {
  return row.materialCode !== null || row.description.trim().length > 0;
}

// Placeholder rows "cannot be confirmed until a product is selected... checkbox
// disabled while the product field still shows 'Select product'". Applied to
// every row regardless of origin, not just template-flagged Placeholders — a
// Custom row with no description yet is exactly the same case.
export function isCheckboxDisabled(row: Pick<TemplateRowInstance, 'materialCode' | 'description'>): boolean {
  return !hasProductSelected(row);
}

export function rowState(row: Pick<TemplateRowInstance, 'origin' | 'checked' | 'touched'>): RowState {
  if (row.origin === 'custom') return 'custom';
  if (row.origin === 'catalog') return 'catalog';
  if (!row.touched) return row.origin; // 'suggested' | 'optional', exactly as loaded
  return row.checked ? 'confirmed' : 'removed';
}

// Priced/in-buy-list requires BOTH checked and a resolved product — a pre-checked
// Suggested Placeholder row (the 2-row live case) is not priced until the plumber
// actually picks something, even though its checkbox shows checked from load.
export function isPriced(row: Pick<TemplateRowInstance, 'checked' | 'materialCode' | 'description'>): boolean {
  return row.checked && hasProductSelected(row);
}

export function isInBuyList(row: Pick<TemplateRowInstance, 'checked' | 'materialCode' | 'description'>): boolean {
  return isPriced(row);
}

export function shouldShowGradeChip(row: Pick<TemplateRowInstance, 'origin' | 'checked' | 'touched'>): boolean {
  const state = rowState(row);
  return state === 'confirmed' || state === 'custom' || state === 'catalog';
}

// Sourced if linked to a real catalog material_code, Assumption if the plumber
// typed a manual product with no catalog match — computed at runtime rather than
// trusted from fixture_template_rows.confirmed_validation_grade, since a row with
// allow_alternatives can be resolved to a different (or manual) product than its
// static template default implies.
export function resolvedGrade(row: Pick<TemplateRowInstance, 'origin' | 'checked' | 'touched' | 'materialCode' | 'description'>): Grade | null {
  if (!shouldShowGradeChip(row)) return null;
  return pricingGrade(row);
}

// The grade a PRICED row contributes to scope/pricing — reflects product
// resolution only (Sourced if a real material_code is linked, else Assumption),
// INDEPENDENT of confirmation state. Distinct from resolvedGrade, which is chip
// visibility and returns null for unconfirmed rows: a pre-checked Suggested row
// is priced into the quote and must carry its true Sourced grade, not a fallback.
export function pricingGrade(row: Pick<TemplateRowInstance, 'materialCode'>): Grade {
  return row.materialCode !== null ? 'Sourced' : 'Assumption';
}

export function resolvedQty(row: Pick<TemplateRowInstance, 'defaultQty' | 'quantityBasis'>): number {
  return row.defaultQty * row.quantityBasis;
}

export function resolvedTotal(row: Pick<TemplateRowInstance, 'checked' | 'materialCode' | 'description' | 'unitPrice' | 'defaultQty' | 'quantityBasis'>): number {
  if (!isPriced(row)) return 0;
  return resolvedQty(row) * row.unitPrice;
}

export function quantityInputLabel(scope: 'fixture' | 'system' | 'geyser'): string {
  return scope === 'system' ? 'Pipe run length (m)' : 'Fixture count';
}

// Checking is blocked while no product is resolved (mirrors isCheckboxDisabled);
// unchecking is always allowed, moving a previously-confirmed row to 'removed'.
export function setChecked(row: TemplateRowInstance, checked: boolean): TemplateRowInstance {
  if (checked && isCheckboxDisabled(row)) return row;
  return { ...row, checked, touched: true };
}

// Linking a catalog product is itself a confirming action for a row whose
// checkbox was inert while unresolved (the pre-checked Suggested Placeholder
// case) — so touched flips to true here even without a separate checkbox click.
export function selectMaterial(
  row: TemplateRowInstance,
  material: { materialCode: string; description: string; unitPrice: number }
): TemplateRowInstance {
  return {
    ...row,
    materialCode: material.materialCode,
    description: material.description,
    unitPrice: material.unitPrice,
    touched: row.checked ? true : row.touched,
  };
}

export function setManualProduct(row: TemplateRowInstance, description: string, unitPrice: number): TemplateRowInstance {
  return {
    ...row,
    materialCode: null,
    description,
    unitPrice,
    touched: row.checked ? true : row.touched,
  };
}

// Cascade field setters for catalog rows — each clears every field downstream
// of it in the fixture cascade's Application → Fitting Type → Size → Product
// chain, so a stale selection can never survive an upstream change.
export function setApplication(row: TemplateRowInstance, application: string): TemplateRowInstance {
  return { ...row, application, fittingType: '', nominalSize: null, materialCode: null, description: '', unitPrice: 0, touched: true };
}

// Fitting Type precedes Size in the fixture cascade, so changing it clears Size
// (and the product) downstream.
export function setFittingType(row: TemplateRowInstance, fittingType: string): TemplateRowInstance {
  return { ...row, fittingType, nominalSize: null, materialCode: null, description: '', unitPrice: 0, touched: true };
}

// Size is the last step before Product in the fixture cascade — it clears only
// the resolved product, never the upstream Fitting Type.
export function setSize(row: TemplateRowInstance, size: string | null): TemplateRowInstance {
  return { ...row, nominalSize: size, materialCode: null, description: '', unitPrice: 0, touched: true };
}

// Standalone-section setters — the Supply/Drainage tables run the cascade in the
// opposite middle order (Size → Fitting Type → Product) with Application fixed,
// so Size is upstream of Fitting Type here and clears it on change.
export function setStandaloneSize(row: TemplateRowInstance, size: string | null): TemplateRowInstance {
  return { ...row, nominalSize: size, fittingType: '', materialCode: null, description: '', unitPrice: 0, touched: true };
}

export function setStandaloneFittingType(row: TemplateRowInstance, fittingType: string): TemplateRowInstance {
  return { ...row, fittingType, materialCode: null, description: '', unitPrice: 0, touched: true };
}

// "Suggested fittings (2 of 2 confirmed)" / "Optional fittings (0 of 6 selected)"
// — informational counts only. Do not wire this into a header click handler;
// bulk-toggle-on-header-click was explicitly rejected during design review.
export function sectionCounts(rows: TemplateRowInstance[], origin: 'suggested' | 'optional'): { total: number; active: number } {
  const section = rows.filter((r) => r.origin === origin);
  return { total: section.length, active: section.filter((r) => isPriced(r)).length };
}
