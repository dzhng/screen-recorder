# Camera permission row

The variable is the added Camera permission row in the production Settings form.
All captures use the same synthetic owner facts, fixed 560 × 780 native view,
aqua/darkAqua appearances and 1× offscreen bitmap. Screen and microphone are
allowed; Camera is undetermined. These are presentation facts, not host permissions.

`before/` was rendered from the unchanged production Settings/permission owner
before adding Camera. `candidate/` is the final production render through
`apps/macos/tests/settings-view-shots.mjs`. Both retain the five updater states,
initial viewport and scrolled bottom. The renderer checks actual scroll reachability.
`comparison/visual-parity-diff.json` records all same-named pairs; side-by-side
images preserve full framing. Metrics describe change, not acceptance.

The Camera row is fully visible and actionable in light and dark. Lower General
settings remain intact in bottom views. The initial viewport has a weaker
continuation cue; the final design keeps normal native scrolling. No speculative
scroll-flash modifier ships. Static shots do not prove discoverability or requests.
See [critique.md](critique.md) for the independent exact-set visual review.

Preview was invoked for the capture checkpoint, but the native automation service
could not find a Preview window. Preview quit cleanly at the end of that review.
The retained full images remain available for inline review; no human acceptance
is inferred from opening a file or from silence.
