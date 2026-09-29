# Bounded voice settings experiment

This checkpoint establishes observable termination and forwarding for the pinned
reference-conditioned generator. It does not enable public settings or establish
reference/text/resource limits, naturalness, linguistic correctness or acceptable
latency. The production worker and frozen runtime were not changed.

The observer watches the executed EOS `break` and subsequent loop-exit line in
the hash-verified generator. It reads Python locals without evaluating an MLX
value or changing a branch. The two frozen word/phrase WAVs remain byte-exact,
as does the phrase with requested repetition penalty changed from 1.05 to 1.5.
Both requests actually use 1.5. A forced one-token budget reaches loop exhaustion
without executing the EOS branch: its 80ms of output must not be called a complete
utterance. EOS itself still does not prove that every requested word was spoken.

The meaningful sentence throughout the controls is “Okay, so this is the recorder
workbench.” Its original reference is already retained in the frozen18 corpus.
The default sentence reaches EOS after35 generated codes (2.8 seconds); changed
seed19 reproduces all output bytes in a fresh process. Greedy temperature and
single-choice top-k produce the same PCM here, consistent with their argmax
behavior. Other sampled controls produced distinct outputs; a changed hash does
not by itself establish quality or causation. Requested/effective locals and
source-backed filter behavior are retained in [the report](report.json).

Top-k is enabled separately for the main and residual codebooks, whose vocabulary
sizes differ. Nonpositive temperature bypasses both probability filters. Requested
top-p1 bypasses its filter. These are source semantics, not newly measured safe
public numeric ranges. Streaming, ignored kwargs, non-English quality and longer
reference/context envelopes remain unverified.

## Reproduction and evidence

[The runner](../../../../packages/test-harness/editing/voice/settings-run.py)
accepts explicit `--bundle`, `--model`, `--out` and `--tranche termination|controls`.
It starts fresh serial sandboxed processes and retains every attempt; preparation
must already exist. Use `--verify-only` with an existing output directory to
validate receipts and complete WAVs without inference. It writes a separate
verification receipt and does not replace original attempts. The initial trials
used the retained scratch controllers before promotion into this runner; their
exact commands and sources are archived, not retroactively attributed to the
promoted controller.

[The archive](evidence.tar.xz) retains all thirteen complete WAVs, requests,
receipts, logs, original controllers, exact observer source used, and a negative
control that falsely labels the one-token cutoff EOS. Offline verification
rejects that mutation. Every archive member was compared against
[its size and SHA256](artifact-files.json). Reference/runtime/model identities
are recorded per attempt; the supplied relocated19b runtime remains separate
from the model. No installation, download, playback or public publication occurred.

Timings include preparation verification/model loading and observer overhead in
a fresh process with existing system caches. They are diagnostic, not a warm
resident-model benchmark or proof of the parent RTF gate. Full generator output
is retained even on budget exhaustion for this experiment only; public generation
must establish its incomplete-output refusal before publication.

The independent [harness review](review.log.gz) found no actionable correctness
issues. Shape review kept this as one experimental observer and one serial
controller; no alternate production worker or lifecycle was added.
