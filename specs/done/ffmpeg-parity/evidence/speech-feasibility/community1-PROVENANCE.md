# Community-1 artifact provenance

This document covers the supported Community-1 artifacts in repository snapshot
`1ed7a662fdc7109e36d822db793ee6eebdaf8594`. Exact artifact hashes are recorded
in `provenance.json`.

## Source mapping

| Converted artifact | Upstream input |
| --- | --- |
| `Segmentation` | `segmentation/pytorch_model.bin` |
| `Embedding` | `embedding/pytorch_model.bin` (WeSpeaker ResNet34) |
| `FBank` | Feature-extraction graph configured from the embedding checkpoint; no separate learned checkpoint |
| `PLDA`, `PldaRho` | `plda/plda.npz`, `plda/xvec_transform.npz` |
| PLDA JSON resources | The same two NPZ files, serialized as Float32 tensors |

The immutable upstream reference snapshot is
`pyannote/speaker-diarization-community-1@3533c8cf8e369892e6b79ff1bf80f7b0286a54ee`.
Its relevant file history identifies checkpoint commit
`5428423440de6baac451412694bb79a0ad644bea` and PLDA import commit
`7aa6699f402495053a3898e112874cb3e68ee064`.

The PLDA files are byte-identical to the BUT Speech@FIT files with these hashes:

| File | SHA-256 |
| --- | --- |
| `plda.npz` | `9b77bcd840692710dd3496f62ecfeed8d8e5f002fd991b785079b244eab7d255` |
| `xvec_transform.npz` | `325f1ce8e48f7e55e9c8aa47e05d2766b7c48c4b25b8de8dd751e7a4cc5fbe8f` |

All six tensors in the two published JSON resources exactly match these inputs
after conversion to Float32. The six constants derived by the published PLDA
transformation also occur byte-for-byte in `PldaRho.mlmodelc` at the locations
referenced by its MIL graph.

## Recorded conversion environment

The modern artifacts record:

- PyTorch 2.8.0
- coremltools 9.0b1
- TorchScript source dialect
- coremlc 3500.32.1
- MIL component 3500.14.1

The public conversion reference is Mobius commit
`33fd6eab634966ae7db4d73da3376a90379642fb`, including conversion and
compilation scripts plus the locked Python environment. That commit postdates
the artifact conversion dates, so it is a reference implementation rather than
an attestation of the exact historical build.

## Reproducible successor pipeline

Mobius commit `ffbc3c8cae2d0ac83912a005a25a2874ced98a3a` adds a release command that:

1. Rejects mutable or abbreviated upstream revisions.
2. Downloads material inputs from the selected immutable revision.
3. Embeds source paths, hashes, upstream revision, and converter revision in the
   generated Core ML packages and JSON resources.
4. Compiles the packages and emits `provenance.json` containing every input and
   output SHA-256 plus the build environment and commands.
5. Refuses release builds from a dirty converter checkout.

Example:

```bash
uv run python build-release.py \
  --upstream-revision 3533c8cf8e369892e6b79ff1bf80f7b0286a54ee \
  --work-dir ./build/community-1-3533c8cf \
  --release-dir ./build/release-3533c8cf \
  --selective-fp16
```

Access to the gated upstream model and acceptance of its user conditions are
required.

## Historical limitations

- The exact upstream checkout used for the original 2025 segmentation and
  embedding exports was not recorded.
- The exact historical converter commit, invocation, Xcode installation, and
  SDK were not recorded.
- The existing segmentation and embedding artifacts therefore remain
  historically reconstructed, not build-attested.
- The older `pyannote_segmentation` and `wespeaker*` artifacts are outside this
  document's scope.
