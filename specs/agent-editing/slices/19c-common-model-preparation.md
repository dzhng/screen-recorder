# 19c — Common local model preparation

Status: complete. Parent: [19](19-voice-assets.md). Dependencies: [19b](19b-voice-runtime-relocation.md).

## Contract and seam

One preparation owner supplies pinned ASR and voice execution inputs. Promote the
existing SpeechModels owner; do not add a voice registry or one competing staging
owner per model. Update both service entry points and all owned callers together.
Keep ASR's pinned files, download/cancellation semantics and transcript identity.

Common discovery (`model.list`) lists finite registered model IDs, purpose, platform, identities
and preparation requirements. `parakeet` and `qwen3-tts` name immutable registrations;
changed content requires a new identity. The descriptor content digest is available
before preparation for later replay. Existing model.status and model.prepare select an
explicit model ID; update owned CLI/MCP/app callers instead of keeping a separate
legacy default path. A resolved voice receipt contains managed Python/entry/model
paths and complete runtime/model identities. Paths are locations, not identities.

Prepare explicitly admits the verified19b local runtime bundle into managed storage
and uses pinned model file acquisition; allow an explicit verified local model
source for offline preparation. Never discover /tmp or invoke pip/uv resolution.
Registered manifests, not caller-asserted hashes, decide acceptable content. A
runtime artifact source is required until a separately verified distribution
exists. Status and generation never download or install. Distinguish registered discovery,
preparation progress and verified execution readiness: a pending asynchronous
verification cannot be reported as ready or block unrelated catalog reads.
Public status awaits one shared asynchronous verification per model; concurrent
callers all receive its result, without consume-once state or cached readiness.
Pending verification is an in-flight request, not an additional polling state.
The small ASR receipt/stat admission remains synchronous at the transcript boundary;
native execution still rehashes pinned model bytes. The runtime inventory uses
asynchronous descriptor reads and hashing, so its much larger walk does not
inherit that synchronous admission path.

Use one staged publication/recovery owner with per-identity concurrent flights.
Repeated prepare joins or returns the ready result; one canceled joiner must not
cancel other callers. Final cancellation drains cleanup. Preserve file modes and
internal relative links; reject escaping links, malformed inventories and changed
bytes. Bound work and yield during the approximately10,000-file runtime walk;
never copy the ASR synchronous small-file inspection into a blocking runtime scan.

Consolidate preparation identity checks without losing execution-time detection
of missing/changed runtime/model inputs. Shared worker launching uses one composed
sandbox profile; nested sandbox processes are not a portability assumption.

## Verification and review surface

Create a focused public CLI/MCP preparation journey with local verified inputs.
Test discovery, absent/preparing/ready/invalid states, restart, repeat preparation,
joiner cancellation and competing ASR/voice preparation. Check source mutation,
symlink escape, interrupted staging and no partial ready publication. Hold a
runtime verification in progress and prove unrelated catalog reads advance.

Run the frozen two texts through the resolved managed receipt with network and
development donor paths denied; complete WAV/PCM must equal19a. Preserve the
existing ASR preparation/transcription and shared lifecycle tests. Report model
storage/copy requirements honestly; a local preparation gate is not a remotely
obtainable installer or cross-machine distribution claim.

Delegated: internal module/type names and batching mechanics within these owners.
No runtime upgrade, new model or hidden source acquisition is delegated. User
feedback changing preparation source/platform expectations updates this slice.

## Current implementation and verification

The common owner is [Models](../../../packages/core/src/models.ts); registered
identities and local artifact admission live beside it. Both service entry points
and CLI/MCP callers select explicit IDs. The private voice renderer resolves
managed inputs through this owner on each attempt. No public voice operation is
introduced. Parakeet's existing directory and receipt meaning are preserved.

Local admission uses the existing bounded independent-file copy owner and verifies
the copy. It requires free capacity for the file plus a 512 MiB reserve; this
explicit reserve keeps one preparation from deliberately consuming the last free
space. Node clone requests returned ENOSYS on the measured host, so preparation
does not claim copy-on-write savings. Low capacity is retryable; no writable
hardlink alias is admitted.
Modes and relative links belong to the registered runtime artifact, including
when the service inherits a restrictive umask.

Verification is retained in [19c evidence](../assets/19c-model-preparation/README.md):
155 native-enabled focused tests pass without skips. The actual CLI/MCP journey
prepares, joins, reuses and restarts the complete managed runtime/model; catalog
reads advance during full verification. Same-size runtime mutation reports
invalid through both public transports and returns to ready after restoration.
Both frozen texts reproduce complete WAV/PCM exactly through the managed renderer
and through the composed donor-denial checkpoint. All 13 private entry refusal
and cancellation/deadline scenarios remain green. Real ASR reproduces all 306
inherited word texts/timings; its existing timing-quality failure is unchanged.

Independent review's restrictive-umask directory-mode finding was reproduced red
and fixed. The public journey also caught a strict-JSON optional-field error,
now covered by a public-wire regression. Final independent review found no
remaining actionable regression. The bundled service includes the static runtime
inventory; there is no checkout-relative manifest lookup or hidden source discovery.
