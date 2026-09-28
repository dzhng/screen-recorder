# Continuous audio availability

Adjacent available intervals describe continuous captured media. They are merged
before intersection with physical container segments, so splitting an availability
claim cannot restart decoding or change samples. Real gaps, even one microsecond,
remain excluded. Overlaps and descending intervals refuse. Signed support remains
valid; recording retained edit spans still require strict separation.

The frozen prior worker rejects the regression (`refusal-red.txt`). Allowing the
request without merging support changes WAV bytes (`decoder-boundary-red.txt`).
The corrected native wire test passes exact receipts and full WAV equality at
44.1/48 kHz, physical/acquisition gaps and explicit stream selection, plus real
one-microsecond holes and overlap rejection. AAC tail/truncation checks also pass.
The full recording audio executable passes, including signed touching support
byte parity, conversions, retained joins and all 27 invalid-request cases. Its old
touching-availability refusal was replaced with overlap rejection; retained-span
refusal was preserved. Eight audio/picture/scene wire tests pass in the combined
worker. No output tolerance changed.

Native SHA256: `68d77b776f3629c2329cbf92f80665ecfc521c7ea723c009c889ed52417e72cf`.
Reproduce with `node --test helpers/mac/Tests/source-audio.test.mjs` against a built
worker and the `ScreenRecorderSourceAudioTests` fixture; run the
`ScreenRecorderAudioTests` executable for recording preservation.

Independent review found no actionable defects. Its separate Swift environment
could not compile because its compiler and SDK were incompatible; executed native
acceptance comes from the root runs above. Root initially invoked `swift test`,
which built but found no test targets; it then ran the actual test executable.

No execution-policy bump is needed: touching input was formerly rejected, every
previously accepted availability list is unchanged, and composition supplies one
continuous interval before its existing retained-domain clipping. Physical segment
boundaries are not merged. This is native mechanism and preservation evidence,
not new subjective listening or a new public admission scenario.
