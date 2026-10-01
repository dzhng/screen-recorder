# Original context for the repeated instruction

Status: original-source preservation is verified; editorial intent remains
pending. No candidate cut or new timing label is supplied.

The historical ASR proposal repeats “Return to it” around two pointer movements.
Text alone cannot determine whether the later occurrence is accidental or an
intentional instruction. The original surrounding narration lets the user make
that choice before any removal. Its text remains a proposal to verify by
listening, not a complete filler/repetition inventory.

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

[Intent record](intent.json) stays pending until actual feedback on this exact
audio. The later phrase is the named candidate. Keeping it as deliberate and
removing it as accidental are separate editorial choices; neither follows from
a duplicate transcript string. A removal judgment would still need independent
phrase/protected boundaries and its own complete-context join check. This
preparation closes no parent 12 or 12b quality gate and changes no accepted media,
native worker, model or installed app.
