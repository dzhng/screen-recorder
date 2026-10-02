# Unchanged retained-sentence recognition

One additional fixed case represents the human-confirmed opening `um`. Raw text
is “Um so let's do the first paragraph. Uh this page is a recording fixture.”
All thirteen inherited sentence words remain in order after ignoring case and
punctuation; this is a baseline-output regression diagnostic, not independent
human spelling truth.

The six existing independent sentence edges fail the unchanged timing gate:
median 112.5 ms, p95 456.8 ms, worst 549 ms. The marked `um` end is estimated
153 ms early; its clip-censored onset is never scored. `paragraph`, `this` and
the middle `uh` are represented. The [evaluation](evaluation.json) retains
complete source ranges and signed errors instead of hiding the failed edges.

The [verification](verification.json) binds the packet, exact executed producer
and later verifier. It records genuine Models preparation from existing accepted
local files, zero fetch calls, actual full WAV support and 114,240 admitted mono
16 kHz samples. The unchanged worker supplies that count after its single
black-box inference; its internal converted PCM bytes are not exposed or hashed.
The WAV header and Float32 payload are separately pinned. Original/accepted
outputs, human marks, source/managed model bytes, receipt, runtime and worker
remain unchanged across the case.

Both actual native children have close events: metadata PID 44788 and recognition
PID 44793 exited zero. The producer also exited zero after preservation checks.
No service, SDK adapter, worker build, download, capture, playback, installed
switch or second inference was needed. The isolated home, source and complete
runtime remain outside Git at the paths in verification; preserve them.

The [plan](../../slices/12h-retained-sentence-recognition.md) owns the one-attempt
scope; [investigation](investigation.json) preserves the historical omission and
missing prepared/per-chunk authorities. This sentence case changes input
container, conversion/context and long-form chunking together relative to the
full narration. It therefore does not identify the historical cause or establish
causal PCM equivalence. No replacement recipe, general recall, timing acceptance
or parent/full-release completion follows. The failed gate ends the case.

[Choices](choices.md) records the storage and owner decisions. The toolkit makes
zero editorial decisions; this evidence does not authorize any removal or treatment.
