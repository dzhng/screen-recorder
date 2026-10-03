# Frozen animation through encoded delivery

The existing zoom, pose and crop/size/pivot journeys now have a matched encoded
checkpoint using the accepted explicit balanced settings. This verifies sampled
trajectory, source/curve preservation and actual delivered clocks; it does not
close slice 16, accept continuous motion or establish listening quality. No
production renderer or encoding policy changed.

## Exact references and intentional boundary corrections

All 117 public pre-encode analytic, moved, split, trimmed and windowed controls
pass. Zoom retains every historical PNG byte. Pose and crop each differ from 32
of 39 historical PNGs, so the initial exact-hash gate correctly failed. Those
runs and the old images are retained; no tolerance was enlarged or old reference
silently replaced.

A replay of the same compiled numeric requests isolates the difference. The
historical worker reproduces all eight unique old poses in each cohort. The
accepted [finished-canvas correction](../15-composed-border/README.md) reproduces
all eight current pose images and seven crop images; the accepted
[sampling-cell correction](../15-sampling-cells/README.md) reproduces all eight
in both. The [explicit transfer table](preencode-reference.json) pins the old and
corrected hashes to that replay. Later public runs reproduce the first failed
run's 39 PNGs and decoded full/range bytes exactly: changing the reference gate
did not change rendering. The first historical-worker attempt refused the new
empty `fonts` field; its failure is retained, and compatible replay omits only
that empty field plus relocates source/output paths.

## Timing and defect sensitivity

The twelve complete movies retain all 231 native decoded PNGs, embedded profiles,
BGRA hashes and actual rational timestamps. A separate packet probe checks every
PTS, duration and track duration. Full/range prepared programs match at the same
global source samples; the one-microsecond trailing range frame is retained.
Each full preview is byte-identical to its durable export.

Real public edits create two negative controls: delay the curves by one 125 ms
sample, and move the authored rectangle four pixels right. Every delayed public
PNG matches the prior analytic sample exactly, including the initial clamp.
Eighteen preselected early/middle/late encoded comparisons distinguish these
edits from ordinary codec loss. Replacing phase movies with positive movies
makes the same analysis fail; its complete failed measurements are retained.

The original unmanaged FFmpeg mean-membership gate remains unchanged and is not
strict color acceptance. The independent embedded-profile-to-sRGB comparisons
also retain their failures:

| Cohort | Reference/full maximum RGB | Worst whole-image mean RGB | Full/range maximum RGB |
| --- | ---: | ---: | ---: |
| Zoom | 185 | 2.6865 | 38 |
| Pose | 186 | 2.4811 | 29 |
| Crop/size/pivot | 185 | 2.1370 | 34 |

All 39 active reference/encoded comparisons exceed the original four-code
threshold; 13 of 15 full/range pairs also exceed it. These diagnostics expose
loss, not an upstream trajectory defect or an automatically accepted tolerance.
Historical unmanaged max 240 and separate earlier color-managed measurements
remain in [the original zoom diagnosis](../16-zoom/writer/README.md).

## Independent review and limits

The [fresh visual review](fresh-visual.log.gz) inspected all nine sheets,
all 111 matched panels, all 231 decoded-frame thumbnails and 29 individual display
PNGs. It identified the delayed trajectory and changed edge exposure in the
geometry control. Encoded blue/red fringes and pale yellow/green rims were most
apparent at 4× and subtler at native 40×64; no conspicuous interior color shift was
reported. The complete report retains its qualified geometry observations.
All sheets and display copies use explicit sRGB, while native PNGs retain their
original profile. No scratch `sips` conversion was used.

This tiny asymmetric fixture judges sampled geometry and edges, not screen-text
readability, photography, between-frame smoothness or real-time playback. No
movie was played; these visual-only projects contain no audio track. Retime+gain and denoise transitions remain
separate [slice 16 obligations](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/16-keyframes.md). Independent code
review found no actionable issue, including a second pass checking all correction
mappings and the captured timing/negative evidence.

## Evidence and reproduction

Run `restore-evidence.py` with a fresh destination to verify and extract the
archive. Every captured path is restored from its original hash; identical files
share `storedAs` entries. `capture/review/brief.txt` is the neutral review entry.
The archive includes the successful public runs, initial failed runs and complete
worker-localization requests/results. The retained localization scripts record
the exact scratch paths and worker binaries used; historical paths in receipts
are provenance, not a portable runtime.

The [existing keyframe runner](../../../../../packages/test-harness/editing/keyframes.mjs)
adds `--appearance` to its three cases. It pins resolved settings in every
preview/export request and consumes the correction table only for explicit
historical hash transfers. Run its companion `keyframe-appearance-analysis.py`
with a root containing `zoom`, `pose` and `geometry` capture directories; run
`encoded-appearance-packets.mjs` on each `appearance` directory. Python needs
Pillow and NumPy. Worker SHA-256 was
`6663e0c169671fa8121ed26e9cf298fb0dd0d789fd5559954899af1e87b608b9`.
