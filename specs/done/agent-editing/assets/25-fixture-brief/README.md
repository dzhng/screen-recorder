# External-caller tutorial fixture brief

Status: prepared request, not executed or accepted. [25](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/25-agent-acceptance.md)
owns the eventual journey and its prerequisites. The planned `tutorial` case is a
short scratch demonstration of primitives, not an assignment to edit the user's
personal tutorial. The developer supplies this technical fixture request; a fresh
external caller discovers and chooses the operations. The product makes zero
editorial decisions.

## Bound media

Resolve identities from these existing authorities before admission. Bind marks
and transcripts to their original source bytes and clock. A newly imported WAV
does not inherit another source's words or timestamps. Rehash execution inputs;
filesystem presence alone does not prove byte identity or model readiness.

| Fixture input | Authority and retained scope |
| --- | --- |
| Workbench speech, screen and journal | [Narrated fixture](../../../../../fixtures/narrated-workbench/README.md), [human marks](../12d-human-marks/human-marks.json), [accepted exact cuts](../12e-labeled-cleanup/README.md). Marks bind narration SHA `2bf4af51122816d6e4c4a6731ddd1a73375be3ed61d82d8cd66bec824638962c` and source origin 48675 µs. The two named targets are not a complete filler inventory. |
| Retiming source and comparison | [Corrected selection](../13a-corrected-selections/report.json), its `original.wav` and `internal-slower-0.8x.wav`; [public delivery](../14e-public-accepted-audio/README.md). Original SHA `afb2a082d6712beef71dae54a89060710e62f9ee0db6e69c5e4eae029cf5bb0c`. |
| Voice reference and public generation | [Frozen reference/settings](../../../../../packages/test-harness/editing/voice/cases.json), [durable public generation/results](../19f-public-voice-jobs/README.md), [current acceptance](../19-acceptance/README.md). The older cases' word bounds and 19f phrase-context windows do not define the accepted word placement. |
| Accepted word context | Original [context.wav](../18-voice/context.wav), SHA `779cbc2c8b034ec8aff96879cda49c0042ca4401ac25aab8e41abae3de79bb45`, represents source context 71.5–76.5 s. The [word recipe](../18-voice-roomtone/report.json) owns source replacement `[74168675,74688675)` µs, generated crop `[0.24,0.84)` s, gain −4.519810154304541 dB and 120 transition samples at 24 kHz. Accepted contextual result SHA `1e027babed08f14d81429c9384dac87aa13f382e7956683db2a06ae025115493`. Its historical background is part of that exact context, not approved speech-free ambience. |
| Pause ambience | [Selected normal-level 200 ms loop](../19-soft-roomtone-overlap/README.md), SHA `7fa912f6ced158759e62ed7e5f6577034b731d1ca18fce3e27ac67147f66ff55`. Preserve provenance and the explicitly tolerated slight seam. The +24 dB copy is a listening aid. |
| Retained camera, screen and microphone | [Four-minute take manifest](../../../../../fixtures/screen-camera-timing/manifest.json). All three files exist at recorded lengths; preparation did not rehash the large originals. Resolve each origin/support independently. Physical synchronization remains open. |
| Music | [Retained inventory](../08-narration-music/archive.json), `captures.tar.xz` member `final/synthetic-chord-bed.wav`, SHA `3fd40ac635a721a874ee5a9e516a48695df0acce8a787df3eb56a2b583151437`. This authored chord bed supplies a mixing fixture, not musical-quality acceptance. |
| Still and font | [Corpus manifest](../00-corpus/manifest.json) `still-alpha.png`; [font authority](../17a-text-layout/report.json). Retain actual font bytes rather than assuming a matching name establishes identity. |

## Requested effects

Use named checkpoints in one scratch project. Preserve their revisions so effects
can be inspected separately and undone. Insertions after a checkpoint are relative
to its actual end; do not guess later project times from unedited source durations.
Keep the complete demonstration below thirty seconds.

