# Camera verification belongs to publication

Status: controlled lifecycle contract verified at `e9f0597e`. Physical camera
closure retains the final clock and raw/observation identities. Its verification
reader is joined by camera source publication, so primary publication can proceed
while that reader finishes. Publication joins it even if cancellation was already
requested; discard still joins before releasing authority.

[Verification](verification.json) and the [archive](evidence.tar.xz) preserve an
actual acquisition-reader hold that failed on the original ordering, the corrected
readiness result, a cancellation-before-join mutant that escaped its held reader,
and corrected cancellation. Both regressions belong to the ordinary test roster.
Existing independent-source, refusal/retry and offline recovery consumers pass;
the two new cases also pass after root integration.

The initial three-second fixture had no usable acquisition checkpoint and is
explicitly preparation failure, not evidence of the defect. Seven seconds of
synthetic support opens the required checkpoint. Test escape timers bound failures;
they do not measure product latency. Complete controlled operands and original
executed-source records remain pinned. The frozen test binary stays private.

This changes the ownership of one wait. It leaves SDK stop, writer completion,
identity pinning, source validators and audio-role scheduling intact. It proves
independent readiness and reader lifetime, not a ten-second sustained Stop.
Measure remaining camera publication with the already retained source before
deciding whether another physical confirmation can answer a new question.
The [cost audit](cost-audit.json) separates required byte/clock revalidation from
unmeasured elapsed cost and defines that bounded trial. No optimization follows
from work counts alone.
