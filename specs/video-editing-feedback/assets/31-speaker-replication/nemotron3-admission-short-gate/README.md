# Nemotron-3 short-gate refusal

Status: **restored under an experimental source overlay, then refused at the
short quality gate**. The pinned NVIDIA checkpoint now restores and runs offline,
but only by layering the exact NeMo source and Lhotse source needed by its NeMo
3.0 configuration over the existing sealed Yap runtime. That overlay has not
been sealed as a relocatable production runtime.

The unchanged three-case short-first protocol was run with the model-card
streaming recipe. `bspxd30` and `returns-overlap-silence` pass every gate. The
independent `aiqwk30` control has DER `0.1298`, identity confusion `0.00485`,
exact speaker count and resource bounds, but overlap recall `0.6054`, below the
unchanged `0.8` minimum. Long-form inference is therefore blocked and the
provider is not promoted.

## Runtime boundary

The base first-party closure is NeMo `2.7.3`, Torch `2.8.0`, NumPy `2.3.5` and
Lhotse `1.33.0`. The run prepends the selected NVIDIA-NeMo Speech source at
revision `3c0fdca291547aa4898cbf38d9f0325ec225d9d8`, the sparse Lhotse source at
revision `ed4eb7a242aeeca23077d08bd455030ce88b5175`, and the pinned NeMo 3.0
wheel. Network access was denied during restore and inference. The model and all
source/runtime hashes are in `protocol.json`.

This proves that the candidate can execute with a compatible source overlay. It
does not authorize replacing the registered runtime: the overlay still depends
on the existing sealed closure and has not been packaged, relocated and hashed
as one runtime. Prepare that closure separately, then rerun the same three short
controls. Do not tune thresholds, add count hints or open a long case while the
short gate is red.

`worker.py` is the exact inference worker used for the retained fixtures. The
compressed JSON fixtures contain complete native probability output and measured
resource timings. `replay.mjs` checks fixture hashes and recomputes the frozen
metrics without loading the model or network.
