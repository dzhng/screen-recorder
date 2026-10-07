# Community-1 AHC threshold probe

Verdict: **refused; no threshold changed the collapse.** This is a bounded,
data-only follow-up to the failed Community-1 provider trial. A single prepared
model pass retained the public 256-D embeddings and 128-D PLDA features for the
BSP30 and 100-second return/overlap calibration controls. `OfflineDiarizerManager`
then re-ran only its existing clustering/reconstruction owner at AHC thresholds
0.3, 0.4, 0.5 and 0.6. Fa/Fb, VBx iterations/tolerance, constrained assignment,
segmentation, embedding and post-processing stayed unchanged; no speaker count
hint was supplied.

Every threshold produced byte-stable segment assignments per case. BSP30 still
exposes two segment speaker IDs against three reference speakers, while the
100-second control still exposes three IDs but retains the known native endpoint
beyond its physical support. The calibration stop rule therefore never admits a
candidate or opens the held-out `aiqwk30` case. Lowering the cut does not explain
Community-1's identity collapse and cannot close slice 31.

`replay.mjs` verifies artifact hashes, prepared-observation shape and finite
values, threshold coverage, identical segment digests, frozen configuration and
the unchanged count/support refusal. It performs no acquisition, model loading,
inference or writes. The Swift source and package manifest are retained as the
exact generation receipt; they are not a production runtime or a promoted
threshold.
