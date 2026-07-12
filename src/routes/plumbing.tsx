import { createFileRoute } from '@tanstack/react-router';
import EstimatePage from '@/components/EstimatePage';
import type { DocumentType } from '@/lib/invoice-document';

// The home page picks Quote vs Invoice and carries that choice here as a
// search param (?doc=quote|invoice). Anything else falls back to "quote".
// estimateId (optional) marks this as an edit of an existing document — its
// row id, used by EstimatePage to hydrate the builder from the saved
// snapshot. Absent/malformed falls back to undefined (a normal new-document
// load), never throws.
interface PlumbingSearch {
  doc: DocumentType;
  estimateId?: string;
}

export const Route = createFileRoute('/plumbing')({
  validateSearch: (search: Record<string, unknown>): PlumbingSearch => ({
    doc: search.doc === 'invoice' ? 'invoice' : 'quote',
    estimateId: typeof search.estimateId === 'string' && search.estimateId ? search.estimateId : undefined,
  }),
  head: () => ({
    meta: [{ title: 'Plumbing Estimator — ContractorOS' }],
  }),
  component: EstimatePage,
});
