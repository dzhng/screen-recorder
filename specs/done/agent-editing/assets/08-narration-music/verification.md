# Verification record

The frozen worker is `/tmp/screenrec-caption-output-combined-native`, SHA256
`6663e0c169671fa8121ed26e9cf298fb0dd0d789fd5559954899af1e87b608b9`.
The current worktree CLI/core dependency build passes (six tasks). No native build
or production source change was made.

```sh
SCREENREC_NATIVE=/tmp/screenrec-caption-output-combined-native \
SCREENREC_NARRATION_MUSIC=1 \
node packages/test-harness/editing/narration-preservation.mjs \
  --out /tmp/screenrec-narration-music-final
```

`initial` and `final` preserve complete independent public runs. The final harness
snapshots delivery selections and explicitly records default ranges; it also names
its sample-aligned range comparison accurately. The initial report's
`fractionalDeliveryMatchesFull` label refers to its 2.5–6.5s range, not fractional
sample boundaries. The original nine-gate journey separately retains its actual
fractional-sample request. No audio or acceptance threshold changed between runs.

Both runs retain their original nine baseline gates in `report.json`, with
accompaniment checks in `music-overlap.json`. The full mix contains 576000 stereo
frames. Its known three-second source occupies [144000,288000); both dry sides
remain exact. The ranged mix covers [120000,312000). Native Float32 comparisons
are exact; no AAC tolerance or listening verdict is introduced. Public MCP edits
and readiness plus CLI WAV delivery exercise the existing surfaces. All mutation
requests/results and delivered revision/range selections are retained; the parent
report holds complete audio receipts and PCM hashes.

Independent read-only code review found no actionable defects in the mixing oracle,
negative controls, preservation, undo or receipt identity. All nine original gates
remain unchanged. Formatting, JavaScript syntax and diff checks pass. No new visual
appearance was introduced: the frame check verifies equality at a matched time,
not a new perceptual rendering claim.

## Retained capture access

`archive.json` identifies all archived files and their SHA256 values. Extract into
an empty directory, then verify the included checksum list:

```sh
mkdir /tmp/narration-music-evidence
tar -xJf captures.tar.xz -C /tmp/narration-music-evidence
cd /tmp/narration-music-evidence
shasum -a 256 -c SHA256SUMS
```

For matched listening context, open `final/original-full.wav` and
`final/music-mixed-full.wav`; use `final/music-mixed-range.wav` for the interior
context. These files were delivered, not auditioned. The authored bed remains
`final/synthetic-chord-bed.wav`; negative WAVs remain alongside their positive
and undo outputs. Paths in historical receipts identify the original scratch
invocation; archive paths provide the retained bytes.
