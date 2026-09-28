import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

@main
struct CompositionAudioTests {
    static func main() async throws { try await run() }
    nonisolated static func run() async throws {
        let data = Data(
            """
            {"output":"/unused.wav","range":{"start":24000,"end":72000},"clips":[],"assets":[],"processing":[{"target":{"kind":"output"},"mediaKind":"output","inputs":[],"steps":[]}]}
            """.utf8)
        let plan = try JSONDecoder().decode(CompositionAudioPlan.self, from: data)
        let stream = try await CompositionAudio.open(plan)
        var position: Int64 = 0
        var blocks = 0
        try await stream.consume { block in
            precondition(block.startFrame == position)
            precondition(block.frameCount > 0 && block.frameCount <= 8192)
            precondition(block.samples.count == block.frameCount * 2)
            precondition(block.samples.allSatisfy { $0 == 0 })
            await Task.yield()
            position += Int64(block.frameCount)
            blocks += 1
        }
        precondition(position == 48000 && blocks > 1 && stream.report?.frames == 48000)
        do {
            try await stream.consume { _ in preconditionFailure("A second consumer received PCM") }
            preconditionFailure("Reconsumption was accepted")
        } catch let failure as NativeFailure { precondition(failure.code == "INVALID_REQUEST") }
        let failed = try await CompositionAudio.open(plan)
        do {
            try await failed.consume { _ in throw CancellationError() }
            preconditionFailure("Sink cancellation was lost")
        } catch is CancellationError {}
        precondition(failed.report == nil)
        print(
            "PASS composition stream rebases window samples, awaits bounded blocks, rejects second consumption and propagates sink cancellation without a report"
        )
    }
}
