# Creative video workflows

Use this reference for a delegated assembly, multi-take edit, captions, graphics,
music or publication task. Use [media workflows](media-workflows.md) for operation
contracts and [editorial checks](editorial-checks.md) for acoustic joins and review.
These are techniques, not automatic treatments or a fixed approval sequence.

Use the installed CLI's schemas and execution capabilities for every operation.

## Inventory → brief → assemble → review → retain

1. Inventory the selected sources: immutable identity, streams, oriented dimensions,
   exact duration/support, frame rate, audio layout and readiness. Keep aliases for
   human reading alongside saved asset/stream/acquisition IDs. Inspect a few
   representative frames; do not assume every folder contains talking heads.
2. For speech-led material, read cached source transcripts before requesting more
   pictures. Inspect visuals at decisions: ambiguous boundaries, alternate takes,
   demonstrations and discontinuities. For silent tutorials, performances or
   visual montages, start with the picture/event evidence that carries the story.
3. Describe what the material supports. Resolve only missing decisions that change
   the result: audience, length/aspect, must-keep or must-remove content, pacing,
   brand/reference, captions and requested treatments. Reuse answers already given.
   Note possible verbal slips as evidence; neither a slip nor a detected filler
   authorizes its removal.
4. For open-ended editorial work, state the proposed shape, source choices,
   treatments and runtime estimate in plain English. Ask only when a material
   choice remains outside the granted scope. A request for a specific edit or
   delegated judgment already authorizes that work; don't add a ritual approval.
5. Save an assembly decision sheet, translate it into advertised ordinary edits,
   then preview the pinned revision. Check actual rendered output before delivery.
6. Keep the requests, receipts, rationale, accepted candidate and unresolved
   judgments in a task workspace outside the installed skill and source media.
   On resumption, read these before making new choices. Do not re-ask a settled
   question or treat acceptance of an older revision as approval of changed output.

For an explicit file list, use the [batch preparation helper](../scripts/batch-prepare.mjs)
with bundled Node and read its `--help`. Save its resumable task manifest before
processing; pending work retains concurrency slots. Name transcript streams
explicitly and request failed-work retries deliberately.

## Read many takes without losing word evidence

Use the [compact transcript helper](../scripts/compact-transcripts.mjs) with the
Node path returned by `screenrec service.tools`; read its `--help`. It reads current
evidence without starting transcription. Keep its continuation and exact rows.

Make a compact reading view grouped by source and, when supplied, speaker. Show
one phrase per line with a display time range, literal text and a pointer to the
original word rows/generation. Choose phrase breaks for readability, while keeping
the exact word evidence available for boundary inspection.
Preserve reported non-speech events such as laughter as evidence. Never invent
speaker labels or missing events. A phrase boundary cannot bridge unavailable
support or an inference-segment boundary.

Example reading view (display seconds only):

```text
Take A · source clock · generation <saved identity>
[4.10–7.82] Open the recording controls from the menu bar.
[8.46–11.03] Select the window you want to record.
```

A reading view is a navigation aid, not an edit authority. Rounded phrase times
lose precision and do not certify word-safe cuts. Return to exact word ranges,
occurrence IDs and source/project fragments before editing. Preserve partial-word
flags. Keep raw verbatim rows; normalized prose and SRT cues can hide fillers,
false starts and short gaps. A missing word in ASR is not proof of absent speech.

Reuse ready transcript generations for unchanged sources. Editing, grading or
changing the caption style doesn't justify retranscribing source media. When the
source, model or generation changes, invalidate the reading view's pins explicitly.
Do not replace the local transcription workflow with a hosted provider implicitly.

For a bounded source or pinned project window, the
[timeline inspection helper](../scripts/timeline-inspection.mjs) combines delivered
pictures, per-channel waveforms, words and cuts into an SVG plus exact manifest.
Use its `--help`; preserve unavailable evidence and continuations. Sparse pictures
are navigation evidence, not proof that you watched the whole interval.

For a pinned before/after comparison, use the
[revision review helper](../scripts/review-bundle.mjs). Select each review extent
explicitly and state its provenance; read its `--help`. Preserve skipped windows,
partial event pages and missing evidence. Equal cut evidence does not establish
equal picture or sound, and a rendered bundle does not mean you listened.

## Select takes by the intended beat

Compare candidates for the same idea across takes, rather than concatenating
files in directory order. Keep the requested wording, useful delivery, visual
continuity and protected moments in view. Preserve punchlines, reactions, laughs,
breaths and emphasis when they carry the beat. An unavoidable slip may be preferable
to losing the only usable explanation; record the tradeoff instead of silently
rewriting the speaker.

Choose ordering from the requested result. A demonstration may need its setup
before the action; an interview excerpt needs enough question context to make the
answer understandable. Check that rearranging takes preserves factual meaning and
that the ending completes the promised explanation.

