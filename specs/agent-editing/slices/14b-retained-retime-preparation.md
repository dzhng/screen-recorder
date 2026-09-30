# 14b — Prepare retained runs before audio processing

Status: verified native retained preparation and integer authoring for the named
mono48k inputs. [Evidence](../assets/14b-retained-retime/README.md) includes14 native
checks, the repaired300-run descriptor case, and four accepted public-authored
selections through20 recipe-bound native plans. Converted-rate normalization is
checked with14d; public readiness/deadlines stay14e.
Dependencies:13/13a acceptance,14a durable ownership and the
[bounded mono file seam](../assets/14-bounded-stretch/README.md).

## Contract and seam

Native composition prepares each complete retimed mono run once per request, then
reads its samples by project position before clip or parent processing. The same
run survives pure splits and short queries. The composition audio-context and
sample-clock owners remain authoritative; no persistent lineage or new queue.

Collect distinct contexts across ordinary clips and state prerequisite clips.
Share prepared readers with both CompositionAudio's main graph and the graph
created by CompositionState.prepareState. Decode/resample only explicitly selected
source support, use the accepted exact file recipe, then duplicate mono into
stereo without gain as the existing channel contract requires. Source gaps and
actual removals break runs; unavailable media must not become accepted silence.

Scratch PCM belongs to the native request and is removed on failure/cancellation.
Core PreparedAudioStore still owns only the durable full-output publication via
JobQueue and AssetStore. Public capability binding waits for14e.

## Verification and review surface

Use the real native composition entry point on matched accepted inputs. Verify
complete PCM equality, exact sample count, excluded-source poison, untouched
neighbors, pure-split equality and full output equal to joined subranges. Exercise
gain and RNNoise after retiming, including state inputs outside the requested view.
Measure one preparation per distinct run and cancellation with no published output.

Public retime accepts integer durationUs: exercise those actual edits and compare
the resulting compiler counts, sampleAt(end) minus sampleAt(start), against native
output. Keep the earlier rational-endpoint probe as a separate oracle. No inferred
rounding rule or per-query DSP reset. A runnable native harness and retained PCM
report are the review surface; this pass makes no new visual claim.

Delegated: request-local reader/file layout and internal structure. The exact
recipe, timing, mono map and durable owners are fixed.

Keep the existing preservation gates, exact source-selection contract and frozen
workers intact. Build only in isolated scratch paths. Update this Status and the
parent14 pickup with evidence before committing. Run the repository review and
audit-choices passes. Missing perceptual evidence stays explicit; accepted mono
listening must not be repeated as a substitute for a different policy.
