import { createFileRoute } from '@tanstack/react-router';
import EstimatePage from '@/components/EstimatePage';

export const Route = createFileRoute('/plumbing')({
  head: () => ({
    meta: [{ title: 'Plumbing Estimator — ContractorOS' }],
  }),
  component: EstimatePage,
});
