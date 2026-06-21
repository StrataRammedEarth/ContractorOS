# Controlled Estimating Pilot

This pack trains and validates the ContractorOS estimating workflow on two
bounded assemblies before it is copied to other trades.

| Pilot | Assembly | Current authority | Output rule |
| --- | --- | --- | --- |
| Deck | `DCK-001` Deck Construction | `exploration_approved` | Internal pilot only. It cannot be used in client output or promoted until its recipe, productivity, and project reconciliation are approved. |
| Plumbing | `PLB-KIT-001` Standard Plumbing Fixture Kit | `approved_locked` | May be used in governed estimate output, subject to project-specific scope and supplier confirmation. |

Run the pilot using `estimating-pilot-v1.md`, request and register the required
evidence in `pilot-evidence-register.csv`, complete the appropriate scope
intake CSV, and capture the result in `pilot-reconciliation.csv`. Do not alter
locked pricing automatically from a reconciliation result.

`pilot-rate-candidates.csv` contains reviewed procurement-list matches. These
are evidence for a QS review, not project quotations or approved rate changes.
`pilot-component-coverage.csv` is the operational sourcing backlog for the two
assemblies.
`deck-threaded-bar-conversion.csv` controls the raw-bar to cut-length rate
derivation; it must be completed before `DCK-B03` can be revised.
`deck-post-beam-connections.csv` records the confirmed single and double
post-bearer geometry and separates their threaded-bar requirements.
`pilot-rfq-request-pack.md` is the controlled collection brief for the
remaining supplier and contractor evidence.
`pilot-quote-intake.csv` is the line-level capture sheet for returned RFQs and
contractor quotes; do not copy quote values directly into seed records.

The pilot is complete only when a QS has signed off the scope, a current
supplier or contractor quote has been compared, all material variances have an
action, and the authority state is reaffirmed or explicitly changed by the
owner.
