# Compiled acquisition masks in native video

The native worker validates the exact stream and source timestamp before applying
the compiler's occurrence-specific exclusion. A physically present picture marked
`source-unavailable` now renders background. A physical empty edit remains
background; unknown timestamps, unknown availability strings and unavailable
ancestors still refuse. The exclusion never changes the reused asset decoder.

This deliberately expands the old `unknown-acquisition` refusal: that assertion
fabricated `source-unavailable` on occupied media, which is now the valid result
of an explicit acquisition mask. It is replaced by an actual compiler-generated
same-bytes/context fixture plus unknown-state and out-of-support refusal checks.
No new availability enum, wire flag, media identity or timing calculation was added.

## Verification

The unchanged production harness at
[video.mjs](../../../../../packages/test-harness/editing/video.mjs) now also covers
context A's internal hole, context B's complete support and physical-only reuse of
the same file. The held-picture cases switch context without changing source time,
and the range-preview case starts/ends one microsecond beside mask boundaries.

The [before failure](before-failure.txt) reproduces `UNAVAILABLE` at the acquisition
fixture. The candidate [complete run](report.json) passes 18 temporal cases,
11 refusal cases, declared-color refusal, matched old-renderer decoded-pixel hashes,
production task cancellation and same-path restart. Ten-minute held output retains
one decoded sample and raster: 37,388,288 bytes peak RSS for three seconds versus
38,027,264 for ten minutes. No resource threshold was changed.

The native worker, cancellation executable and existing frame tests were built in
this isolated worktree. [Frame preservation](frame-preservation.txt) passed.
Independent `codex review --uncommitted` found no actionable defects; its attempted
native build was blocked by sandbox SDK/module-cache errors, so native build/run
evidence comes from the successful isolated builds outside that reviewer sandbox.
Focused harness lint, format and diff checks passed.

Run shape (with an empty output folder):

```sh
swift build --package-path helpers/mac --product screenrec-native
swift build --package-path helpers/mac --product ScreenRecorderCompositionVideoTests
SCREENREC_BASELINE_NATIVE=/path/to/before-worker node packages/test-harness/editing/video.mjs --case repeat-reorder --out /empty/evidence/folder
```

One full attempt observed A4 instead of A5 at existing `av-replacement` frame 31,
before acquisition cases. The [failure](transient-failure.txt) and its
[delivered movie](transient-failure.mp4) are retained. Five identical-request runs
against each before/after worker returned A5; the subsequent complete run passed.
[Repeated observations](transient-repeats.json) do not establish a cause or resolve
this transient frame issue. No assertion was relaxed or expected frame changed.

## Visual evidence

The target is occurrence-local picture membership: the masked use must omit A1,
while complete and physical-only uses retain it. Unmasked pictures retain their
orientation, counter and contain framing. The complete temporal contact-sheet set
is under [contacts](contacts); the [new occurrence movie](acquisition-occurrences.mp4)
and [counter crop](masked-and-full-crop.png) retain the changed surface.

[Matched-source telemetry](comparison.json) compares equal source instants. Masked
versus complete differs over 75% of frame pixels above grayscale delta 16; unmasked,
resumed and physical-only comparisons have mean grayscale differences below 0.18.
Against the intended support, the candidate is less wrong: it delivers the masked
background instead of refusing the requested artifact, without removing later uses.

All agent slots were occupied for this bounded pass, so screenshot-critique's
no-reviewer fallback was applied to the three new complete contact sheets:

- Strongest concern: the black run might include an adjacent retained picture.
  The counter resumes at A2, and the separate one-microsecond boundary window
  retains A0 before the hole and A2 at its end; no visible extra counter is lost.
- Strongest concern: reusing the decoder might suppress later complete uses.
  Both later runs visibly contain A1 with unchanged corner markers and framing.
- Strongest concern: a held sample might retain stale pixels across a mask change.
  The held sequence visibly changes black → A1 and A0 → black → A2 at the named
  context/boundary transitions; no residual counter appears in the black cells.

This is native execution evidence, not public CLI/MCP or full slice-10b acceptance.
No capture, desktop screenshot, playback or user-library operation was performed.

### Fresh visual integration review

A subsequently available unprimed reviewer inspected all 18 contact sheets and the
enlarged crop, without code, history or expected verdicts. It found no definite
visual corruption: upright readable counters, consistent corner markers, clean
shape changes and completely black excluded tiles without leftover pictures.
It explicitly could not establish intended edit timing, distinguish intended holds
from stalls, or verify audio from these stills; the native timing/PCM gates own
those claims. Root inspection and the retained numerical comparisons agree with
its visible observations. The existing transient frame mismatch remains unresolved.
