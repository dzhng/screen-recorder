# Real editing regression inputs

Audio excerpts retain the original decoder's source-rate Float32 samples without
lossy compression. Picture excerpts retain the full original raster and camera
appearance through a separately measured ProRes reduction. Source identities and
exact selections live in [recipes.json](recipes.json); the [manifest](manifest.json)
binds retained bytes, clocks and the scope of preservation evidence.

The [corpus tool](../../packages/test-harness/editing/video-corpus.mjs) owns case
selection, derivation and physical verification; use its help. External originals
remain unchanged. Audio re-decode equality and sampled visual preservation are
different claims from recognizer accuracy or picture-quality observations.
A newly derived video remains unverified until its own visual proof is recorded.

The [selected speech comparison](../../specs/video-editing-feedback/assets/01-corpus-audio/speech-parity/README.md)
records exact original/derivative recognition parity under a frozen worker recipe.
Its manifest dispositions preserve context-sensitive recognition and historical
failures without treating a transcript as independent lexical truth.

Fetch only selected LFS inputs. A pointer alone is refused. Picture verification
requires a supplied prepared FFprobe executable so a matching hash cannot stand
in for actual decoded frames. The [picture evidence](../../specs/video-editing-feedback/assets/01-corpus-picture/README.md)
states both measured preservation and remaining temporal/behavioral limits.
The exact historical tiny input has its own [speech-timing provenance](../speech-timing/README.md);
it is not another Float32 copy. Multicamera and independent speaker controls
remain pending under the approved fixture contract.

[Real speaker dialogue controls](dialogue/README.md) retain two small identified
crops with an explicit quiet-host attenuation for per-occurrence finishing proof.

[Unlike-microphone operands](synchronization/README.md) retain lossless separated
windows for synchronization research; their waveform refusal is separate from
physical byte preservation and does not declare cameras synchronized.
