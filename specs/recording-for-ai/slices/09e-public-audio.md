# Revision-bound audio inspection

Status: public integration verified for generated two-track media, cuts, gaps,
CLI/MCP parity, cache regeneration, missing roles and explicit failure/retry.
Audition remains open. Native execution is verified in 09b; source timing is published by 06j.

The core pins a revision, validates a positive playback range no longer than
30 seconds, and uses the existing timeline trim mapping to obtain retained source
spans. Native executes those spans; it must not resolve edits or infer acquisition
from container padding. The index supplies bounded acquired intervals per requested
narration/system role. Current capture files share source zero, as established by
CaptureWriter.startSession and CaptureClock; do not invent track offsets.

Distinguish unrequested audio, requested-but-missing acquisition, and a requested
range containing genuine gaps. Mix only the available captured tracks, retaining
explicit absence metadata. One native track uses unity gain; two use the already
verified native half gains. Preserve source-evidence generation and integrity in
the result. Do not turn missing acquisition into reported recorded silence.

Reuse the durable queue, cache and bounded delivery owner. Cache misses regenerate
the same pinned request; failures wait for explicit retry. Extend the adapter's
shared byte delivery to audio files/content without duplicating transfer logic.
The native writer owns the WAVE container independently of opaque cache filenames.

Verify a generated two-tone/two-track source through real public requests across
a cut, with gaps, absent roles, current/historical revisions, repeat/cache eviction,
explicit retry and source hashes. CLI files and MCP audio content must match.
Numerical checks do not replace the existing audible-join/audition gate.


[Public evidence](../assets/audio-inspection/review.md) distinguishes real adapter
and native execution from the remaining listening and physical acquisition gates.
The public unavailable intervals retain source coordinates; the requested playback
range and retained source spans provide the projection into the excerpt.

Native audio decode and I/O failures permit an explicit retry; invalid requests,
ranges and output plans remain terminal. Retry permission means another attempt
is allowed, not that an unreadable or corrupt source is guaranteed to recover.
Ordinary reads retain the failed result even if the underlying condition changes.
