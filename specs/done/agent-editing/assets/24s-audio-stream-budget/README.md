# Retained 300-second streaming gate

The exact retained gate passes on source commit `7bfcd911`. The complete harness
finishes in 12.62 seconds, including source generation, the 10-second and
300-second native cases, independent WAVE checks and source hashing. Each child
still has its original 60-second timeout. This is whole-harness elapsed time,
not an invented individual-worker timing.

The Node harness is byte-identical to checkpoint `0147c63`, and the Swift
`streamingProof` function is also byte-identical. Only unrelated reference-helper
code elsewhere in that Swift file changed. `verification.json` records those
checks, commands, compiler/runtime versions and the exact debug executable hash.
No production code, test, timeout, tolerance or memory threshold changed here.

The 300-second case returns the expected 14,397,184 retained frames, with a
maximum block of 8,192 frames. Native peak RSS is 29,999,104 bytes versus
26,984,448 for the 10-second case, satisfying the original scaling assertion.
Native sampled error is 1.49e-8; independently sampled WAVE-window error is
4.66e-10, within the unchanged 1e-5/1e-6 limits. Source bytes are unchanged and
both cases propagate sink failure after three blocks without reporting completion.
These are the original sampled numerical oracles, not a new assertion of
sample-by-sample equality across the entire output. Optional old-WAVE baseline
comparisons were not requested and report zero.

`evidence.tar.xz` contains the source and complete generated WAVE outputs directly
from the run, compressed once rather than duplicated as loose PCM. The reports
are also readable beside it; `artifact-files.json` identifies every archived file
by size and SHA-256. Build and execution logs include the successful exit and
whole-harness resource measurements. The source is synthetic stereo tones;
no devices, playback, installation or downloads were used.

The [original failure and 87.209-second diagnostic](../00-baseline/audio-fix/review.md)
remain unchanged. This rerun does not attribute the speedup to a particular
intervening change and does not establish concurrent-load immunity, the separate
storage-inventory gate, or broader scale completion. Review confirmed the exact
old contract, evidence identities and this scope boundary; no new implementation
needed code review or additional speculative benchmarks.
