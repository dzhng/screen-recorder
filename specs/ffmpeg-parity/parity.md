# Parity contract

Parity means common offline work through screenrec's shared typed contracts,
plus bundled FFmpeg passthrough through the released launcher for extras. It does not mean exposing
an arbitrary filtergraph API or implementing every capability twice.

## Preservation and additions

| Workflow | Current owner/default to preserve | Planned change and evidence owner |
| --- | --- | --- |
| Import, inspect selected tracks, trim, split, sequence, retime | Asset admission and composition's exact mapping; native sample support | Slice 04 admission corpus; slice 25 general-footage codec checks. No wider input promise from decoder inventory alone |
| Crop, geometry, opacity, curves, layers, text | Composition and shared native picture executor | Preserve across new grade/alpha paths; full/window sample phase and rotation-once checks |
| Mix, gain/fades, resampling, RNNoise | Composition state and native audio/prepared outputs | New measurement/treatments in 10/13–15; existing implementations unchanged |
| Filmstrip + waveform + transcript + cuts | Existing separate inspectors and projection | 08 bounded aligned artifact with exact manifest |
| Multi-take transcript reading | Core word truth, generations and occurrences | 07 verbatim budgeted pages; no automatic take ranking |
| Rendered before/after review | Existing revisions, preview and inspection | 09 read-only coverage bundle; perception remains agent/user judgment |
| LUFS and true peak | Existing signal selection; no current public meter | 10 read-only calibrated measurement; explicit true peak and channel interpretation |
| Caption grouping and SRT/VTT | Existing text.seed, fonts and placements | 11 proposals; 12 displayed-caption sidecars at pinned revision |
| SDR correction and HDR handling | Shared color policy currently refuses unsupported HDR | 16→17 modest grade; 18→19 explicit managed SDR derivative |
| Transparent motion overlays | Existing media placement and curves | 20→21 proven immutable input; no transparent final movie promise |
| Richer local speech | Existing local models and source-bound words | 22→23 source-bound anonymous speaker companions |
| Ducking/compression/limiting/normalization | Current audio routing/state owners | 13–15 explicit typed treatments and retained context |
| Editorial resumption | Existing immutable revisions/packages | 24 small explicitly transferred task-side notes |
| Selected-file inventory/preparation | Current import/model/job operations | 06 bounded orchestration, per-item resume; no new queue |
| MP4 H.264, WAV, M4A | Established native delivery | Preservation checks, no backend replacement |
| MP4 HEVC | Output schema and native encoder need extension | 25 discriminated settings and actual readiness |
| GIF or other non-core extra | External artifact, outside managed export | 02/26 tool discovery and launcher passthrough; verify available build features, import explicitly if needed |

## Backend recipe contract

A supported capability has one declared implementation, identified by backend,
version/configuration, relevant dependencies, input identity and parameterization.
The selected revision and required processing recipe determine inspection,
preview and export; invocation order or an unavailable executable cannot pick a
new recipe. Cache/prepared-result identity includes the implementation and actual
mode. Preserve native defaults unless a focused reproduction demonstrates a gap.

FFmpeg works on explicitly admitted streams or retained compiled/prepared samples.
It must not reinterpret the edit graph, discover a different first audio stream,
invent support from average fps, reset excerpt clocks or change state boundaries.
Bitstream equality across encoders is not promised. Exact authored support and
A/V timing are invariant; pixel/audio differences need an explicit bounded
encoding tolerance and independent control, recorded before acceptance.

Input families must separately report metadata probing, decoding, inspection and
managed-project support. Unknown timing/color/layout is unavailable or refused,
not success inferred from FFmpeg's ability to open a file. Wider families require
a resliced admission contract before advertising support.

## Proposed shared extensions

Operation spelling below names the planned contract seams. Some checkpoints are
implemented; the owning slices and installed schemas determine actual readiness.
Check existing owners before registration and update this spec if consolidation
changes a name.

| Extension | Required request identity | Required result identity |
| --- | --- | --- |
| Capability/health augmentation | Selected app/runtime | Absolute FFmpeg/ffprobe paths; build/config/hash; inventory/readiness |
| audio.measure | Asset+stream+optional acquisition/support, or project+revision+tap; prepared recipe where applicable; exact window; channel and peak mode | Signal/window/coverage; algorithm/backend; LUFS/LRA/peak or not-measurable; limitations |
| export.create (new SRT/VTT kinds) | Project+revision; explicit caption placements; SRT/VTT; destination/replay ID | Pinned cues/text; rounding/overlap/omission facts; publication receipt |
| asset.convert | Immutable asset+whole selected streams; explicit frozen HDR→SDR recipe; canonical replay key | New immutable asset; retained source/provenance; transform and support receipt |
| Processor/output variants | Ordered typed grade/dynamics recipe; state domains; discriminated HEVC settings | Same compiled meaning, preparation dependency and actual implementation everywhere |
| Optional speech evidence reads | Source/model generation or project revision; family/range/page | Source observations/occurrences, confidence, coverage, unknowns and generation pins |

Consumer helpers reuse existing public operations and return task-side manifests;
no second shared service contract is introduced just to package evidence. Promote
only a demonstrated shared retention/delivery need. Public schema errors,
unavailable capability, execution failure and partial evidence remain distinct.

## Research acceptance

The build, color, alpha and speech checkpoints freeze executable inputs, settings,
fixtures, independent references, quality/work budgets and observed limitations.
Do not select a universal quality threshold from an unlabeled fixture or choose a
provider merely because it runs. Retain the existing speaker research and use
small tool checks for the public workflow. The user evaluates
practical quality by using the product; no additional cohorts or scoring machinery
are required for this release. For color and dynamics, identity preservation and
known chart/impulse controls precede perceptual confirmation.

Every parity row is verified through the public production boundary once its
implementation exists. A reference-binary filter run establishes feasibility only.
No demo edit is required for this specification; later novice/user acceptance
complements the isolated proofs rather than replacing them.

## Primary implementation references

Use the documentation matching the pinned source when reproducing these contracts;
live documentation is orientation, not installed capability evidence.

- [FFmpeg licensing and redistribution](https://ffmpeg.org/legal.html) and [component license inventory](https://github.com/FFmpeg/FFmpeg/blob/master/LICENSE.md).
- [CLI execution and stream selection](https://ffmpeg.org/ffmpeg.html), [probe semantics](https://ffmpeg.org/ffprobe.html) and [protocol/descriptor behavior](https://ffmpeg.org/ffmpeg-protocols.html).
- [Filter definitions](https://ffmpeg.org/ffmpeg-filters.html), especially ebur128, loudnorm, alimiter, sidechaincompress, tonemap and compatible color conversion.