For each selection, save source identity/clock, exact candidate range, quoted
content, intended beat, keep/remove rationale and any uncertainty. Once placed,
record occurrence identity and pinned revision as well. Estimate total duration
from the intended placement: include overlaps, holds, gaps and retiming rather
than summing source durations blindly. If over the requested budget, revise within
the delegated scope or surface the tradeoff; don't cut off the payoff line.

A decision sheet is not a second project format. Screenrec's composition and
revision history remain authoritative. Use `edit.apply` with discovered schemas
and saved identities. Plan a batch against one revision,
and recompute later project coordinates after structural changes.

For delegated work, give each worker the actual scope, pinned sources/evidence,
user constraints, target runtime and output contract. Require exact selections,
quotes, reasons and unresolved issues. Use unique output paths and immutable
shared inputs. Parallel work is useful only when authorized, independent and
bounded by the machine's capacity; it is not required for every animation.

## Cut craft is context, not a silence threshold

Start speech-led cut candidates near phrase boundaries, then inspect audio and
picture together. Long pauses can be useful; short gaps may conceal consonants.
Retrieve a bounded `audio.get` excerpt and nearby `frame.batch` samples for the
pinned selection; use `waveform.get` or `spectrogram.get` to investigate uncertainty.
Protect phonemes using actual listening and [editorial checks](editorial-checks.md),
not a fixed padding interval. If speech timestamps omit a sound, inspect the source
rather than cutting on the assumption that the interval is empty.

Useful audition starting points:

- Try 30–200 ms of padding around retained speech; 50 ms before the first word and
  80 ms after the last word can be an initial selection. Widen or tighten from
  actual phonemes, breaths and neighboring words; ASR timestamps are estimates.
- A roughly 30 ms audio fade can help suppress a boundary click. Place it in
  suitable non-speech material where possible, and check that it doesn't blunt
  a consonant. A fade is an explicit edit, not automatic cut behavior.
- Pauses around 400 ms or longer are often convenient places to investigate cuts;
  shorter phrase gaps can also work. Neither duration nor low amplitude proves
  silence or a safe boundary.
- About 400–600 ms between speakers can be a starting point for a relaxed handoff;
  adjust for conversational rhythm and the requested pace.

Use the advertised fade or gain-curve edits only for a chosen treatment. Compare
the resulting join against the untreated context: suppressing a click can also
soften a consonant. Leave room for handoffs and reactions when they carry meaning.

J-cuts/L-cuts, reaction shots, picture-in-picture, holds and crossfades are possible
editorial ideas. Translate them to explicit placement, overlap and advertised
processing. Picture and sound may intentionally change at different times; track
that choice and verify both planes. No implicit B-roll or synchronization repair.

## Captions that survive the composition

Choose cue grouping, case, line length, contrast and safe placement from the
viewing context. Short emphatic chunks suit some social clips; natural phrase
chunks suit explanations. Break at sensible punctuation or pauses and avoid
flashing unreadable cues merely to enforce a fixed word count. Review dwell time
and line wrapping at the intended viewing size. Try two-word chunks for brief
emphasis or four to seven words for explanatory phrases, then adjust to meaning
and reading speed. Merge cues that would flash too quickly.

Read `transcript.get` for the pinned project revision, then group explicit word
occurrences for `text.seed`. Preserve generation, source ranges and occurrence IDs;
project projection accounts for repeats, trims and retiming. Use `text.set` for
requested display corrections while preserving the seed's source evidence.

For bounded draft grouping, use the bundled Node runtime to run
[`caption-proposals.mjs`](../scripts/caption-proposals.mjs) (`--help` describes the
JSON input). Supply one complete pinned project entry from the compact transcript
helper, explicitly selected row indexes, any requested display corrections, and
caller-chosen limits/style/safe area. It returns ordinary text clip and geometry
drafts with exact raw word pins and projected fragments, plus violations; it does
not transcribe or apply edits. Apply chosen drafts separately against the pinned
revision. Grapheme counts constrain proposals, not pixel fit. Every draft retains
an unverified-layout diagnostic until actual applied frames establish glyph
coverage, clipping and readability. Dwell and reading speed describe the word
support envelope; partial/discontinuous word diagnostics must remain visible.
Instant words retain point evidence with `clip: null` and explicit unsupported
dwell/speed diagnostics; they have no invented placeable duration.

Place captions in the intended foreground order so overlays do not obscure them;
verify the final composite, including later output processing. Inspect actual
`frame.get` output and a moving preview. Check glyph coverage, wrapping, clipping
and phone-size readability. Use exact admitted font faces; a font name alone doesn't prove the
intended face rendered. Sidecar SRT/VTT delivery must be advertised separately;
burned-in text does not establish a subtitle file was exported. For advertised
SRT/VTT export kinds, select the pinned revision and exact caption placement IDs.
Keep omission, styling-loss and timing-rounding diagnostics. If literal text is
ambiguous in SRT, use VTT rather than rewriting the words to force acceptance.

