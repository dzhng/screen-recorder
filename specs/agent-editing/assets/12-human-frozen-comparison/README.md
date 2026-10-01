# Frozen outputs against eight actual human edges

The unchanged baseline fails this cohort (median 100 ms / p95 371.5 ms). Each retained alignment condition uniquely matches all eight edges and passes the unchanged 100/250 ms timing thresholds on this cohort (median 30.5 ms / p95 104 ms / worst 117 ms). All eight alignment predictions are identical across the three conditions. No recipe is selected.

Signed error in milliseconds: negative is earlier than the human mark.

| Human edge | Baseline | Float32 alignment | Text-coverage alignment | Float16 alignment |
| --- | ---: | ---: | ---: | ---: |
| w6-start | -43 | 117 | 117 | 117 |
| w6-end | 480 | -80 | -80 | -80 |
| w117-start | 15 | 15 | 15 | 15 |
| w117-end | -60 | 20 | 20 | 20 |
| w116-start | -140 | -60 | -60 | -60 |
| w116-end | 159 | -1 | -1 | -1 |
| w118-start | -170 | -10 | -10 | -10 |
| w118-end | 41 | 41 | 41 | 41 |

Scope: workbench, paragraph, uh and this start/end edges; one original development recording. Human marks are derived afresh from both saved confirmations and verified against their clip/source clocks. The baseline result independently reproduces the root report. The existing scoreBoundaries owner supplies unique same-word matching within 1.5 seconds, interpolated quantiles and unchanged timing thresholds. Candidate seconds use the existing source-origin conversion policy of 48,675 microseconds plus rounded candidate seconds; human clip seconds use annotation-time.mjs. No IDs or words were remapped to force matches.

Identity verification: actual narration source, inherited clock labels, original/supplied text, retained result, runner and documented result/contract/inventory hashes match their frozen records. Recorded audio/model/runtime/settings fingerprints cross-match the float32 control; the text-coverage condition differs only in its declared supplied-text insertion, and the precision condition only in its recorded dtype/runner. Complete original word order is verified for 306 words (307 with the declared insertion). All precision packet inventory entries rehash successfully.

Provenance limit: the prepared mono 16 kHz WAV scratch file is absent. Its recorded hash agrees across all retained runtime records, but cannot be freshly rehashed. Model/runtime identity remains recorded historical fingerprints, not a current-environment or rerun certification. These figures rescore identity-bound frozen outputs; no model, decoder or native worker ran.

Verbatim unavailable: /tmp/screenrec-speech-verbatim-run/result.json is absent. The retained old score does not contain all eight current edges, so no comparable aggregate or arbitrary neighbor reconstruction is produced. Restricted generated transcript is neither copied nor redistributed.

Opening um end is reported separately and missing in all three supplied-text outputs. Its onset is at the clip edge and excluded as censored; sentence endpoints are excluded because they are not individual word edges. This cohort pass does not establish filler recall, full-corpus timing, repetition/removal intent, protected-word coverage elsewhere, other joins, memory acceptance, held-out confirmation or production recipe selection. Historical scores, labels and frozen candidates remain unchanged.

The [root verification](root-verification.json) independently reproduced every
signed error and statistic and rehashed the retained labels and results.
Reinspection uses the existing `scoreBoundaries` owner and the retained result
paths and identities in the score JSONs. The transient orchestration script is
not a maintained alternative scorer. No historical packet or score was rewritten.
