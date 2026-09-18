# 08 — Durable local transcription and projections

Status: implemented and measured (2026-09-19). P6 is closed on real narration with one target
not met, reported rather than relaxed: word boundaries are late/early by a median of 135 ms
against a 100 ms target, always bracketing the speech rather than clipping it, and warm resources
pass with room to spare (0.004x real time, 147 MB peak against 4 GiB). Measuring it found and
fixed a defect of this repository's own — a sentence's punctuation token carried the preceding
word's end up to a second past the last sound. See the [boundary evidence](../assets/speech/boundaries/README.md).
- **P1:** native `speech.transcribe` gives exact word parity with the pinned CLI on
  generated speech with network denied. See the
  [evidence](../assets/speech/native-transcribe.md).
- **P2:** pinned model assets prepare and verify against HuggingFace. See the
  [assets record](../assets/speech/model-assets.md).
- **P3:** core owns the durable transcript store, processing, projection and search.
- **P4:** `transcript.get`, `transcript.search`, `model.status`, `model.prepare` and
  the transcript processing artifact are public through CLI/MCP.
- **P5:** narrated processed packages export with portable source and edited
  transcript pages and reopen with identical reads.
- **P6:** [boundary timing and resources](../assets/speech/boundaries/README.md) on this person's
  own narration, with the panels the marks were read from.

`apps/macos/tests/transcript-service.test.mjs` runs the bundled service with the
real prepared model (set `SCREENREC_SPEECH_MODELS`) on generated `say` narration
with an empty edit. It checks the gap row, paging, search, a mid-word cut, retry
and unchanged sources. It then exports the cut take as a narrated package, reopens
it, and requires identical transcript pages and search entries. Generated speech
proves plumbing only. Dependencies: 04 (Parakeet selected with
best-effort fillers), 06.

## Passes

| Pass | Question | Seam | Parallel |
| --- | --- | --- | --- |
| P1 Native speech operation | Can the worker turn acquired narration into offline source-µs word timings with the evaluated decoder? | Native `speech.transcribe` | with P2, P3 |
| P2 Model assets | Can pinned assets be acquired, verified and reported without touching recordings, and never at inference? | Core `SpeechModels` status/prepare | with P1, P3 |
| P3 Transcript store and projection | Does core own a durable, retryable, generation-pinned transcript whose word IDs survive projection? | Core transcript store, processing and reads | with P1, P2 |
| P4 Public operations | Can agents prepare models, observe readiness, page and search through CLI/MCP? | `transcript.get`, `transcript.search`, `model.status`, `model.prepare`, `processing.*` transcript artifact | after P1–P3 |
| P5 Narrated packages | Do narrated packages export and reopen with identical transcript reads? | Portable `source-transcript`/`edited-transcript` pages replace `UNSUPPORTED_ARTIFACT` | after P3, with P4 |
| P6 Real-evidence gate | Does production meet boundary timing and resource targets on real narration? | Evidence only | last; needs user narration |

### Owners and invariants

- **Only acquired narration is transcribed.** Native opens one stream per readable
  interval of the planned narration track, downmixes and resamples each to 16 kHz
  mono, and maps engine seconds back to source microseconds clamped to that interval.
  Gaps never become synthetic silence; an interval too short for the engine is
  reported as skipped.
- **The native request carries the pinned model file list with sizes and hashes.**
  Native refuses a missing or mismatched file before loading, so FluidAudio's own
  download path can never run at inference. FluidAudio links only into the worker,
  never the app.
- **Model assets live under `models/`** in a revision-keyed directory named as
  FluidAudio expects, staged and renamed in whole, and are never removed by
  recording deletion. `model.prepare` is the only operation that uses the network.
- **A word's span is when it was spoken.** Tokens are grouped into words exactly as the evaluated
  CLI groups them, and the engine's own word times are kept in the raw record, but the span every
  read and edit is aimed by covers only the tokens that carry speech. The engine places a
  sentence's closing punctuation wherever it decided the sentence ended — up to a second after the
  last sound — and that must not become part of the word a cut removes.
- **Words are verbatim with deterministic kinds.** Each word records text, source
  range, token-averaged confidence and a kind (`filler`, `vocalization`, `speech`)
  from a fixed rule over its emitted text. Raw engine output is retained as a hashed
  file. Word IDs are per generation, and every read and cursor names its generation,
  so a retry changes the generation instead of mixing IDs.
- **Transcripts are a heavy durable artifact** on the existing queue, with the source
  evidence as dependency. Missing narration is `unavailable:no_narration`; unprepared
  models are a retryable `unavailable:model_not_prepared` that starts no job.
- **Reads project through the shared timeline owner.** Cut words vanish, and words a
  cut intersects are `partial` with fragments under the same ID. Pages interleave
  explicit gaps for audio never acquired. Search is literal and case-folded over
  consecutive words.
- **Integration parity reopens 04 on divergence.** P1's lab compares per-interval
  sample transcription against the pinned CLI on the same audio before public
  operations ship.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Commands below are planned
harness entrypoints to create in this slice, not existing executable claims.

## Contract and API seam

Source narration becomes a faithful word-timed artifact; edits project it without retranscribing or rewriting.

Integrate only the selected engine behind the native speech worker contract. Add explicit model prepare/status and pinned acquisition; absent assets fail meaningfully and never trigger cloud use. Retain raw output and source words, project revision transcript/events through core, and publish readiness for the correct artifact generation. Allow frame inspection even if speech fails.

## Runnable checkpoint

Run bun run lab:transcript on a real recorded take containing a pause, filler, repetition and target phrase. Read paged words and literal search results, edit mid-word, observe clipped fragments, kill transcription, restart, retry and compare source hashes.

## Acceptance

Word IDs/source ranges remain stable across projections; current/historical requests identify revision and generation. No cleanup drops ums. Missing narration is an explicit empty/unavailable case; system audio remains separately accessible. Retry does not duplicate a running job.

## Decisions delegated and scope firewall

Model adapters and internal chunking are delegated only within the passed engine configuration. Chunk boundaries must not duplicate/drop words; changes affecting fidelity rerun slice 04's relevant held-out checks.

## Visual review

Transcript text/JSON is primary. Any transcript timing graphic or screenshot is reviewed for alignment only, with compare-screenshots when reference exists and screenshot-critique last.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If integration differs from the evaluated runtime or loses word accuracy, the model gate reopens; do not accept a passing probe for a different production decoder.

