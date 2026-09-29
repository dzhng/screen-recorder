# Matched encoded appearance

This checkpoint tests the accepted explicit balanced output settings against the
frozen pointer/transform input and ten seconds of recorded scrolling content.
It does not close slices 06, 15 or 16, pronounce encoded appearance acceptable,
or establish continuous-playback quality. The [acceptance boundary](../09b-output-quality/acceptance-boundary.md)
and historical four-code/thin-pointer failures remain intact.

The frozen source, journal, nested geometry and four pre-encode images match the
retained [pointer-chain fixture](../15-pointer-chain/README.md). Public frame
images are byte-exact after the existing ICC-aware RGBA normalization. Full and
clipped requests have equal source layers, visual operations and prepared pointer
records at corresponding source instants. The current checkpoint observes those
public images and immutable prepared inputs; it does not newly instrument the
writer's pixel-buffer append boundary. Historical buffer-identity evidence stays
separate.

All 595 Apple-decoded frames are retained, including exact rational timestamps,
embedded ICC profiles and decoded BGRA hashes. An independent packet probe checks
every packet's PTS, duration and track duration against the declared clipped
intervals. AVAssetReader returned invalid per-sample durations here; those raw
receipts remain marked invalid, and packet timing supplies the duration check. Both public exports are byte-identical to their corresponding full
previews. The non-grid ranges intentionally retain the intersecting source frame
at time zero; comparisons use its global sample time, not the range-local index.

Frozen full/range decoded images match exactly at all three shared instants.
Recorded full/range frames share exact inputs and timing, but their encoded
appearance differs: maximum channel difference 63, worst whole-image mean
0.509664. This is consistent with differing encode histories; it is not a unique
causal diagnosis or an acceptance threshold. Original four-code checks fail for
all 280 recorded full/range pairs, and the original thin-landmark diagnostic
passes none of the seven frozen reference/encoded comparisons.

A shifted acquisition changes recorded pointer x coordinates by 12 source
pixels; a missing-pointer variant disables the pointer operation. All eight
encoded negative frames have greater whole-image MSE than their matched positive
and fail the original landmark diagnostic. Replacing a negative with its positive
causes the sensitivity assertion to fail. These are defect-sensitivity checks,
not evidence that the positive appearance is acceptable. The corrected input
gate also rejects missing, extra and altered range pointer records.

Review sheets honor explicit PNG sRGB tags and convert embedded ICC profiles
to sRGB before any composition, then embed that destination profile. Individual native PNGs retain
the original profile. Initial raw-RGB composite sheets are preserved separately
as invalid comparisons; they manufactured a gray-level discrepancy and must not
be used for judging appearance. Original numeric comparisons already normalized
ICC and are unchanged. Complete MP4s and all-frame contact sheets are supplied;
actual continuous playback remains unverified.

## Evidence and reproduction

Run `python3 restore-review.py /absolute/fresh/directory` to verify archive
hashes, extract the capture and restore neutral review aliases. The original
report retains historical capture paths; the review aliases are relocatable. `archives.json` gives SHA-256 and byte counts. `files.json` preserves every
pathname and original hash through `storedAs` references for duplicate bytes.
`capture-metadata-media.tar.xz` contains the public request/response trace,
resolved settings, exact source/journal identities, native prepared streams,
complete media, small decoded frames and all pre-encode references. The six
recorded-frame archives preserve every full-resolution decoded frame. Review
sheets include native-size small contexts, nearest-neighbor enlarged thin-pointer
crops, recorded text crops and contact sheets covering every decoded frame.

The public capture harness is `packages/test-harness/editing/encoded-appearance.mjs`
with `SCREENREC_NATIVE` and a fresh `--out` directory. Run the companion
`encoded-appearance-packets.mjs`, `encoded-appearance-diagnostics.mjs` and
`encoded-appearance-analysis.py` on that directory. Python needs Pillow and
NumPy. `node --test packages/test-harness/editing/encoded-appearance-inputs.test.mjs`
checks the retained frozen full/range program and pointer mutations without a
service. Captures used frozen worker SHA-256
`843b3bc21bc901e3bf24fc9c3ebd5bdfb9361b628c8e4a5403bd707df17a8270`;
no production renderer change was made.

Independent code review found the initial missing pointer-input comparison;
the gate and frozen-fixture tests now cover it. Its full transcript and the
follow-up review are retained. The initial harness failure is also retained: it
wrongly expected a pointer-stream file for the deliberately missing-pointer case;
the corrected capture checks whether the native request declares that stream. The [independent still-frame critique](visual-review.md) records visible
compression loss and successful defect discrimination, with a scratch-image
presentation limitation preserved and investigated. Encoded appearance and
continuous-playback acceptance remain open.
