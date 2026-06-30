import { createFileRoute } from '@tanstack/react-router';
import EstimatePage from '@/components/EstimatePage';
import type { DocumentType } from '@/lib/invoice-document';

// The home page picks Quote vs Invoice and carries that choice here as a
// search param (?doc=quote|invoice). Anything else falls back to "quote".
interface PlumbingSearch {
  doc: DocumentType;
}

export const Route = createFileRoute('/plumbing')({
  validateSearch: (search: Record<string, unknown>): PlumbingSearch => ({
    doc: search.doc === 'invoice' ? 'invoice' : 'quote',
  }),
  head: () => ({
    meta: [{ title: 'Plumbing Estimator — ContractorOS' }],
  }),
  component: EstimatePage,
});
