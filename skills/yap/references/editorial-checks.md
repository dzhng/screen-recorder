# Editorial checks

These are optional techniques for your delegated editing task. You choose the
edits and treatments; yap supplies primitives and makes zero editorial
decisions.

Use these checks to catch unintended effects, not to impose a style. Deliberate
silence, hard cuts, noisy recordings and independent picture/sound edits can all
be correct. Follow the user's intended result; select the necessary primitives
and settings explicitly. A preference for one candidate is not a universal preset.
Exercise delegated editing judgment when the task grants it; ask for clarification
only when an unresolved choice materially affects the requested result. Do not
turn a checklist into a mandatory approval sequence.

## Listen around the edit

- Review enough unchanged context on both sides to judge the transition. A clean
  isolated replacement can still sound pasted into the original recording.
- Use a familiar complete sentence with the original alongside. Avoid unexplained
  word fragments or random speech that make the listener guess what to judge.
  Label the changed region and give one concrete rubric, such as complete words
  and natural joins. A small slowdown may be barely noticeable; perceptibility
  and absence of damage are different questions.
- Separate judgments about word placement, pronunciation, speaker identity,
  level, pacing, echo and continuity. A natural-sounding clip does not prove that
  a cut falls between words. A correctly placed cut does not prove a natural join.
- Label artificial annotation aids, such as inserted digital silence. Approval
  of their boundary placement does not approve that sound as the final edit.
  Preserve earlier verdicts for their exact scope when later feedback exposes a
  different problem. Do not imply an algorithm improved when only the input,
  selected region or rate changed.

## Pauses, cuts and background sound

- Inserting zero samples can make the background vanish abruptly even when speech
  is intact. Inspect the noise floor before, during and after the gap; a pause in
  speech need not be silence in the room. Room-tone fill, chosen-scope noise
  reduction and deliberate silence are separate editorial choices.
- A low-energy region may contain a quiet syllable, breath or consonant. Treat ASR
  timestamps and waveform troughs as candidates, not verified word boundaries.
  When a boundary is wrong, repair the selection before tuning fades or DSP.
- Inspect room-tone samples for speech and distinct noises before repeating them.
  Listen for loop seams, repeated sound patterns and level changes at overlaps.
  Gain and fades can help, but overlap can also boost or cancel correlated audio.
- A short fade may suppress a click but can also soften a consonant; a longer
  crossfade can smear or duplicate speech. Choose overlap and curve from the
  actual join instead of applying a fixed fade to every cut. Preserve intentional
  breaths, emphasis and pacing unless the requested edit changes them.

## Replacement speech and processing

- Judge generated speech at its actual playback level beside the original.
  Louder output can exaggerate a mismatch. A separately labeled level-matched
  comparison can help diagnose timbre; it is not permission to normalize the
  original track or conceal the delivered level difference.
- Check entrance and exit separately. Extra lead-in or tail silence can expose
  an otherwise convincing replacement; one side may already be correct. Adjust
  only the requested timing and protect adjacent phonemes.
- A similar voice can still differ in echo, room sound or background hum. Keep an
  accepted candidate as the control; changing cloning modes is not a verified
  fix for a join problem. Inspect timing, level and background continuity as
  separate variables before attributing the cause or replacing the engine.
- Noise reduction can introduce consonant loss, pumping, metallic sound or echo.
  Compare untreated and processed context at the chosen scope, with bypass
  available. Lower measured noise and a matching transcript do not establish
  better speech. Retain the user's preferred result for that material without
  making its processor or settings mandatory for other recordings.

## Picture, sound and review workflow

- When changing duration, decide explicitly which picture, sound, captions and
  overlays move together. Inspect both planes after an audio-only or video-only
  replacement. A hold, inserted footage or another visual treatment is a creative
  choice; do not silently add B-roll or assume lip synchronization is required.
- Check the delivered framing, readable text and moving transitions, not just a
  valid export or a still thumbnail. Use exposed settings and capability checks;
  a preset must not hide a requested supported control.
- Verify autonomously using the capabilities discovered for this task. Use
  available audio/video perception, rendered-excerpt transcription, signal
  analysis and frame comparisons to investigate defects. No human listening,
  watching or transcript labeling is a QA prerequisite. When a person must hold
  a device or stage a requested capture, state the duration beforehand and honor
  their stop; analysis continues on retained files.
- State listening/playback limitations honestly. Numerical equality verifies
  preservation; it does not supply perception. Record what each agent check
  established and left unresolved; preserve any user preferences already given
  without asking them to repeat a check.

## Review the rendered candidate

For an assembled or publishable video, review the pinned rendered revision, not
only source excerpts. Build the review list from authored edits and project cut
events; distinguish track entrances/exits from whole-picture cuts. Source scene
changes alone cannot enumerate edited joins.

- Inspect every changed join with unchanged context on both sides. A window around
  1.5 seconds each way is a useful start; widen it for a sentence or a slow reveal.
  Compare sampled frames, waveform and audio on the same project clock. Look for
  flashes, unwanted jumps, clipped words, clicks, duplicated speech, missing room
  sound, caption occlusion and animation phase errors. A waveform spike is a
  candidate artifact, not an audible-pop verdict.
- Sample the opening, ending and representative middle sections. Check that the
  setup and chosen ending survive: a complete video delivers its payoff, while a
  [teaser](teaser-videos.md#the-question-end-strategy) can deliberately
  withhold the answer after a complete question. Check that captions or end cards
  do not accidentally reveal it. Check that text is readable at the intended viewing size, grades
  match, and music/effects don't mask speech. A still cannot establish motion or
  enough reading time; watch the changed transition when possible.
- Compare the delivered duration, dimensions, exact frame rate, streams and encoding
  with the pinned composition and requested output. Explain sample-grid differences
  rather than requiring rounded source-duration arithmetic to match exactly.
- Where available, measure whole-program loudness/true peak and section levels;
  use the [music checks](creative-workflows.md#music-and-sound-effects) to interpret
  their limits. Missing analysis must remain a stated verification limit.
- For high-stakes publication, an independent critic can help when delegation is
  available and authorized. Supply the candidate, user brief and actual references;
  ask for ranked issues with timecodes and evidence, not reassurance. Keep author
  explanations out of a first visual impression. Record what the critic could
  actually view or hear.

For suspected clipped speech, compare the rendered excerpt with its retained
source in a complete sentence. Re-transcribe the changed excerpt when useful;
prepare Yap's registered local transcription model through `model.prepare` when
needed for this check. Missing or changed words prompt
boundary investigation, not automatic text correction. ASR can omit or mishear
words, so combine it with waveform/spectrogram and any available listening.
Do not treat transcript agreement as proof that every phoneme survived, or
install an external transcription tool/model by default. Inspect motion over the changed interval
when possible; sparse frames leave unsampled intervals uncertain.

Fix observed defects, render the affected output and recheck the changed behavior.
Reuse unchanged accepted evidence. Keep iteration bounded: three review rounds
can be a useful initial budget; stop sooner for an external blocker or no progress,
and deliver the best checked candidate with precise unresolved issues instead of
presenting them as passed or shifting QA to the user. A failed render
is not a reason to repeat the same request unchanged. Save verdicts against exact
revision/artifact identities in the task workspace, not in the installed skill.
