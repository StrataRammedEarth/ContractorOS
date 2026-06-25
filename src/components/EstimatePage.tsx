import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type {
  LibraryRecord,
  CrewRate,
  EstimateData,
  ValidationResult,
  SaveResult,
} from '@/lib/supabase-client';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Library = { materials: LibraryRecord[]; resources: CrewRate[] };
type Inputs = EstimateData['inputs'];

interface Props {
  library: Library;
  connected: boolean;
  onSave: (data: Partial<EstimateData>, project: string, client: string, trade: string, status: 'draft' | 'submitted' | 'approved') => Promise<SaveResult>;
  onValidate: (data: Partial<EstimateData>) => Promise<ValidationResult>;
  onCalculate: (inputs: Inputs, scope: EstimateData['scope'], labour: EstimateData['labour']) => EstimateData['totals'];
  onBuildScope: (inputs: Inputs, materials: LibraryRecord[]) => EstimateData['scope'];
  onBuildLabour: (inputs: Inputs, resources: CrewRate[]) => EstimateData['labour'];
}

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────

const DEFAULT_INPUTS: Inputs = {
  projectName: '',
  clientName: '',
  supplyMetres: 0,
  pipeType: 'CPVC',
  points: 0,
  drainMetres: 0,
  trenching: false,
  fixtures: { toilet: 0, basin: 0, shower: 0, showerDoor: 0, showerRose: 0, showerArm: 0, kitchenMixer: 0 },
};

const FIXTURE_LABELS: Record<keyof Inputs['fixtures'], string> = {
  toilet: 'Toilet / WC',
  basin: 'Basin',
  shower: 'Shower Base',
  showerDoor: 'Shower Door',
  showerRose: 'Shower Rose',
  showerArm: 'Shower Arm',
  kitchenMixer: 'Kitchen Mixer',
};

