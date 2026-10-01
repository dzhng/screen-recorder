# Local speech experiment

Build core, then run `node scripts/speech-eval.mjs --help` from the repository
root. `plan` prints pinned acquisition commands without changing files; `prepare`
downloads the Parakeet model and builds the upstream FluidAudio CLI outside the
repository. The model files, sizes and hashes are the ones core's
[speech model owner](../../core/src/models.ts) prepares for the product, and
`prepare` refuses a download that differs from them. Parakeet is the engine
[selected](../../../specs/recording-for-ai/slices/04-local-speech-gate.md) by this
experiment.

## Evidence belongs to the audio

A clip manifest supplies `id`, `audioPath` (relative to the manifest or absolute),
and `audioSha256`. The runner reads only that explicitly supplied audio, checks
its hash, verifies prepared model hashes, denies inference networking with the
macOS sandbox, and retains upstream reports alongside normalized `result.json`.
Every invocation gets a new output directory. A failed invocation retains its
partial diagnostics but cannot reuse an older transcript.

A dataset contains `fillerTerms` and `clips`. Each clip adds `origin` (`human` or
`synthetic`), `kind` (`canonical`, `held-out`, or `walkthrough`), `duration` in
seconds, and manually labeled `words`. Every word has `text`, `start`, and `end`;
`filler: true` marks an acoustically labeled filler and `required: true` declares
words that the fixture requires the experiment to preserve, including repeated
or false-start words. These are supplied preservation targets, not an engine
judgment of editorial intent. `covers` records
which real clips exercise `repetition`, `false-start`, `silence`, and
`technical-names`. The complete labeling, including ordinary neighboring words,
is necessary for useful boundary measurements.

Pass a JSON array of normalized results to `evaluate`. Evaluate each model
separately: mixing model or executable identities is rejected. Human review adds
`audition: { "reviewer": "name", "neighboringSpeechIntact": true }` to each result
only after listening to actual removals at its returned ranges. Keep the raw
result and the reviewed copy as separate evidence artifacts.

The upstream CLI runner starts a fresh process and sets `warm: false`. Its process
RSS and elapsed time include startup. It cannot certify the warm resource gate;
that requires an in-process production-runner measurement on the five-minute
human fixture, retaining equivalent provenance. Do not simply relabel the CLI
measurement warm. Missing fixtures, auditions, and warm measurements remain
pending (exit 2), observed failures fail (exit 1), and complete passing evidence
exits 0. Synthetic clips never contribute to the fidelity score.

## Interpreting measurements

Fillers are detected using the fixed `fillerTerms` vocabulary for this experiment.
Terms are individual tokens; ambiguous words such as “like” count as predicted
fillers whenever emitted, including ordinary uses. Label those uses correctly so
precision reveals this limitation. Freeze the vocabulary before held-out scoring.
This measures the proposed literal filler detector; it does not prove contextual
filler classification or phrase recognition. Repetitions are compared as ordered
occurrences, rather than as a set of words. Case and punctuation are ignored. When equally good text alignments match
different repeated occurrences, choose the alignment with the smallest total
word-boundary distance. Timing never overrides a better text match.

Boundary errors include both endpoints of exact aligned words; omitted words
have no invented timing. The report retains matched/reference denominators,
canonical omissions, and filler false negatives beside timing percentiles.
Wilson intervals describe the uncertainty in this small acceptance set. Neither
word timing support nor a vendor throughput claim establishes edit safety.

## Upstream provenance and notices

[engines.mjs](engines.mjs) owns the license identities; the runtime version and
commit, the model snapshot and its files come from core's speech model owner. Source checkouts retain upstream
LICENSE/NOTICES; the model card carries the model license, as the model repository
has no LICENSE file. FluidAudio code is Apache-2.0 and its converted Parakeet v2
weights are CC-BY-4.0. Preserve these notices and model attribution if
redistributing assets. No upstream code or weights are vendored by this harness.

The pinned [FluidAudio CLI](https://github.com/FluidInference/FluidAudio/blob/v0.15.7/Sources/FluidAudioCLI/Commands/ASR/Parakeet/SlidingWindow/TranscribeCommand.swift)
merges subword timings at whitespace boundaries. The probe CLI has a broader package
build surface than a final application importing the single selected Swift product.

FluidAudio resolves the parent of a supplied model path and appends its own
version-specific folder name. Its explicit asset directory therefore matches that
name; a generic folder can trigger an unintended download attempt even with assets
present. The probe denies network and requires a raw word report, since the upstream
CLI may log a model error while exiting successfully. For production integration,
set the runtime's offline mode before model loading: its ordinary retry path may
purge cached models before attempting a download.
