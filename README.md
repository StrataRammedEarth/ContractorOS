# ContractorOS Reliable Estimating Core

Assembly-first estimating for plumbing, decking/balustrade, and masonry.

## Run locally

Double-click `Start-Preview.cmd`, or run:

```powershell
npm run build
npm run start -- -p 3010
```

Open `http://127.0.0.1:3010`.

Without Supabase environment values, ContractorOS runs in local data mode and saves data in the browser.

## Supabase and owner login

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor.
3. Create the owner user under Authentication.
4. Copy `.env.example` to `.env.local` and fill in the project URL and anonymous key.

When those values exist, the app requires the Supabase owner login.

## Deploy to Vercel

Import this folder or its GitHub repository into Vercel. Add the same Supabase environment variables, then deploy.

## Data governance

- Trusted records are seeded from the locked plumbing KB, scaling rules, corrected deck benchmark, masonry KB, and commercial rules.
- ContractorOS is currently exploration-ready under owner-controlled governance, not production-ready.
- Permanent data changes, imports, locked promotions, exceptions, and overrides require owner approval.
- Placeholder values may be used for research and estimating exercises when they remain flagged, sourced, dated, and traceable.
- The current commercial factors are exploration-approved architect placeholders. They may support internal estimates but block client proposal PDFs until the owner locks the intended waste, risk, contingency, markup or margin, and VAT policy.
- Saved estimates snapshot their rates and rules.
- Governed CSV imports can stage materials, resources, assemblies, commercial rules, assumptions, validations, source records, and productivity records. Supported records can be persisted as inactive staged records, then promoted only through owner approval.
- Actual results create review suggestions and never update locked rates automatically.
- Customer proposal PDFs present ContractorOS output as an estimate, not a final binding quote. Internal assumptions and warnings are listed in an accompanying notice.
- The PLB-000 top-down plumbing package is retained as historical trace evidence only. Selectable plumbing estimates should be rebuilt from approved components and kits.
- The DCK-001 deck value is an accepted exploration placeholder and must be rebuilt bottom-up before locked promotion.
- Import templates for every governed record type are available under `templates/`.

## QS prompt assets

- The canonical Assistant QS system prompt lives at `data/ContractorOS_QS_System_Prompt.md`.
- Usage notes and verification tests live at `data/ContractorOS_QS_Prompt_Operator_Guide.md`.
- These prompt assets are aligned to the current repo governance model and should be reconciled against any uploaded historical source pack before being treated as authoritative.

## Controlled estimating pilot

- The deck and plumbing pilot pack lives in `data/pilots/`.
- Start with `data/pilots/estimating-pilot-v1.md`, then complete the relevant
  scope intake and reconciliation files.
- `DCK-001` remains internal-only until a QS-reviewed bottom-up rebuild has
  current evidence and owner approval. `PLB-KIT-001` is the controlled
  componentised plumbing pilot.
