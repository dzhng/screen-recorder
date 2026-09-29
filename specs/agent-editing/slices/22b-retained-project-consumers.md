# 22b — Retained prepared output in project consumers

Status: verified scoped consumer checkpoint; [evidence](../assets/22b-retained-consumers/README.md). Dependencies: [14a](14a-prepared-audio.md), [22a](22a-portable-snapshots.md), [20d3](20d3-package-asset-metadata.md).

The retained format 2 learned package reproduces a consumer gap: its saved output
asset reads exactly while project audio, preparation and preview refuse when RNNoise
capability is unavailable. Historical selection after undo/restart has the same
failure. The prepared owner and atomic package publication already retain the bytes
and original recipe; this leaf connects project consumers to that authority.

## Eligibility and ambiguity

PreparedAudioStore alone resolves retained full processed-output publications referenced
by the selected revision. The complete compiled audio recipe must match with its
recorded executor/model/adapter/state/upstream/rendition identities preserved. Only
the existing project/revision context remapping may differ. Compilation may construct
unbound requirements for comparison, but it must bind them to the recorded identities,
not erase policy differences or substitute today's available implementation.

Only the whole processed output domain, or a bounded range of it, is eligible.
Raw, clip, track and group taps cannot consume a full-output receipt. Changed support,
source, order, gain, processor/state windows or policy cannot reuse incompatible PCM.
Undo/restore retains its target's prepared references through ProjectStore; this
reference inheritance does not replace exact compatibility verification.

Exactly one eligible ready policy may satisfy a read. Multiple distinct compatible
policies refuse with candidate identities; no newest/current/arbitrary selection and
no new selector API. A compatible publication with missing/corrupt bytes remains a
visible error, never silent DSP fallback. If no receipt is eligible, existing produced
readiness and job behavior remains authoritative. There is no new registry, queue,
model policy or automatic download.

Audio ranges retain the original full-output sample clock. Preview/export use those
same samples for movie assembly while independently requiring ordinary video rendering.
Ready retained data does not advertise execution capability. Pinned jobs must record
which prepared receipt they consume so later publications cannot change their meaning.

## Verification

Preserve the actual public red. Verify current/historical/undo audio.prepare, output
audio.get, preview and export after capability/processor unavailability, with generic
movie rendering available. Compare complete/ranged lossless PCM to the retained
oracle; encoded audio is a separate codec comparison. Exercise changed upstream,
order/window/policy, ambiguity, corrupt/missing PCM, job/lifetime fencing and non-output
tap exclusion. Reuse the current-v2 font proof; do not repeat its matrix. No listening,
retime or new DSP acceptance follows from this consumer repair.

Jobs pin an explicit produced choice when no retained output is selected. Later
preparation cannot change a queued render or export. Original receipt provenance
stays intact even when undo creates a new revision that consumes it.
