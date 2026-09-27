# Editing fixture corpus

Run the [generator](fixtures.mjs) with `--out DIRECTORY`; add `--verify` to
check the frozen media and real-source hashes without regenerating them.
Run `node --test packages/test-harness/editing/fixtures.test.mjs` from the
repository root for byte-repeatability, decoded timing/geometry/audio, and
deliberate-tampering checks. These commands do not launch the app or play audio.

The [hand-written oracle](expected.json) is separate from the generator so a
timing mistake cannot manufacture its own expected answer. Its composition
scenario is input for future compiler tests, not evidence of a working editor.
The frame sheets show every decoded numbered frame in presentation order.

The MOV fixtures use H.264 High-profile YUV420 pixels and uncompressed PCM so
later tests can inspect sample membership without AAC delay. Lossless H.264 would
require the less portable High 4:4:4 Predictive profile; lossy color decoding
instead has an explicit small tolerance. Separate WAVs let audio replacement
tests choose sound independently of the picture. The existing deterministic raster
font avoids machine-specific font rendering.

A timestamp gap is not an acquisition gap. The gap movie lets a decoder hold the
preceding image while the explicit synthetic source-evidence interval says the
content was unavailable. Native empty edit-list fixtures and real capture evidence
remain separate gates. Transparent stills likewise expose geometry/alpha only,
not proof that a renderer handles them.

Real narration is hashed where it already lives, never replaced with synthetic
speech or duplicated into this compact corpus. Independent speech labels, native
preservation results and visual review belong to the slice's evidence report.
The manifest records the source commit at generation and encoder versions;
regenerating with another encoder version may change bytes without changing
decoded content. The tests prove repeatability with the installed toolchain.
