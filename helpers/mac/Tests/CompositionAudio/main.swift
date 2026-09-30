import Foundation
import Darwin
import ScreenRecorderAudio
import ScreenRecorderMedia

@main
struct CompositionAudioTests {
    static func main() async {
        do { try await dispatch() }
        catch {
            FileHandle.standardError.write(Data("\(error)\n".utf8))
            exit(1)
        }
    }
    static func dispatch() async throws {
        if CommandLine.arguments.count >= 2 {
            let plan = try JSONDecoder().decode(CompositionAudioPlan.self,
                from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
            if CommandLine.arguments.dropFirst(2).first == "--cancel-during-preparation" {
                let task = Task.detached { try await CompositionAudio.write(plan) }
                let parent = URL(fileURLWithPath: plan.output).deletingLastPathComponent()
                var observed = false
                for _ in 0..<5000 {
                    if try FileManager.default.contentsOfDirectory(atPath: parent.path).contains(where: { $0.hasPrefix(".retime-") }) {
                        observed = true
                        task.cancel()
                        break
                    }
                    try await Task.sleep(for: .milliseconds(1))
                }
                precondition(observed, "Preparation scratch was never observed")
                do { _ = try await task.value; preconditionFailure("Cancellation published output") }
                catch is CancellationError {}
                precondition(!FileManager.default.fileExists(atPath: plan.output))
                let remaining = try FileManager.default.contentsOfDirectory(atPath: parent.path)
                precondition(remaining.allSatisfy { !$0.hasPrefix(".retime-") })
                print("PASS cancelled preparation leaves no output or scratch")
                return
            }
            let result = try await CompositionAudio.write(plan)
            print(String(decoding: try JSONEncoder().encode(result), as: UTF8.self))
        } else { try await run() }
    }
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
        // These wire values preserve IEEE negative zero, which JSON.stringify would normalize.
        let negativeZero = """
        {"output":"/unused.wav","range":{"start":0,"end":3},"clips":[{"clipId":"c","trackId":"t","sampleRange":{"start":1,"end":2},"placement":{"startUs":{"numerator":125,"denominator":6},"endUs":{"numerator":125,"denominator":3}},"source":{"kind":"silence"},"pitch":"preserve","available":[],"context":[]}],"assets":[],"processing":[{"target":{"kind":"clip","id":"c"},"mediaKind":"audio","inputs":[],"steps":[{"id":"g","enabled":true,"processor":{"type":"gain","gain":-0.0}}]},{"target":{"kind":"track","id":"t"},"mediaKind":"audio","inputs":[{"kind":"clip","id":"c"}],"steps":[]},{"target":{"kind":"output"},"mediaKind":"output","inputs":[{"kind":"track","id":"t"}],"steps":[]}]}
        """
        let negativePlan = try JSONDecoder().decode(CompositionAudioPlan.self, from: Data(negativeZero.utf8))
        let negative = try await CompositionAudio.open(negativePlan)
        var negativeFrames = 0
        try await negative.consume { block in
            precondition(block.samples.allSatisfy { $0.bitPattern == Float(-0.0).bitPattern })
            negativeFrames += block.frameCount
        }
        precondition(negativeFrames == 3)
        let withEmptyChild = negativeZero.replacingOccurrences(
            of: "{\"target\":{\"kind\":\"output\"}",
            with: "{\"target\":{\"kind\":\"track\",\"id\":\"empty\"},\"mediaKind\":\"audio\",\"inputs\":[],\"steps\":[]},{\"target\":{\"kind\":\"output\"}")
            .replacingOccurrences(of: "\"inputs\":[{\"kind\":\"track\",\"id\":\"t\"}]",
                with: "\"inputs\":[{\"kind\":\"track\",\"id\":\"t\"},{\"kind\":\"track\",\"id\":\"empty\"}]")
        let positive = try await CompositionAudio.open(JSONDecoder().decode(
            CompositionAudioPlan.self, from: Data(withEmptyChild.utf8)))
        try await positive.consume { block in
            precondition(block.samples.allSatisfy { $0.bitPattern == Float(0).bitPattern })
        }
        let missingState = negativeZero.replacingOccurrences(
            of: "\"type\":\"gain\",\"gain\":-0.0",
            with: "\"type\":\"rnnoise\",\"active\":[{\"start\":0,\"end\":3}]")
        let uncovered = try await CompositionAudio.open(JSONDecoder().decode(
            CompositionAudioPlan.self, from: Data(missingState.utf8)))
        do {
            try await uncovered.consume { _ in preconditionFailure("Uncovered state emitted PCM") }
            preconditionFailure("Silent branch hid missing prepared coverage")
        } catch let failure as NativeFailure { precondition(failure.code == "INVALID_REQUEST") }
        print(
            "PASS composition stream rebases window samples, awaits bounded blocks, rejects second consumption and propagates sink cancellation without a report"
        )
    }
}
