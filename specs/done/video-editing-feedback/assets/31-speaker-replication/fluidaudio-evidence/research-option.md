# Separately declared clustering diagnosis option

Read-only feasibility inventory; no alternative evaluation or calibration has
been run. The failed Community-1 recipe remains frozen and red.

The exported public chunk observations contain every finite embedding256,
rho128, chunk index and original assignment. Upstream selectTrainingEmbeddings
only drops nonfinite embedding vectors; all retained vectors are finite. That
is sufficient to replay the exact AHC warm start, VBx refinement, centroid census
and per-embedding assignment without repeating segmentation or embedding
inference. Pinned PLDA psi parameters remain available through the prepared
model closure. Do not reimplement those numerical algorithms in JS: compile a
small reference-only export alongside unchanged pinned upstream source and
retain its complete closure/hash. These internal stages are not public APIs.

First replay the failed default recipe from exported observations and require
exact assignment parity, with native column/order and Float-to-Double semantics
unchanged. Record AHC initial count, VBx pi census, assigned centroid count and
public assignment count separately. That localizes the collapse:

- AHC threshold is a Euclidean cut on L2-normalized embeddings. Default 0.6;
  lower values merge less and can seed more initial identities.
- warmStartFa and warmStartFb default 0.07 and 0.8; they control VBx's likelihood
  precision/recall tradeoff and posterior pruning. They affect the surviving pi
  mixture, rather than forcing an output count.
- maxIterations=20 and convergenceTolerance=1e-4 stop VBx's arithmetic refinement;
  changing them is a different convergence experiment, not an identity fix.
- constrainedAssignment=true already prevents local co-chunk identities from
  snapping to the same centroid when more than one centroid survives. It cannot
  create a missing centroid after collapse.
- exact/min/max speaker count would force repartitioning and is forbidden here.
  Embedding extraction duration/masking/skip strategy and zero-vote reembedding
  require different evidence or inference and are outside data-only diagnosis.

A bounded proposal, subject to separate acceptance/freeze before evaluation:
use only BSP30 and the BSP100 return assembly; replay four AHC cuts
[0.3, 0.4, 0.5, 0.6], keeping Fa/Fb, iterations, tolerance, constrained assignment
and every other parameter exact. Record automatic counts and all assignments.
Use no aiqwk information, no known-count input or forced cluster creation. If
both BSP cases can infer their reference count, prefer the highest threshold on
a count-error tie and freeze it before one aiqwk diagnostic count evaluation.
Do not broaden into a Fa/Fb grid when this diagnostic fails; bank and reslice.
The reference count is calibration scoring truth, not a runtime count hint.

This experiment can isolate AHC-caused collapse; it cannot establish final
speaker quality. The public cache lacks segmentation masks and logits, so a
new assignment's exact timeline/DER/overlap cannot be reconstructed from it.
A cached PreparedDiarization in a new reference process can publicly re-cluster
without more inference, but the carrier cannot be serialized from public fields.
A complete final-quality experiment therefore needs an explicitly frozen
same-module observation seam, one fresh short preparation, and retained complete
internal source operands. No long run until all unchanged quality gates pass.

Native source-endpoint admission is independently red: changing clustering
cannot legalize padded output beyond physical sample count. No data-only cluster
count result, including a correct aiqwk count, closes slice 31, public slice 32,
word attribution, long-form continuity or new-runtime packaging.
