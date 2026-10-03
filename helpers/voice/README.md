# Reference speech execution

This sidecar executes the registered reference-conditioned voice profile. The
shared model owner verifies prepared runtime and model bytes; the service uses
its existing JSON process and render-attempt owners for execution, cancellation
and staging cleanup. The worker cannot publish assets or edit projects. Its
stdout carries one result; third-party progress belongs to stderr. Python
isolated mode excludes ambient module paths, and the OS denies network access.
Ordinary execution never installs or downloads a model.

The authoritative [profile](../../packages/core/src/model-data/voice-profile-v1.json)
is embedded in model discovery and shipped as an identified runtime file. It
states measured work and numerical limits, rather than universal model capacity
or voice quality. Requests retain their values alongside effective clamps and
filter modes. The frozen default recipe remains the parity oracle.

A narrow adapter observes the pinned backend's original preparation calls to
measure actual context before the talker loop. It preserves original return
values and restores the temporary encoder observation on failure. This is a
source-pinned private API dependency, not a second prompt or tokenizer owner.
Generation that exhausts its token budget without observing EOS is refused
before publication; audio length cannot determine that distinction.

Reference bytes live in the service's existing attempt workspace. Shared process
cleanup remains responsible under SIGKILL. Completed output moves through
exclusive publication, never overwriting an input or existing destination.
Public durable generation and source selection remain separate integration work.

The identified runtime includes one [source patch](probability-filter.patch) to
Qwen's probability filter. It preserves valid filtering and the default bypass;
only an otherwise-empty result from valid finite support restores the first
maximum-logit candidate. Invalid logits are not fabricated into valid support.
The [numeric evidence](../../specs/done/agent-editing/assets/19d1-probability-filter/README.md)
records why a fitted top-p minimum was insufficient. Runtime inventory and the
entry's source pins identify the patched bytes; the upstream commit alone does
not identify this execution contract.

Durable receipt structure lives in [voice-types](../../packages/core/src/voice-types.ts)
and does not import current profile bounds. Durable objects reject unknown fields
instead of silently discarding them during canonical identity. The executor's
explicit response decoder tolerates additive worker fields, then verifies the
known semantic fields against the current request and registered profile.
