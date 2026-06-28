import { createFileRoute } from '@tanstack/react-router';
import EstimatePageStable from '../components/EstimatePageStable';

export const Route = createFileRoute('/plumbing')({
  head: () => ({
    meta: [{ title: 'Plumbing Estimator — ContractorOS' }],
  }),
  component: EstimatePageStable,
});
