# Exact physical audio segment phase

Physical occupied segment times remain rational through acquisition intersection,
layout and decoder positioning. Microsecond availability is public evidence, not
a numerical execution anchor. Declared acquisition edges remain binding; exact
physical support cannot expand them. Existing sample-clock floor/nearest policies
are unchanged, with no fitted offset or tolerance.

The frozen MOV has a second occupied run at 5720000/6000000 seconds: exactly frame
45760 at 48 kHz. The old shared opener projected that start to 953333 µs. Full
source audio decoded from frame 45760 but placed it at frame 45759. A late request
at 1.2 seconds consequently skipped 11841 instead of 11840 native frames, selecting
original frame 52801 instead of 52800. Instrumented packet timestamps and decoder
selection establish this cause; the physical media payload is unchanged.

The common SourceTrack now retains the existing exact selection type. Raw source,
composition and excerpt consumers quantize only at their established sample
boundary. Public unavailable/readable metadata projects back to microseconds.
Excerpt conversion keeps its existing unbounded input lookahead; a temporary end
limit failed the existing resampled-edge preservation test and was removed before
acceptance. The failed log and unchanged-threshold green are retained.

## Evidence and limits

The native regression fails on the old owner and passes on the corrected owner.
It compares complete full and late PCM to independently authored samples and
checks that narrowed acquisition support still excludes physical audio. Frozen
rational and rounded controls remain distinguishable: corrected rational output
selects original frame 52800, while the rounded physical control selects 52801.

A persistent public library was seeded with ready source audio, project audio,
late source audio, movie preview, prepared audio and waveform jobs. Repeating the
same requests under the corrected service creates new job identities. Complete
source/project/prepared WAVs equal the original lossless samples (including the
real gap); the late WAV equals original frames 52800 through 62399. Preview proves
new publication identity, not an AAC sample-equivalence or listening claim.

Native source audio, composition audio, movie audio and transcript decoder recipe
identities change because these consumers share the corrected execution owner.
Prepared and acoustic recipes already pin upstream execution identity. Retained
published evidence keeps its original provenance; it cannot satisfy new execution
recipes. Picture-only execution is unchanged. No ASR inference was run.

The source-window and excerpt preservation suites pass, including bounded late
reads, acquisition gaps, mono/stereo, fractional-rate refusal and existing
resampled-edge thresholds. The focused core cache-owner suite passes 39 tests.
The integer mixer cohort retains full/range/tail/split behavior at 8, 44.1, 48 and
192 kHz. Independent read-only review found no concrete correctness defects.
This checkpoint does not close listening, codec-quality, capture-clock adjacency,
or whole-slice 08 acceptance.

`verification.json` pins commands, native identity and retained file hashes.
`evidence.tar.gz` preserves the diagnosis, public requests/replies and WAVs, test
logs and integer cohort. Frozen probes contain their original scratch paths;
reproduction requires a fresh isolated library and old-implementation seed before
new-implementation verification. The root storage harness owns its separate
combined capture confirmation here; earlier storage red evidence remains frozen.

## Combined capture confirmation

[Root verification](root-sparse-verification.json) upgrades the active sparse-storage
oracle to original sample placement computed directly from requested rational times.
The old reader fails the omitted-run comparison; the corrected reader passes all14
storage/publication groups. The exact and rounded controls now differ as required:
the exact late read selects original52800, while the rounded control selects52801.
Continuous44.1/48k, physical byte identity, full/late reads and interrupted publication
remain checked. Root CLI dependency build also passes. The155-file archive preserves
both runs and the independent oracle review; every archived member was hash-checked.
Earlier20a evidence remains frozen. This fixes reader phase, not the unwired capture
journal/materializer/publication repair.
