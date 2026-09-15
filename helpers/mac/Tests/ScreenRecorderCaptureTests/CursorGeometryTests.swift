import CoreGraphics
import Foundation
import ScreenRecorderCapture

/// A retina window filling its surface: 800x500 points at 100,80 onscreen, 1600x1000 output pixels.
private let placed = CaptureGeometry(
    outputWidth: 1600, outputHeight: 1000,
    contentRect: GeometryRect(x: 0, y: 0, width: 800, height: 500), contentScale: 1,
    scaleFactor: 2, screenRect: GeometryRect(x: 100, y: 80, width: 800, height: 500),
    boundingRect: nil, requestedSourceRect: nil)

/// The same take after the window grew to 1000x600 points. The output keeps its dimensions, so the
/// content is scaled to 0.8 and letterboxed by ten points at the top and bottom.
private let letterboxed = CaptureGeometry(
    outputWidth: 1600, outputHeight: 1000,
    contentRect: GeometryRect(x: 0, y: 10, width: 800, height: 480), contentScale: 0.8,
    scaleFactor: 2, screenRect: GeometryRect(x: 100, y: 80, width: 1000, height: 600),
    boundingRect: nil, requestedSourceRect: nil)

/// A window on a display mounted above the origin display, where global points are negative.
private let aboveOrigin = CaptureGeometry(
    outputWidth: 1280, outputHeight: 800,
    contentRect: GeometryRect(x: 0, y: 0, width: 640, height: 400), contentScale: 1,
    scaleFactor: 2, screenRect: GeometryRect(x: -300, y: -1440, width: 640, height: 400),
    boundingRect: nil, requestedSourceRect: nil)

private func pixel(
    _ geometry: CaptureGeometry, _ x: Double, _ y: Double, line: UInt = #line
) -> CGPoint {
    guard let point = geometry.outputPixel(forGlobalPoint: CGPoint(x: x, y: y)) else {
        preconditionFailure("Geometry with a source rect must place a finite point", line: line)
    }
    return point
}

private func reading(hostUs: Int64, x: Double, y: Double, buttons: Int = 0, skipped: Int = 0)
    -> CursorReading
{
    CursorReading(
        hostUs: hostUs, global: CGPoint(x: x, y: y), buttons: buttons, zeroOriginHeight: 982,
        skippedTicks: skipped)
}

