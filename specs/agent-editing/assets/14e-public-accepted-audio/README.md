# Accepted selections through public audio delivery

The existing four user-accepted corrected selections now pass actual public
CLI/MCP editing and `audio.get` delivery through the integrated native/service
retiming owners. Every full PCM output equals its accepted mono reference duplicated
into stereo. Pure splits preserve it; joined left/right selections equal the full
output; short selections equal their exact sample slice. No listening inference or
new audition is needed for these identical outputs.

[The report](report.json) pins the worker, recipe and delivered file hashes.
[The archive](evidence.zip) retains all transport requests/replies, compiled plans,
receipts and service log with member hashes. The plans are compiler inspection
artifacts: these outputs were delivered by public audio.get, not by invoking the
native composition test executable. Matched source/reference WAVs remain in the
[accepted packet](../13a-corrected-selections/README.md); duplicate WAVs are omitted.
[Source identities](sources.json) bind the tested owners and harness.
[Root integration](root-verification.json) records64 focused test passes,14 export
recovery passes, and unchanged frozen worker hashes.

Run the [authoring harness](../../../../packages/test-harness/editing/retiming-authoring.mjs)
with `--public-audio`, a fresh `--out` directory, and SCREENREC_NATIVE pointing to the
compatible isolated14e worker. Its direct `--renderer` mode remains the separately
recorded native prerequisite. This evidence does not establish linked video timing,
package recovery, other source material, or pitch-follow perceptual quality.
