# Earlier room-tone candidate and public loop

**Listening pending.** The [user review](../listening-review-2026-09-30.md)
rejects the original pause as speech-free because of a voice blip around 70–80%
of its duration. This separate candidate retains only 0.3–0.8 seconds of that
1.5-second pause, before the reported approximate blip location. The location is
not an independently measured boundary; neither cropping nor low signal energy
proves this candidate is speech-free.

The [original-level region](source-region.wav) is an exact 12,000-frame selection
from the immutable 24kHz mono pause. [Source provenance](../18-voice-roomtone/extraction.json)
maps it to source timeline66.5–67.0s with the existing48675µs origin conversion.
The public extraction receipt retains its asset origin and both CLI/MCP results.
An explicit public conversion supplies the [48kHz stereo loop reference](source-region-stereo.wav);
the loop comparison uses this converted reference, not a claim of direct
cross-rate sample equality.

[Normal-level loop](loop.wav) repeats the candidate for six seconds with explicit
50ms overlapping fades and 10ms outer fades. The
[diagnostic listening loop](loop-monitor-plus24db.wav) applies **+24dB gain only**
through the public output processing stack so quiet material can be heard. This
is a labeled monitoring copy, not a new room-tone level policy or a replacement
for the accepted voice edits. No normalization or denoising is applied.

The [report](report.json) binds source, assembler, worker, extraction/conversion,
outputs and authored intervals. All source-selection samples are exact; complete
public loop PCM matches an independent sample-domain mix within4.97e-10. The
monitoring output matches explicit Float32 gain within7.46e-9, stays below full
scale and restores the normal loop exactly after undo. Actual audio delivery is
byte-identical through CLI and MCP. [Exchanges](exchanges.json.gz) retain complete
public requests and responses, including delivered audio. These mechanical checks
do not supply the speech-free or loop-naturalness verdict.

The frozen accepted denoise, word and shortened phrase are untouched. No new
capture, model installation, synthesis or automatic playback is performed.
The selected window and gains are explicit choices for this review; no automatic
ambience source selection or filling policy is added.

Reproduce with the existing compatible JavaScript build and an explicit worker:

```sh
SCREENREC_NATIVE=/absolute/path/to/screenrec-native node specs/agent-editing/assets/19-clean-roomtone/assemble.mjs --out /tmp/new-room-tone-review
```

The [assembler](assemble.mjs) uses the existing service harness and public
operations. The [final independent review](review.md) is retained beside this packet; the
configured CLI second-opinion service failed before reviewing because its model
was unavailable, so it supplies no review verdict.
