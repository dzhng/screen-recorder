# Authored stereo sentence with RNNoise

**Listening accepted.** The [user verdict](../listening-review-2026-09-30.md)
passes the exact authored-stereo pair for balance and voice quality. This uses the same complete sentence as the
[original packet](README.md), with an explicitly authored channel relationship:
left is the original and right has half its amplitude. It is a channel-relation
control, not naturally recorded spatial audio.

Compare [the authored original](original-stereo.wav) with
[the denoised candidate](candidate-stereo.wav). With stereo headphones, one question:
**Are all words still clear and natural after denoising, with the same left/right
balance and no unexpected change in either ear?** The intended original balance is
louder on the left; this asks whether denoising adds an unexpected change.

The assembler encodes the frozen sentence samples as Float32 stereo without any
resampling. Public source delivery and the public dry project reproduce every
sample of the declared input: unchanged left and exactly half-level right. The
candidate applies the existing independent-channel RNNoise recipe once at output;
no extra gain, normalization, fades or retiming follows it. Duration is unchanged.
The candidate's left channel exactly matches the initial frozen candidate's left
channel. CLI and MCP deliver identical complete bytes for source, dry and candidate.

[The stereo manifest](stereo-manifest.json) retains assembly-time listening state
and records input/output energy, each
channel's fitted gain and remaining sample difference after that gain is removed.
Those are numerical descriptions of the denoise transformation; the linked
user review supplies the listening verdict. The right/left RMS ratio is 0.5 at input and about 0.5038 at output.
These whole-file values cannot establish perceived balance, stereo quality,
intelligibility, speech-free margins or protected-word boundaries.

[Compressed receipts](stereo-receipts.json.gz) retain actual requests, authoring
arguments, processing state and deliveries. The manifest binds original mono
media, the initial candidate/manifest, stereo media, frozen worker, assembler and
existing encoder. The initial pair and its assembly evidence remain unchanged.
Scratch raw, source-delivery and dry WAVs are not duplicated here.

Use the [focused assembler](assemble-stereo.mjs) with existing builds and tools:

```sh
SCREENREC_NATIVE=/tmp/screenrec-03d-native-build/debug/screenrec-native node specs/agent-editing/assets/15a3-protected-sentence/assemble-stereo.mjs --out /tmp/protected-stereo-fresh --ffmpeg /opt/homebrew/bin/ffmpeg
```

The service home is isolated and removed after assembly. There is no new capture,
sentence, model, dependency installation or automatic playback.
[Audited assembly choice](stereo-choices.md) retains the encoding decision;
[review](stereo-review.json) binds the delivered packet. The
[root public replay](root-stereo-verification.json) reproduces both complete
WAV hashes, exact dry/source samples and the unchanged left-channel result.
