# 19d — Measured voice settings and bounded work

Status: implemented and verified for the registered measured profile. [Adoption evidence](../assets/19d-voice-adoption/README.md) covers strict settings, actual prefill accounting, truthful EOS refusal, exact frozen/filtered audio parity, repaired numerical controls and unchanged final preparation/lifecycle gates. Original timing and numeric failures remain retained with their scope. Public durable generation remains owned by19f. Parent: [19](19-voice-assets.md). Dependencies: [19a](19a-voice-entry-parity.md), [19d1](19d1-probability-filter.md).

Resource justification remains in the [termination/control trials](../assets/19d-voice-settings/README.md), [larger-output memory red](../assets/19d-voice-envelope/README.md), [measured joint corner](../assets/19d-voice-corner/README.md) and [reference/temperature probes](../assets/19d-voice-admission/README.md). These are not quality or universal capacity claims.

The [probability-filter repair](19d1-probability-filter.md) preserves the measured
empty-distribution failures and the reviewed repair. Its initial numerical checks
are supplemented by the actual registered adoption and audio parity evidence.

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

## Registered execution contract

The active immutable registration is `qwen3-tts-icl-v1`; its authoritative
[profile](../../../packages/core/src/model-data/voice-profile-v1.json) is embedded
in discovery and included byte-for-byte in the runtime artifact. The old private
registration is replaced, while its frozen evidence remains untouched. A new
registration identifies the measured execution contract, not an internal module
revision. Runtime entry changes require a new inventory identity.

The profile is a measured work and numerical envelope, not universal model
capacity or a quality guarantee. The joint corner evidence supplies its reference,
actual target/prefill and output limits; the earlier larger-output memory red
remains open outside that profile. Seed uses canonical unsigned decimal text so
JavaScript cannot lose bits. Greedy temperature bypasses probability filters;
top-k disables independently when it reaches each codebook's vocabulary. The
receipt preserves requested settings and the pinned repetition clamp.

The pinned backend compares an ascending bfloat16 cumulative distribution against
`1-top_p`. Tiny positive top-p values can round that threshold to one and remove
every candidate. An endpoint sweep initially supported a candidate lower bound, but broader
partial-uniform distributions still produced empty support, including at0.01.
The [numeric-filter repair](19d1-probability-filter.md) preserves valid sampling
and frozen defaults while restoring a candidate only for otherwise-empty valid
support. The entire positive binary64 top-p domain is admitted; zero and one
retain the backend's disabled-filter semantics. Signed zeros are canonicalized
before JSON receipt comparison. Final default and filtered audio parity passes with zero tolerance.
Admission remains one domain regardless of greedy mode. The
repetition ceiling prevents a nonfinite bfloat16 scalar; it does not promise
natural speech. Output finite-sample checks remain mandatory.

One narrow instance adapter observes the pinned backend's existing preparation
and encode calls, calls each original once, returns the original values and
restores the encoder in `finally`. It records actual token counts and identities
and refuses excessive context before the talker loop. No prompt reconstruction,
second encoding or alternate tokenizer owner is introduced. This deliberately
depends on the pinned private API and rejects unexpected shapes.

Completion comes from the pinned nonstream result token count and its verified
EOS-before-append loop: exhausting the requested budget is refused before output
publication. Identical audible content can occur with and without observed EOS,
so this is termination truth, not a claim that every capped clip misses a word.
