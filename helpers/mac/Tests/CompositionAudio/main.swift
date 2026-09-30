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
        if CommandLine.arguments.dropFirst().first == "--exact-time" {
            try verifyExactTimeCarrier()
            return
        }
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
        try verifyExactTimeCarrier()
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

func verifyExactTimeCarrier() throws {
    let decoder = JSONDecoder(), encoder = JSONEncoder()
    for json in ["0", "1", "-1", "9007199254740991", "-9007199254740991",
        "{\"numerator\":1,\"denominator\":3}", "{\"numerator\":-1,\"denominator\":3}"] {
        let original = Data(json.utf8)
        let value = try decoder.decode(ExactTime.self, from: original)
        let encoded = try encoder.encode(value)
        let expected = try JSONSerialization.jsonObject(with: original, options: [.fragmentsAllowed]) as! NSObject
        let actual = try JSONSerialization.jsonObject(with: encoded, options: [.fragmentsAllowed]) as! NSObject
        precondition(actual == expected, "Exact time changed during serialization: \(json)")
    }
    func refused<T: Decodable>(_ type: T.Type, _ json: String) throws {
        do { _ = try decoder.decode(type, from: Data(json.utf8)) }
        catch { return }
        throw NativeFailure("TEST_FAILED", "Accepted invalid exact time: \(json)")
    }
    for json in ["9007199254740992", "-9007199254740992",
        "{\"numerator\":2,\"denominator\":6}", "{\"numerator\":-2,\"denominator\":6}",
        "{\"numerator\":0,\"denominator\":2}", "{\"numerator\":1,\"denominator\":1}",
        "{\"numerator\":1,\"denominator\":0}", "{\"numerator\":1,\"denominator\":-3}",
        "{\"numerator\":1,\"denominator\":9007199254740992}",
        "{\"numerator\":-1,\"denominator\":3,\"extra\":1}"] {
        try refused(ExactTime.self, json)
    }
    for start in ["-1", "{\"numerator\":-1,\"denominator\":3}"] {
        try refused(CompositionAudioPlan.Selection.self, "{\"startUs\":\(start),\"endUs\":1}")
        try refused(CompositionAudioPlan.Selection.self, "{\"startUs\":0,\"endUs\":\(start)}")
    }
    _ = try decoder.decode(CompositionAudioPlan.Selection.self,
        from: Data("{\"startUs\":0,\"endUs\":{\"numerator\":1,\"denominator\":3}}".utf8))
    for value in [ExactTime(Int128(TimeSpan.maximumMicroseconds) + 1),
        ExactTime(-Int128(TimeSpan.maximumMicroseconds) - 1),
        ExactTime(1, Int128(TimeSpan.maximumMicroseconds) + 1), ExactTime(Int128.max)] {
        do {
            _ = try encoder.encode(value)
        } catch { continue }
        throw NativeFailure("TEST_FAILED", "Encoded unsafe exact time")
    }
    let difference = try ExactTime(1).subtract(ExactTime(4, 3))
    precondition(difference == ExactTime(-1, 3))
    let whole = try encoder.encode(ExactTime(6, 3))
    precondition(String(decoding: whole, as: UTF8.self) == "2")
    print("PASS exact signed carrier and nonnegative selection decoding")
}
