# Real physical footage through ordinary import

The user's retained [fixture](../../../../../fixtures/screen-camera-timing/README.md)
passes the actual public CLI/service import path as three standalone files.
Camera and screen each deliver early, middle and late frames; the microphone
produces a ten-second 48 kHz mono Float32 WAV with 480,000 samples and nonzero audio.
The source hashes remain unchanged. No recording rows, asset metadata or job state
were fabricated. No model, capture or native build ran for this check.

`report.json` retains public jobs, assets, actual stream IDs, occupied support,
frame provenance and audio metrics. `outputs.tar.xz` retains the six PNGs, WAV,
report and bounded scratch verifier. Root independently rehashed all three source
files; `root-verification.json` pins those identities and the output archive.
All verification processes are terminal; the isolated library remains available at
the path in the report. The frozen native8a worker was used.

The user's early-stop request ended recording through app termination. The
fragmented source files remain readable, but the selected probe had no app-owned
graceful-stop handle and emitted no terminal capture result. A separate offline
camera recovery attempt reached candidate-picture verification and then blocked
inside `AVAssetReaderTrackOutput.copyNextSampleBuffer`; both retained process
samples identify `ProbeCameraMedia.swift:233` inside the represented-frame loop.
The decoded ordinal is unknown. This is not proof of a final-EOF-only hang, nor
of completed canonical publication. The recovery process was terminated and its
raw input and private candidate retained. These defects require code work, not
another user recording. Import success and sampled decoding do not prove sync.
