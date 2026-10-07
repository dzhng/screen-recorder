# Failed bounded speaker-provider trials

The exact original 30-second Sortformer comparator remains unchanged and passes
in the separate `handoff-evidence` bundle. This bundle banks independent,
preselected alternatives; none meets the mandatory four-speaker overlap gate.
No new production provider, relocated runtime or public operation is ready.

Run `node replay.mjs <repo-root> [original-handoff-evidence-root]`. Replay uses
the repository's existing diarization scorer, verifies retained file hashes and
complete native Float32 bytes, reproduces exact native 0.5 postprocessing, and
recomputes all calibration selections and held-out metrics. It performs no
inference, acquisition, tuning or writes. Original evidence defaults to the
sibling `handoff-evidence` directory. No media, model weights, wheel, runtime or
source archive is retained here.

| Frozen alternative | Held-out case | DER | Overlap recall | Result |
| --- | --- | --- | --- | --- |
| Original raw-score interpretation, BSP-calibrated 0.4 | aiqwk600 | 19.4823% | 8.0717% | fail |
| Same interpretation | original aiqwk30 | 14.7853% | 13.4529% | fail |
| Official original low-latency recipe, native 0.5 | aiqwk30 | 19.9100% | 0% | fail |
| NVIDIA streaming Sortformer v2, official very-high-latency recipe | aiqwk30 | 34.3837% | 10.7623% | fail; identity confusion 13.99% |
| Nemotron 3 high-context recipe, native 0.5 | aiqwk30 | 12.9848% | 60.5381% | fail |
| Nemotron BSP lowest-DER interpretation, 0.5 | aiqwk30 | 12.9848% | 60.5381% | fail |
| Nemotron BSP overlap-priority interpretation, 0.05 | aiqwk30 | 48.3726% | 95.0673% | fail; extra speaker |

The gates remain DER≤20%, global identity confusion≤5%, overlap recall≥80%,
inference≤2×audio and RSS≤4GiB. Nemotron also requires exact observed count.
Each interpretation freezes its selection using BSP calibration before scoring
aiqwk alternatives. Native aiqwk failure was already known, so these are
interpretation-held-out cases, not untouched or training-held-out datasets.
No long low-latency or Nemotron inference followed the failed short gate.

## Acquisition and runtime limits

Nemotron 3 checkpoint preparation went through the existing Core Models owner,
with pinned revision and exact bytes in `nemotron-preparation`. OpenMDW 1.1
metadata/license evidence lives in `nemotron3-metadata`. That is checkpoint
readiness only. Published NeMo 3.0.0 lacks the required RoPE encoder;
`restore-evidence` retains that failure. Pinned latest NeMo Speech source then
required a newer Lhotse indexing module; the second strict local restore passed
with both source layers. This experimental layered runtime is not a sealed,
relocated artifact. Its base runtime digest names the preserved original
runtime, not a hash of the combined new source closure.

The checkpoint-date NeMo source also failed Lhotse compatibility. Its first
attempt began before acquisition completed and used the wheel: it is retained
but invalid as source-admission evidence. The first Nemotron preparation missed
its scratch home; the corrected preparation is retained. A full Lhotse archive
exceeded the bounded download cap and was replaced by a filtered sparse checkout.
The original preparation had earlier written pip's default user cache before
scratch-cache discipline was established; no zero-user-cache-write claim is made.

Frozen protocols are retained verbatim, including descriptive copy errors:
low-latency `stateScope` mentions high-context 27.2-second chunks, but its actual
frozen `chunk_len=6` computation and worker source determine the smaller chunks;
Nemotron interpretation prose says four columns while exact code and operands
preserve eight. Neither typo changes a reported measurement or a selection.
`nemotron-threshold` retains the refused pre-parity protocol; corrected `r2`
first proves exact native final-frame semantics before alternative analysis.

The distinct NVIDIA `diar_streaming_sortformer_4spk-v2` checkpoint is retained in
the [v2 short-quality refusal](nemotron-v2/README.md). It restores in the sealed
NeMo 2.7.3 runtime and passes both calibration controls, but its held-out control
fails DER, identity-confusion and overlap-recall gates. The short failure stops
before long-form inference and does not alter the v2.1 production provider.

## Remaining work

Slice 31 remains red. Separate provider-quality selection from runtime closure:
first obtain a preregistered recipe passing every required short gate, then prove
long-form returns, overlap, silence and global identity; only a quality winner
merits sealed relocated runtime assembly. Word attribution and named-speaker
binding remain separate integration work and cannot inherit quality from
anonymous slots or model-card benchmarks.

`fluidaudio-inventory` banks one concrete next seam: already-pinned FluidAudio
0.15.7 Community-1 offline clustering. This is a read-only API/weight/license
inventory, not a measured quality result. A distinct short trial is authorized
separately; it does not retune the failed Nemotron recipe.
