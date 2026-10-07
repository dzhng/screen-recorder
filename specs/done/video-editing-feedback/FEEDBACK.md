# Feedback for Screen Recorder / screenrec (v0.1.6)

Running tally of screenrec friction across all video projects. Newest at the bottom of each section; items so far come from `sota-graham-neubig-trailer/`.

## Bugs

1. **Transcription fails with "Transcript words must not overlap".** Full 33 min source
   (asset `2732b484…`, `track:2`) failed twice with `INVALID_RESPONSE` and empty
   `errorDetails`; the retry fails identically, so `retryable: true` is misleading. Splitting
   into 400 s extracts, 3 of 5 still failed; at 100 s, 800–900 s and 1400–1600 s still failed.
   It looks like the decoder emits overlapping word times and the validator rejects the whole
   transcript. Suggest clamping/merging overlaps (or dropping the offending word with a
   diagnostic) instead of failing the job, and putting the offending word times in `errorDetails`.
   At 25 s, only 825–850 s still fails, so it's one specific spot in the audio, not length.
   Chasing it took 3 rounds of extract → transcribe and ~30 extra jobs.
2. **Normalization failures only surface at export, after a full render.** Gain-only mode refused
   ("cannot meet the requested range or peak ceiling") and dynamic mode refused at −14.3 vs −14.0
   LUFS (tolerance 0.2) with `NORMALIZATION_TARGETS_UNMET`. Both failed the whole export. A
   best-effort result with a warning, or a preflight check at `edit.apply` time, would save
   render cycles. The `errorDetails.after` measurement is very helpful, though.
3. **Dynamic normalization systematically undershoots and then fails its own check.** On a mix
   with kick/crash hits, targets of −14.5, −15.0 and −14.5 (with 0 dBTP ceiling) landed at −14.9, −15.4
   and −14.8 LUFS, each failing the 0.2 LU tolerance and the whole export. A limiter after it
   doesn't help, because normalization validates its own output. Workaround: compressor plus manual
   gain plus limiter, calibrated by `audio.measure`.
4. **Transcription overlap bug also hits tiny clips.** A 2.25 s Madison extract failed with "words
   must not overlap" while neighbouring start points worked.
5. **`audio.measure --output` writes nothing.** The loudness numbers are only reachable by reading
   the `measurement.file` cache path from the reply.

## Ergonomics

1. **`asset.import` of a 2.3 GB file times out at the CLI** (`TIMEOUT`, retryable) even though
   the job is created. Replaying the request ID works, but the import call could return the
   job immediately instead of blocking past the client timeout.
2. **No way to transcribe a sub-range of an asset.** The workaround is `audio.extract` →
   new asset → transcribe, which then reports times relative to the extract, so every word
   time has to be offset back to the source clock by hand. A `range` on transcript
   preparation (or source-clock times on extract transcripts) would fix both this and the
   bug above.
3. **`compact-transcripts.mjs --help` prints nothing** and exits 0, though the skill says to
   read its `--help`.
4. **Inconsistent result field names.** `job.get` puts output under `result`, while
   `audio.extract` puts it under `published`. Easy to read the wrong one.
5. **No speaker labels.** Interviews need to know who said what; the user's own transcript
   (from another tool) had speakers, Parakeet output does not.
6. **`edit.apply` `remove` ranges accept only integer µs**, while placements accept exact
   fractions. At 24 fps most frame boundaries (k/24 s) aren't whole microseconds, so a
   frame-exact ripple delete isn't possible; I had to delete the clip and re-place two pieces.
7. **ASR drops false starts.** Parakeet silently skipped a "fortun-" stutter; I only found it
   by re-transcribing the edited audio. A disfluency/partial-word event would help trailer work.
8. **Media delivery needs blind polling.** `waveform.get` / `frame.batch` with `--output` write
   nothing while processing, so scripts loop until the file appears. A `--wait` flag (or blocking
   until ready with a timeout) would remove most of the shell glue.
9. **No way to verify edited speech without re-transcribing.** `transcript.get` on a project
   depends on the source transcript, which failed, so checking cuts meant extracting the project
   mix and transcribing it as a new asset. That workaround works well though; a built-in
   "transcribe this revision's output" would be welcome.
