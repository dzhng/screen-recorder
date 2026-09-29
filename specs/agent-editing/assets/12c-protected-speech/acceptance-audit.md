# 12c / 15a remaining acceptance

Read-only audit of main `41d80a70`. No builds, native/model execution, downloads,
audio playback, code or spec edits. Paths below are repository-relative.

## Current conclusion

RNNoise is the user-preferred **frozen candidate**, not an accepted production
processor. The missing work is no longer “find a denoiser,” “try another warmup,”
or “build a durable preparation owner.” It is protected-speech evidence and
listening, explicit remaining state/channel semantics, then actual typed DSP
adoption through the existing owner. `15a` being unimplemented is accurate;
several older infrastructure/state pickup sentences are stale.

## Banked evidence; do not repeat it

- `assets/12c-matched-noise/audition/{README.md,user-feedback.json}` records the
  user's “Learned filter sounds better” preference on the original five-second,
  separately RMS-matched cohort. Keep the source/model/build identities in
  `assets/12c-rnnoise/preparation.json`: source revision
  `70f1d256acd4b34a572f999a05c87bf00b67730d`, fixed model archive and build flags.
  Do not reopen conventional-versus-learned selection or change gain/model/recipe.
- `assets/12c-rnnoise-timing/` proves the measured frame adapter: mono 48 kHz float,
  two zero flush frames, fixed 960-sample compensation, exact selected counts,
  first/interior/end impulse positions, 1/17/479-sample cases, repeatability and
  extra-tail equivalence. One-frame skip/no-flush negatives remain failures.
  Its poisoned-input and independent-half-reset controls reject process-before-
  selection and reset-per-clip policies. Surviving impulse peaks are not speech
  protection: the model removes most impulse energy.
- `12c-matched-noise`, `12c-clean-reference`, and `12c-transient-noise` retain
  stationary/transient and clean/native-versus-quiet controls. The clean source
  has a pinned original FLAC and known transcript (`selection.json`). Metrics
  separate noise-only attenuation from mixed/reference changes; they do not
  separate residual noise in speech or certify intelligibility.
- `12c-channel-relations` proves identical/inverted-channel equality and measured
  half-level nonlinearity for correlated mono-derived channels. It neither chooses
  independent stereo processing nor covers different speech/noise per channel.
- `12c-range-origin` rejects the tested one-second warmup: 47,999/48,000 late-window
  samples differ (max0.0029093); full-origin control is exact. This is not a proof
  that every finite context fails. `12c-prepared-output` then provides the useful
  alternative: compiled selected input and frozen recipe parity, exact pure split
  and poisoned-neighbor preservation, fresh trim differing from stale crop, real
  noncommuting gain/RNNoise order, and bounded positional reads with inference
  unavailable. Root confirmation reproduces raw hashes. This is output-target
  mono research evidence, not production denoise bypass or clip-state adoption.
- `14a-prepared-audio`, `14a-prepared-portable`, and `14a-public-preparation` now
  establish the durable PreparedAudioStore/JobQueue/AssetStore owner, fencing,
  revision/upstream retention, restart, bounded reads, portable unit-rate/gain
  assets, public explicit-revision `audio.prepare`, ordinary asset/audio/acoustic
  inspection, CLI/MCP and fresh skill use. Those infrastructure gates do not need
  another parallel implementation or repetition just to add RNNoise.

## Actual remaining requirements

1. **Protected speech and listening (binding):** localize complete words, quiet
   consonants, onsets/ends and joins; assess loss, pumping, musical artifacts,
   naturalness and introduced echo on original and independent clean/noisy
   controls. No protected-phoneme labels or independent listening verdict exists
   in the retained-output proof (`verification.json` says so). The preference on
   one audition is real evidence but cannot stand in for these judgments. Raw gain,
   clipping and separately normalized audition provenance must remain visible.
2. **State/channel contract (binding, only partly proved):** the mono full-output
   prepared domain works for the tested pure split/trim/poison cases. Clip/track/
   group state domains, sentence activation and transitions, supported strength
   automation, dry neighbors, real stereo relation and channel policy are still
   unspecified/unverified. Do not infer them from resampling context or invent a
   linked-channel implementation. Existing research constraints should guide the
   later typed recipe, not be rerun as another warmup grid.
