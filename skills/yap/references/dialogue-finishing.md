# Match dialogue before mastering the mix

Measure each selected host independently. A whole-program loudness pass can hide
one quiet speaker. Select representative **processed clip** taps at a pinned
revision with `audio.measure`; deliver each ordinary JSON file with `--output`.
Keep its range, audio generation and signal recipe. Repeated or retimed source
clips are distinct occurrences: measure each occurrence on its own project grid.

Run [`dialogue-proposals.mjs`](../scripts/dialogue-proposals.mjs) with the bundled
Node. Supply `projectId`, `revisionId`, `targetIntegratedLufs`, explicit
`gainBounds:{minimumDb,maximumDb}`, `truePeakCeilingDbtp`, `peakPolicy`,
`minimumDurationUs`, and `clips:[{clipId,evidence}]`. `evidence` is the delivered
JSON, with `measurement` at its root; it is not the operation's metadata envelope.
Use the selected occurrence IDs from the current revision. Run `--help` for usage.

`peakPolicy:"refuse"` produces no gain draft when predicted true peak would
exceed the ceiling. `"cap-gain"` explicitly permits a lower gain; its constrained
proposal states that the requested loudness was not met. Neither policy inserts
a limiter, compressor or normalization. Outside gain bounds, short selections,
unmeasurable loudness and missing support remain explicit exceptions. Choose the
minimum useful duration for the material; there is no universal dialogue target.

The helper returns evidence pins, the original measurement, a gain draft and
predicted loudness/peak for that **measured selection**. It never calls the CLI or
applies edits. A short representative selection cannot prove the full clip or
full mix. Predictions assume appending static gain after the measured clip stack;
adding another processor afterward invalidates that prediction.

Inspect the selected target's current ordered steps. Explicitly append the chosen
`gainStep` through `processing.set`, keeping existing step IDs and omitting IDs
for the new draft; submit against the proposal's pinned revision. This operation
sets the whole stack, so do not discard existing compression or other effects.
A stale revision needs new evidence, not a replaced revision ID. Re-measure the
applied clip selections before balancing music and mastering the complete mix.

When compression is explicitly selected, discover `makeupGainDb` through the
installed processor schema. It is post-compression gain in dB; omission is unity.
It changes the processor's output, rather than automatically matching a loudness
target. Measure after it before proposing another gain. Excess makeup can raise
peaks. Bypass preserves dry audio and cannot retain an implicit makeup gain.

Prepare and measure the complete final mix with the requested mastering recipe.
Strict refusal requires investigation or an explicit revised treatment within the
brief. A compliant PCM master does not guarantee the encoded file's true peak;
measure decoded delivery separately and retain each meter's identity.
