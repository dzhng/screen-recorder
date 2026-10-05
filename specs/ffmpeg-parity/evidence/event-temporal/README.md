# Independent temporal event cohort

This bounded experiment selects **no category or provider**. Laughter fails the
frozen development calibration. Clapping passes development at its selected
threshold, then fails once on untouched confirmation. Applause and Gasp are
unannotated here; neither can inherit Clapping's labels or result.

## Label and media authority

[Original dataset declaration](upstream-readme.md) describes human annotators
listening to synchronized close microphones and validating audible scene events.
The [actual MIT notice](dataset-notice.txt) and immutable
[Zenodo record](dataset-record.json) cover the released dataset. Temporal labels
are 100 ms occupancy frames, preserving simultaneous classes and sources; they
do not certify finer onset/end precision.

[Selection](selection.json) uses original labels and bounded source-member size
only, before any audio acquisition or model observations. Train and test use the
provided official split. Each includes a Laughter window, a Clapping window and
explicit negatives. The [frozen protocol](frozen-protocol.json) owns the category
mapping, calibration budget, source projection, patch support and acceptance rule.

[Admission](input-admission.json) binds complete original ZIP member size/CRC/SHA,
exact physical RIFF clocks, selected integer frames, direct MIC channel zero,
original PCM16-to-Float32 conversion, prepared resampling bytes and complete
original label reconstruction. Range responses and central-directory hashes agree;
the server provides no ETag. The entire multi-gigabyte audio archive's published
MD5 was recorded but not independently computed. No whole-archive integrity claim
follows from selected-member admission. The [source operands](operands.json)
retain exact selected original channel PCM16 windows under the dataset notice.

## Mapping and quality

YAMNet's native scores classify a 975 ms context with 480 ms hops. The fixed
[bin owner](bins.mjs) assigns each original 100 ms bin midpoint its nearest native
patch center. It retains original support and abstention denominators, with no
neighbor maximum, onset shift, dilation, subtype substitution or subjective cuts.
Raw model scores remain complete; this is an explicit coarse occupancy recipe.
Scene annotations were not independently listened on the selected microphone
channel. That projection assumption and model-context granularity limit the claim.

The [development report](development-report.json) contains the complete frozen
threshold curve. [Selected thresholds](threshold-decision.json) were frozen before
any test inference; that file records the decision-time snapshot. The
[confirmation report](confirmation-report.json) evaluates only the selected named
category. The [research map](research.json) owns outcomes, costs, effects and next
hypotheses. Complete scores were generated for all native classes during Clapping
confirmation; these source windows are now consumed research inputs, even though
Laughter has no selected threshold or confirmation score.

[Replay](replay.mjs) verifies retained operands and recomputes occupancy without
running models, acquisition or resampling. PANNs Cnn6's existing clipwise output
cannot certify timed intervals. A different temporal provider or semantic recipe
needs a separately frozen protocol and new untouched confirmation; lowering a
threshold after observing this failed test cannot promote this recipe.

The [independent review](review.txt) led to explicit preflight rejection of stale
frozen decision bindings and existing attempt diagnostics. Seven mutation probes
failed before those guards and pass after, without running any model. Historical
raw operands and decisions were preserved byte-for-byte.
