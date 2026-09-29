# Exact voice runtime recovery

The former `/tmp` prepared home, runtime bundles and original virtual environment
were absent at this audit. Earlier preserved-home statements described the prior
checkpoint, not current availability. Recovery keeps the registered model, profile
and runtime identities unchanged; it does not repeat editorial generation or voice
quality acceptance.

All 14 model files remain exact in
`~/.cache/screen-recorder/prepared-sources/qwen3-tts-1eccf1cb2519` (2,516,143,009 bytes).
The recovered runtime source is now outside temporary storage at
`~/.cache/screen-recorder/prepared-sources/voice-runtime-3f20d26c32dfdc7d83f13e4e68cf3dab38ca5e6231f6bf9c2c20584b75805001`.
Its 11,428 inventory entries include 10,036 regular files totaling 488,274,953 bytes;
file contents, modes, relative symlinks and inventory digest were checked exactly.
Existing input files were cloned with distinct inodes; no writable hardlinks or
full-copy fallback were used.

[Root verification](root-verification.json) independently checks both runtime trees
and both model copies against registered hashes, modes and links, confirms separate
runtime-file inodes, and rehashes the complete evidence archive.

## Reconstruction provenance

The pinned Python base, repository entry/profile/pins and local uv cache provide
8,892 exact files. Another 1,073 bytecode files reproduce the registered bytes using
the pinned interpreter, original source contents, compile filename and timestamp.
The source filename remains `/tmp/screenrec-voice-venv/...` inside historical code
objects; it is provenance, not an execution dependency. The banked recipe records
source hashes and timestamps, including the verified virtualenv timestamp
`1790539740`. No bytecode is omitted from runtime identity.

Seventy installed metadata files are reconstructed exactly from uv metadata and
console-script conventions. Archived preparation evidence identifies the original
local source checkout. Its `direct_url.json` uses
`file:///tmp/screenrec-voice-runtime-src`; the surviving uv revision record provides
timestamp `1790539722` plus `18575016` nanoseconds. Both JSON files and the resulting
installed RECORD match their registered hashes. The sole modified Python source is
reproduced from the cached upstream file plus the committed probability-filter
patch, again matching the existing inventory rather than updating it.

The first combined verifier failed on one SciPy bytecode file despite the earlier
individual proof. CPython marshal output can differ with compiler object reference
sharing. The bounded reconstruction compiles at most twice while retaining the
previous code object, accepts only the registered hash, and fails closed otherwise.
The diagnostic, original verifier and final full proof are retained.

## Readiness boundary

The public preparation probe uses the existing service and CLI/MCP transports,
explicit local model/runtime sources, unchanged validation and the existing 180s
preparation deadline. It checks discovery identity, joined preparation, ready reuse
and readiness after service restart. It does not rerun the prior synthesis or
listening gates. Its durable home is
`~/.cache/screen-recorder/verification/voice-runtime-3f20d26c/home`.

The evidence archive banks the source-hashed reconstruction plan, bounded scripts,
read-only and materialization proofs, model hashes, public requests/responses and
preparation report. The recipe requires its recorded local sources if reconstruction
is needed again; the completed durable runtime itself is the preferred preparation
source. No package install, network download, model upgrade, native rebuild or
physical playback was performed.

Public preparation passed in 59,509.361ms, followed by ready reuse and a successful
service restart/readiness check. The service is stopped and the durable home is
released to the integration owner. Independent review found no actionable issues
in source isolation, exact identity, closed-failure behavior or the reported scope.