10. **No built-in shot/scene list on exports.** I used bundled ffmpeg (`scene` filter) to confirm
    cuts landed on planned frames; `timeline.events` covers project cuts but not "what changed
    visually in the delivered file".
11. **Output normalization overshoots slightly**: dynamic mode at −1 dBTP measured −0.9 dBFS
    peak with ffmpeg ebur128 (could be meter differences; worth a note in the docs).
12. **Word boundaries near cut points are unreliable, and there's no tool to pin them down.** Case: in
    the final edit, Parakeet labelled Graham's phrase-final "trend" as "turn" at 1574.80–1574.96 s. The
    waveform (`waveform.get`, 20 ms buckets) showed a further speech burst at ~1575.10–1575.44 s before
    silence, so a cut built from the word times dropped the word. Extending the cut into the silence brought
    "trend" back on re-transcription. The burst-is-"trend" reading is inferred from energy, not heard.
    Other boundaries were off by different amounts or missed words entirely, so there's no fixed bias.
    Word times are probabilistic estimates. Product capabilities that would fix this:
    - **Forced alignment:** align known text (the curated caption or cut text) to a source range and return
      word boundaries with confidence. More reliable than free transcription when the words are known.
    - **Boundary-aware word rows:** per-word confidence plus the nearest silence before and after each
      word, so cuts can snap to real gaps instead of estimated word ends.
    - **Join verification:** transcribe or align a window around each edit join with context on both sides
      (not the clip in isolation), and flag edge words that are missing, mislabelled or truncated.
13. **Color tools are thin for stylized grades.** Only `sdr-correction` (exposure/contrast/
    saturation/white balance). Matching a reference look (Dwarkesh's low-key, a16z's teal and gold) needs
    shadows/highlights or curves, split-toning or LUT import, vignette and grain. Contrast pivots
    around mid-grey, so on a bright-wall webcam shot it crushes the face long before the wall
    darkens. Workaround: gentle grade plus a vignette PNG overlay.
14. **No blend modes** for overlays (multiply/screen/soft-light), which would make vignettes,
    grain and color washes much easier.
15. **No music source.** Neither a library nor generation, so trailers need an external
    track; I synthesized placeholders in Python.
16. **Image fit + push-in works nicely** (geometry `fit: cover` + keyed `scale`), and text with
    imported fonts rendered exactly as specified. Building a whole 30-clip variant in one
    labeled `edit.apply` batch is a great workflow.
17. **No multicam/audio sync.** Aligning the co-hosts' raw camera files to the final edit needed
    chunked transcription and phrase search; envelope cross-correlation was too weak because each
    raw file holds a single mic. An "align asset B to asset A by audio" operation would help.
18. **Text has no vertical alignment.** Glyphs render top-aligned in the text box, so centring a
    subtitle in a letterbox bar takes trial and error on the rect.
19. **Compressor has no makeup gain**, so a separate gain step is needed after it.
20. **Labels only resolve within the batch that created them.** Fine, but `processing.set` on a
    later revision needs the real track ID; the error message (`INVALID_EDIT ... label`) was clear.
21. **Needs good built-in face detection (user-requested priority).** Centring speakers needed an
    external Swift/Vision script sampling frames every 0.5 s, plus manual rect maths, per take. What's
    needed: face boxes from `frame.get` / `index` reads, a face track over a range (to follow movement),
    and a "reframe to subject" geometry mode (centre a face at a target point, with min/max zoom), so
    talking-head edits can be centred and kept centred in one call.
22. **No per-clip loudness matching.** The mixed sources ranged from −16 to −38 LUFS. Matching them
    took one `audio.measure` per clip, then computing gains by hand. A "match clip loudness" helper or a
    normalize-per-clip processor (with no export-blocking tolerance) would help dialogue edits.
