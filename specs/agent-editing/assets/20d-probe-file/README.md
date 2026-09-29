# Probe metadata file delivery

A native probe can describe more metadata than the control protocol can carry.
The existing probe now optionally writes its unchanged JSON to a caller-owned
output and returns a compact byte-count/SHA-256 receipt. Service consumers verify
that receipt before invoking the existing strict metadata schema. Ordinary asset
input admission is unchanged; canonical verification keeps its admitted input
file descriptor. Temporary output belongs to the existing render or source
verification attempt, and native children inherit its lifetime descriptors.

This is a transport prerequisite, not complete large-source admission. The banked
100,000-run canonical file produces 200,000 physical metadata rows: 100,000 occupied
and 100,000 empty. File delivery preserves every field and matches the previous
inline result exactly. The unchanged 100,000-row schema cap still refuses it.
Public asset reads and package manifests also still need bounded bulk metadata
delivery; their global frame/manifest limits remain unchanged.

The file payload has a 64 MiB delivery/parse budget, allowing the measured
15,428,099-byte metadata object without enlarging control frames. This bounds the
accepted serialized payload, not AVFoundation or JSONEncoder's internal allocation.
It is not a recording-duration limit or a claim that every media layout fits.

`verification.json` and `evidence.tar.gz` retain the commands, worker identity,
complete compressed metadata, actual public old-frame refusal, package manifest
refusal, preservation checks, and fresh-attempt result. Old immutable import
request IDs retain their prior result; a fresh request ID starts new work.
The source fixture and independent PCM/publication proof remain in
[the source-budget leaf](../20d-source-budget/README.md).
