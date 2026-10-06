# Full-frame picture inputs

These inputs preserve camera defects as useful controls. The source's warm walls,
backlit curtain, low framing and soft detail remain intact; no crop, downscale or
grade is part of reduction. The [fixture recipes](../../../../fixtures/video-editing-feedback/recipes.json)
freeze full-frame ProRes SQ encoding, original hashes and source selections.
The corpus tool owns selected regeneration and decoded-frame verification.

[Clock comparison](clock-comparison.json) compares native physical start/end
sample support at four matched source/derivative frames per camera. It rebases
exact rational media clocks, including the final fractional frame. Physical
FFprobe certification checks all 72 decoded frames per retained clip for raster,
color interpretation, duration and ordered timestamps. Sampled visual evidence
is a separate claim from those physical checks.

[Pixel comparison](pixel-comparison.json) declares face, wall and full-frame masks.
Across the twelve pairs, mean RGB error is 0.675–0.724 on the 0–255 scale and
full-frame PSNR is 48.42–48.78 dB. Face masks retain small encoding error;
no sampled pair showed a changed geometry or material color shift. These are
measured differences, not an assertion that lossy reduction is pixel identical.

The [independent critique](visual-critique.md) accepted each sampled camera pair
and face crop. Shared source exposure/framing issues remain explicit future QA
controls. Native PNG operands are retained through LFS; contact sheets were
shown in one Preview window without a human acceptance dependency. Four
samples cannot establish absence of every intermediate temporal artifact.

Regeneration deliberately leaves preservation unverified until its own matching
proof is recorded: decoded timing alone never certifies visual fidelity.
[The regeneration receipt](regeneration.json) separately checks exact recipe
bytes for the selected Graham input. Picture observations/grade quality and
whole-corpus completion remain pending.

## Review

The scoped shape pass leaves fixture derivation and physical certification with
the existing corpus owner, reusing the service's native process lifetime and
Composition's rational clocks. No product operation or dependency was added.
The diff pass added focused refusal controls for missing decode evidence, shifted
PTS, changed raster and changed color interpretation. Fifteen checks pass,
including a real three-frame FFmpeg input and spawned CLI pending/repeat behavior.

The [independent code review](initial-code-review.md) found that successful pending
video derivation was immediately rejected by the certification command. This was
confirmed and corrected with a public CLI red/green check. Derivation now returns
its explicit pending preservation; separate verification still refuses it. Repeated
derivation physically checks existing bytes without rerunning the encoder or
prematurely certifying appearance. The docs keep those two claims distinct.

[The follow-up review](followup-code-review.md) found stale recipe reuse, unchecked
frame pixel aspect and an optional encoder pin. Each defect was reproduced before
its fix. Repeated derivation now requires the same frozen video recipe, every
decoded frame must retain square pixels, and first derivation requires its encoder
hash. [The resolution receipt](followup-code-review-receipt.json) records the
focused checks and complete physical corpus certification. Parent shape, diff and
docs review found no remaining issue in this checkpoint.
