// Display-only labels for fitting_type, decoupled from the canonical key.
// fitting_type stays the stable matching key for product_filter, the cascade
// lookup against plumblink_materials, and Geyser branch logic — this map is
// applied only at render sites, never at those matching sites. Unmapped
// fitting_type values pass through unchanged.

// Tap / Mixer is shared across several templates but should read as the
// specific fixture it's fitted to. Keyed on AppliedTemplate.fixtureType;
// verified against fixture_template_rows that "Basin" resolves the same
// default product (PLB-PL-TM02) as "Basin Mixer", so both read as "Basin
// Mixer". Fixture types not listed here fall back to the global "Mixer".
const TAP_MIXER_LABELS: Record<string, string> = {
  'Basin': 'Basin Mixer',
  'Basin Mixer': 'Basin Mixer',
  'Kitchen Mixer': 'Kitchen Mixer',
  'Shower Mixer': 'Shower Mixer',
};

export function fittingTypeLabel(fittingType: string, context?: { fixtureType?: string }): string {
  if (fittingType === 'Valve / Stop Tap') return 'Isolation Valve';
  if (fittingType === 'Tap / Mixer') {
    const byContext = context?.fixtureType ? TAP_MIXER_LABELS[context.fixtureType] : undefined;
    return byContext ?? 'Mixer';
  }
  return fittingType;
}
