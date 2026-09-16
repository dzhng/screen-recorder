import CryptoKit
import Foundation
import ScreenRecorderFrames

func pointerCompositionCancellation(source: URL, parent: URL) async throws {
    let directory = parent.appendingPathComponent("pointer-lifetime-\(UUID().uuidString)")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    defer { try? FileManager.default.removeItem(at: directory) }
    let output = directory.appendingPathComponent("pointer-cancel.mp4")
    let schedule = directory.appendingPathComponent("pointer-cancel.jsonl")
    var header: [String: Any] = [
        "version": 1, "recordingId": "fixture", "sourceId": "source",
        "sourceGeneration": "fixture", "revisionId": "revision", "sourceWidth": 320,
        "sourceHeight": 240, "durationUs": 3_000_000, "spanCount": 1,
        "trailPolicy": "requested-time-trail-v1", "scenePolicy": "rgb-spatial-change-v2",
    ]
    var data = try JSONSerialization.data(withJSONObject: header)
    data.append(10)
    for i in 0..<10_000 {
        let row: [String: Any] = [
            "spanIndex": 0, "at": ["value": String(i * 300), "timescale": 1_000_000],
            "pointer": ["atSourceUs": i * 300, "x": 30 + i % 2 * 100, "y": 40],
        ]
        data.append(try JSONSerialization.data(withJSONObject: row))
        data.append(10)
    }
    try data.write(to: schedule)
    header.merge([
        "file": schedule.path, "bytes": data.count, "records": 10_000, "events": 10_000,
        "sha256": SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined(),
    ]) { _, new in new }
    let receipt = try JSONDecoder().decode(
        PointerScheduleReceipt.self, from: JSONSerialization.data(withJSONObject: header))
    let plan = try JSONDecoder().decode(
        [VideoRenderSpan].self,
        from: Data(
            "[{\"source\":{\"startUs\":0,\"endUs\":3000000},\"playback\":{\"startUs\":0,\"endUs\":3000000}}]"
                .utf8))
    let task = Task {
        try await VideoRenderer.write(
            source: source, plan: plan, output: output, pointerSchedule: receipt)
    }
    let deadline = ContinuousClock.now.advanced(by: .seconds(5))
    while !(try FileManager.default.contentsOfDirectory(atPath: directory.path)).contains(where: {
        $0.hasPrefix(".video-render-")
    }) {
        guard ContinuousClock.now < deadline else {
            task.cancel()
            _ = try await task.value
            fatalError("Pointer render never reached staging")
        }
        try await Task.sleep(for: .milliseconds(2))
    }
    try Data("another owner's file".utf8).write(to: output)
    task.cancel()
    do {
        _ = try await task.value
        fatalError("Cancelled pointer render succeeded")
    } catch is CancellationError {}
    let sentinel = try Data(contentsOf: output)
    precondition(sentinel == Data("another owner's file".utf8))
    let names = try FileManager.default.contentsOfDirectory(atPath: directory.path)
    precondition(
        !names.contains {
            $0.hasPrefix(".video-render-")
        })
    print("PASS pointer composition cancellation removes only owned staging")
}
