@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderMedia
#if DEBUG
@testable import ScreenRecorderAudio

@main
struct SelectedAudioTests {
    static func main() async throws {
        let directory = URL(fileURLWithPath: ProcessInfo.processInfo.environment["SCREENREC_SELECTED_AUDIO_EVIDENCE"]
            ?? NSTemporaryDirectory() + UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try await run(directory)
    }
    static func wave(_ directory: URL, _ name: String, rate: Int, channels: Int, samples: [Float]) throws -> URL {
        let url = directory.appendingPathComponent(name + ".wav")
        let writer = try AudioWaveWriter(sampleRate: rate, frames: Int64(samples.count / channels),
            channels: channels, output: url, sources: [])
        defer { writer.discard() }
        try writer.write(AudioPCMBlock(startFrame: 0, frameCount: samples.count / channels, samples: samples))
        _ = try writer.finish()
        return url
    }
    static func samples(_ source: URL, rate: Int, channels: Int, block: Int = 8192) async throws -> [Float] {
        let stream = try await SelectedAudioConversion.open(source: source, sampleRate: rate, channels: channels)
        var result: [Float] = []
        try await stream.consume(blockFrames: block) { part in
            precondition(part.startFrame * Int64(channels) == Int64(result.count))
            precondition(part.frameCount > 0 && part.frameCount <= block && part.frameCount <= 8192)
            precondition(part.samples.count == part.frameCount * channels)
            result += part.samples
        }
        precondition(result.count == Int(stream.frames) * channels)
        return result
    }
    nonisolated static func run(_ directory: URL) async throws {
        var impulse = [Float](repeating: 0, count: 17)
        impulse[16] = 1
        let last = try wave(directory, "last-permitted-frame", rate: 48000, channels: 1, samples: impulse)
        let full = try await samples(last, rate: 24000, channels: 1)
        precondition(full.count == 8 && full.contains { abs($0) > 0.00001 },
            "The final permitted frame must influence finite-filter output despite the shorter output quota")
        let truncated = try wave(directory, "shortened-context-control", rate: 48000, channels: 1,
            samples: Array(impulse.prefix(16)))
        let short = try await samples(truncated, rate: 24000, channels: 1)
        precondition(short != full && short.allSatisfy { $0 == 0 })
        for (source, name) in [(last, "last-permitted-output"), (truncated, "shortened-context-output")] {
            let stream = try await SelectedAudioConversion.open(source: source, sampleRate: 24000, channels: 1)
            _ = try await stream.write(to: directory.appendingPathComponent(name + ".wav"))
        }
        print("PASS last permitted input frame contributes beyond output-duration-derived context")
        for rate in [24000, 44100, 48000] {
            for count in [1, 3, 17, 8193] {
                let input = (0..<count).map { Float(($0 * 13) % 127 - 63) / 128 }
                let file = try wave(directory, "count-\(rate)-\(count)", rate: rate, channels: 1, samples: input)
                for target in [24000, 44100, 48000] where count * target / rate > 0 {
                    let expected = count * target / rate
                    let complete = try await samples(file, rate: target, channels: 1)
                    precondition(complete.count == expected)
                    if target == rate { precondition(complete == input) }
                    for partition in [1, 127, 4093] {
                        let partitioned = try await samples(file, rate: target, channels: 1, block: partition)
                        precondition(partitioned == complete)
                    }
                    let stream = try await SelectedAudioConversion.open(source: file, sampleRate: target, channels: 1)
                    let receipt = try await stream.write(to: directory.appendingPathComponent("result-\(rate)-\(count)-\(target).wav"))
                    precondition(receipt.input.frames == Int64(count) && receipt.output.frames == Int64(expected))
                    let output = try AVAudioFile(forReading: URL(fileURLWithPath: receipt.file))
                    precondition(output.length == Int64(expected))
                    let data = try JSONEncoder().encode(receipt)
                    try data.write(to: directory.appendingPathComponent("receipt-\(rate)-\(count)-\(target).json"))
                }
            }
        }
        print("PASS exact rate/count matrix, non-microsecond durations, complete PCM partition invariance and closed outputs")
        let lane: [Float] = [-0.0, 0.25, -0.75, 1.5, -2, Float.greatestFiniteMagnitude]
        for (name, left, right) in [("equal", lane, lane), ("left", lane, Array(repeating: Float(0), count: lane.count)),
            ("right", Array(repeating: Float(0), count: lane.count), lane), ("opposite", lane, lane.map { -$0 })] {
            let interleaved = zip(left, right).flatMap { [$0, $1] }
            let source = try wave(directory, name, rate: 48000, channels: 2, samples: interleaved)
            let mono = try await samples(source, rate: 48000, channels: 1)
            let expected = zip(left, right).map { Float((Double($0) + Double($1)) * 0.5) }
            precondition(mono == expected && mono.allSatisfy(\.isFinite))
            let stereo = try await samples(source, rate: 48000, channels: 2)
            precondition(stereo == interleaved)

        }
        let monoSource = try wave(directory, "mono-preservation", rate: 48000, channels: 1, samples: lane)
        let unchanged = try await samples(monoSource, rate: 48000, channels: 1)
        let duplicated = try await samples(monoSource, rate: 48000, channels: 2)
        precondition(unchanged == lane)
        precondition(duplicated == lane.flatMap { [$0, $0] })
        var changing: [Float] = []
        for index in 0..<1025 {
            changing.append(Float(index % 31 - 15) / 16)
            changing.append(Float(index % 17 - 8) / 32)
        }
        let changingSource = try wave(directory, "stereo-rate", rate: 44100, channels: 2, samples: changing)
        let convertedStereo = try await samples(changingSource, rate: 24000, channels: 2)
        let convertedMono = try await samples(changingSource, rate: 24000, channels: 1)
        let averaged: [Float] = stride(from: 0, to: convertedStereo.count, by: 2).map { index in
            Float((Double(convertedStereo[index]) + Double(convertedStereo[index + 1])) * 0.5)
        }
        precondition(convertedMono == averaged)
        print("PASS explicit channel policies and finite overflow-safe Float32 rounding")
        for poison in [false, true] {
            let sourcePCM = (0..<48000).map { frame -> Float in
                let permitted = (7200..<14400).contains(frame) || (28800..<38400).contains(frame)
                return !permitted && poison ? 1000 : Float((frame * 7) % 97 - 48) / 100
            }
            let donor = try wave(directory, "donor-\(poison)", rate: 48000, channels: 1, samples: sourcePCM)
            let selected = directory.appendingPathComponent("selected-\(poison).wav")
            let receipt = try await SourceAudio.write(source: AudioSourceSelection(source: donor.path,
                sourceOffsetUs: 0, available: [TimeSpan(startUs: 150000, endUs: 300000), TimeSpan(startUs: 600000, endUs: 800000)]),
                range: TimeSpan(startUs: 100000, endUs: 900000), output: selected)
            precondition(!receipt.unavailable.isEmpty)
            let stream = try await SelectedAudioConversion.open(source: selected, sampleRate: 44100, channels: 2)
            _ = try await stream.write(to: directory.appendingPathComponent("isolated-\(poison).wav"))
        }
        let clean = try Data(contentsOf: directory.appendingPathComponent("isolated-false.wav"))
        let poisoned = try Data(contentsOf: directory.appendingPathComponent("isolated-true.wav"))
        precondition(clean == poisoned, "Excluded donor samples and acquisition gaps must not affect any converted sample")
        print("PASS complete converted output unchanged by poisoned excluded source and acquisition gaps")

        let zero = try wave(directory, "zero-quota", rate: 48000, channels: 1, samples: [1])
        do {
            _ = try await SelectedAudioConversion.open(source: zero, sampleRate: 24000, channels: 1)
            preconditionFailure("Zero output quota was accepted")
        } catch let error as NativeFailure { precondition(error.code == "INVALID_REQUEST") }
        let empty = try wave(directory, "empty", rate: 48000, channels: 1, samples: [])
        do {
            _ = try await SelectedAudioConversion.open(source: empty, sampleRate: 48000, channels: 1)
            preconditionFailure("Empty PCM was accepted")
        } catch {}
        let broken = directory.appendingPathComponent("truncated.wav")
        var bytes = try Data(contentsOf: last); bytes.removeLast(4); try bytes.write(to: broken)
        do {
            _ = try await SelectedAudioConversion.open(source: broken, sampleRate: 24000, channels: 1)
            preconditionFailure("Truncated WAV was accepted")
        } catch {}
        enum SinkFailure: Error { case stop }
        let failing = try await SelectedAudioConversion.open(source: last, sampleRate: 48000, channels: 1)
        var calls = 0
        do {
            try await failing.consume { _ in calls += 1; throw SinkFailure.stop }
            preconditionFailure("Sink failure was lost")
        } catch SinkFailure.stop { precondition(calls == 1) }
        do {
            try await failing.consume { _ in preconditionFailure("Failed source resumed") }
            preconditionFailure("A second consumer was accepted")
        } catch let error as NativeFailure { precondition(error.code == "INVALID_REQUEST") }
        let canceledOutput = directory.appendingPathComponent("canceled.wav")
        let canceled = Task {
            let stream = try await SelectedAudioConversion.open(source: last, sampleRate: 48000, channels: 1)
            withUnsafeCurrentTask { $0?.cancel() }
            return try await stream.write(to: canceledOutput)
        }
        do { _ = try await canceled.value; preconditionFailure("Cancellation published output") }
        catch is CancellationError {}
        precondition(!FileManager.default.fileExists(atPath: canceledOutput.path))
        let invalid = try wave(directory, "nonfinite", rate: 48000, channels: 1,
            samples: Array(repeating: Float(0.1), count: 9000) + [.nan])
        let invalidOutput = directory.appendingPathComponent("failed.wav")
        do {
            let stream = try await SelectedAudioConversion.open(source: invalid, sampleRate: 48000, channels: 1)
            _ = try await stream.write(to: invalidOutput)
            preconditionFailure("Nonfinite PCM published output")
        } catch {}
        precondition(!FileManager.default.fileExists(atPath: invalidOutput.path))
        let midstream = Task {
            let stream = try await SelectedAudioConversion.open(source: changingSource, sampleRate: 48000, channels: 2)
            var calls = 0
            do {
                try await stream.consume(blockFrames: 17) { _ in
                    calls += 1
                    withUnsafeCurrentTask { $0?.cancel() }
                }
                preconditionFailure("Mid-stream cancellation was ignored")
            } catch is CancellationError { precondition(calls == 1) }
        }
        try await midstream.value
        for profile in [(0, 1), (192001, 1), (48000, 0), (48000, 3)] {
            do {
                _ = try await SelectedAudioConversion.open(source: last, sampleRate: profile.0, channels: profile.1)
                preconditionFailure("Unsupported profile was accepted")
            } catch let error as NativeFailure { precondition(error.code == "INVALID_REQUEST") }
        }
        let leftovers = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        precondition(!leftovers.contains { $0.hasPrefix(".screenrec-output-") })
        print("PASS zero/empty/truncated refusal, sink failure, one-consumer lifetime, cancellation and failed-output cleanup")



    }
}

#else
@main
struct SelectedAudioTests {
    static func main() throws {
        throw NativeFailure("INVALID_REQUEST", "The partition and WAV-sink gate requires a debug test build.")
    }
}
#endif