func runCursorGeometryTests() throws {
    // Corners and an asymmetric interior target, so a transposed transform cannot pass.
    precondition(pixel(placed, 100, 80) == CGPoint(x: 0, y: 0), "The content origin is pixel zero")
    precondition(
        pixel(placed, 300, 455) == CGPoint(x: 400, y: 750),
        "An asymmetric target keeps its axes, got \(pixel(placed, 300, 455))")
    precondition(
        pixel(placed, 900, 580) == CGPoint(x: 1600, y: 1000),
        "The far corner lands on the surface bound")
    precondition(
        !placed.contains(outputPixel: pixel(placed, 900, 580)),
        "The far corner is one pixel past the last drawn pixel")
    precondition(
        placed.contains(outputPixel: pixel(placed, 899.9, 579.9)),
        "The last drawn pixel is inside the capture")
    print("PASS a filled retina window maps corners and an asymmetric interior point")

    // Fixed output dimensions do not imply fixed source geometry.
    precondition(
        letterboxed.outputWidth == placed.outputWidth
            && letterboxed.outputHeight == placed.outputHeight,
        "A resized window keeps the take's output dimensions")
    precondition(
        pixel(letterboxed, 100, 80) == CGPoint(x: 0, y: 20),
        "Padding offsets the content origin, got \(pixel(letterboxed, 100, 80))")
    precondition(
        pixel(letterboxed, 600, 380) == CGPoint(x: 800, y: 500),
        "A scaled interior point follows content scale, got \(pixel(letterboxed, 600, 380))")
    precondition(
        pixel(letterboxed, 1100, 680) == CGPoint(x: 1600, y: 980),
        "The scaled far corner keeps its letterbox, got \(pixel(letterboxed, 1100, 680))")
    precondition(
        letterboxed.contains(outputPixel: CGPoint(x: 10, y: 21))
            && !letterboxed.contains(outputPixel: CGPoint(x: 10, y: 19)),
        "Letterbox padding is outside the captured content")
    print("PASS a resized window letterboxes inside unchanged output dimensions")

    // A display mounted above the origin display has negative global points throughout.
    precondition(
        pixel(aboveOrigin, -300, -1440) == CGPoint(x: 0, y: 0),
        "A negative display origin is still the content origin")
    precondition(
        pixel(aboveOrigin, -60, -1140) == CGPoint(x: 480, y: 600),
        "Negative origins keep interior placement, got \(pixel(aboveOrigin, -60, -1140))")
    let onOtherDisplay = pixel(aboveOrigin, 100, 100)
    precondition(
        onOtherDisplay == CGPoint(x: 800, y: 3080),
        "A point on another display is projected, not clamped, got \(onOtherDisplay)")
    precondition(
        !aboveOrigin.contains(outputPixel: onOtherDisplay), "That point is outside the capture")
    let before = pixel(placed, 0, 0)
    precondition(
        before == CGPoint(x: -200, y: -160) && !placed.contains(outputPixel: before),
        "A point left of the capture keeps negative coordinates, got \(before)")
    print("PASS out-of-capture points stay projected and outside, never clamped to an edge")

    // Region capture has no per-frame screen rect; the request's global rect explains it.
    let region = CaptureGeometry(
        outputWidth: 800, outputHeight: 600,
        contentRect: GeometryRect(x: 0, y: 0, width: 400, height: 300), contentScale: 1,
        scaleFactor: 2, screenRect: nil, boundingRect: nil,
        requestedSourceRect: GeometryRect(x: 1228, y: -1440, width: 400, height: 300))
    precondition(
        pixel(region, 1428, -1290) == CGPoint(x: 400, y: 300),
        "A display-local region offsets into its display, got \(pixel(region, 1428, -1290))")
    let unexplained = CaptureGeometry(
        outputWidth: 800, outputHeight: 600,
        contentRect: GeometryRect(x: 0, y: 0, width: 400, height: 300), contentScale: 1,
        scaleFactor: 2, screenRect: nil, boundingRect: nil, requestedSourceRect: nil)
    precondition(
        unexplained.outputPixel(forGlobalPoint: CGPoint(x: 0, y: 0)) == nil,
        "Geometry no frame has explained cannot place a point")
    print("PASS a region uses its requested global rect and unexplained geometry places nothing")

    // AppKit reports the pointer in a bottom-left space anchored to the zero-origin display.
    precondition(
        GlobalPointSpace.flip(appKit: CGPoint(x: 2341, y: 1688), zeroOriginHeight: 982)
            == CGPoint(x: 2341, y: -706),
        "A pointer above the origin display converts to a negative global y")
    precondition(
        GlobalPointSpace.flip(appKit: CGPoint(x: 10, y: 10), zeroOriginHeight: 982)
            == CGPoint(x: 10, y: 972), "A pointer near the origin display's bottom stays positive")
    print("PASS AppKit pointer readings convert through the zero-origin display height")

    try runCursorTrackTests()
}

