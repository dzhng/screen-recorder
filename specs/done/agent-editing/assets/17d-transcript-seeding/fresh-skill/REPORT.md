# Fresh-agent screenrec skill usability review

## Result
The requested black-box workflow succeeded using only skills/screenrec/SKILL.md, selected-operation CLI help, and public operations from the supplied built CLI. No implementation, tests, specs or diff were inspected; this is not a general code-correctness certification.

Project: f9651ad9-be88-4e1c-9a36-8ac42bb816f9
Final revision: cc52d5f6-4731-4a41-8588-5ee6eb5abc20 (ordinal 4).

## Actions and outcomes
1. Read the skill and CLI help; saved selected schemas for asset.import/get, job.get, project.create/get, revision.get, edit.apply, text.seed, transcript.get, model.status and frame.get. All service operations explicitly used the socket from /tmp/seed-skill-service.json.
2. Confirmed model.status was ready. Never called model.prepare or any download operation.
3. Imported the supplied narration.mov and /System/Library/Fonts/Supplemental/Arial.ttf through asset.import, polled jobs, and inspected admitted metadata. Narration was one 48kHz mono audio stream, track:1, normalized duration 133973334us. Font returned one explicitly named face, ArialMT, which was selected by immutable asset ID and exact PostScript name.
4. Created a 960x540, 30fps project with opaque #182030ff background; placed source [0,10000000) twice on one audio track, initially at [0,10000000) and [12000000,22000000). Added a separate video track for captions.
5. Retimed only the second occurrence to 6666667us with pitch:preserve, selected scope and no ripple. First occurrence remained intact. This was an authored timing probe, not an audio-readiness test.
6. Requested source transcript [0,10000000), waited through processing, then read a project transcript pinned to the post-retime revision. It returned 32 rows: 16 source words in each occurrence, all whole words. Both pages had nextCursor:null, so no continuation was skipped. Source generation: 85b3664d-14fd-4cb2-bc66-8fc9394ffe1f.
7. Chose words 0–6 separately for each occurrence: “Okay, so this is the recorder workbench.” Used original sourceRange and ordinal pins, not projected fragments. Called advertised text.seed once with two cue groups, distinct occurrence IDs and labels, space separator and project anchor. Explicit style: ArialMT; raster 960x540; size 42; #ffffffff; centered; wrap:true. Seed atomically created two captions in revision ordinal 3.
8. Replayed the byte-identical request with its original requestId and expectedRevisionId. Complete response data (revision, document, labels, normalized changes, created IDs) was equal. Transport envelope IDs differed normally.
9. Used text.set to correct only the first display literal to “Okay, so this is the Recorder Workbench.” (editorial capitalization, not a claim of an ASR error). Revision ordinal 4 retained the first caption's placement and immutable seed evidence; every other clip, including the second caption and both audio occurrences, was unchanged.
10. On that current revision, submitted an otherwise valid seed cue for the intact first occurrence with generation 00000000-0000-0000-0000-000000000000. It was refused with NOT_FOUND, “Retained transcript generation is unavailable”, retryable:false. Full revision.get data before and after was identical: no revision or caption was created.
11. Replayed the original successful seed request again after the correction and rejection. Its data still exactly matched the original seed response; project.get confirmed head remained the correction revision, ordinal 4.
12. Re-read the same source transcript selection. Complete returned data equaled the pre-seed result, including all 16 inspected word rows, generation and source transcript raw SHA-256 (7b29eccba9e5c3be856e8f785f6371020cccb8a2705ae0165d89ea41763acd63). No displayed correction changed source word evidence.
13. Requested pinned project frame.get PNGs, waited for readiness, and delivered them under this scratch directory. Personally inspected corrected.png at project 2s and repeated.png at 14s: first shows the capitalization correction, second retains the original literal; both are legible white text near the top on dark background. Returned layouts cover all 40 characters in one line and report only ArialMT. No clipping or missing glyphs was apparent in these two samples.

## Exact retimed placement
First caption: [1120000,5600000)us.
Second caption: [1593333338/125,393333338/25)us, i.e. [12746666.704,15733333.52)us.
Both endpoints exactly equal 12000000 + sourceEndpoint * 6666667/10000000 and exactly equal the selected project-transcript fragment envelope. Python Fraction assertions passed without rounding. These are authored placement checks, not proof of fractional display-frame transitions.

## Discovery friction
- Bare --help emits the whole catalog: 767580 bytes. The first attempt to display it overwhelmed the tool output; extracting operation names/descriptions and using selected-operation help recovered cleanly.
- Even selected edit.apply --help is 461763 bytes because it expands all union variants and nested schemas. Programmatic selection of track.add/place/retime/text.set was useful. Selected text.seed help was manageable at 7578 bytes and sufficient without implementation knowledge.
- Schemas describe inputs, not response shapes. Reading saved receipts was necessary to discover nested revision/edit labels, transcript rows, job results and picture layout.
- First transcription required a noticeable processing wait despite ready models; source/project readiness and dependencies made this diagnosable. No retry or download was needed.
- Center alignment is horizontal; a full-canvas text raster places this text near the top, not bottom-centered subtitles. That was acceptable for this explicit-style probe; more polished caption placement would need advertised geometry.
- No blocking usability defect was observed in this exercised path.

## Precise verification limits
- No listening, audio extraction, playback, acoustic evaluation or retimed audio execution was performed. Numeric timing, successful still rendering and transcript text cannot prove speech accuracy, synchronization quality, pitch preservation, natural joins, or retimed audio executor readiness.
- Source comparison covered the queried first 10 seconds (16 words); unchanged generation/raw digest also remained reported for the 306-word transcript, but all 306 rows were not individually compared.
- Visual inspection covered only two interior stills. No boundary-frame sweep, full movie, encoding/export, package relocation, alternate glyph/font coverage, content/clip anchor, split/copy or later structural-edit behavior was tested.
- Replay equality concerns byte-identical parameter files and complete response data, not identical transport envelopes or durability across a service restart.
- No repository edits/rebuilds, installed-app/user-library access, live capture, direct database/service-storage access, or shutdown. All direct scratch writes stayed here; public mutations wrote only to the externally owned isolated service. Service and project remain available.

## Evidence
- checks.json and checks.py: executable assertions and summarized results (all passed).
- *.request.json / *.receipt.json / *.stderr: saved attempts, including polling, rejected generation and both replays.
- seed.request.json, seed.receipt.json, seed-replay.receipt.json, seed-replay-after-correction.receipt.json.
- correct.receipt.json, before-invalid.receipt.json, invalid-generation.receipt.json, after-invalid.receipt.json, head-after-replay.receipt.json.
- source-before-15.receipt.json, source-after.receipt.json, project-words-2.receipt.json.
- seeded.png, corrected.png, repeated.png and associated frame receipts.
