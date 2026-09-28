@preconcurrency import AVFoundation
import Darwin
import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

func streamingProof(source: String, seconds: Int64, evidence: URL) async throws {
    let span = TimeSpan(startUs: 0, endUs: seconds * 1_000_000)
    let track = AudioTrackPlan(
        role: .narration, source: source, sourceOffsetUs: 0, available: [span])
    let spans = [
        TimeSpan(startUs: 0, endUs: 168_583),
        TimeSpan(startUs: 200_000, endUs: 372_750),
        TimeSpan(startUs: 400_000, endUs: span.endUs),
    ]
    let stream = try await AudioPCMStream.open(tracks: [track], spans: spans)
    precondition(stream.format.sampleRate == 48_000 && stream.format.channels == 2)
    let expectedFrames = seconds * 48_000 - 2_816
    precondition(stream.frames == expectedFrames)
    var blocks = 0
    var seen: Int64 = 0
    var largest = 0
    var lastCount = 0
    var checked = 0
    var maximumError: Float = 0
    try await stream.consume { block in
        precondition(block.startFrame == seen)
        precondition(block.samples.count == block.frameCount * 2)
        precondition(block.frameCount <= AudioPCMStream.maximumBlockFrames)
        for offset in 0..<block.frameCount {
            let frame = block.startFrame + Int64(offset)
            if frame % 4096 != 0 && abs(frame - 8092) > 250 && abs(frame - 16384) > 250
                && frame < expectedFrames - 250
            {
                continue
            }
            let start: Int64 = frame < 8092 ? 0 : (frame < 16384 ? 8092 : 16384)
            let end: Int64 = frame < 8092 ? 8092 : (frame < 16384 ? 16384 : expectedFrames)
            let sourceFrame =
                frame < 8092 ? frame : (frame < 16384 ? frame - 8092 + 9600 : frame - 16384 + 19200)
            var gain: Float = 1
            if start > 0 && frame - start < 240 { gain = Float(frame - start) / 240 }
            if end < expectedFrames && end - 1 - frame < 240 { gain = Float(end - 1 - frame) / 240 }
            for channel in 0..<2 {
                let frequency: Double = channel == 0 ? 997 : 1511
                let expected =
                    Float(0.2 * sin(2 * Double.pi * frequency * Double(sourceFrame) / 48_000))
                    * gain
                maximumError = max(
                    maximumError, abs(block.samples[offset * 2 + channel] - expected))
                checked += 1
            }
        }
        seen += Int64(block.frameCount)
        blocks += 1
        largest = max(largest, block.frameCount)
        lastCount = block.frameCount
    }
    precondition(seen == expectedFrames && maximumError < 0.00001)
    // Independent WAVE consumer of the same stream; it is also the production excerpt sink.
    let waveStream = try await AudioPCMStream.open(tracks: [track], spans: spans)
    let wave = evidence.appendingPathComponent("stream-\(seconds).wav")
    let bytes = try await AudioWave.write(waveStream, to: wave)
    let readback = try AVAudioFile(forReading: wave)
    precondition(readback.length == expectedFrames)

    enum SinkFailure: Error { case intentional }
    let failed = try await AudioPCMStream.open(tracks: [track], spans: [span])
    var accepted = 0
    var completed = false
    do {
        try await failed.consume { _ in
            accepted += 1
            if accepted == 3 { throw SinkFailure.intentional }
        }
        completed = true
    } catch SinkFailure.intentional {}
    precondition(accepted == 3 && !completed)
    var usage = rusage()
    getrusage(RUSAGE_SELF, &usage)
    let report: [String: Any] = [
        "seconds": seconds, "frames": seen, "waveFrames": readback.length,
        "sampleRate": stream.format.sampleRate, "channels": stream.format.channels,
        "blocks": blocks, "largestBlockFrames": largest, "finalBlockFrames": lastCount,
        "checkedSamples": checked, "maximumSampleError": maximumError, "waveBytes": bytes,
        "peakNativeRSSBytes": usage.ru_maxrss, "sinkFailureAfterBlocks": accepted,
        "completedAfterFailure": completed,
    ]
    let data = try JSONSerialization.data(
        withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
    try data.write(to: evidence.appendingPathComponent("stream-\(seconds).json"))
    print(String(decoding: data, as: UTF8.self))
}

/// Lossless reference for generated movie plans, using the same bounded production stream.
func writePlanReference(_ path: String) async throws {
    struct Plan: Decodable {
        let tracks: [AudioTrackPlan]
        let spans: [TimeSpan]
        let output: String
    }
    let plan = try JSONDecoder().decode(
        Plan.self, from: Data(contentsOf: URL(fileURLWithPath: path)))
    let stream = try await AudioPCMStream.open(tracks: plan.tracks, spans: plan.spans)
    let bytes = try await AudioWave.write(stream, to: URL(fileURLWithPath: plan.output))
    let report: [String: Any] = [
        "frames": stream.frames, "sampleRate": stream.format.sampleRate,
        "channels": stream.format.channels, "bytes": bytes,
        "tracks": try JSONSerialization.jsonObject(with: JSONEncoder().encode(zip(plan.tracks, stream.reports).map { AudioTrackReport(role: $0.role, source: $1) })),
    ]
    print(
        String(
            data: try JSONSerialization.data(withJSONObject: report, options: [.sortedKeys]),
            encoding: .utf8)!)
}

/// Selected-source PCM uses the production stream and WAVE sink without a recording role.
func writeSelectedReference(_ path: String) async throws {
    struct Plan: Decodable {
        let source: AudioSourceSelection
        let spans: [TimeSpan]
        let output: String
    }
    let plan = try JSONDecoder().decode(Plan.self, from: Data(contentsOf: URL(fileURLWithPath: path)))
    let stream = try await AudioPCMStream.open(source: plan.source, spans: plan.spans)
    let bytes = try await AudioWave.write(stream, to: URL(fileURLWithPath: plan.output))
    print("Selected source PCM: \(stream.frames) frames, \(bytes) bytes")
}
