# ContractorOS Controlled Estimating Pilot v1

## Objective

Prove that ContractorOS can move from a measured scope to an auditable,
bottom-up estimate without silently relying on benchmark pricing. The pilot
uses one decking assembly and one plumbing assembly because they represent two
different governance states.

## Pilot boundaries

| Pilot | Estimate unit | Assembly | Baseline | Authority state |
| --- | --- | --- | --- | --- |
| Deck | m2 | `DCK-001` | 25 m2 | `exploration_approved` |
| Plumbing | kit | `PLB-KIT-001` | 1 kit | `approved_locked` |

`DCK-001` is deliberately retained as internal-only. A successful calculation
does not justify client use or locked promotion. `PLB-KIT-001` is the
componentised plumbing pilot; `PLB-000` remains the package roll-up and not the
input for this validation exercise.

The current drawing-backed deck test case is 84 m2. New stairs and a ramp are
shown on the drawings and are not part of `DCK-001` unless separately measured
and represented by governed assemblies.

## Required workflow

1. Capture the actual project scope in the relevant intake CSV. Every required
   field must have a measured value, drawing reference, site observation, or a
   recorded allowance with owner approval.
2. Confirm the assembly selection. Do not price materials outside their
   assembly context and do not substitute a top-down benchmark for a recipe.
3. Reconcile every material, labour, plant, logistics, consumable, compliance,
   waste, risk, contingency, and margin driver. A zero value requires an
   explicit `not applicable` basis; it is never implied.
4. Check each rate and productivity record for source, effective date,
   geography, unit, confidence, and authority state.
5. Run the estimate. Preserve the output, rate snapshot, warnings, and source
   lineage in the reconciliation record.
6. Obtain a QS comparison against a current supplier quote, subcontractor
   quote, or completed-project actual. Explain all material variances.
7. Record a recommendation. Only the owner may promote, correct, or withdraw a
   governed record.

## Source hierarchy for this pilot

1. Project drawing, site measurement, engineer detail, supplier quotation, and
   executed subcontractor quotation control a project estimate.
2. Approved ContractorOS source records may support component selection and
   existing locked pricing.
3. The 14-file Drive corpus provides classification, historical benchmarks,
   productivity research, and reference case data. It must not override current
   project or supplier evidence.
4. Unverified research, historical rates, and broad material lists remain
   reference-only or assumption-grade until reviewed and promoted.

## Non-negotiable gates

| Gate | Deck pilot | Plumbing pilot |
| --- | --- | --- |
| Scope complete | Dimensions, height, bearing/support method, access, slope, foundation detail, board direction, finish, and balustrade/interface requirements confirmed. | Fixture schedule, quantities, connection locations, pipe material and diameter, hot-water scope, access, testing, and exclusions confirmed. |
| Unit normalised | Board, beam, screw, fastening, and m2 quantities reconcile to the drawing and recipe. | Each fitting, accessory, labour hour, and kit component reconciles to `ea`, `m`, `hour`, or `day` as applicable. |
| Rate current | Deck material and crew evidence is current, local, and quotation-backed. | Existing locked records are checked against current supplier availability and project-specific specification. |
| Productivity credible | Crew composition, elapsed duration, access, height, cutting, and rework conditions are recorded. | Installer role, elapsed hours, testing/commissioning time, and fixture complexity are recorded. |
| Reconciliation complete | ContractorOS result compared to a current quote or actual completed deck. | ContractorOS result compared to current supplier/installer evidence or actual completed fixture kit. |
| Client output | Blocked until owner promotion to `approved_locked`. | Permitted only if the project scope matches the governed assembly and all project-specific exceptions are stated. |

## Completion criteria

The pilot is complete when both rows in `pilot-reconciliation.csv` contain:

- a traceable project or test reference;
- a QS-reviewed scope intake;
- the controlling quote or actual result;
- a variance calculation and explanation;
- identified correction actions with owners;
- an explicit recommendation to retain, stage a correction, or seek locked
  promotion.

No pilot result updates a rate, productivity record, commercial rule, or
authority state automatically.
