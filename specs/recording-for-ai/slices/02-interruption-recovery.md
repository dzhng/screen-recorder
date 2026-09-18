# 02 — Recover interrupted source media

Status: implemented and measured (2026-09-19); audio audition remains, which needs a person.
Dependencies: 01. Generated PCM fragmentation is verified; independent review produced
timing/journal corrections now integrated and tested. See the
[timing correction report](../assets/recovery/timing-review.md) for remaining limits.

`bun run lab:recovery` ends a take the way a crash would at five different moments and reports
what the next launch made of what was left ([report](../assets/recovery/lab/recovery.json)). On
this Mac: a kill before the writer committed anything keeps nothing and says so
(`NO_RECOVERABLE_VIDEO`, no timeline at all); every later moment keeps a prefix that decodes
whole, and the worst loss is 2.98 s against a 5 s target — one fragment, which is what a take is
in the middle of writing. Killing while a take is paused or while it is stopping is no different
from killing it mid-write: the take settles as interrupted and keeps its committed fragments.
Service relaunch and reconciliation are also pinned by
`apps/macos/tests/capture-service.test.mjs`. What the lab cannot judge is whether a recovered
tail ends where it claims to by ear; `--microphone` writes the clips for that.

Read [architecture](../architecture.md), [contracts](../contracts.md), and
[verification](../verification.md) before implementation. Existing native checks run
through `apps/macos` tests and the worker `media.recover` operation.

## Contract and API seam

Only media that actually decodes is advertised as recovered after app, service, or writer termination.

Test AVAssetWriter file fragmentation before building a segment store. Start with 1-second initial and 5-second subsequent fragments, subject to actual write/read behavior. Write a durable native capture journal with session ID, observed clock/geometry/pause events, and source artifact references. Source metadata is acquisition evidence, not a second library. If fragmentation fails, compare independently finalized short segments and choose one.

## Runnable checkpoint

Run bun run lab:recovery. Terminate before first fragment, during writing, after multiple fragments, during pause and while stopping. Decode every advertised surviving interval after relaunch, independently inspect track tails, and derive source duration from validated video while preserving each audio track’s usable intervals and gaps. A missing/short optional track never discards intact video; render gaps as silence and mark them unavailable for transcription. Simulate journal tail truncation, missing media, and audio tails shorter than video (including no recoverable audio prefix).

## Acceptance

Report the recovered duration and measured loss window per run. Meet the proposed checkpoint loss target where applicable; a zero-prefix early kill is honest. Never label a corrupt tail ready. Completed source hashes remain unchanged. Process-kill evidence is not sudden-power-loss proof.

## Decisions delegated and scope firewall

Checkpoint implementation and file flush mechanism are delegated after measurement. Record the chosen format and remove the alternative from product code; retain comparison harnesses. One failed mechanism can be replaced, but not by an untested recovery claim.

## Visual review

Recovered frame validity only; compare known recovered grid frames with the original fixture, then screenshot-critique last. Audio evidence also requires audition.

Follow the exact skill links and non-blocking human review procedure in
[verification](../verification.md#visual-gates). If this slice produces no visual
artifact, retain its machine-readable evidence instead; do not manufacture UI just
for a screenshot gate.

## Stay green and feedback

Keep dependency slices' focused checks green. Update this slice's status/evidence
and the README Next Agent Prompt at each green checkpoint. Tests must pin consumer
behavior, not implementation constants. Run the narrowest relevant checks during
iteration; full-suite closeout belongs to slice 15.

If neither mechanism works, this slice remains failed and source-lifecycle dependents wait. A pure timeline or speech probe may continue independently.


## Integrated checkpoint evidence

The [recovery report](../assets/recovery/review.md) records actual own-window
process kills and the merged worker tests. Fragmentation preserves a decoded video
prefix after its first fragment; an earlier kill honestly returns zero usable video.
The journal retains session identity and an unfinished pause. Audio availability is
intersected with accepted sample ranges because the platform decoder may synthesize
padding silence. This checkpoint does not prove device audio, service restart, or
sudden power-loss durability.