3. **Real stack inputs (binding):** post-retime speech and combined overlapping
   speech/noise inputs remain open. A gain-before/after noncommuting proof is not
   combined-parent DSP meaning; gain-only14a is not RNNoise-on-retimed audio.
   Accepted retiming/DSP domains are a separate dependency; do not fake them with
   synthetic timing metadata or make them a reason to block annotation work.
4. **Production adoption (genuinely absent):** `packages/composition/src/schema.ts`
   registers pointer/gain/geometry/opacity only; no RNNoise type is authorable.
   The research driver remains external. `15a` still needs frozen-entry parity,
   supported typed parameters/targets, model preparation/provenance and explicit
   unavailability, actual bypass/reorder/history/undo, preview/export/tap consumers,
   model-aware cancel/retry/restart/concurrent revision cases, poisoned selections
   and long/late bounded reads through the shared owner. Reuse14a lifecycle tests
   and add DSP-specific joins to that path rather than repeating every owner test.
   Retained model-dependent portability/scale/agent acceptance remain22/24/25.

These are grounded in `slices/12c-noise-reproduction.md`, `slices/15a-noise-processing.md`,
`processing.md` (Noise acceptance), `verification.md` (12c/15a), and the live
`journeys.md` rows for sentence treatment, optional denoise and processed tracks.

## Stale narrative versus invented diagnostics

- Stale: prepared-output README's “Core needs one durable owner” and its plan's
  “next ... single core owner”; that owner, public preparation and relocation now
  exist. Still true: the research result itself did not implement those services,
  and actual RNNoise preparation is unavailable. Link historical scope to14a
  rather than rewriting old reports as broader successes.
- Overbroad: “freeze a state policy” as if no useful policy were measured. The
  retained mono output-target mechanism is established; general target/channel/
  transition policy is not. “Investigate retained output” is likewise historical
  after12c-prepared-output. Conversely15a's “when11 lands” is stale: source/project
  acoustic consumers already exist, although RNNoise tap integration is missing.
- Agent-selected diagnostics, **not extra user quality bars**: global correlation,
  mixture-error/noise ratios, a particular one-second warmup, half-level channel
  max/RMS differences, impulse amplitude and ASR agreement. Preserve their values
  and failed experiments; do not promote arbitrary numeric limits, demand bitwise
  dry-versus-denoised speech equality, or require all stereo nonlinear differences
  to vanish. Exact duration, declared latency, kept-input isolation, pure-split
  preservation and range/full equality are binding invariants, not optional
  diagnostics to loosen. Listening is also binding and cannot be replaced by ASR.

## Smallest useful next pass without listening or new DSP

Create a **protected-speech review packet solely from retained PCM**, beginning
with the independent clean utterance and the already preferred original cohort.
Use `12c-clean-reference/selection.json`'s verified transcript (starts “MISTER
QUILTER”, ends “HIS GOSPEL”) and retain complete utterance context. Index the raw
reference, noisy, reference-only processed and noisy processed outputs by existing
hash, exact sample bounds and declared960-sample compensation. Add separately
labeled matched-level listening copies and short context windows only by lossless
cropping/constant audition gain; never rerun or normalize the numerical outputs.
Expose starts/ends and candidate quiet-consonant/word regions with annotation
status: the transcript is verified, but precise word/phoneme boundaries require
human confirmation. A waveform/ASR guess must remain a candidate, not a trusted
phoneme label. Keep the complete source audio available so crop choices cannot
hide defects; reuse the existing prepared whole/split-context auditions.

The deliverable is an addressable annotation/listening handoff with raw identities,
window definitions, gains/peaks, explicit unanswered quality questions and no
speech-quality verdict. This fills the current absence of localized evidence and
makes the next listening judgment concrete. It can proceed while retiming/channel
contracts remain open and without adopting RNNoise prematurely. It does not close
12c or justify marking15a ready. If implementation is pursued afterward, first
slice a constrained production-entry parity seam on the existing prepared owner;
keep readiness/refusals honest until its supported quality/state/channel contract
is accepted. No new denoiser, model download, warmup sweep or recipe change is
needed for the immediate pass.
