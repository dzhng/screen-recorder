# Learned processing through deep and wide routing

The bounded cohort joins the previously separate topology and learned-processing
contracts: 512 real occurrences overlap across 32 tracks over eight seconds,
routed through 128 nested groups, the existing ordered reciprocal-gain stacks,
and one RNNoise step on the combined root parent. Synthetic source samples and
authored offsets independently predict the complete dry Float32 sum. Both full
dry PCM and every prepared sample match their respective independent oracles;
the learned oracle is the unchanged frozen C reference, run separately per lane.
No processing implementation, model, tolerance or performance budget changed.

The cohort is verified by the original bounded public run **plus continuation of
its same saved publication**, not a fresh invocation of the final corrected
harness. The final harness received syntax checks and independent static review;
its bounded comparison helper was exercised separately. The old gain-only scale
runner consumes the extracted shared topology; its operation array was checked
exactly against the prior implementation without repeating the long-duration run.

## Evidence and limitations

`report.json` summarizes the evidence boundary; complete original reports,
requests, source media, dry/prepared/late PCM, reference inputs/raw outputs,
retained catalog, diagnostic scripts and reviews are in `evidence.tar.xz`.
`artifact-files.json` authenticates each member. `verification.json` pins commands,
source/native identities and archive verification. The frozen reference binary is
also retained, recovered exactly from the existing 24f metadata archive after its
temporary copy disappeared; no model or library was replaced or downloaded.

The first comparison run was manually stopped when a deliberate failing
multi-megabyte Buffer assertion expanded its diagnostic to roughly 20.5 GB RSS.
Saved dry PCM was already exact. The bounded helper now checks byte equality and
reports only first differing frame/channel, lengths and hashes. Its 3,072,000-byte
negative control produces a 270-character diagnostic; no tolerance changed.

The next public run passed the dry oracle and cached 250-row inspection, then
returned INTERNAL_ERROR while reading an already-ready prepared publication.
Scratch owner tracing identified ELOOP from a noncanonical `/tmp` test home under
the existing no-symlink file boundary. The harness now canonicalizes its home.
Continuation used the same catalog/project/revision and publication through its
`/private/tmp` path, with both learned-capability and composition-mixing operations
unavailable. It read and checked the complete prepared PCM, restarted again, and
verified the final 12,000 stereo frames through a **retained asset selector**.
This is not post-restart project-tap replay. Learned DSP was not rerun.

Measured cached inspection p95 was 12.51 ms against the unchanged 250 ms target.
Native preparation receipt peak RSS was 95,518,720 bytes; sampled service peak
was 406,798,336 bytes. Continuation retained lookup took 69.5 ms, independent C
reference 509 ms and late delivery 212 ms. These are diagnostic observations with
host/observer effects, not a new learned-processing SLA. Original preparation
wall time was not retained because the subsequent read failed. Public prepared
receipts do not retain sourceWork, so no decoder or input-I/O work claim is made.

This verifies the short cohort, complete output, stable retained identity and
retained delivery without processing. It does not prove two-hour deep/wide learned
work, arbitrary learned-stack combinations, listening quality or general memory
scaling. Independent reviews found no actionable defect after the harness fixes.
