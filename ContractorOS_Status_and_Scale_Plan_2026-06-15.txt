# ContractorOS Status and Scale Plan

Date: 2026-06-15

## Executive Status

ContractorOS has moved beyond concept exploration into a working prototype.

The local application is a Next.js estimating product with:

- Assembly-first estimating across plumbing, decking, and masonry
- A curated seed library with confidence and source metadata
- Material CSV review and controlled approval
- Buy list, build plan, estimate history, actual-cost capture, and PDF proposals
- Local browser storage for simple use
- Optional Supabase authentication, multi-organization storage, and row-level security
- Automated tests for core benchmark calculations and import validation

The strongest product asset is not quote generation. It is the governed estimating
knowledge base: assemblies, productivity rates, material pricing, commercial rules,
confidence levels, sources, and actual-versus-estimate learning.

## Google Drive Status

The ContractorOS Drive folder has a useful emerging structure:

- Master
- Source Data
- Material
- Labour Productivity
- Assembly
- Validation
- Work in Progress
- Incoming
- Archive
- Apps
- Plumbing

The latest and most important Drive assets include:

- Labour_productivity_library_clean, modified 2026-06-15
- PLUMB_Material_Library_P1P2, modified 2026-06-15
- Productivity Library, modified 2026-06-14
- Assembly_Scaling_Rules_v1.2-1.csv
- MASONRY_KB_v1-1.csv
- SPONS_Productivity_Library_v1-1.csv
- Validation_Log_v1-1.csv
- ContractorOS_App-1.jsx
- ContractorOS_Gemini_Instructions.md

Drive currently contains duplicate or overlapping architecture, writing-mode,
productivity, benchmark, and material-library files. The folder called
"Latest Files" is no longer the latest source for several important records.

## Main Risks

1. Source-of-truth fragmentation

The application seed, Google Sheets, CSV files, source PDFs, and duplicated Drive
files can disagree. There is no machine-readable master manifest that declares
which file and revision is authoritative.

2. Database history is not yet strong enough

The current JSONB library record approach is flexible, but supplier price history,
assembly revisions, approvals, and effective dates need stronger relational
structure. The existing uniqueness rule also prevents clean retention of multiple
superseded revisions for the same code.

3. Governance exists in concept more than workflow

The product has confidence labels, sources, pending imports, and actuals, but the
database does not yet fully implement review queues, approvals, audit trails,
promotion rules, or rollback.

4. Prototype cloud writes will not scale safely

Editing a material price can trigger a full-library save. This is acceptable for a
small owner-operated prototype but should become record-level, validated,
transactional writes before adding users.

5. Commercial terminology needs confirmation

The current "margin" calculation applies a percentage markup to cost. If the
business means gross margin percentage, the calculation must be changed and
explicitly tested.

## Recommended Product Boundary

Keep the first commercial version narrow:

- One contractor organization
- One owner plus a small internal team
- Plumbing first, with decking as the second validated trade
- Estimate, buy, build, proposal, and actuals workflow
- Controlled library imports and owner approval
- No automatic AI-generated prices or quantities

Design the data model for multiple organizations and trades now, but do not build
enterprise administration, marketplaces, or broad AI drawing takeoff yet.

## Recommended Database Direction

Move the most important governed data out of generic JSONB records into explicit,
versioned entities:

- materials
- suppliers
- supplier_material_prices
- resources
- productivity_rates
- assemblies
- assembly_components
- commercial_rule_sets
- source_documents
- import_batches and import_rows
- review_decisions
- projects
- estimate_versions and estimate_lines
- actual_cost_lines
- audit_events

Every governed record should carry:

- organization_id
- stable business code
- revision number
- status
- effective_from and effective_to
- confidence
- source_document_id
- approved_by and approved_at
- created_at

Use immutable revisions. Never overwrite an approved rate or assembly; close its
effective period and create a new revision.

## Phased Roadmap

### Phase 1: Trustworthy Core

- Declare one authoritative master manifest for Drive and application data
- Consolidate duplicate Drive files into Master, Work in Progress, and Archive
- Confirm markup versus gross-margin rules
- Add record-level cloud writes and validation
- Add library revision history, approvals, and audit events
- Add estimate-line snapshots and calculation explanations
- Fix proposal finalisation so invalid estimates cannot produce client PDFs

### Phase 2: Operational Pilot

- Pilot with 10 to 20 real plumbing estimates
- Capture estimated versus actual material and labour line items
- Measure quote time, estimate variance, gross profit variance, and win rate
- Add project/client records, quote statuses, acceptance, and variation tracking
- Add supplier price dates, expiry alerts, and price-comparison views

### Phase 3: Repeatable Product

- Create a contractor onboarding and data-import workflow
- Add role-aware approvals for owner, estimator, and reviewer
- Add trade packs with versioned assemblies and validation coverage
- Add branded proposal templates, email generation, and acceptance workflow
- Add dashboards for margin leakage, stale prices, and estimate accuracy

### Phase 4: Scalable Intelligence

- Use AI only for assisted classification, source extraction, anomaly detection,
  and draft scope wording
- Require human approval before AI-derived data becomes active
- Add drawing/tender ingestion only after the structured estimating core has
  sufficient validated assemblies and benchmark coverage

## Immediate Next Sprint

The highest-value next sprint is a "trusted data spine":

1. Create a master manifest listing authoritative source files and their statuses.
2. Implement versioned material prices, productivity rates, and assemblies.
3. Implement an approval queue and audit events.
4. Convert cloud saves to record-level writes.
5. Run a real plumbing pilot and capture actual line-item results.

Success for the sprint is not more features. It is being able to answer:

"Which approved source and revision produced every number in this estimate?"

