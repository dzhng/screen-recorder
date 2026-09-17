# 14c3c2b — Public package audio excerpts

Status: implemented. See [public package audio evidence](../assets/portable-inspection/public-package-audio.md)
for the scoped native/CLI/MCP gate and remaining narration/audition boundaries.

## Contract and ownership

The existing audio.get/retry operations accept exactly one recordingId or
packageHandle. Package default revision is the exported pin; included history can
be selected explicitly. System, narration and mix retain the library acquisition,
gap, gain and duration semantics. Missing narration is reported honestly and is
never inferred from transcript readiness.

One AudioInspection controller owns range/track validation, source dependency
readiness, pre-admission acquired-track planning and explicit retry. Its library
adapter retains library/cache policy; its package adapter resolves admitted
history and existing queue context authority. A shared renderAudio function owns
planAudioExcerpt, native receipt validation, publication and failed-output cleanup.
Native media.audio remains the sole decoder/mixer.

Package frame and audio consumers share one small context policy owner for their
now-common source metadata, revision lookup, bounded queue receipts and output
reuse. It does not own a second scheduler, cache or catalog. Clean frames remain
independent of annotation evidence. Audio sources resolve to inventoried members
through the retained descriptor-backed file owner; no temporary ambient source
path can redirect reads.

The existing package output reservation/lease owner covers WAVE outputs. Held
reads prevent eviction, failed cleanup retains charge, explicit retries and more
than 32 sequential requests make progress without reopening. Close fences new
requests, drains queued/native work, revokes only this handle's deliveries, then
cleans its workspace. Same embedded recording UUID never grants library authority.

## Verification

Keep library audio tests and all frame tests green. Open a generated no-narration
ZIP after relocation and compare actual CLI WAVE and MCP audio bytes plus metadata
against shared library audio planning/native rendering. Exercise system and mix,
acquisition gaps, cuts and historical revision selection, absent narration,
repeat reuse, explicit failure retry, output pressure and held reads. Confirm
close during an actual held native audio worker drains before cleanup; another
open and a same-ID library deletion remain isolated. Verify before delivery TTL
expiry, unchanged input hashes and terminal owned process groups.

This checkpoint proves audio transport/sample parity, not human audition or
transcript validity. It adds no ASR acceptance or narrated package readiness claim.
Internal naming and factoring are delegated; native semantics, budgets and public
operation names remain unchanged. Root README maintenance belongs to integration.
