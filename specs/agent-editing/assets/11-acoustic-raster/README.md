# Acoustic raster evidence

The native headless renderer consumes measured waveform buckets or spectral density, without opening audio or changing channels. The core request adapter supplies exact source/project provenance and clips missing-support overlays to the displayed range. PNG encoding/publication shares the existing picture owner.

`helpers/mac/Tests/acoustic-image.test.mjs` generates the retained stereo reference: distinct 750/3000 Hz tones and a right-channel impulse at sample 102000 (2.125 seconds). The actual native wire test checks full/detail absolute clocks, channel separation, unclipped amplitude, missing-support union, exclusive output publication, long provenance, and energy narrower than a raster pixel in both dimensions. `pooling-mutation.log` proves that replacing maximum pooling with last-value wins loses the only narrow energy cell. The final native test passes. `picture-parity.json` compares the shared encoder's source-frame output byte-for-byte with the frozen original native binary; `native-preservation.log` covers the existing frame tests.

Full screenshots and twice-sized crops cover every generated visual state. `visual-changes.json` proves the final label/headroom adjustments changed the actual native PNGs. Provenance can be arbitrarily long within the bounded receipt: the image visibly abbreviates long text while the receipt retains it exactly. Plot limits leave five percent headroom above measured peaks exceeding the default full-scale range. Frequency labels use plain Hz.

These are renderer and request-adapter checks. Public acoustic image delivery, cache lifecycle, agent use and listening acceptance remain separate gates. No capture, installed-app launch, playback or model execution was used.