| Checkpoint | Supplied technical request |
| --- | --- |
| Marked speech | Use workbench source context `[50518675,57658675)` µs. Remove exactly opening `um` `[50518675,50831675)` and middle `uh` `[54113675,54508675)`. Preserve every other word and source order, including marked `paragraph` and `this`; reproduce the accepted 12e join treatment. These coordinates use the human marks' original source clock; map asset-relative requests using the bound origin. |
| Retimed block | Append the corrected-selection original. Slow only source frames `[31206,91680)` at 48 kHz to rate `4/5`, preserving pitch and untouched neighbors. Use its accepted exact selection and comparison without another phonetic marking task. |
| Pure split | Split one processed clip at an interior supported time without changing its content or processing. Verify unchanged delivered audio/pictures, then independently edit one piece and undo to the exact pre-split result. A trim or removal alone cannot satisfy this checkpoint. |
| Camera interlude | Append two seconds of retained camera footage from its admitted asset-relative `[10,12)` seconds. Overlap two seconds of retained screen footage and microphone audio, each from that asset's own `[10,12)` seconds, and layer the retained still for the first second. Require observable membership of both movie sources and real microphone PCM. This is independent composition, not a physical synchronization measurement. |
| Independent replacements | On saved interlude revisions, replace picture while preserving its audio, then replace one declared audio selection while preserving picture. Demonstrate ordinary compatible-processing preservation and a separate explicit processing reset. Undo both to the saved interlude. |
| Ordered stacks | Get, set, reorder and bypass clip, track, nested-group and output stacks. Compare linear gain 0.5 followed by learned noise reduction with the reversed order on a named speech branch; retain delivered evidence of the order's effect. Insert narration into an already processed track with an empty own clip stack. Express phrase exceptions with clip processing or another track. |
| Optional denoise | Keep a reversible noise-reduction branch and verify bypass/undo, channel identity and unchanged duration. The final demonstration may remain dry. Report changed integrated audio's quality scope separately; the earlier audition does not automatically approve it. |
| Music | Use two seconds of the chord bed over the interlude. Explicitly ramp linear gain from 0 to 0.125 over the first half-second, hold to 1.5 seconds, then return to 0 at two seconds. Verify independent bed mute/level changes and untouched narration outside that interval. |
| Captions and zoom | Add literal caption `Primitive fixture` for the interlude and occurrence-bound `paid` for the generated word. Add a bounded zoom over a caller-identified fixture landmark; retain required caption/content visibility at named start, middle and end frames. The caller chooses reversible layout and styling. |
| Local voice | Append the bound original word context and request actual local synthesis of `paid` with the accepted reference, profile and frozen settings. Reproduce the exact accepted word crop/gain/placement/transitions above and its existing background only within that context. Do not substitute 19f phrase windows or treat the historical background as approved pause fill. Retained generated bytes alone do not prove a new synthesis request. Compare frozen raw generation and contextual output through their separate authorities; no repeat audition of unchanged bytes. |
| Explicit pause | Append a 600 ms pause using the existing normal-level ambience loop. Choose and record placement, gain and transitions explicitly; do not regenerate or retune the loop. Noise reduction remains an independent choice. |
| Delivery | Use canvas 1280×720 at 30 fps. Discover encoder capabilities, select the balanced preset and override average video bitrate to 3000000 bits/s. Verify resolved settings and delivered stream geometry/timing; requested bitrate is not measured file bitrate. Deliver preview, movie and editable package. |
| Recovery | Handle a forced stale edit by recomputing from the actual revision. Recover a lost response with the identical saved request, without another mutation. Inspect history and undo, then relocate the package with donor media and model cache unavailable. Changed model-dependent settings must report missing preparation rather than reuse stale output. |

Grade requested effects, exact clocks, protected content, unchanged originals,
history, delivery and recovery. Do not grade one preferred style or ask the user
which repetitions to remove. Where processing intentionally changes samples,
use its existing conformance authority and declared protected windows; do not
demand dry-sample equality inside the changed region.

## Execution boundary

The recovered voice runtime/model source and durable verification home are present,
but preparation does not establish current registered readiness. Resolve existing
transcript generations with matching canonical source receipts; missing metadata
is an explicit gap, not permission to fabricate words or repeat the accepted 12b
inference cohort. The user has now explicitly authorized model work. Resolve
registered readiness through the actual preparation owner in isolated storage,
preserving existing personal model files, accepted recipes and prior evidence.
Prepare only what this brief needs; do not change the selected engine or repeat
accepted quality cohorts merely to exercise that permission.

The historical `45cbe7…` worker is unavailable. Permitted new execution needs its
own compatible source/runtime pins. `acceptance.mjs` remains unimplemented;
installed cutover, final scale and camera prerequisites remain open. This brief
does not authorize an installed switch, new capture or audible playback.

Reuse accepted per-feature evidence. New integrated output gets only its relevant
new checks, with visual review under 25 and listening/physical limits stated
honestly. Prerecorded footage cannot close live camera acceptance, and numerical
equality cannot supply a listening verdict for unheard output.
