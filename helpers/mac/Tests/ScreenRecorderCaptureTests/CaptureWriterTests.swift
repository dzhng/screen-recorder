import Foundation
import ScreenRecorderCapture

func runCaptureWriterTests() throws {
    for canceled in [false, true] {
        let directory = RecoveryFixture.directory("quiet-writer")
        defer { try? FileManager.default.removeItem(at: directory) }
        let writer = try CaptureWriter(
            request: CaptureRequest(
                source: CaptureSource(kind: "window", windowID: 1),
                outputDirectory: directory.path, microphone: false, systemAudio: false),
            width: 32, height: 32, sessionID: "quiet-writer",
            requestedSourceRect: nil, onFailure: { _ in })
        defer { writer.cancel() }
        let journal = directory.appendingPathComponent("capture.journal.jsonl")
        let header = try Data(contentsOf: journal)
        writer.queue.sync {
            writer.accept(CursorReading(
                hostUs: 1, global: .zero, buttons: 0, zeroOriginHeight: 800))
        }
        let written = try Data(contentsOf: journal)
        precondition(written.count > header.count, "A live writer journals display-space changes")
        if canceled { writer.cancel() } else { writer.seal() }
        let sealed = try Data(contentsOf: journal)
        // Keep the real writer alive, as queued stream callbacks can during native shutdown.
        writer.queue.sync {
            writer.accept(CursorReading(
                hostUs: 2, global: .zero, buttons: 0, zeroOriginHeight: 900))
        }
        let delivered = try Data(contentsOf: journal)
        precondition(delivered == sealed, "A late cursor delivery must not append after seal/cancel")
    }
    print("PASS late cursor deliveries cannot append after writer seal or cancel")
}
