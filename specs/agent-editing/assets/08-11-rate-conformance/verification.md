# Execution record

Base `11969420`, branch `codex/audio-rate-conformance`. All authoritative native
runs use `/tmp/screenrec-caption-output-combined-native`, SHA256
`6663e0c169671fa8121ed26e9cf298fb0dd0d789fd5559954899af1e87b608b9`.
No native build or product source changes were needed. The existing targeted
CLI/core build passed (six cached tasks).

Commands (run from the repository root, with the worker above):

```sh
SCREENREC_NATIVE=/tmp/screenrec-caption-output-combined-native \
SCREENREC_RATE_EVIDENCE=/tmp/screenrec-audio-rates-sealed \
node packages/test-harness/editing/audio-mix.mjs --case music-and-replacement

SCREENREC_NATIVE=/tmp/screenrec-caption-output-combined-native \
SCREENREC_ACOUSTIC_RATES=1 \
node packages/test-harness/editing/audio-evidence.mjs \
  --fixture tones-and-clicks --out /tmp/screenrec-acoustic-rates-final
```

Retained mixer runs are chronological, not a collection selected for passing:
`mix-initial` passed; `mix-failed` failed the independent AAC range sum at
`5.960464477539063e-8`; `mix-retained` passed with earlier artifact retention;
`mix-controlled` passed with frozen-decoder arithmetic controls; `mix-verified`
uses the final scoped gate; `mix-sealed` additionally captures each produced
WAV before header/cardinality validation through the existing render helper. The report's `passed` means its
stated gate only; it does not erase the original failed exactness experiment.
All native source seek max/RMS and composition/component differences are retained
separately. No repeated run changes the earlier failure into a zero result.

`acoustic-initial` and `acoustic-final` both passed the complete existing public
journey plus source/project rate comparisons. The latter adds wrong-time and
wrong-Nyquist rejection. Full PCM ranges contain 20,580 source frames and 22,400
project frames for the same requested microsecond interval; their distinct
sample-grid endpoints are intentional. Both impulse clocks resolve to 0.64s.

`aac-repeat` contains eight fresh source reads and eight fresh isolated resampled
reads of one fixed AAC file. Each set measured zero difference from its first
member. The earlier scratch probe's unknown-operation error and already-produced
WAVs are also retained (`repeat-initial`); this was a diagnostic command typo, not
a product refusal. The corrected probe is retained alongside its receipts.

The fresh visual review inspected all eight newly captured full images and eight
lossless details. Its raw log is retained, as is the neutral brief and alias map.
The initial independent code review found no actionable issue but attempted an
unusable stale debug worker; that runtime result is not authoritative. The second
review found an unmodified AAC exactness assertion and retention-after-assertion;
both were corrected. The final follow-up found the remaining pre-validation capture gap and the not-yet-packaged evidence. Both were resolved. [Complete-package review](review-complete.txt) then found no actionable issues and independently checked all 390 archive entries.
Formatting and JavaScript syntax checks pass. No listening or continuous playback
was performed.

## Restore and inspect

Run `python3 restore.py /tmp/rate-conformance-restored` from this evidence folder.
The destination must not exist. The manifest preserves every captured pathname
while the archive stores identical bytes once. All restored files are hash-checked.
Original scratch paths in historical receipts are immutable provenance, not live
references. `review/brief.txt` opens the neutral visual scope; `mix-sealed` and
`acoustic-final` hold the final execution evidence. Earlier runs and raw failures
remain equally addressable.