private func runCursorTrackTests() throws {
    var track = CursorTrack(batchSize: 3)
    precondition(
        track.epoch == 0 && track.observe(placed, hostUs: 0) == 1,
        "A first observation opens epoch 1")
    precondition(
        track.observe(placed, hostUs: 16_000) == nil, "An unchanged geometry keeps its epoch")
    precondition(
        track.accept(reading(hostUs: 1_000, x: 300, y: 455), sourceUs: 0) == nil,
        "A partial batch is retained until it fills")
    precondition(
        track.accept(reading(hostUs: 17_000, x: 0, y: 0), sourceUs: 16_000) == nil,
        "A partial batch is retained until it fills")
    guard
        let batch = track.accept(
            reading(hostUs: 33_000, x: 300, y: 455, buttons: 1), sourceUs: 32_000)
    else { preconditionFailure("A full batch must be written") }
    precondition(
        batch.map(\.sourceUs) == [0, 16_000, 32_000], "A batch keeps sample order, got \(batch)")
    precondition(
        batch[0].x == 400 && batch[0].y == 750 && batch[0].visible,
        "An inside sample carries its output pixel, got \(batch[0])")
    precondition(
        batch[1].eligibility == "outside" && batch[1].x == -200,
        "An outside sample keeps its projection, got \(batch[1])")
    precondition(
        batch[2].buttons == 1 && batch[0].buttons == 0, "Button state is recorded as observed")
    precondition(
        batch.allSatisfy { $0.geometryEpoch == 1 }, "Samples carry the epoch they were taken under")
    precondition(
        batch[0].globalX == 300 && batch[0].globalY == 455,
        "The raw global point is retained beside the transform")
    precondition(
        track.accept(reading(hostUs: 49_000, x: 300, y: 455), sourceUs: 48_000) == nil,
        "A written batch leaves nothing pending")

    // A window that moves opens a new epoch under unchanged output dimensions.
    let moved = CaptureGeometry(
        outputWidth: 1600, outputHeight: 1000,
        contentRect: GeometryRect(x: 0, y: 0, width: 800, height: 500), contentScale: 1,
        scaleFactor: 2, screenRect: GeometryRect(x: 140, y: 80, width: 800, height: 500),
        boundingRect: nil, requestedSourceRect: nil)
    precondition(
        track.observe(moved, hostUs: 60_000) == 2, "A moved window opens the next epoch")
    precondition(
        track.accept(reading(hostUs: 65_000, x: 300, y: 455), sourceUs: 64_000) == nil,
        "A partial batch is retained until it fills")
    let sealed = track.seal()
    precondition(
        sealed.map(\.geometryEpoch) == [1, 2],
        "A seal writes what is pending, under the epoch each sample was taken, got \(sealed)")
    precondition(
        sealed.last.map { $0.x == 320 && $0.y == 750 } == true,
        "A sample after the move follows the new geometry, got \(sealed.last as CursorSample?)")
    precondition(
        track.accept(reading(hostUs: 81_000, x: 300, y: 455), sourceUs: 80_000) == nil
            && track.seal().isEmpty,
        "A sealed take cannot gain a late sample")
    precondition(
        track.stats.sampled == 5 && track.stats.afterSeal == 1 && track.stats.geometryEpochs == 2,
        "Sealed takes report what they recorded, got \(track.stats)")
    print("PASS a track batches samples, follows geometry epochs and refuses late readings")

    // A frame reports its placement milliseconds after the moment it describes. Readings taken
    // after a window moved must not be projected onto the position it had just left.
    var late = CursorTrack(batchSize: 100)
    _ = late.observe(placed, hostUs: 0)
    _ = late.accept(reading(hostUs: 40_000, x: 300, y: 455), sourceUs: 40_000)
    _ = late.accept(reading(hostUs: 60_000, x: 300, y: 455), sourceUs: 60_000)
    precondition(
        late.observe(moved, hostUs: 50_000) == 2,
        "A geometry delivered after the readings it explains still opens its epoch")
    let projected = late.seal()
    precondition(
        projected.map(\.geometryEpoch) == [1, 2],
        "Each reading uses the geometry in effect when it was taken, got \(projected)")
    precondition(
        projected[0].x == 400 && projected[1].x == 320,
        "A reading after the move is projected through the moved window, got \(projected)")
    print("PASS readings are projected through the geometry contemporaneous with them")

    // Pauses: the take's own clock refuses readings, and nothing is invented for that time.
    var clock = CaptureClock()
    clock.start(at: 100_000_000)
    var paused = CursorTrack(batchSize: 100)
    _ = paused.observe(placed, hostUs: 100_000_000)
    let hosts: [Int64] = [
        100_000_000, 101_000_000, 102_500_000, 103_000_000, 104_000_000, 105_500_000, 106_000_000,
    ]
    for (index, hostUs) in hosts.enumerated() {
        if hostUs == 102_500_000 { clock.pause(at: 102_000_000) }
        if hostUs == 105_500_000 { clock.resume(at: 105_000_000) }
        _ = paused.accept(
            reading(hostUs: hostUs, x: 300 + Double(index), y: 455),
            sourceUs: clock.sourceTime(for: hostUs))
    }
    let recorded = paused.seal()
    precondition(
        recorded.map(\.sourceUs) == [0, 1_000_000, 2_500_000, 3_000_000],
        "Paused readings are omitted and resumed time removes the pause, got \(recorded)")
    precondition(
        paused.stats.omittedPaused == 3 && paused.stats.sampled == 4,
        "Omitted paused readings are counted, not backfilled, got \(paused.stats)")
    precondition(
        recorded.map(\.globalX) == [300, 301, 305, 306],
        "The gap keeps the movement that was observed, with nothing interpolated across it")
    print("PASS a paused take records no samples and reports the readings it dropped")

    // Missed cadence ticks are reported rather than reconstructed.
    precondition(
        CursorSampler.skippedTicks(elapsedUs: 16_667, intervalUs: 16_667) == 0
            && CursorSampler.skippedTicks(elapsedUs: 20_000, intervalUs: 16_667) == 0,
        "An on-time or slightly late tick owes nothing")
    precondition(
        CursorSampler.skippedTicks(elapsedUs: 33_334, intervalUs: 16_667) == 1
            && CursorSampler.skippedTicks(elapsedUs: 100_000, intervalUs: 16_667) == 5,
        "A late tick reports the readings the cadence owed")
    var gapped = CursorTrack(batchSize: 100)
    _ = gapped.observe(placed, hostUs: 0)
    _ = gapped.accept(reading(hostUs: 1_000, x: 300, y: 455, skipped: 4), sourceUs: 0)
    gapped.note(refusedReadings: 7)
    precondition(
        gapped.stats.skippedTicks == 4 && gapped.stats.droppedReadings == 7
            && gapped.seal().count == 1,
        "A gap is reported as skipped and refused readings, got \(gapped.stats)")
    print("PASS missed and refused readings are reported instead of filled in")

    try runCursorJournalTests()
}

