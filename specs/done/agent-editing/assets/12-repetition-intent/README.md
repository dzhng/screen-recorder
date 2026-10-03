# Original context for the repeated instruction

Status: retired as a project prerequisite by the user's 2026-09-30 clarification:
**zero editorial decisions; only primitives**. Original-source preservation remains
verified. No candidate cut, new timing label or editorial answer is supplied.

The historical ASR proposal repeats “Return to it” around two pointer movements.
Text alone cannot determine whether the later occurrence is accidental or an
intentional instruction. That choice belongs to an external agent in a separately
requested editing task, not development of this toolkit. The solicitation was
scope drift and must not be restarted. Its text remains an unverified proposal,
not a complete lexical/filler inventory.

[Original audio](original.wav), [native request](request.json),
[response](response.json) and [manifest](manifest.json) identify the exact source,
worker and context. Every delivered sample matches the actual MOV audio sample
tables; [root verification](root-verification.json) and the
[packet positions](source-packets.json) retain the byte proof.

The source has an empty leading movie edit. Packed audio indexes exclude it;
FFmpeg packet timestamps include a frame-quantized representation. Adding the
exact 48,675µs edit to packed time reproduces the requested interval. The apparent
2,336-frame difference between index and timestamp coordinates names the same
samples and is not a timing failure. The native reader subtracts the occupied
segment origin to select frames and adds it back to seek; support masks do not
reset that origin.

The unchanged [intent record](intent.json) preserves the historical unanswered
question. Its pending field is not an active request or project blocker. No answer
is inferred or needed for implementation. This packet proves original-source
delivery only; technical word timing, evidence coverage and explicit-cut quality
retain their own gates under [editorial control](../../architecture.md#editorial-control).
