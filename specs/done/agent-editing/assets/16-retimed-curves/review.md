# Review and decision audit

The settled change adds focused public media checks and a shared deterministic counter fixture. It changes no processor, compiler, registry, schema, native binary or installed application.

## Verification and review

The complete retimed gain and zoom runs pass on the frozen 0525dfb9 worker. Three deliberate public-input controls fail for their intended reasons: replacing cubic gain with linear gain changes PCM by 0.010497 at the first active tested sample; delaying the zoom's ending key moves a measured edge three pixels from its expected location, exceeding the unchanged two-pixel bound; shifting the physical source sequence produces counter 1 where counter 0 is required. Their scripts, failed reports and logs are in `negative-controls.tar.xz`; no mutation script remains on the production harness path.

Two preliminary failures were harness errors, not production defects: the content window initially used `range` instead of the existing `sourceRange` field, and the initial packet assertion assumed rational 30fps packet stamps despite the documented microsecond output clock. The corrected packet check compares exact visible intervals while retaining an independent exact-frame source oracle. One negative-control launch inherited Node's incompatible `--input-type` flag into the service; the file-based rerun reached the intended PCM assertion. Those failed attempts are retained.

Shape review kept each focused journey in its own module behind the existing runner, and extracted the counter raster only because two real consumers need it. The extraction preserves all 240 original A/B frame buffers exactly. Independent root review requested complete full/range error measurements and one owner for picture/event constants; both were added and the final public runs passed. Lint, syntax and diff checks pass. The separate Codex CLI review could not run because its configured model was rejected by the account with HTTP 400; this is not credited as review coverage.

The fresh visual reviewer inspected all 20 direct full/crop pairs, four full sheets and all 17 decoded sequence sheets. It reported:

- High confidence: the full movies have a completely black lead-in through frame 14; images alone cannot establish intent. This matches the explicit half-second move, and every lead-in frame is numerically checked as black.
- High confidence: counters and edges show thin gray/dark fringes and uneven pixel-step thickness at crop scale. Full-frame labels remain readable. This is retained as a scaled/encoded appearance limit, not dismissed as exact color parity.
- High confidence: no clipped text, missing bit markers, torn edges or obvious distortion; all counters, labels and eight bit markers remain visible and distinguishable.
- Moderate confidence: geometry grows progressively without an isolated size or position jump; the project-clock control grows earlier and holds. The numerical all-frame gate, rather than this visual judgment alone, establishes the trajectory.
- High confidence: dark bits and the blue indicator have relatively low contrast against navy but remain discernible. They are immutable fixture colors, not a new UI design.

The final rerun's complete still and decoded movie hashes match that reviewed set. Still images make no claim about motion smoothness, flicker or playback continuity; the separate playback evidence owns that question.

## Choices made in this pass

**Use dry retimed PCM as the gain input oracle — sound, high confidence.** When a source passage is slowed, the accepted stretch processor creates the samples that gain must scale. This check reads that unprocessed result, calculates the requested envelope independently, and compares every processed sample. Reimplementing the stretch algorithm inside a gain test would introduce a second stretch owner and obscure the missing curve-clock question. Existing retiming acceptance remains the authority for the dry samples themselves.

**Judge encoded geometry with source bits and landmark boundaries — sound, medium confidence.** A compressed edge may change a few color values without moving the image. For each frame, the check identifies the physical source using its binary counter, then compares all four edges of an asymmetric red landmark with an independent curve calculation. The two-pixel bound was chosen before rendering and a wrong-phase control breaks it. Color differences are separately measured; this decision cannot be reused to claim color or subjective motion quality.

**Keep focused dispatch cases separate from established cohorts — sound, high confidence.** A developer checking retimed envelopes can run the small new case without replaying every unit-rate scope and static geometry example. Existing entry points remain, while the obsolete expected refusal is removed because stretching now succeeds. This adds no product option or compatibility behavior.

**Retain the independently played containers — sound, high confidence.** Re-rendering the same pixels changes movie creation metadata. The evidence retains the exact movies already consumed by the playback probe and records that the final verification run decoded to the same pixels. Replacing those containers with new ones would silently break the playback hash trail.