private func runCursorJournalTests() throws {
    let directory = RecoveryFixture.directory("cursor-journal")
    defer { try? FileManager.default.removeItem(at: directory) }
    let journal = try CaptureJournal(
        directory: directory.path,
        header: CaptureJournalHeader(
            schemaVersion: 1, sessionID: "cursor", source: CaptureSource(kind: "window", windowID: 3),
            width: 1600, height: 1000, microphone: false, systemAudio: false))
    try journal.recordOrigin(hostUs: 1_000_000)
    try journal.recordDisplaySpace(hostUs: 1_000_000, zeroOriginHeight: 982)
    try journal.recordGeometry(epoch: 1, hostUs: 1_000_000, sourceUs: 0, geometry: placed)
    var track = CursorTrack(batchSize: 2)
    _ = track.observe(placed, hostUs: 1_000_000)
    _ = track.accept(reading(hostUs: 1_000_000, x: 300, y: 455), sourceUs: 0)
    guard let batch = track.accept(reading(hostUs: 1_016_000, x: 0, y: 0), sourceUs: 16_000) else {
        preconditionFailure("A full batch must be written")
    }
    try journal.recordCursorSamples(batch)
    try journal.recordGeometry(epoch: 2, hostUs: 1_100_000, sourceUs: nil, geometry: letterboxed)

    let summary = try CaptureJournal.inspect(directory: directory.path)
    precondition(
        summary.cursorSamples == 2 && summary.firstCursorSourceUs == 0
            && summary.lastCursorSourceUs == 16_000,
        "A summary reports the cursor range without retaining samples, got \(summary)")
    precondition(
        summary.geometryEpochs == 2 && summary.lastGeometry == letterboxed,
        "A summary keeps the take's last geometry and epoch count")
    precondition(
        summary.invalidAtSequence == nil && !summary.incompleteTail && summary.originHostUs == 1_000_000,
        "Cursor records must not disturb the acquisition boundaries around them")

    var events: [JournalGeometry] = []
    var streamed: [CursorSample] = []
    try CaptureJournal.streamCursorEvidence(
        directory: directory.path, geometry: { events.append($0) },
        samples: { streamed.append(contentsOf: $0) })
    precondition(
        events.map(\.epoch) == [1, 2] && events.map(\.sourceUs) == [0, nil],
        "Streamed geometry keeps its epochs and the source time each was seen at")
    precondition(
        events[0].geometry == placed && events[1].geometry.contentScale == 0.8,
        "Streamed geometry carries the raw evidence the transform came from")
    precondition(
        streamed == batch, "Streamed samples read back exactly as written, got \(streamed)")

    // Evidence after a record that will not decode is not believed by either reader.
    let url = directory.appendingPathComponent("capture.journal.jsonl")
    var lines = try String(contentsOf: url, encoding: .utf8).split(
        separator: "\n", omittingEmptySubsequences: false
    ).map(String.init)
    precondition(lines[4].contains("\"event\":\"cursorSamples\""), "Fixture holds the batch record")
    lines[4] = lines[4].replacingOccurrences(of: "\"sourceUs\":0", with: "\"sourceUs\":\"0\"")
    try lines.joined(separator: "\n").write(to: url, atomically: true, encoding: .utf8)
    var afterBadRecord: [CursorSample] = []
    var geometryAfterBadRecord: [JournalGeometry] = []
    try CaptureJournal.streamCursorEvidence(
        directory: directory.path, geometry: { geometryAfterBadRecord.append($0) },
        samples: { afterBadRecord.append(contentsOf: $0) })
    let corrupted = try CaptureJournal.inspect(directory: directory.path)
    precondition(
        corrupted.invalidAtSequence == 5,
        "The corrupted fixture names its bad record, got \(corrupted.invalidAtSequence as Int?)")
    precondition(
        afterBadRecord.isEmpty && geometryAfterBadRecord.map(\.epoch) == [1],
        "A stream stops where the summary stops believing the journal, got \(afterBadRecord.count) samples")
    print("PASS geometry and cursor evidence round-trip through the journal")
}
