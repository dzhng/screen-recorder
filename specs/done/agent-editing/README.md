# Agent-operated media toolkit

This closed record explains the toolkit's rationale and retained acceptance.
[Current ownership](../../../README.md#where-things-belong) and source schemas guide
implementation; the original [build plan](https://github.com/dzhng/screen-recorder/tree/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing)
and [release-era contract record](https://github.com/dzhng/screen-recorder/tree/c08e0bd8e10903d482232818ccfffaf1d653555a/specs/done/agent-editing)
retain exact historical proposals and declarations.

## Rationale and invariants

The [architecture rationale](architecture.md) explains the separation between
caller intent, pure composition, durable ownership and native execution.
[Cross-owner contracts](contracts.md) explain the distinctions those components
must preserve. [Processing](processing.md) owns state-domain and portable-result
rationale. Operation availability and parameter shapes remain code-owned.

The [decision ledger](choices.md) records source-reconciled choices at closeout,
including scenarios and confidence. It is an audit record, not another command
catalog or an instruction to reproduce temporary development owners.

## Retained evidence and visual standards

The [preservation registry](assets/23-owner-fixture-ports/README.md) binds scoped
publication, delivery, lifecycle and scale results to their actual candidates.
The [evidence directory](assets/) owns the complete retained packets.
The [release disposition](release-closeout.md) explains accepted limitations;
[acceptance evidence](assets/acceptance-maintenance/release-gates.md) owns the
underlying observations. Original failures remain distinct from later recoveries.

[Reference-style evidence](assets/reference-style/README.md) records the user's
visual brief. [Sampled visual review](assets/25b-fresh-caller/fresh-visual-review/README.md)
and [temporal comparisons](assets/25b-fresh-caller/temporal-review/README.md) retain
matched frames and intervals. These are fixture standards, not product-selected
styling or general perceptual acceptance.

[Current verification tools](../../../packages/test-harness/README.md) own executable
reproduction. Archived producers preserve the paths and bytes associated with
historical results. Large operands held outside Git retain their recorded archive
identity and transfer requirements; an unavailable operand cannot become a pass.
