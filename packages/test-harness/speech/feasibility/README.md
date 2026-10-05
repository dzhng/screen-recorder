# Optional speech feasibility

These research producers run one explicitly prepared local provider against one
explicit PCM input. They do not download models, call product services, mutate a
library or choose edits. Model/source preparation is separate; the active spec
freezes candidates, licenses, corpus inputs and promotion rules before inference.
A failed provider remains evidence, never a product fallback.

The Swift sources use the identified FluidAudio SDK. Build them in a private
package with two jobs, using the pinned SDK source and no unrelated optional
text-normalization trait. Their positional arguments are local model directory,
mono16k float32 little-endian PCM and a fresh JSON destination. Use the model's
exact matching config and retain all speaker timelines, including overlap.

The Python producers use the identified private research environment, explicit
model/source files, PCM and a fresh result path. Each file's argument unpacking
owns its invocation. Provider sample rates belong to the frozen recipe; convert
original audio once and retain hashes of both original and prepared bytes.
Inference runs with networking denied, for example:

```sh
sandbox-exec -p '(version 1)(allow default)(deny network*)' \
  /path/to/research-python events.py MODEL_TFLITE PCM_F32LE NEW_RESULT_JSON
```

The scorer compares independent reference labels with complete candidate output.
Anonymous speaker labels may be matched only within evaluation; that mapping is
not a product claim about a person's identity. Overlap contributes speaker-time
error. Per-category event precision/recall cannot be averaged into an unrelated
category's pass. Untimed whole-file tags establish presence only, not intervals.

Cold process/model loading, inference and process peak RSS have separate scopes.
Host caches and out-of-process CoreML/ANE memory remain limitations. Preserve
complete operands before a gate, never tune confirmation cases afterward, and
keep missing independently listened word boundaries pending. The
[speech protocol](../protocol.md) owns those evidence principles.
