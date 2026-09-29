# 19d — Measured voice settings and bounded work

Status: bounded termination/control experiment verified; [evidence](../assets/19d-voice-settings/README.md) retains fifteen fresh-process trials, including identical-audio cap/EOS boundary controls, exact frozen/clamp parity and changed-seed replay. Public resolver/worker integration and measured reference/text/output resource envelope remain open. Parent: [19](19-voice-assets.md). Dependencies: [19a](19a-voice-entry-parity.md).

## Contract and seam

Agents control supported generation settings; presets only supply defaults. One
capability descriptor/request resolver owns validation, default expansion, actual
forwarding and requested/effective settings. The private frozen-request restriction
is replaced when measured support exists, not preserved as a parallel worker.

Start from the [pinned source audit](../assets/19a-voice-entry/parameter-recon.md).
Cover seed, temperature, top-k, top-p, repetition penalty, token budget and actual
language keys. Reject nonfinite values, malformed types and ignored kwargs. Report
real clamps/filter disabling; preserve frozen requested1.05/effective1.5 exactly.
Streaming changes decoding; keep that mode distinct and explicitly unavailable
until separately verified, rather than claiming transport equivalence. Ordinary
retiming owns speech speed, since the pinned reference branch ignores speed.

Reference duration, decoded frames, text/prefill and output tokens jointly bound
work. Do not inherit the private five-second limit as model capacity or invent
public numeric bounds from configuration position limits. Measure termination and
return truthful completion versus token-budget exhaustion. Establish an observable
stop signal in the pinned generator; output length alone does not prove EOS. Default publication
must refuse incomplete speech when that condition is observable; never quietly
label a cutoff as complete. Preserve actual duration and complete output identity.

## Experiment and verification

First retain exact frozen word/phrase requests and WAVs. Use one intelligible full
sentence for subsequent comparisons. Change one control per run: alternate seed,
greedy temperature, top-k disabled/one, top-p filtering, effective repetition1.5
versus frozen1.05 then a larger penalty, and a forced tiny token budget. Verify
forwarded/effective values and stop conditions, not merely changed hashes.
Inspect actual supported language keys; unsupported names refuse instead of
falling back silently. Preserve one changed-setting fresh-process replay.

Then measure candidate reference/text/output envelopes with a bounded experiment
queue, retaining every attempt, memory/time, output count and stop reason. Declare
exact inputs and whether longer references are synthetic repetitions or continuous
speech. Choose public work limits from evidence before editing protocol bounds;
if evidence is insufficient, keep that envelope unresolved rather than accepting
it through a preset. Separate resource support from intelligibility/naturalness.

Every model/runtime/entry change reruns frozen parity with zero tolerance. No
normalization, reference expansion, extra context or recipe retuning is implicit.
No model install/download or automatic playback. Parent18/19 listening and runtime
performance gates remain independent; per-job model reload costs must be measured,
not excluded by calling filesystem caches a warm model.

Deliver an inspectable capability report, retained experiment evidence and focused
resolver/worker checks. Delegated: bounded trial ordering and instrumentation.
Public numeric limits are an evidence-backed outcome recorded before adoption;
user feedback on acceptable latency or quality changes the acceptance verdict.
