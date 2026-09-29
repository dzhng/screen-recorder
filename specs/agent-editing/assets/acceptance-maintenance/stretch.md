# Stretch acceptance maintenance: 13 / 13a / 14

Read-only audit of current specs and retained evidence; no experiments, model/codec changes, code edits or spec edits. Public14a preparation is in root verification and is not reopened here.

## Binding requirements

-13/13a: accept a local pitch-preserving mechanism on real narration, not only tones. Required cases are0.8x,0.9x,1x,1.25x, whole phrases and local changes adjacent to unchanged speech. These rates are test cases, not a permanent API range.
-Exact compiler-declared PCM counts, finite correct-channel output, bit-identical untouched neighbors and independence from excluded source samples. Compensation must be documented; no hidden real-context admission, padding/cropping to mask a failed engine count, automatic window switching or silently imposed minimum editable duration.
-Tone acceptance requires an available estimate and strictly<1% error. A missing estimate is not a pass. Identity remains an independently verified bit-exact copy capability even for a one-sample request; a short tone's unavailable pitch estimate does not invalidate that copy capability.
-13a still requires independently labeled complete protected words at both joins and independent listening for clipped speech, intelligibility and naturalness. ASR names, waveforms, peak/energy metrics and file endpoints cannot supply that evidence. If no audio-capable reviewer is available, retain the unanswered audition as unverified and continue unrelated work.
-14 follows accepted13/13a. It must use shared prepared-audio/job/asset owners, exact manifest/implementation identity and existing editorial timing; no DSP in DB transactions. Public linked and unlinked audio/video retiming, selected rushed-speech edits, independent visual replacement, post-retime stacks, source evidence preservation, split/repeat/attachment mappings, range/full parity, invalidation/history and long-run drift need delivered-media proof. Absolute sample-phase/count and one-output-frame long-run A/V drift requirements come from contracts/verification, not an impulse-peak budget.

## What is already banked

Native/atempo reproduction established useful count/pitch/source-isolation observations but did not solve endpoints: native exact WAV is a diagnostic crop; atempo count varies with content. Universal padding/fixed-latency crop and hidden real-context fixes were rejected.

Signalsmith exact with pinned headers/settings, selected-only input and explicit equal-count identity bypass remains the numerical incumbent. Full-output support scans supersede the earlier censored windows without changing frozen output hashes. Request-specific admission boundaries,32 isolated output pairs,137 verified PCM identities,32 real-speech renders and13 reviewed plots are retained. Visual review is qualified, not absent; residual trace/zoom limitations remain explicit. Replot only when a listening discrepancy or omitted measurement needs it.

The short-window/RubberBand exploration is completed research, not a fresh search queue. StandardR3's1.076005% case fails the unchanged pitch gate. ShortR3 improves that case and available tone estimates, but isolated peak displacement worsens. Its independent176-result reproduction and36 short-candidate PCM identities are retained. No engine/window fallback or distribution decision was accepted.

Existing composition retime/split/mapping work and14a storage/publication/bounded-read/portability work must be reused. None establishes stretch readiness; none needs restarting to answer the remaining speech question.

## Threshold classification

Binding: exact requested sample count; <1% measured tone error; bit equality for unaffected/source-poison comparisons; compiler phase/rounding; production range/full and long-run drift requirements.

Frozen recipe capability, not a quality score: input/output frame-dependent seek length (queried/pinned upstream Float32 arithmetic and truncation);2880-sample default latencies;256-sample research block; explicit unsupported outcomes. Admission success never means accepted speech quality.

Research diagnostics, not user quality thresholds:1e-7 support-amplitude cutoff; zero-crossing estimator's middle-half window/minimum-crossing settings;33-sample incumbent versus199.75-frame/4.16ms candidate peak offsets; weak0.0739 peak from0.8 impulse;34.2%/44.6–45.7% retained impulse-energy observations; ±100ms plot crops; authored25ms guards and their approximately±25ms marking uncertainty;250ms audition neighbors. Preserve these definitions for matched comparisons; do not tune them to manufacture a pass or reinterpret them as allowable clipped-word/latency budgets.

The60s subprocess/selection ceilings are bounded research-runner controls, not a general product duration policy. Speech-cleanup median100ms/p95 250ms boundary targets belong to12b; they are not permission to lose that much speech at a stretch join.

## Smallest next step

1.Obtain independent audio judgments on existing hash-verified original/retimed real-speech auditions. Start with the retained opening phrase and short E2 controls plus clean whole-utterance control; retain the full seven-phrase cohort for confirmation. Judge both joins, complete consonants, pitch/intelligibility and naturalness separately. Keep the original unanswered user listening question unverified; do not repeatedly infer consent or acceptance from silence.
2.Independently mark complete first/last selected words and protected neighboring words on the real source, recording uncertainty and source identity. Existing ASR names and outer phrase marks are insufficient; the arbitrary100ms short audition is not a labeled word. First compare labels with already-authored selections. Only if an actual label exposes a selection mismatch, author the changed selection explicitly and reproduce that affected case with the existing pinned runner; old hashes do not validate a new selection.
3.Use those outcomes to resolve the current candidate or name the remaining short-speech failure. No new engine sweep, automatic window switch or global duration minimum follows. A passing subset may close a named subcheckpoint; whole14 remains incomplete if required local/short speech treatment is unresolved.
4.Only after scoped13/13a acceptance, the smallest implementation checkpoint is an adapter from the accepted frozen recipe to existing prepared-audio execution, with original recipe provenance and explicit count-based refusal before publication. Prove matched-input production parity first, then public linked/unlinked media/timing and post-retime stack cases. Research is mono48k; production channel/routing behavior needs explicit parity evidence rather than an inferred stereo policy. Reuse existing14a cancellation/restart/history/read/transfer controls instead of creating another ready store.

Primary local evidence: specs/agent-editing/slices/{13-stretch-reproduction,13a-stretch-endpoints,14-retiming,14a-prepared-audio}.md; contracts.md audio bounds; verification.md audio quality and preservation gates; processing.md preparation/order contracts; assets/{13-stretch,13a-signalsmith,13a-support-review,13a-endpoint-verification,13a-short-capability}/README.md; endpoint-verification/review.md and verification.json; stretch-measurements.mjs. No quality claim is derived from PCM or ASR alone.
