# Timed-caption delivery evidence

This checkpoint separates supplied word/display mapping from an explicitly
authored entrance. The [runner](../../../../../packages/test-harness/editing/caption-timed-motion.mjs)
uses the existing public caption journey and native worker; its selecting entry is
[captions.mjs](../../../../../packages/test-harness/editing/captions.mjs) with
`--case timed-motion --out NEW_DIRECTORY` and `YAP_NATIVE` pointing to a pinned worker.
The runner owns the exact recipe and operands; these numbers are fixture requests,
never automatic editing defaults.

The fixture retains declared synthetic word observations over generated silent
PCM. It performs no recognition and proves no speech-model accuracy. Corrections
change display text while seeds retain original words, exact source estimates and
occurrence identity. Empty corrections omit glyph runs while preserving the caller's
chosen separator; overlapping windows remain active together.

[Summary](summary.json) records scope, worker identity and quantitative verdicts.
[Public/native receipts](report.json) retain every frame selection, compiled text
record, layout and artifact identity. The source/declared drafts remain there; all
native stills and decoded movie frames are retained alongside their complete
[capture manifest](visual/capture-manifest.json), comparison measurements, crops
and contact sheets. Full preview and committed export match exactly. Independent
numeric reference movie frames match decoded candidate caption pixels exactly;
the offgrid preview comparison retains its distinct codec tolerance.

The [red public receipt](red-public-report.json) records the strict native refusal
caused by leaking authored `timedWords` into a compiled text request. The compiler
now resolves those source windows into active glyph ranges and removes authored
timing. The compiled schema also rejects authored timing, keeping one clock owner.
[Helper falsification](red-helper.log.gz) restores the unfixed helper in scratch and
fails both correction and fragmented-support tests. Focused green checks are
retained in [verification](verification.md).

[Fresh image-only critique](visual/fresh-critique.md) inspected every capture and
found no candidate clipping, layout, legibility or entrance-phase defect. Its warm
yellow movie fringe is also present in the matched encoded numeric reference,
which has zero candidate difference; this does not claim lossless still/movie
color equivalence. Preview presented the entrance strip, overlap crop and initial
comparison sheet in one window, then quit during unattended closeout.

No exit treatment was requested. The final occupied sample is 2.9375 seconds;
FFprobe confirms 48 frames and a three-second movie. No post-end picture, exit
animation, between-frame playback smoothness or speech acoustics is claimed.

[Independent code verdict](independent-code-verdict.md) is retained verbatim.
[Triage](review-triage.md) dismisses its single oracle finding using the explicit
parent retime and delivered pixel evidence. Scoped refactor/code/docs review found
one owner for wrapping offsets, animation phase, native rasterization and request
validation; no renderer, clock, preset, compatibility path or dependency was added.
