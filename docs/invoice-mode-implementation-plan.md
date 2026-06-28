# Invoice document mode implementation plan

Target file: `src/components/EstimatePage.tsx`

## Confirmed current code structure

- Plumbing route: `src/routes/plumbing.tsx`
- Main plumbing UI and engine: `src/components/EstimatePage.tsx`
- Existing quote output: `printQuotePDF(inp, scope, labour, quoteRef)`
- Existing buy list output: `printBuyPDF(inp, scope, quoteRef)`
- Existing quote reference logic: session-based `PLB-YYYY-NNN`
- Existing material actuals pattern: `FixtureLine` and `PipeLine`
- Existing output tabs: Estimate, Buy, Build, Learn
- Existing confidence grades: Locked, Validated, Sourced, Derived, Assumption, Placeholder

## Required implementation

### 1. Document type

Add:

```ts
type DocumentType = 'quote' | 'invoice';
interface InvoiceMeta {
  issueDate: string;
  dueDate: string;
  bankingDetails: string;
}
```

In `EstimatePage`, add:

```ts
const [documentType, setDocumentType] = useState<DocumentType>('quote');
const [quoteRef] = useState(() => nextDocumentRef('quote'));
const [invoiceRef] = useState(() => nextDocumentRef('invoice'));
const docRef = documentType === 'invoice' ? invoiceRef : quoteRef;
```

### 2. Separate numbering

Replace `nextQuoteRef()` with:

```ts
function nextDocumentRef(type: DocumentType) {
  const now = new Date();
  const year = now.getFullYear();
  const yearMonth = `${year}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const key = type === 'invoice' ? `cos_invoice_seq_${yearMonth}` : `cos_quote_seq_${year}`;
  let seq = 0;
  try { seq = parseInt(sessionStorage?.getItem?.(key) ?? '0', 10); } catch (_) {}
  seq += 1;
  try { sessionStorage.setItem(key, String(seq)); } catch (_) {}
  return type === 'invoice'
    ? `INV-${yearMonth}-${String(seq).padStart(3, '0')}`
    : `PLB-${year}-${String(seq).padStart(3, '0')}`;
}
```

This preserves quote numbering and gives invoices an independent `INV-YYYYMM-NNN` series.

### 3. Gate branch

Quote gate must remain strict. Invoice gate must pass actuals regardless of grade.

```ts
const issuable = documentType === 'invoice' || GRADES[weakest]?.rank >= GRADES['Derived'].rank;
```

Apply this branch in both `EstimateTab` and `LearnTab`.

### 4. UI toggle

Add a top-of-job toggle:

```tsx
Quote | Invoice
```

Default is `quote`.

When `invoice` is selected, show:

- Issue date
- Due date, default issue date + 7 days
- Banking details

### 5. Output branch

Replace direct quote printing with:

```ts
const printDocument = () => documentType === 'invoice'
  ? printInvoicePDF(effInputs, scope, labour, docRef, invoiceMeta)
  : printQuotePDF(effInputs, scope, labour, docRef);
```

Button label:

```tsx
{documentType === 'invoice' ? 'Download Invoice' : 'Download Quote'}
```

### 6. Invoice output requirements

`printInvoicePDF` must render:

- `INV-YYYYMM-NNN`
- issue date
- due date
- client and project/address
- actual material lines: product, unit, qty, price, total
- labour lines
- subtotal excl VAT
- 15% VAT
- `Total amount due`
- banking details
- past-tense work narrative

### 7. Do not change

Do not alter:

- `buildScope`
- `buildLabour`
- `applyLadder`
- geyser assembly adapters
- pricing constants
- scaling/intensity logic

## Supabase already prepared

The database already has:

- `estimate_versions.document_type`
- `estimate_versions.invoice_meta`
- `document_counters`
- `next_document_reference(...)`

This file records the intended app-side patch because the GitHub connector currently exposes whole-file replacement but not safe line-level patching.
