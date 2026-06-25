import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  loadLibrary,
  saveEstimate,
  validateEstimate,
  testConnection,
  type LibraryRecord,
  type CrewRate,
} from '@/lib/supabase-client';
import { calculateEstimate, buildScope, buildLabour } from '@/lib/engine';
import EstimatePage from '@/components/EstimatePage';

export const Route = createFileRoute('/plumbing')({
  head: () => ({
    meta: [{ title: 'Plumbing Estimator — ContractorOS' }],
  }),
  component: PlumbingEstimateRoute,
});

function PlumbingEstimateRoute() {
  const [library, setLibrary] = useState<{ materials: LibraryRecord[]; resources: CrewRate[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const isConnected = await testConnection();
        setConnected(isConnected);

        const [materials, resources] = await Promise.all([
          loadLibrary('material', 'active'),
          loadLibrary('resource', 'active'),
        ]);

        setLibrary({ materials: materials ?? [], resources: (resources as CrewRate[]) ?? [] });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-medium">Loading ContractorOS…</p>
          <p className="text-sm text-muted-foreground">Connecting to library and crew rates</p>
        </div>
      </div>
    );
  }

  if (error && !library) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm space-y-4">
          <p className="text-destructive font-medium">⚠️ Connection Error</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm underline underline-offset-4 text-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <EstimatePage
      library={library ?? { materials: [], resources: [] }}
      connected={connected}
      onSave={saveEstimate}
      onValidate={validateEstimate}
      onCalculate={calculateEstimate}
      onBuildScope={buildScope}
      onBuildLabour={buildLabour}
    />
  );
}
