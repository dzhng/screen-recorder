@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderCapture

/// Authored raw/H264 fixtures exercise visible decoded bytes without a physical input boundary.
func runProbeCameraPixelPublicationTests() async throws {
    for (width, expectedHash) in [(32, "a25957a308051415c014091d3859d675729f6d437d1a5982b07bc76007868094"),
        (34, "38d8e98cc586ee348e6644bdfb08a0a20954903b015ed2802d2cd528ac248b1b")] {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("screenrec-camera-pixels-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: root) }
        let directory = root.appendingPathComponent("camera")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let raw = directory.appendingPathComponent("camera.raw.mov")
        let fixture = URL(fileURLWithPath: #filePath).deletingLastPathComponent().appendingPathComponent("fixtures/camera-visible\(width).mov")
        try FileManager.default.copyItem(at: fixture, to: raw)
        let asset = AVURLAsset(url: raw)
        let track = try await asset.loadTracks(withMediaType: .video).first!
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        reader.add(output)
        precondition(reader.startReading())
        let pixel = output.copyNextSampleBuffer()!.imageBuffer!
        precondition(CVPixelBufferGetWidth(pixel) == width && CVPixelBufferGetHeight(pixel) == 16)
        let stride = CVPixelBufferGetBytesPerRow(pixel)
        precondition(width == 32 ? stride == width * 4 : stride > width * 4,
            "Fixtures must exercise both contiguous and padded decoded rows")
        reader.cancelReading()
        let journal = try CaptureJournal(directory: directory.path, header: CaptureJournalHeader(schemaVersion: 1, sessionID: UUID().uuidString,
            source: CaptureSource(kind: "authored-camera-pixels"), width: width, height: 16, microphone: false, systemAudio: false))
        defer { journal.lease.release() }
        var rows = Data()
        for index in 0..<3 {
            let row: [String: Any] = ["role": "camera", "disposition": "accepted", "cameraFrame": [
                "ordinal": index,
                "start": ["value": index * 512, "timescale": 15360, "epoch": 0],
                "end": ["value": (index + 1) * 512, "timescale": 15360, "epoch": 0],
            ]]
            rows.append(try JSONSerialization.data(withJSONObject: row))
            rows.append(10)
        }
        let observations = root.appendingPathComponent("timestamps.jsonl")
        try rows.write(to: observations)
        try ProbeCameraMedia.recordClosed(raw: raw, marker: directory.appendingPathComponent("camera.closed.json"))
        let receipt = try await ProbeCameraMedia.publish(lease: journal.lease, observationURL: observations)
        precondition(receipt.representedFrames == 3 && receipt.firstUs == 0 && receipt.endUs == 100000 && receipt.diagnostics.isEmpty)
        // Independent serialized decoded bytes: little-endian PTS/width/height followed by visible BGRA.
        precondition(receipt.pictureSHA256 == expectedHash, "Visible pixels or exact picture metadata changed")
        print("PASS camera publication exact \(width)×16 visible BGRA pixels, stride\(stride), and timestamps")
    }
}
