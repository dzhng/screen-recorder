# Confirm audible boundaries with waveform clicks

The listener requested a task requiring only waveform clicks and Next, and
reported an additional opening “um”. The page presents one boundary at a time.
A click selects the blue line and plays a bounded preview starting exactly there; Next
confirms the selection and advances. The final Next saves the confirmed marks
locally. Back allows correction and Skip preserves an unclear edge as unknown.
No timestamps need typing, no checkbox or separate save form is required, and
loading the page starts no sound. The complete unchanged original remains in
browser memory after loading.

The user explicitly chose playback from the clicked point, replacing the initial
lead-in. The [playback update check](click-preview-update.json) records an actual
muted click whose selected and initial playback positions are identical; its
[capture](click-preview-check.jpg) is a synthetic probe, not human timing evidence.

The opening filler began as a listener-reported target. Its
[actual independently marked range](../12d-human-marks/README.md) is now retained
alongside the other requested human boundaries.
The server owns target identity and filler classification; the shared annotation
clock exports only fully marked confirmed filler ranges. Skipped or partial
edges cannot become independent ranges. The sentence target still covers
“So … recording fixture”, excluding the opening filler. This bounded clip cannot
prove a complete corpus inventory or repetition/removal intent. Human mark
reconciliation closes only the scoped sentence/neighbor-label requirement.

[Root verification](root-verification.json) covers real muted browser clicks,
stable selected points while previews run, progression, Back, invalid endings,
skips and successful saves after deliberately stopping and restoring an isolated
server. Synthetic exports retain the opening filler alongside “uh” and preserve
unknowns. A focused new export regression failed for the missing opening filler
before the fix; the default harness then passed bootstrap and fourteen tests.
All test positions and records are synthetic and excluded from ground truth.
The user output directory receives no synthetic saves.

[Current page](page-preview.jpg) shows the actual user framing. The
[complete verification archive](verification.tar.xz) contains all captures and
enlarged control crops, synthetic export checks and retained test output. The
initial candidate changed 565,567 pixels relative to the prior form viewport.
The fresh visual critic found overlapping historical marker labels and a stale
completion heading; current captures resolve both. Confirmed boundaries use gray
lines with a separate legend, so labels do not collide with the blue selection.
The actual narrow user view keeps the waveform, selection and Next together.
No audible listening acceptance is inferred from muted playback or screenshots.

Shape/diff/docs review keeps one owner for steps and target identity, one owner
for preview cancellation, and the existing shared owner for original-clock
conversion. The old input rows, checkbox and form-save path are removed. No new
dependency, permanent service or model was added. The configured Codex CLI
review remains unavailable after its unsupported-model rejection; no successful
CLI review is claimed. The [manifest](manifest.json) pins the initial guided page;
the playback update check pins the current preview owner. Earlier
marking manifests remain historical evidence. Broader corpus labels, intent and
quality evaluation are the next pickup.
