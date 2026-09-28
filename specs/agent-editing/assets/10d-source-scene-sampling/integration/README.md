# Combined worker preservation

After integrating selected-source scene sampling, spectral reduction, capture-end
projection and the touching-audio correction, the full workspace build passed.
The frame executable and eight audio/source-picture/scene wire tests pass; audio
results are retained in the [support correction](../../11a-touching-support/README.md).
Twenty-eight focused core tests cover waveform/spectral reduction, source scenes
and capture interruption. These core tests do not establish public interruption
or scene routes.

The actual CLI/MCP source-picture journey also passes (`source-picture-public.json`)
with the merged one-input/two-input fixture: explicit streams, physical gaps,
retained acquisition after donor deletion, batch delivery, cancellation/retry,
restart and unchanged originals. It compares against the existing reviewed picture
oracles; this is preservation, not new visual acceptance.

Frozen worker SHA256:
`68d77b776f3629c2329cbf92f80665ecfc521c7ea723c009c889ed52417e72cf`.
Public invocation: `SCREENREC_NATIVE=<frozen-worker> node packages/test-harness/editing/source-frame-evidence.mjs --out <scratch-output>`.
No capture, playback, installed-app launch or user library changes occurred.
