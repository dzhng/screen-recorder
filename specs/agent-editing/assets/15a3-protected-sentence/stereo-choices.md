# Stereo assembly choice

## Sound — high confidence

**When:** protected-sentence authored stereo follow-up, 2026-09-30.

**The choice:** Use the existing FFmpeg encoder to wrap explicitly authored
Float32 samples in a WAV file. The sentence's original samples are copied into the
left channel; the right gets exactly half each sample's amplitude. The encoder
receives those already interleaved samples at their original rate and writes
Float32 WAV. A complete sample comparison proves the encoded file retains the
exact declared channels before it reaches the public import and project workflow.

**The gap:** The requested stereo control prescribed channel gains and public
processing, but did not prescribe how to create the source WAV container.

**The reach:** This evidence assembler requires the already installed encoder,
whose binary hash and actual arguments are retained. It adds no production
format writer or dependency installation. Future reproduction can verify the
encoded samples rather than assume an encoder preserves them.

**Verdict:** Sound. Reusing an existing encoder avoids another maintained WAV
writer, while all-frame equality prevents an unnoticed encoding or gain change.

**Confidence:** High.
