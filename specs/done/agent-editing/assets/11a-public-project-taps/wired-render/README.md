# Wired audio attempt preservation

The unchanged public [audio-taps journey](../../../../../../packages/test-harness/editing/audio-taps.mjs)
passed against the root runtime after both source and project renderers adopted
`withRenderedAudio`. [Report](report.json), [runtime hashes](runtime.json),
[package manifest hashes](package-manifests.json), and [run receipt](run.txt)
identify this integration run.

All 15 CLI/MCP tap receipts have the same WAV and PCM hashes as the original
passing journey. Full/range, changed settings, current head and cancellation/retry
outputs also remain byte-identical. Historical restart and public deletion checks
passed unchanged. This proves the locked attempt copy preserves public audio
behavior; process-kill staging ownership is established separately by the render
lifetime tests. The original journey's stated pending gates remain pending.

The native worker remained frozen at SHA-256
`611ee1097c95fa2eae4ef7c6a0cb11facc39d236c642b953e9ccf072f8f05137`.
No harness assertion, product source or acceptance threshold changed for this run.
