# RNNoise native dependency

This package owns only the fixed learned mono frame adapter. It has no project,
source-selection, renderer, model-download, queue or publication authority. The
composition audio owner supplies a selected state domain and consumes output
through the existing prepared-audio lifecycle. This library does not select
channels, source context or project state boundaries.

Sources and generated header are unchanged from the pinned upstream revision;
[provenance](provenance.json) binds their exact bytes and the frozen model archive.
The generated model C is large, so it is explicitly staged into ignored build
storage. Build preparation never downloads or converts weights:

```sh
node helpers/denoise/prepare.mjs /absolute/path/to/frozen-model.tar.gz
swift build --package-path helpers/denoise --product DenoiseParity
python3 packages/test-harness/editing/denoise-entry-parity.py \
  --native helpers/denoise/.build/debug/DenoiseParity \
  --reference /absolute/path/to/frozen-rnnoise-api --out /tmp/new-parity-evidence
```

The native audio target links this library directly. Prepare the local model
before building native products; `scripts/build-macos.mjs` verifies staged bytes
and vendored sources before Swift compilation. `prepare.mjs --verify` checks the
same prerequisite without extracting an archive. No runtime command prepares or
downloads weights. External model redistribution readiness remains unresolved;
local personal execution does not establish a weights license grant.

The adapter accepts finite mono float samples at the frozen rate, streams bounded
frames and preserves state across read chunk boundaries. The caller declares the
selected count and owns transactional output cleanup if reading, writing or
cancellation fails. It must not treat preview bounds as the state origin. See the
[parity contract](../../specs/agent-editing/slices/15a1-denoise-entry-parity.md)
for the measured recipe; the [runtime contract](../../specs/agent-editing/slices/15a2d-linked-denoise-runtime.md) owns composition integration and its remaining gates.

The vendored upstream code is covered by [COPYING](COPYING). Retain that notice
with source and binary distribution. Model provenance is retained; broader
product distribution and acceptance are a runtime-adoption gate, not inferred
from successful compilation. No trained weights are committed here.
