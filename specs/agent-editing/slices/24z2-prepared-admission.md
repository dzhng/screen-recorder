# 24z2 — Prepared audio admission work

Status: bounded-work implementation verified at the prepared request consumer;
the existing large-recipe deadline remains red. Exact checks, source identity,
failures and review are retained in the [evidence packet](../assets/24z2-prepared-admission/README.md).
[Root integration](../assets/24z2-prepared-admission/merged-verification.json)
adds the merged focused regression and full-sample public WAV lifecycle proof.

## Resource identity and occurrence identity

A recipe preserves each authored clip occurrence, including its source window,
placement and processing graph. Retention protects the underlying resources,
which are identified by both kind and ID. Reusing one asset across clips must
not repeat the same catalog write or erase a clip from the execution recipe.
Asset and acquisition identities remain separate even when their ID text is equal.

[PreparedAudioStore](../../../packages/core/src/prepared-audio.ts) owns this
distinction. Its dependencies contain each selected resource once; the generic
reference owner and its recovery/retry lifetimes retain their existing behavior.
Selected processing prerequisites remain part of the dependency inventory.

## Immutable admission context

Retained resolution and fresh preparation use one resolved immutable composition
inside a request. A fresh window binds the current renderer through the existing
composition owner. Execution still resolves the pinned revision independently:
an admission object is neither a persistent cache nor a substitute for execution
validation. Restart, cancellation, retained output lookup and package adoption
keep their existing owners.

## Acceptance boundary and next pickup

The [prepared consumer tests](../../../packages/core/src/prepared-audio.test.ts)
guard bounded admission work with a small repeated-resource project and complete
recipe/resource comparisons. They preserve queued restart and ordinary completion.
Existing tests own cancellation, terminal publication fencing, retained reuse,
portable adoption and independent recipient reads after donor output removal.

The unchanged many-clip recipe test was run once after the material fix and still
exceeded its original deadline. Work-count reduction does not establish that
deadline or explain either original timeout. No timing cohort or default changes
were made. Next work must identify the remaining expensive phase before selecting
another owner change; this pass adds no timeout diagnosis beyond its work proof.
