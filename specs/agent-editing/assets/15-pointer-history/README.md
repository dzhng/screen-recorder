# Exact capture presentation history

Pointer preparation needs the selected source's displayed sample and exact empty
support intervals, independently of an edited clip. The existing sequential
presentation writer and pinned reader now accept that history directly. They do
not fabricate a timeline revision or introduce another sample selector.

`CaptureSourceRead.presentation` owns acquisition authority and the mapping:
`assetUs = captureUs + sourceToAssetOffsetUs`, then
`containerUs = captureUs + clockOffsetUs`. Its selected stream history deliberately
includes capture before a trimmed clip. Native selection still belongs to
`PresentationSource.selection`; returned rational boundaries are translated back
without rounding. The reader carries the latest completed physical-empty interval
end across skipped records. A direct late seek therefore retains the same reset
floor as sequential reading.

The writer bounds emitted bytes, records and decoded samples, checks cancellation
while making progress, and publishes only a completed file. Reader admission is
bounded before its validation scan; each cursor holds one record and one exact
empty-end value. These are work limits, not measured release-scale acceptance.
Legacy callers adapt their real revision spans at the request boundary and keep
schedule identity separately; they use the same writer and reader.

[The fixture runner](../../../../packages/test-harness/editing/presentation-history.mjs)
authors two distinguishable video tracks with nonzero origin and an exact
fractional physical gap. [Native results](./native.json) and
[verification](./verification.json) preserve both successful requests and deliberate
failure controls. The frozen old writer's matched request is byte-identical.

This prerequisite does **not** prepare or replay pointer overlays. Queued/cache
lifetime integration, cursor/geometry/reset observation consumption, immutable
trail selection and native prefix replay remain open. No execution capability is
bound. Histories require a nonnegative representable capture clock; a translated
sample before that clock or a CoreMedia subtraction that rounds is refused rather
than clamped or invented. The exact clock format remains unchanged; incompatible
timescales produce an explicit unavailable result with no partial publication.
