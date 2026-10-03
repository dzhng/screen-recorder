# Common model preparation checkpoint

The [manifest](manifest.json) records the immutable inputs, archive digest and
measured gates. The lossless archive contains complete generated WAVs, public
CLI/MCP traces, donor-denial controls, private entry refusals and process cleanup,
and the real ASR reproduction. It excludes the multi-gigabyte managed installation.

The public journey verifies a locally prepared runtime through the common model
owner, including restart, reuse, concurrent catalog reads and same-size runtime
mutation. The normal private renderer and the single composed donor-denial
profile reproduce both frozen voice outputs exactly. The latter separately
refuses reads of the original interpreter, environment, runtime bundle, worker
source and model source before synthesis; it does not rely on nested sandboxes.

ASR retains all inherited word text and timing. Its inherited timing-quality
failure remains unchanged: this checkpoint establishes preservation, not cleanup
quality. Voice byte parity likewise is not a listening, cold-cache or cross-host
determinism claim. Public voice generation is still outside this checkpoint.

Preparation copies through the existing bounded file owner. A direct Node clone
control returned ENOSYS, so the implementation makes no copy-on-write savings
claim. The explicit admission reserve is documented in the
[slice](https://github.com/dzhng/screen-recorder/blob/f362b1f6cf9fa2ae558150a717210ef6a5b09dac/specs/agent-editing/slices/19c-common-model-preparation.md).

The recorded early failures include strict JSON discovery before its fix and a
missing local model source. The coordinating task restored the same pinned model
files to a durable local source; the passing preparation independently verified
those files again. The earlier disk-exhaustion interruption is not a passing gate.

Run the public journey with explicit verified sources and the relocation
checkpoint's assembly metadata and donor profile:

```sh
node packages/test-harness/editing/model-preparation.mjs \
  --out /absolute/new-evidence-directory \
  --runtime /absolute/verified-runtime-bundle \
  --model /absolute/pinned-model-source \
  --native /absolute/screenrec-native \
  --assembly /absolute/relocation-assembly.json \
  --profile /absolute/relocation-denial.sb
```

The private lifecycle runner takes the resulting managed library through
`--model-home`; it does not accept self-asserted runtime paths. These scripts and
registrations describe this committed checkpoint; later entry changes need a
new immutable descriptor rather than retargeting its identity.
