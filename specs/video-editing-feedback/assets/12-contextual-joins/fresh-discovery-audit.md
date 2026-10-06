# Fresh-agent discovery audit (12D)

The unprimed audit read only the public [media fixture receipt](media-fixture-report.json)
and the slice contract; it received no timecode hint. It identified `clipped` as the
edge defect because the caller expected `fortunate`, fresh Parakeet recognition
returned `'Kay.`, and the delivered tail remained energetic. The intact and repaired
cases returned `Fortunately,` and retained a quiet tail. The intentional-jump case
was separately identifiable from its two-sided source mapping and missing rendered
recognition.

The receipt exposes enough public identity to author a bounded repair: use the
clipped project/revision, its `boundary.before.clipId`, `assetId`, `streamId` and
`trackId`, remove that clip, place the same asset's full `0–951000` microsecond range,
prepare the changed tap and rerun `join.verify`. This is a caller decision; no
detector or helper selects it.

The audit did not rerun the helper because the receipt intentionally does not retain
a live managed service/home or the original request payload. Therefore 12D remains
open as a runnable fresh-agent/helper acceptance gate even though the defect is
discoverable from the retained report and the helper itself has a real-media
exercise in [media-fixture-report.json](media-fixture-report.json).
