# Implementation choices

Choices made where the plan was silent; explicitly delegated internal details
are omitted. Planning decisions remain in [decisions.md](decisions.md).

## Sound — medium confidence

### Small, ordinary compressed timing fixtures

When: corpus pass, `b1fc5fe`.

The choice: numbered clips use low frame rates and High-profile H.264 with modest
compression. When a check asks which frame appears at a cut, there are few frames
to inspect and each has a visible identity. Lossless H.264 would preserve exact
colors but selected a less broadly supported profile; tests instead allow a small
color error while checking frame identity. The plan required deterministic,
asymmetric clips but did not select encoding or frame rate.

The reach: these fixtures prove timing and basic geometry, not production motion
quality or native compatibility. Native decode and high-rate preservation have
separate gates. Verdict: sound because compact fixtures expose exact boundaries
without requiring an unusual decoder profile. Confidence: medium.

### Byte reproducibility is tied to recorded tool versions

When: corpus pass, `b1fc5fe`.

The choice: regenerating with the recorded encoder and runtime must reproduce the
same bytes. A different encoder release may write different bytes for the same
pictures; the manifest records tool versions and generator hashes rather than
promising otherwise. The plan required determinism without defining its toolchain
boundary.

The reach: future fixture updates must preserve the frozen inputs or deliberately
record a new toolchain and evidence. Verdict: sound because it makes the actual
reproduction guarantee checkable. Confidence: medium.

## Sound — high confidence

### A timestamp jump is not evidence of a native acquisition gap

When: corpus pass, `b1fc5fe`.

The choice: a video timestamp jump is paired with explicitly synthetic acquisition
metadata. A decoder can hold the prior picture across the jump; the separate
metadata says recording was unavailable there. The fixture does not claim to
contain a native empty edit-list interval. The plan requested gap cases without
choosing how this small generated case would encode one.

The reach: consumers must distinguish displayed held pixels from evidence that
media was actually acquired. Existing native empty-gap references remain required.
Verdict: sound because it avoids treating a convenient synthetic case as proof of
a different media mechanism. Confidence: high.
