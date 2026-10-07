# Independent controls

The [control manifest](manifest.json) binds small, hand-authored negative and
boundary controls to the existing canonical corpus at
`specs/done/agent-editing/assets/00-corpus`. It intentionally reuses those
bytes rather than making a second fixture owner. The controls cover exact
rational 24fps membership, known offset/drift, unrelated single-mic audio,
rotated asymmetric pixels, flat/partial/transparent alpha, saturated edge
landmarks, wrong supplied text, blank detection and an unavailable transition
gap.

The verifier is public and case-independent:

```sh
node packages/test-harness/editing/corpus-controls.mjs verify \
  --controls specs/done/video-editing-feedback/assets/01-corpus-controls \
  --reference-root specs/done/agent-editing/assets/00-corpus \
  --ffmpeg /opt/homebrew/bin/ffmpeg \
  --ffprobe /opt/homebrew/bin/ffprobe
```

The 2026-10-06 receipt passed all nine controls and 594,411 bytes of existing
media. It verifies source hashes before decoding and refuses changed authored
oracles, missing bytes, altered audio landmarks, changed alpha, rotated-stream
metadata or transition-gap timestamps. Synthetic controls supplement the real
editing cases; they do not certify speech lexical truth, camera quality or
whole-corpus behavior.

## Receipt

| input | SHA-256 |
| --- | --- |
| verifier | `27ea3d41602ff40448cf7626814c81255fe784dfa5d353aa650009187c236e0d` |
| control test | `757ce58a0670233340bbd17f1d526084b8114a172cd21b69251bd3ec1fee2668` |
| control manifest | `4ad056ef79284b3772e026dc959ad8da4cee90d282cc3ce1c494a1bd8815fe20` |
| canonical media manifest | `b6eee1f3c71329f17aca9f439aaf3880b93a744efd226d64a416c609394fa733` |
| canonical oracle | `929a3b138bf6dbcece450167962a70f8d8823a165be2d05aecaab698be599f14` |
| ffmpeg | `c8173e9755795978bce8e104f8d7044fabe7d6d84044aba37d3648c6f4e4e1a8` |
| ffprobe | `56559c234422b0e3722c54b2bd99bbd8cd83d3732a13a6d207589982a6b7085e` |
