# Readiness checker failure settlement

The readiness checker must save a failed report even when its source child exits
before reporting startup or cleanup rejects. Child failure cannot become readiness,
and successful verification still requires a zero source exit. The lifecycle
owner in [the checker module](../../../../../packages/test-harness/editing/parakeet-readiness-processes.mjs)
concentrates startup, SDK connection, terminal observation and report finalization.
It consumes the SDK's existing error and close callbacks without replacing its
transport or changing its deadlines.

[Verification metadata](verification.json) identifies the frozen preparation
packet, source pins and every payload in [the supplemental archive](evidence.tar.gz).
The archive contains the actual producer, the two reproduced original failures,
and corrected actual-child controls. Fixtures are synthetic startup scripts; they
perform no model preparation, inference or native operation. Their driver bound
is five seconds; SDK defaults and the existing readiness budget remain unchanged.
These controls establish checker failure behavior, not another readiness or
quality result. Original source, library, runtime and preparation evidence remain
retained under the original packet's authority.

[Choices](choices.md) explains the maintained module seam; [review](review.md)
states its verification limits. Run the focused controls with `node --test
packages/test-harness/editing/parakeet-readiness-processes.test.mjs`.

The [merged verification](merged.json) and [root control packet](merged.tar.gz)
retain actual merged child results and root integrity/source checks. They preserve
the original readiness producer rather than claim another preparation run.
