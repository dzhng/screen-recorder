# The installed journey over a real narrated take

One run of `bun run lab:personal-release` against the installed app and the person's own
library, on the [checked-in take](../../../../fixtures/narrated-workbench/README.md) as it was
recorded on 2026-09-18: a 134-second narration of the local workbench with pointer gestures, a
pause, spoken fillers and the sentence "this is free".

[journey.json](journey.json) is that run's own report, with the selection reasons counted and
the transcript text cut short; [transcript.json](transcript.json) is the full projection the CLI
returned, words and acquisition gaps.

## What this run showed

- **Transcription** of real speech through the selected engine, offline: 306 words.
- **Fillers are best effort, as decided.** The engine emitted one "uh" and dropped the "um"s the
  narrator spoke. This is the measurement behind that product decision, not an estimate.
- **Search and editing** over evidence: "this is free" resolved to three consecutive word IDs at
  73.8 s and was cut; the same edit against the revision it replaced was refused as stale; undo
  and restore moved the current revision without touching the original media.
- **Screenshot selection** chose 156 images, naming why: cursor motion, button presses, coverage
  and the first frame.
- **Both exports committed**, and the processed package, moved out of the library, answered
  transcript reads page for page identically to the library and rendered a new frame from its
  own relocated media.
- **Storage accounting** reported live totals, with more than a third of them regenerable cache.

## What it does not show

Word boundary accuracy and the audibility of a cut: both need a person to listen, and the run
writes audio clips across each join for exactly that. The preview render in this run took about
as long as the take itself, which is the measurement behind the bounded preview rendition.
