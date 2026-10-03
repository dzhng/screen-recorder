# Capture-end interruption evidence

Interruption inspection reports a recorded capture/video endpoint, never the
instant a device failed. A trustworthy complete payload makes interruption
coverage ready with zero markers. A trustworthy interrupted payload supplies one
marker with its original journal sequence and failure code. Lifecycle-only or
presence-only completion remains unknown; damaged evidence is untrusted; a
contradictory terminal lifecycle is a conflict. Those categories explicitly remain
unavailable rather than manufacturing a crash from missing bytes.

The source owner converts the capture endpoint through the selected acquisition
binding exactly. A shorter audio stream does not move the endpoint to its own end.
The marker is visible only where selected source support reaches it from the left.
An excluded tail therefore suppresses the marker without erasing the retained
capture provenance.

## Boundary ownership

Ordinary cursor, pause and geometry points retain half-open support and `[start,end)`
query windows. Capture-end markers close the support on their left: support and
query ownership use `(start,end]`. This includes a recording or clip endpoint once
and partitions adjacent query windows without duplicating it. It does not change
frame/sample lookup or pretend that media exists after the endpoint.

Composition exposes an explicit endpoint projection sharing the same exact timing
and support index as ordinary point projection. Repeated, reordered and rationally
retimed occurrences retain their clip, track and capture identities. The existing
project ordering—time, track rank, clip ID, source ordinal, event kind—stays intact.
At a same-track join, a prior endpoint can tie several observations opening the
next clip. The existing capture checkpoint holds one deferred head while those
opening observations merge by the established key. Positive-duration,
nonoverlapping clips bound this to two contributors; no second heap or read session
is introduced. Capture query policy fences the changed checkpoint shape without
invalidating transcript query policy.

## Evidence and limits

Core tests use actual acquisition admission/import owners with controlled native
boundary responses, not fabricated recording rows. They cover terminal coverage,
short audio, physical tail exclusion, endpoint partitions, prefetched source heads,
adjacent reverse-lexical clip IDs, rational repeats and bounded tied-track progress
including empty continuations. Composition tests keep half-open point behavior and
prove exact left-support queries skip unrelated prefixes. Existing project capture,
recording events, portable evidence, packages and transcript reads stay green.

`native-source-reads.json` is a separate actual native export/probe and core import
proof using synthetic journals around the retained media under `inputs/`. The video
has a nonzero origin and physical gap; the audio ends before the capture endpoint.
Complete yields no markers. Interrupted video yields the translated closing marker;
audio yields none, retaining the original capture endpoint. This is core inspection,
not a public CLI/MCP acceptance run or physical device interruption.

Removing adjacent-head deferral fails forward ordering; consuming a prefetched
terminal head before delivery loses it across a page-one continuation; using
ordinary half-open projection loses endpoint markers. These negative controls and
passing checks are retained here. Public routing, public journeys and remaining
scene/cut coverage belong to the following integration passes.

Independent review found no actionable defects. It reran the core and composition
checks and type checks, inspected the negative controls and native receipts, and
verified the retained media hashes. It did not rerun native capture or a public
transport journey.
