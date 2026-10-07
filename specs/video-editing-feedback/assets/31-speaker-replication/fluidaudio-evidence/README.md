# Community-1 bounded provider trial

This is a distinct, frozen FluidAudio 0.15.7 offline Community-1 trial, not a
change to the preserved original Sortformer comparator. All three short cases
failed. No long run, threshold/count fitting, upstream patch or production
registration followed the failures.

The bounded [AHC threshold probe](threshold-probe/README.md) reuses one prepared
embedding pass and tests four declared distance cuts without changing any other
parameter. Its calibration assignments are identical at every cut, so it is an
executable refusal and does not promote a threshold or open the held-out case.

Run `node replay.mjs <repository-root>`. It uses the existing diarization scorer,
checks complete retained file hashes and byte-preparation receipts, replays
public observations and reproduces source-support refusals without clipping.
The script does not acquire, infer or write. No weights, media, runtime or build
output is included. The separate original `handoff-evidence` replay establishes
exact original parity; this trial cannot borrow its quality result.

| Case | Observed / reference speakers | DER | Overlap recall | Gate |
| --- | --- | --- | --- | --- |
| BSP30 calibration | 2 / 3 | scorer refuses | 38.6024% descriptive | fail |
| 100s returns/overlap calibration | 3 / 3 | scorer refuses | 99.3209% descriptive | fail |
| aiqwk30 held-out | 1 / 4 | 51.8390% | 0% | fail |

BSP30 ends at 30.084890365600586s for 30s physical support. The 100s output
includes endpoints 100.05093383789062 and 100.08489227294922. Those original
native numbers are retained; the authoritative scorer refuses them as invalid
intervals, so their DER is null. Their overlap figures describe activity against
reference overlap only and cannot turn an inadmissible output into a pass.
Held-out identity confusion is 37.4146%, exceeding the unchanged 5% gate.
Inference was 0.178/0.360/0.141s and maximum RSS 338,706,432 bytes, so compute
is not the failure. Automatic global clustering merged the four-speaker case
into one anonymous identity despite retaining overlap in configuration.

## Preparation and capture

The existing Core Models owner prepared all 25 pinned files totaling 21,635,985
bytes: four native model bundles, PLDA parameters and attribution/provenance.
Every file was rehashed after execution. Network-denied loading of all four
CoreML models and PLDA parameters succeeded in 10.449s. `readiness.json` scopes
that native byte/load closure, not provider quality or production registration.
License material preserves the supported Community-1 CC-BY-4.0 attribution.

`protocol.json` froze default Community-1 configuration except
exclusiveSegments=false (simultaneous turns required) and
exposeChunkEmbeddings=true (public numerical evidence retained). No count hints
were supplied; min/max/exact speaker count remain nil. One whole-input call per
case clusters that case jointly. Inference runs through the service's existing
jsonWorker process owner; network and repository/source-project reads are denied.
The reference executable is compiled in its own scratch build against unchanged,
exact pinned upstream source. The full source closure hash and worker hash are
retained; this is not a production native-runtime packaging proof.

All inference-bearing public segment fields, embedding256/rho128 vectors,
cluster assignments, speaker database and timings are retained. Native random
segment UUIDs were omitted by the explicit projection in `reference.swift`;
they do not change scoring. The captured completePublicObservations flag refers
to this numerical projection, not a byte-exact serialization of every public
property. Internal segmentation logits and prepared internal timed embeddings
are inaccessible through the public carrier and are not claimed retained. A
passing provider would still need a frozen reference-only observation seam to
prove full rawmodel replay. There is no reason to patch this failed provider.

Two pre-inference refusals are retained. First, the reference error envelope
omitted protocol-required error.details; adding an empty object exposed the
actual native admission refusal. Second, upstream Repo.folderName strips
`-coreml`, so the initial manifest folder speaker-diarization-coreml did not
match speaker-diarization. Core Models re-prepared the exact already-verified
local bytes under the correct folder, with no alias, download or inference/config
change. The refused manifest/preparation/protocol and all transport attempts
remain separate evidence.

## Concrete remaining capability

Reliable simultaneous-speaker/global-identity separation remains unproven:
original Sortformer loses four-speaker overlap, Nemotron native0.5 misses required
overlap and lower interpretation adds phantom speakers, and Community-1 defaults
merge the held-out identities. Community-1 also needs native source-endpoint
admission if pursued; its padded frame support cannot become physical media
support. Reslice provider selection/short quality, long-form continuity,
relocated runtime closure and word-attribution integration. Slice 31 and public
slice 32 remain unfinished. This bounded recipe is failed evidence, not a generic
external blocker or permission to loosen gates.