## Graphics and animation slots

Choose graphics only when requested or within delegated scope. Obtain brand
palette, type and reference language from existing context; avoid defaulting every
video to an unrelated visual style. Select external authoring tools by the
material they need to produce:

- HTML/CSS/GSAP engines such as HyperFrames suit product UI and web compositions.
- Remotion suits React state/components or an existing React brand system.
- Manim suits equations, formal diagrams and graph transformations.
- PIL/image sequences suit simple cards, counters and progressive reveals.

These are external authoring options, not bundled dependencies. Use an available
appropriate tool, then import the rendered asset through supported media admission.
Don't scaffold animation projects inside the installed screenrec skill. If the
requested codec/alpha path isn't supported, report the gap or discuss an explicit
alternative; don't silently flatten transparency against the wrong background.

Each slot brief should name its goal, output path, duration, dimensions, exact frame
rate, codec/alpha needs, palette/font, timed reveal/hold sequence and exclusions.
Keep source code, render and verification together. Verify the asset's actual
headers and first/last frames before placing it. For browser-authored graphics,
wait for fonts and assert the intended face loaded; silent fallback is a defect.

For explanatory animation, give the viewer time to parse the finished result at
1×. A simple explanatory card may start around 5–7 seconds with about a second
of finished hold; complex diagrams need longer, while decorative accents can be
shorter. Inspect a `preview.get` range that includes the reveal and finished hold;
a still frame cannot show whether there is enough reading time. Separate decorative
motion from information the viewer must understand. Use advertised geometry/opacity
curves for simple movement; inspect existing processing order before adding steps.

Align a reveal's landing frame with the spoken payoff using the projected word
occurrence. If reveal duration is R and payoff is at T, start near T−R, then inspect
the sampled result. An overlay starting partway through a source must have the
intended local phase; it must not display an accidental middle frame. Anchor typing
text to the full string's bounds to avoid sideways movement as characters appear.
Use one clock mapping for picture, words and audio evidence; don't independently
approximate their timing in each graphic.

## Color, orientation and delivery

Check `processing.capabilities` before promising a grade. If the requested
correction has no executable processor, report that gap before applying edits.
For a supported treatment, compare representative processed frames with the same
pinned dry tap. Inspect skin tones, screen-text contrast and consistency across
sources. External processing needs an explicitly selected workflow with retained
originals and newly admitted outputs.

Inspect oriented dimensions, mixed frame rates and color metadata before choosing
a canvas and export. Rotation metadata can make coded width/height misleading.
Preserve exact frame-rate fractions; don't round 30000/1001 to 30 by accident.
An HDR source needs an explicit supported HDR delivery or tone-mapping decision;
washed-out output is not a creative grade. Common delivery examples are landscape
1920×1080, vertical 1080×1920 and square 1080×1080; preserve the requested framing
rather than forcing a landscape default. Preview size doesn't change project size.

Use `output.capabilities` to select supported delivery and `export.create` to
publish the pinned revision. Reuse managed preparations rather than repeatedly
encoding intermediate files. Keep the durable export identity and receipt alongside
the review artifact; an inspection preview is not a published export.

## Music and sound effects

Keep music/effects within the request. A visible contact, click or reveal can justify
an effect; a stock whoosh on every cut can overwhelm the content. Align the audible
attack, not just file start, to the event. Inspect the leading silence/build and
place it earlier when needed; a threshold is only a detection aid.

Place the selected music on an explicit audio track and use gain curves for the
requested balance under speech and across transitions. Choose level targets from
the delivery requirements. Avoid normalizing each clip independently when the
intended measurement is the complete mix. Existing gain curves allow authored
ducking; automatic sidechain, limiting or loudness normalization must be separately
advertised. A 12–15 dB reduction from the music-only level is one starting point
for auditioning a bed under speech, not a guaranteed intelligible balance. For
some online delivery, −14 LUFS integrated and at most −1 dBTP are useful example
targets; use the destination's requirements and verify the complete mix. These
figures don't authorize a mastering treatment or imply it is executable here.
Preserve the dry control and evaluate the delivered level in context.

Measure integrated loudness and true peak when a suitable analysis tool is available,
plus section levels for dialogue, music-only passages and end cards. A quiet outro
or overpowering effect may disappear in whole-program averages. Waveform RMS is
not LUFS or true peak. Measurements cannot establish taste, intelligibility or
pleasant joins; disclose missing listening evidence. Offer contrasting music choices
when the user requests alternatives, and keep the selected version identified.
