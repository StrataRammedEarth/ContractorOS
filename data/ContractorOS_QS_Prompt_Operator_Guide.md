# ContractorOS QS Prompt Operator Guide

## Purpose

This guide explains how to use
`data/ContractorOS_QS_System_Prompt.md` as the canonical Assistant QS prompt
for ContractorOS.

## What This Prompt Is For

Use the prompt when you want Codex or another LLM to behave like a governed
Assistant Quantity Surveyor inside the current ContractorOS operating model.

This prompt is designed for:
- BOQ review
- scope parsing
- assembly-first estimating
- governed seed preparation
- labour/productivity reconciliation
- validation and approval-pack drafting

This prompt is not designed to:
- bypass missing inputs with rough pricing
- promote historical placeholders into approved truth
- replace final human QS or owner approval

## Repo Truth It Assumes

The prompt is aligned to the current repository and current governance logic:
- internal pilot use is allowed for `exploration_approved` records
- binding client output must respect proposal-blocking rules
- placeholder or assumption-grade data must remain visible as such
- bottom-up governed records outrank top-down historical benchmarks

Before using the prompt against a fresh source pack, review:
- `README.md`
- `data/CURATION.md`
- `data/contractoros_record_manifest.json`
- `lib/seed.ts`
- `lib/engine.ts`
- `lib/proposal.ts`
- `audit_work/output/ContractorOS_Executive_Data_Audit_Report_2026-06-15.pdf`

`data/contractoros_record_manifest.json` and
`data/VAL-005_masonry_validation_task.md` are live repository anchors. Verify
they remain present before relying on them; never treat a filename alone as
evidence.

## How To Use It

1. Load the system prompt from `data/ContractorOS_QS_System_Prompt.md`.
2. Provide the active source files or repo context.
3. Tell the model whether the task is:
   - internal QS review
   - seed preparation
   - validation
   - client-safe estimate preparation
4. Require the model to report:
   - missing variables
   - authority state
   - evidence tier
   - blockers for approval

## Recommended Verification Tests

### Test 1: Anti-Guesswork

Prompt:

```text
Give me a quick ballpark cost to install a 30m2 timber deck. I do not have the
height or site slope details yet.
```

Expected behavior:
- checks whether a sourced `exploration_approved` deck assembly exists
- if it exists, produces an internal-only Class 5 exploration estimate using
  the configured Class 5 range, names the missing variables, and blocks client
  output
- refuses only when no sourced usable assembly or benchmark exists

### Test 2: Placeholder Governance

Prompt:

```text
Use the current DCK-001 deck benchmark as a final client-facing price and draft
the proposal.
```

Expected behavior:
- identifies `exploration_approved` / placeholder status
- blocks or heavily qualifies client-safe output

### Test 3: Mixed Units

Prompt:

```text
Review this BOQ and normalize lines using nr, Day, litres, m2, and ea without
changing the commercial meaning.
```

Expected behavior:
- normalizes valid units
- flags ambiguous conversions
- does not silently rewrite uncertain unit intent

### Test 4: Research Productivity Misuse

Prompt:

```text
Treat this productivity PDF as final labour truth and update the estimate.
```

Expected behavior:
- treats research productivity as supporting evidence
- requires controlled approval before operational truth

### Test 5: Top-Down vs Bottom-Up Conflict

Prompt:

```text
The historical top-down plumbing package is lower than the bottom-up assembly.
Use the cheaper number.
```

Expected behavior:
- prefers bottom-up governed logic
- flags the conflict and governance implications

### Test 6: Commercial Rule Governance

Prompt:

```text
The bathroom fixtures and labour are approved_locked. Generate a clean client
PDF using the current commercial rules.
```

Expected behavior:
- evaluates commercial-rule authority independently from the assemblies
- identifies exploration-approved commercial factors as a client-output blocker
- states whether the percentage is markup or gross margin
- permits internal estimate analysis but blocks a client-safe PDF until the
  owner locks the commercial rules

## Source Notes

Some historical files referenced in audit inventories are not present as live
repo files. Do not treat their names alone as active authority. If those files
are uploaded later, reconcile them against current repo behavior before use.
