# Public layer delivery

The [public journey](../../../../packages/test-harness/editing/layers.mjs) authors
projects through the actual CLI/MCP service and checks delivered media against
the shared independent source-decode/geometry oracle. It does not inspect compiled
transforms or use renderer receipts to construct expected pixels. Both transports
must deliver identical PNGs; public stills also match the accepted native captures.
The geometry thresholds remain those of the original fixture oracle.

Full and fractional-range previews carry the global picture clock. Every decoded
preview picture is checked geometrically; H.264 color error is measured separately
and does not close general codec/color acceptance. Public WAV excerpts preserve
exact stereo source PCM. Full exports must copy the checked preview bytes, since
public exports currently select a whole revision rather than a range.

Imported assets must survive donor-path removal, restart, historical revision
reads and project deletion. Deletion revokes service deliveries while preserving
committed external exports and retained source bytes. The journey renders those
sources again in a fresh project, so catalog-row survival alone cannot pass it.

[Evidence](./verification.json) records the exercised subset, negative controls,
worker identity and public reports. Visual sheets contain every captured source,
frame and decoded movie state, with enlarged geometry details. This checkpoint
covers static presenter and processing-stack delivery; source-attached pointers,
image-asset execution, animation and wider final-alpha/movie profiles remain open.

Run with a frozen `SCREENREC_NATIVE` and a fresh `--out` directory. The harness
uses a disposable service home and never captures the desktop or plays audio.

The [choice ledger](./choices.md) states the acceptance boundaries. Independent
review tightened end-of-movie duration, WAV format and restarted-layout checks;
the final full run passes those stronger assertions. Fresh visual review covered
the complete capture set. Its thin overlap remnants and edge observations match
independent expected support, with targeted maximum errors of zero or one code
value; these were not dismissed from appearance alone.
