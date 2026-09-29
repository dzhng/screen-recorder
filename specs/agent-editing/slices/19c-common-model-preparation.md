# 19c — Common local model preparation

Status: planned. Parent: [19](19-voice-assets.md). Dependencies: [19b](19b-voice-runtime-relocation.md).

## Contract and seam

One preparation owner supplies pinned ASR and voice execution inputs. Promote the
existing SpeechModels owner; do not add a voice registry or one competing staging
owner per model. Update both service entry points and all owned callers together.
Keep ASR's pinned files, download/cancellation semantics and transcript identity.

Common discovery lists finite registered model IDs, purpose, platform, identities
and preparation requirements. Existing model.status and model.prepare select an
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