23. **Explicit exports should overwrite (user-requested change).** `export.create` refuses an existing
    destination ("destination belongs to another file or was modified"), so every re-export needs a new
    filename. Proposed logic: if you explicitly export to a path, replace it, atomically (render to a
    temp file in the same directory, then rename over the target only after commit), so a failed export
    never destroys the previous good file. Keep one guard: by default only replace files screenrec itself
    published (it already tracks ownership); replacing a foreign file needs an explicit `overwrite: true`.
24. **Multi-camera sources share a clock but nothing links them.** The three Riverside raw files are the
    same 2360 s session; I had to discover that from the durations and verify it by cross-correlation.
    Declaring assets as synced angles (with offsets) would make camera switching trivial.
25. **No animated or styled text.** TikTok-style captions (per-word colour, stroke, shadow, pop/scale
    animation, active-word highlight timed to the transcript) aren't possible with `text` clips: one
    colour per clip, no stroke or shadow, no per-word timing. I rendered every frame externally in Swift and imported
    a ProRes 4444 alpha overlay. That worked very well (alpha honoured, frame-exact). Built-in
    "karaoke captions from transcript words" with style presets would be a big win, since the word timings
    are already in screenrec.
26. **No transition primitives.** Whip pans, crash zooms and flash cuts had to be hand-built from
    geometry and opacity keyframes plus overlay flashes. Also missing: motion blur, so whips show a hard
    black gap. A small transition library (crossfade, dip, whip, zoom, flash) with an optional SFX hook
    would help.
27. **No SFX/music library or generation**, so all whooshes and impacts were synthesized.

28. **Frame reads and ffmpeg decode disagree on colour.** The same BT.709-tagged raw frame measured
    wall blue−red −15 via `frame.get` and −32 via the bundled ffmpeg's RGB conversion, so colour QA done
    with `screenrec ffmpeg` on exports is biased warm relative to what QuickTime shows. A documented
    "decode like the player" path (or frame reads on exported files) would make grade verification trustworthy.
29. **Grading needs objective feedback.** Nothing reports exposure or clipping, so I graded by eye at
    first and overexposed white walls (12–29% clipped). Per-frame stats (mean luma, % clipped, % crushed,
    face luminance) from `frame.get` or `index` would have caught it immediately. I built this with Vision
    (`scripts/analyze-frames.swift`, `scripts/grade-sweep.py`).

## Feedback on the screenrec skill (SKILL.md and references)

1. **The skill helpers went unused, which says something.** `compact-transcripts.mjs --help` printed
   nothing, and the review helpers (`timeline-inspection.mjs`, `review-bundle.mjs`, `caption-proposals.mjs`)
   need hand-built JSON inputs with no examples, so I fell back to my own scripts. Each helper should have a
   copy-pasteable example invocation.
2. **No guidance for multi-camera / multi-source interviews.** Riverside-style per-person recordings on a
   shared clock are the common podcast case; the skill should cover syncing angles and choosing raw vs edited.
3. **No guidance on objective picture QA.** The editorial checks cover audio joins in depth, but say nothing
   about verifying exposure, clipping, face framing, or that nothing is cropped. All of that came up as user
   feedback here and should be in `editorial-checks.md`.
4. **Long-source transcription isn't addressed.** The skill assumes `transcript.get` works on the whole
   source; it doesn't mention the overlap failure or the chunking workaround.
5. **Loudness mastering advice is missing.** The skill mentions −14 LUFS as an example target, but not
   per-clip dialogue matching, or that dynamic normalization can fail its own tolerance on peaky mixes.
6. **Text and captions guidance stops at plain text.** There's no mention that animated or styled captions
   need an external renderer plus a ProRes 4444 overlay, which worked well and is worth documenting as the pattern.

7. **Add a cut-verification lesson to `editorial-checks.md`.** Re-transcribing a cut to check it is
   biased at the edges: a recognizer needs context, so audio that starts or stops abruptly can lose or
   misread the edge word even when it's intact (or invent a fragment, like the stray "One" I saw).
   That makes the check probabilistic in both directions. Recommended practice:
   (1) treat the waveform as the primary evidence: keep clean silence on the kept side of each cut;
   (2) when re-transcribing, pad both sides with silence/room tone, or transcribe a window spanning the
   join and its neighbours, rather than an isolated snippet;
   (3) prefer forced alignment to free transcription when the words are known;
   (4) resolve remaining ambiguity automatically: run several checks (padded-window transcription at
   a few cut offsets, alignment confidence, speech energy within ~50 ms of the cut). If they disagree,
   take the conservative cut (keep more audio, ending in measured silence). Never escalate to a person.
   This session's "1877.68 drops 'I just'" test used abrupt-start snippets, so it's suggestive, not proof.

