# Picture allocation audit

| Finding | Trigger and amplification | Owner | Disposition / acceptance |
| --- | --- | --- | --- |
| High: decoded sources have no aggregate bound | Many active occurrences each satisfy the single-source dimension check; retaining256 large decoded pictures can multiply the former one-source footprint by256. Repeated occurrences do not share decoded storage. | PresentationSource metadata/open lifecycle and composition picture profile | Preflight encoded format areas before opening any readers. Provisional total area ceiling is8192² pixels, preserving the former nominal single-source ceiling. Prove an over-budget request refuses before decode and a smaller request still succeeds. |
| High: intermediate canvases outgrow a per-image bound | Each explicit canvas rasterization can retain an RGBAh surface; node count alone permits many full-canvas intermediates. | Compiled primitive admission | Bound the aggregate declared rasterized area per frame at8192² pixels. Assert the declared domain when executing the primitive. |
| High: cache limit does not bound live masks | Clearing a64MiB cache does not free masks still referenced by the current image graph. | Coverage-mask executor | Preflight unique live mask bytes, prune inactive cached masks before adding new ones, and bound the total at64MiB. |
| Dismissed: unchanged masks rebuilt for every frame | Identical coverage operations share per-executor cached masks; repeated held pictures additionally reuse the final raster when physical samples and visual instructions match. | Picture executor | Existing cache keys include every layer occurrence, exact selected sample and all operations; retain those equality gates. |

These are provisional pathological-work guards, not measured release-scale
capacity. Slice24 still owns representative scale and memory acceptance. An
excess request must produce a terminal profile refusal naming the limit kind,
bound, requested work and frame owner; it must not retry unchanged forever.

The final admission harness reproduces all three missing bounds against the
preflight-free worker, then verifies terminal `NOT_READY` refusals in the new
worker and a successful smaller recovery request. Its 4000×4000 encoded movie
has a 40×40 preferred-transform display extent: display size cannot conceal its
decode cost. Metadata preparation takes the maximum encoded area across track
format descriptions before opening readers. The variable-resolution metadata
path is audited; no variable-resolution fixture or peak-RSS acceptance is claimed.

Inactive clip dry/processed taps independently reproduce the earlier missing
picture error and now yield transparent PNGs with no pictures, readers or decoded
samples. [Admission results](./allocation-admission.json) retain the responses.
`picture-admission.mjs` takes a fresh output directory and `SCREENREC_NATIVE`.
