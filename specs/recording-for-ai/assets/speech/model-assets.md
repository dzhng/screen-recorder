# Parakeet model assets: real prepare

Evidence that the pinned manifest in
[speech-models.ts](../../../../packages/core/src/speech-models.ts) matches what
HuggingFace serves. Recorded 2026-09-17 on arm64 macOS 25.6.0.

- Repository `FluidInference/parakeet-tdt-0.6b-v2-coreml` at revision
  `ee09c569f73759e6d44c9bd16766f477b2b36d39`, folder `parakeet-tdt-0.6b-v2`.
- The pins come from two sources. The sha256 of all 22 files are the ones slice 04
  evaluated offline ([word report](parakeet-synthetic.json)). The byte counts come
  from the Hub tree API for that revision, whose LFS sha256 agreed with the
  evaluated hashes for all 12 LFS files. The repository has no LICENSE file. Its
  README declares `license: cc-by-4.0` and is pinned for attribution.
- Model digest: `4fe3f59cc82bab4ee7d06349b9a37c92d4b5758553b2cbb87a54ecc2dee6824a`.

| Component              |           Bytes |
| ---------------------- | --------------: |
| Encoder.mlmodelc       |     446,150,623 |
| Decoder.mlmodelc       |      14,447,282 |
| JointDecision.mlmodelc |       3,466,823 |
| Preprocessor.mlmodelc  |         329,757 |
| parakeet_vocab.json    |          18,762 |
| README.md              |           1,665 |
| **Total (22 files)**   | **464,414,912** |

## Result

`SpeechModels.prepare` ran with the real `fetch` against a scratch home outside the
repository. It streamed every file from `huggingface.co/<repo>/resolve/<revision>/`,
and each file's size and sha256 matched its pin. It took 144.2 s. The status went
from `absent` to `ready`, and staging was left empty. An independent `shasum -a 256`
over the installed folder matched all 22 pins. A new `SpeechModels` on the same
home, given a fetch that throws, reported `ready`.
