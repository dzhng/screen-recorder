# Original official checkpoint reproduction

The exact official checkpoint and native high-context recipe pass this bounded
six-window speaker gate. Every case has DER below 20%, including overlap with no
collar; pooled development DER is 9.581% and confirmation DER is 13.432%. This
selects no production runtime or provider architecture.

The [protocol](frozen-protocol.json) froze original artifact revision/hash,
NVIDIA Open Model License, NeMo/runtime versions, CPU budget, source cohort and
native settings before model acquisition and inference. The actual
[card](model-card.md), [license page](license-page.html.gz), [artifact metadata](model-artifact.json)
and [acquisition receipt](acquisition.json) are retained. Inference restores the
explicit local file with networking denied; it never calls model acquisition.
The 471 MB checkpoint remains in the shared research cache, without another copy.

The source cohort and independent original-byte/label admission are owned by the
[speaker cohort](../speaker-cohort/README.md). Every original Float32 hash agrees.
Every output contains 375 native 80 ms rows spanning exactly 30 physical seconds;
all native segment bounds are already inside that support. No clamp, tail removal
or interior endpoint change was needed. Default native postprocessing uses onset
and offset 0.5, with zero padding and duration filters. Original raw probabilities,
segment lines, encoded model configuration, process logs and attempt receipts
remain complete. The configured speaker-cache update period is 300; native chunk
boundaries make its effective period 340, as the retained implementation/logs
explain. The additional streaming-source snapshot was recorded after inference,
without modifying installed code or the frozen recipe.

[Research](research.json) retains every case, phase and resource result. Maximum
inference is 0.660 seconds per 30 seconds of audio; process peak RSS is 1.955 GB.
Imports/model/input loading is measured separately. The private Python research
environment reuses unchanged dependencies read-only, so this is no independent
clean-install or uncached machine claim. The earlier converted/CoreML default
recipe fails on one development window. Artifact, runtime and recipe differ
simultaneously; this experiment cannot attribute the improvement to conversion,
settings or implementation separately. All earlier failures remain valid evidence.

The official card explicitly lists VoxConverse v0.3 in training data. Confirmation
was untouched by our calibration, never certified training-held-out. Six short
windows do not establish population quality, arbitrary speaker counts, unknown
assignment confidence, known-person identity or long-form resource bounds.

[Replay](replay.mjs) verifies the historical operands and exact unchanged DER
scorer without model execution, acquisition or writes. A passed research gate
permits a small production integration spec: preserve this exact original recipe,
resolve the optional runtime/dependency closure with existing voice/model
preparation and jobs owners, and verify source/project contracts. It does not
authorize a separate Python installer/service or implicit model downloads.