function fmt(n: number) {
  return 'R ' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function EstimatePage({ library, connected, onSave, onValidate, onCalculate, onBuildScope, onBuildLabour }: Props) {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const [estimate, setEstimate] = useState<Omit<EstimateData, 'inputs'> | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  function setFixture(key: keyof Inputs['fixtures'], val: number) {
    setInputs((p) => ({ ...p, fixtures: { ...p.fixtures, [key]: val } }));
  }

  function generate() {
    const scope = onBuildScope(inputs, library.materials);
    const labour = onBuildLabour(inputs, library.resources);
    const totals = onCalculate(inputs, scope, labour);
    setEstimate({ scope, labour, totals });
    setValidation(null);
    setSaveResult(null);
  }

  async function handleValidate() {
    if (!estimate) return;
    setBusy(true);
    setStatus('Validating…');
    const result = await onValidate({ inputs, ...estimate });
    setValidation(result);
    setStatus('');
    setBusy(false);
  }

  async function handleSave(s: 'draft' | 'submitted') {
    if (!estimate) return;
    setBusy(true);
    setStatus('Saving…');
    const result = await onSave({ inputs, ...estimate }, inputs.projectName || 'Unnamed', inputs.clientName || 'Unknown', 'plumbing', s);
    setSaveResult(result);
    setStatus('');
    setBusy(false);
  }

  const hasEstimate = !!estimate;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Plumbing Estimator</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {library.materials.length} materials · {library.resources.length} crew rates loaded
          </p>
        </div>
        <Badge variant={connected ? 'default' : 'secondary'}>
          {connected ? '● Supabase connected' : '○ Offline'}
        </Badge>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">

        {/* Job Details */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Job Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Project Name</Label>
              <Input placeholder="e.g. Bathroom Reno – 14 Oak St" value={inputs.projectName}
                onChange={(e) => setInputs((p) => ({ ...p, projectName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Client Name</Label>
              <Input placeholder="e.g. John Smith" value={inputs.clientName}
                onChange={(e) => setInputs((p) => ({ ...p, clientName: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        {/* Pipe & Scope */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Pipework</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Supply Pipe (m)</Label>
              <Input type="number" min={0} value={inputs.supplyMetres}
                onChange={(e) => setInputs((p) => ({ ...p, supplyMetres: +e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Pipe Type</Label>
              <Input placeholder="CPVC / Copper / Poly" value={inputs.pipeType}
                onChange={(e) => setInputs((p) => ({ ...p, pipeType: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Drain Pipe (m)</Label>
              <Input type="number" min={0} value={inputs.drainMetres}
                onChange={(e) => setInputs((p) => ({ ...p, drainMetres: +e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Connection Points</Label>
              <Input type="number" min={0} value={inputs.points}
                onChange={(e) => setInputs((p) => ({ ...p, points: +e.target.value }))} />
            </div>
            <div className="flex items-center gap-3 col-span-2">
              <Switch checked={inputs.trenching}
                onCheckedChange={(v) => setInputs((p) => ({ ...p, trenching: v }))} />
              <Label>Trenching required</Label>
            </div>
          </CardContent>
        </Card>

        {/* Fixtures */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Fixtures</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {(Object.keys(inputs.fixtures) as (keyof Inputs['fixtures'])[]).map((key) => (
              <div key={key} className="space-y-1.5">
                <Label>{FIXTURE_LABELS[key]}</Label>
                <Input type="number" min={0} value={inputs.fixtures[key]}
                  onChange={(e) => setFixture(key, +e.target.value)} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Generate */}
        <Button className="w-full" size="lg" onClick={generate}>
          Generate Estimate
        </Button>

        {/* Results */}
        {hasEstimate && estimate && (
          <>
            {/* Scope */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Materials Scope</CardTitle></CardHeader>
              <CardContent className="p-0">
                {estimate.scope.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground">
                    No materials matched from library. Add items to the library or adjust fixture inputs.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead className="w-1/2">Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estimate.scope.map((line, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{line.code}</TableCell>
                          <TableCell className="text-sm">{line.description}</TableCell>
                          <TableCell className="text-right">{line.quantity}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{line.unit}</TableCell>
                          <TableCell className="text-right">{fmt(line.price)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(line.total)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{line.confidence}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Labour */}
            {estimate.labour.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Labour</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-1/2">Description</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Rate / hr</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {estimate.labour.map((line, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{line.description}</TableCell>
                          <TableCell className="text-right">{line.hours}</TableCell>
                          <TableCell className="text-right">{fmt(line.rate)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(line.cost)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Totals */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Pricing Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm max-w-sm ml-auto">
                  {[
                    ['Material Cost',          estimate.totals.material_cost],
                    ['Waste (5%)',              estimate.totals.waste_5pct],
                    ['Direct Cost',            estimate.totals.direct_cost],
                    ['Risk Allowance (5%)',     estimate.totals.risk_5pct],
                    ['Contingency (10%)',       estimate.totals.contingency_10pct],
                    ['Subtotal',               estimate.totals.subtotal],
                    ['Margin (25%)',            estimate.totals.margin_25pct],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between text-muted-foreground">
                      <span>{label as string}</span>
                      <span>{fmt(value as number)}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between font-semibold text-base pt-1">
                    <span>Quote Price</span>
                    <span className="text-primary">{fmt(estimate.totals.final_total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Validation feedback */}
            {validation && (
              <Card className={validation.is_valid ? 'border-green-500/50' : 'border-destructive/50'}>
                <CardContent className="pt-6 text-sm space-y-1">
                  {validation.is_valid ? (
                    <>
                      <p className="font-medium text-green-600">✅ Estimate is valid — Grade: {validation.confidence_grade}</p>
                      {validation.estimate_range && (
                        <p className="text-muted-foreground">
                          Range: {fmt(validation.estimate_range.low)} – {fmt(validation.estimate_range.high)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-medium text-destructive">❌ {validation.blockage_reason ?? validation.error}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Save feedback */}
            {saveResult && (
              <Card className={saveResult.success ? 'border-green-500/50' : 'border-destructive/50'}>
                <CardContent className="pt-6 text-sm">
                  {saveResult.success
                    ? <p className="text-green-600">✅ Saved as <strong>{saveResult.estimate?.reference}</strong></p>
                    : <p className="text-destructive">❌ {saveResult.error}</p>}
                </CardContent>
              </Card>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={handleValidate} disabled={busy}>
                {busy && status === 'Validating…' ? 'Validating…' : 'Validate Estimate'}
              </Button>
              <Button variant="outline" onClick={() => handleSave('draft')} disabled={busy}>
                {busy && status === 'Saving…' ? 'Saving…' : 'Save as Draft'}
              </Button>
              <Button onClick={() => handleSave('submitted')} disabled={busy}>
                Submit Estimate
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