8. **Remove human-in-the-loop verification from the skill.** `editorial-checks.md` says to "ask for the
   smallest useful human check", and SKILL.md frames missing listening as a limit to disclose. The point of
   screenrec is that agents edit end to end: humans give direction and goals, not QA. The skill should teach
   automated verification instead: waveform/spectral checks at joins, alignment confidence, padded-context
   re-transcription, loudness and true-peak measurement, Vision checks of framing and exposure, frame-hash
   comparison for reproducibility. When evidence stays ambiguous, take the conservative choice.

## Feedback from the user (verbatim intent, chronological; keep every item)

Trailer content and pacing
- v1 cuts were good and found the spicy takes, but Lily's "Welcome to SOTA TV" felt random in the middle.
- Make many variations of the trailer: Dwarkesh-style (spicy takes, music, nicer transitions) and a16z "It's time to build"-style.
- Use the co-host brief for content inspiration; include at least one clip from each co-host.
- Use the raw individual camera recordings to compose the video where possible.
- Make it more exciting and spicier; "surprise me"; keep the Hollywood version and branch the spicy one off.

Music
- The first bed sounded "so depressing"; it needs to be way more exciting.
- Pull the actual audio from Dwarkesh episodes to understand the target style.
- Match the user's jevgrep launch video: a bit more upbeat, "not super classical".

Picture and colour
- Follow Dwarkesh's grade for the Dwarkesh variant and the a16z grade for the others.
- The Dwarkesh grade was way too dark, with edges darkened way too much; brighten it a lot.
- The grade made the background yellow; check the frames yourself.
- Verify with Vision that it's neither too dark nor too bright.
- "Hollywood" means production level, not letterbox bars: don't cut off parts of the video.
- Centre the faces (asked twice).
- Make sure no part of the video is cut off.

Captions and graphics
- Add subtitles; make the video feel like a Hollywood production.
- Captions should be TikTok-style: animate into view and highlight exactly the word being said.
- Make the transitions spicier.
- TikTok captions sat way too high, with too much bottom margin; move them down.
- Emojis are a cool touch: lean in and make them bigger and more impactful.
- After the spicy version: v1 was good but spicy is too TikTok, with too many emojis. Make something in
  between for Twitter with reactions and special effects, but less; one or two emojis max. Use screenshots
  of Graham's original tweets and quote graphics instead of emojis.
- Focus on the spicy/balanced direction for now.

Audio
- Normalize the voices: some Graham clips and Madison's clip were too quiet.

Tooling and process
- Use one repo for all videos (not one per video); media out of git, everything else in, so edits are reproducible.
- Keep a FEEDBACK.md for screenrec, update it regularly as you work, and include skill feedback plus all user feedback.
- screenrec needs good face detection.
- Explicit exports should overwrite the existing file.
- Use Codex (GPT image) for any image generation.
- Use the screenrec skill to guide the work.
- Lily should be able to reproduce the exact same videos from the repo plus the raw clips.
- Keep the repo clean and well organized (no stray screenshots); add a README per video with the decisions,
  so a fresh session with the originals can reproduce the exact same video.
- The repo README should include the screen-recorder install instructions, so Lily can just point her agent at it.
- Word timing is probabilistic. A re-transcription check is itself biased when the audio ends or starts
  abruptly (no continuation into silence), so it can make a correct cut look clipped. Some of this should
  be fixed by new screenrec capabilities, and some taught as a lesson in the skill.
- No human involvement in verification, ever. Humans only give directions and goals. Delete any
  recommendation that requires a human to check the work ("if humans needed to do that, they could just use a
  normal video editing app").
