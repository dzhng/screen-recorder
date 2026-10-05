# Agent editing workflow capability assessment

Status: capability assessment; implementation ordering is superseded by the
[FFmpeg parity plan](../ffmpeg-parity/README.md). This assessment
identifies improvements to agent-driven editing using this checkout's public
contracts. Installed releases may differ; operation help and execution
capabilities remain authoritative. No feature below is being implemented by this
document.

The useful editorial procedures are adapted into the consumer skill's
[creative workflows](../../skills/screenrec/references/creative-workflows.md) and
[rendered-candidate checks](../../skills/screenrec/references/editorial-checks.md#review-the-rendered-candidate).

## Contract to preserve

Agents choose content and treatment under the user's request. The product returns
primitives and evidence, and performs explicit non-destructive edits. A compact
transcript, a silence candidate or a QC warning must never authorize an edit.

Extend the existing asset, composition, revision, model, job and publication
owners. Read helpers should pin evidence and avoid changing projects. Creative
processors must share preview, frame/audio inspection, export, undo and package
semantics. Don't introduce a second EDL renderer or animation clock.

## Initial assessment order (superseded)

Start with **a combined timeline view**, **a packed transcript view**, then
**a read-only review bundle**. These close the largest agent feedback gaps while
reusing shipped primitives. Add loudness measurement next; caption delivery and
color correction are the strongest subsequent production capabilities. Animation
and richer speech evidence need more feasibility work.

Use the parity plan for dependencies and next work. Priorities below describe
the original assessment, not an alternate implementation ladder.
Each entry separates an absent convenience from a genuinely new primitive.

### 1. Combined timeline inspection — first

**Today:** frame batches, waveform images/JSON, spectrograms, transcripts and
project cut events exist separately in the [operation catalog](../../packages/protocol/src/operations.ts).
There is no combined filmstrip/waveform/word-label delivery operation.

**Add:** a bounded source or pinned-project inspection that returns one image plus
machine-readable frame references, word occurrences, cut markers and shared axes.
Distinguish source/project clocks, actual sampled visibility, acquisition gaps and
unavailable evidence. Include per-channel waveform views rather than silently
mixing channels. Gap shading must say whether it means absent transcript words,
measured low energy or unavailable support; none is certified silence.

**Why:** agents can inspect an ambiguous boundary in one artifact instead of
assembling several independently scaled outputs. Start as a consumer helper over
existing operations; promote it to a service operation only if delivery/reuse
needs justify that ownership. A contact sheet must not become a full-frame scan.

### 2. Packed multi-source transcript reading — first

**Today:** source/project word reads and literal phrase search exist, with generation
pins, occurrence projection and pagination. They are not a compact cross-take
reading surface. The [transcript records](../../packages/core/src/transcript.ts)
retain word text, ranges and confidence; phrase summaries can reuse them.

**Add:** a token-budgeted text/Markdown view grouped by source and optionally known
speaker, with display ranges, verbatim phrases, exact evidence pointers and coverage.
Split at configured pauses and real segment/support boundaries. Retain raw word
rows, generation and partiality; never promote rounded summary times to edit bounds.
Use real admitted source duration, not the span from first to last transcript word.
Unknown speaker or absent events must stay unknown. Page large outputs.

**Why:** agents can compare many takes without loading all word JSON or inventing
scoring pipelines. This is a presentation helper, not a new ASR engine or automatic
"best take" ranking.

### 3. Rendered review bundle — first

**Today:** project cut events, previews, picture/audio taps and immutable revisions
provide most inputs. Agents manually collect and align review artifacts.

**Add:** an explicitly requested, read-only bundle for a pinned revision or comparison
pair: changed joins with context, opening/ending samples, caption/overlay entrances,
selected middle sections and expected versus delivered technical properties.
Include bounded audio, filmstrips, transcripts and missing-evidence declarations.
Use project cuts and authored differences; source scene changes do not enumerate
edited joins. Identical splits and mapping changes need different explanations.

**Why:** makes before/after and independent critique reproducible. Mechanical
warnings can report clipping, missing streams or duration discrepancies; they cannot
certify natural sound or make taste judgments. Report requested coverage and skipped
checks. Keep perceptual verdicts tied to artifacts, separate from automated checks.

### 4. Loudness and peak measurement — next

**Today:** waveform min/max/RMS and spectrogram inspection exist. The catalog has
no public integrated LUFS, loudness range or true-peak operation. RMS and sampled
peak cannot substitute for those measurements.

**Add:** bounded source/project/tap analysis with channel layout, measured window,
BS.1770/EBU R128 implementation identity, gating, true-peak oversampling and
unavailable-support treatment. Support whole-program and explicit section readings.
Warn against interpreting very short speech excerpts as program loudness.

**Why:** detects music/effects masking dialogue, clipping and weak end cards. Keep
measurement read-only. A separate explicit normalization/limiter processor could
follow, with caller-selected targets; −14 LUFS is not a product default policy.

### 5. Caption sidecars and cue layout — next

**Today:** exact font admission, literal text, editable styling and `text.seed` already
support explicit burned-in captions. The caller groups cues. There is no advertised
SRT/VTT export or general caption-layout helper.

**Add:** caller-selected cue construction with limits on line width/lines, reading
speed, minimum dwell, pauses, punctuation and safe area. Return proposed ordinary
text placements for explicit application. Add revision-pinned SRT/VTT delivery
with repeat/retime mapping, text corrections and documented time rounding.

**Why:** makes consistent readable captions and accessible sidecars practical.
Preserve source word pins and separate display text; a style preset must not rewrite
speech or force uppercase. Verify final-layer visibility, multilingual glyphs and
long unbreakable words. Sidecars are new output kinds, not audio/video subtitles
silently inferred from text clips.

### 6. Color correction and explicit HDR handling — next

**Today:** the [processor registry](../../packages/composition/src/schema.ts) includes
geometry, opacity, pointer, gain and RNNoise, with no grade/LUT processor. Video
[output settings](../../packages/composition/src/output-settings.ts) select H.264
Rec.709. Existing color conversion does not imply controllable tone mapping or
end-to-end HDR export.

**Add:** a modest ordered correction primitive, such as exposure/contrast/white
balance/saturation or CDL; define working color space, clipping and alpha behavior.
Then assess LUT dependencies, scopes and explicit HDR-to-SDR tone mapping against
actual native decoding. Expose source color facts and transformation policy.

**Why:** lets callers match camera takes and avoid washed-out HDR imports. Reuse
admitted assets for LUTs and the same processor stack for every output. Grade quality,
HDR preservation and metadata correctness require separate proof; an echoed Rec.709
label establishes none of them.

### 7. Transparent motion assets and animation interchange — later

**Today:** ordinary media layers, still images, text, geometry/opacity curves and
font retention already cover basic graphics. Final H.264 output requires opaque
pixels. External HyperFrames/Remotion/Manim projects are not managed dependencies.
This assessment does not establish a complete alpha-video import path.

**Add:** first verify which alpha-bearing movie/image-sequence inputs actually
admit and composite correctly. Fill demonstrated gaps with an explicit immutable
motion-asset contract: duration, exact fps/phase, straight/premultiplied alpha,
color, dimensions and retained bytes. Consider an external-render import helper
before adding a bundled browser runtime. Transparent intermediate export is a
separate capability from opaque final delivery.

**Why:** brings designed overlays into existing placements without flattening them
against an accidental background. Imported renders can work independently of their
authoring tool; editable animation-source portability is a separate promise.
No automatic engine installation or a second timing system.

### 8. Richer speech and acoustic evidence — later, research first

**Today:** verbatim words, confidence, generations and literal
[filler/vocalization classification](../../packages/core/src/word-kind.ts) exist.
The word record has no speaker identity; its classification is not diarization or
an acoustic laugh/applause detector. Word-level output alone does not establish
that every filler was recognized.

**Add:** evaluate optional local diarization, non-speech event recognition and
boundary alignment. Keep model version, confidence, channel/source ranges and
explicit unknowns. Overlapping speakers need separate intervals. Derived evidence
must retain source generation and survive project occurrence mapping.

**Why:** improves interview handoffs, reaction preservation and boundary confidence.
Measure recognition quality on real material before selecting a provider. Hosted
ASR would introduce explicit upload, credential, cost and retention contracts;
it must not silently replace this product's local inference.

### 9. Explicit music ducking and final mastering — later

**Today:** layered audio and gain curves can express manually chosen ducking and
fades; full processed PCM can be retained. No sidechain compressor, limiter or
loudness-normalization processor appears in the registry.

**Add:** after measurement, consider a compressor/limiter with explicit detector
routing, attack/release/lookahead and consistent state across inspection/export
windows. A read-only helper could first propose gain keys for caller-selected speech
regions. Keep proposed keys separate from applying them.

**Why:** helps mixed dialogue/music without forcing identical fades or levels on every
clip. Preparation and export must share retained state and timing; metering a dry tap
cannot certify a mastered result. Do not generate or select music automatically.

### 10. Portable editorial memory — small companion feature

**Today:** revision history and editable packages preserve the composition and its
dependencies. The consumer skill saves task-side rationale and verdicts, but there
is no public structured editorial-notes contract tied to a revision.

**Add:** if real resumptions justify it, caller-authored notes keyed to revision,
occurrence/source and artifact identity: intent, rationale, accepted/rejected
candidate and unresolved issue. Distinguish historical annotations from current
state and include them in transfer only explicitly.

**Why:** enables another agent to continue without repeating settled auditions.
Start with a task-side manifest; add product storage only when cross-agent/package
transfer requires it. Don't append an unbounded session diary to the consumer skill.

### 11. Multi-take inventory and preparation convenience — small companion feature

**Today:** imports, source facts, local-model preparation, jobs and cancellation exist
as individual operations; multi-source preparation still needs caller orchestration.

**Add:** a consumer helper that inventories selected files and queues only requested
imports/transcripts with bounded concurrency, per-item readiness/errors and resumable
identity. Preserve independent source clocks and explicit capture bindings.

**Why:** reduces orchestration for folders of takes without multiplying inference
workers or media copies. Automatic scanning/uploading of unrelated files, model
downloads during reads and unconditional retranscription are outside this contract.

## Evidence and review improvements

The timeline/review bundle should expose **missing support explicitly**, not turn
it into black frames or silence. It should inspect **project occurrences and exact
sample visibility**, not approximate edits from rounded source seconds. Reuse
**immutable evidence and revision differences** to recheck only changed behavior.
Carry **review coverage and uncertainty** into delivery so render success never
becomes a perceptual pass. These use this repo's existing strengths to make the
workflow more trustworthy than a standalone FFmpeg EDL pipeline.

## Keep workflow guidance separate from product policy

Fades, padding, cue sizes, pacing and mix targets are useful audition starting
points. Keep them configurable and verify actual output; they are not automatic
product treatments. Hosted ASR, strategy approval, parallel agents and external
rendering are workflow choices rather than prerequisites. Remote media acquisition
can remain external to editing. Existing presenter/segmentation proposals remain
separate and are not activated by this assessment.
