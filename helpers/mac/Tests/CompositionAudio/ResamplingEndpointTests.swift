@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

func verifyResamplingEndpoints() async throws {
    let directory = URL(fileURLWithPath: ProcessInfo.processInfo.environment["SCREENREC_COMPOSITION_AUDIO_EVIDENCE"]
        ?? NSTemporaryDirectory() + UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    // The original third retained span uses recording time and a +125ms source offset.
    // This standalone clip preserves its native interval/quota without the old automatic mix/fades.
    let recordingStart: Int64 = 2_500_000, recordingEnd: Int64 = 5_999_983, offset: Int64 = 125_000
    let start = recordingStart - offset, end = recordingEnd - offset
    let duration = end - start
    let firstNative = try ExactTime(Int128(start)).sample(44_100, nearest: true)
    let endNative = try ExactTime(Int128(end)).sample(44_100, ceil: true)
    let outputFrames = try ExactTime(Int128(duration)).sample(48_000)
    let operands: [String: Any] = ["recordingRangeUs": [recordingStart, recordingEnd],
        "recordingSourceOffsetUs": offset, "assetOriginUs": 0, "sourceRangeUs": [start, end],
        "projectPlacementUs": [0, duration], "inputSampleRate": 44_100, "outputSampleRate": 48_000,
        "admittedNativeFrames": [firstNative, endNative], "outputFrames": outputFrames,
        "excludedMarkers": [104_737, 259_087], "includedMarkers": [104_738, 259_086]]
    try JSONSerialization.data(withJSONObject: operands, options: [.prettyPrinted, .sortedKeys])
        .write(to: directory.appendingPathComponent("operands.json"))
    precondition(firstNative == 104_738 && endNative == 259_087 && outputFrames == 167_999,
        "Original nearest-start/ceil-end source cells and the output quota must remain exact")

    func writeSource(_ name: String, markers: [Int]) throws -> URL {
        let url = directory.appendingPathComponent(name + ".caf")
        let format = AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: 44_100,
            channels: 1, interleaved: true)!
        let file = try AVAudioFile(forWriting: url, settings: format.settings,
            commonFormat: .pcmFormatFloat32, interleaved: true)
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 264_600)!
        buffer.frameLength = 264_600
        buffer.floatChannelData![0].initialize(repeating: 0, count: 264_600)
        for frame in markers { buffer.floatChannelData![0][frame] = 0.9 }
        try file.write(from: buffer)
        return url
    }
    func readPCM(_ url: URL) throws -> (rate: Double, channels: Int, frames: Int64, samples: [Float]) {
        let file = try AVAudioFile(forReading: url, commonFormat: .pcmFormatFloat32, interleaved: true)
        let channels = Int(file.processingFormat.channelCount)
        let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: 8_192)!
        var samples: [Float] = []
        while samples.count < Int(file.length) * channels {
            try file.read(into: buffer, frameCount: AVAudioFrameCount(min(8_192,
                Int(file.length) - samples.count / channels)))
            guard buffer.frameLength > 0 else { throw NativeFailure("TEST_FAILED", "Independent PCM read stopped before declared EOF") }
            samples.append(contentsOf: UnsafeBufferPointer(start: buffer.floatChannelData![0],
                count: Int(buffer.frameLength) * channels))
        }
        return (file.processingFormat.sampleRate, channels, file.length, samples)
    }
    var pcm: [String: Data] = [:]
    var peaks: [String: Float] = [:]
    var metrics: [String: Any] = [:]
    for (name, markers) in [("zero", []), ("outside", [104_737, 259_087]),
                            ("inside-start", [104_738]), ("inside-end", [259_086])] {
        let source = try writeSource(name, markers: markers)
        let sourceBytes = try Data(contentsOf: source)
        let track = try await AVURLAsset(url: source).loadTracks(withMediaType: .audio)[0]
        let trackRange = try await track.load(.timeRange)
        let streamId = "track:\(track.trackID)"
        let clip: [String: Any] = ["kind": "clip", "id": "c"]
        let target: [String: Any] = ["kind": "track", "id": "t"]
        let sampleRange = ["start": Int64(0), "end": outputFrames]
        let sourceRange = ["startUs": start, "endUs": end]
        let output = directory.appendingPathComponent(name + ".wav")
        let body: [String: Any] = ["output": output.path, "range": sampleRange,
            "assets": [["assetId": "a", "streamId": streamId, "path": source.path, "originUs": 0]],
            "clips": [["clipId": "c", "trackId": "t", "sampleRange": sampleRange,
                "placement": ["startUs": Int64(0), "endUs": duration], "pitch": "preserve",
                "source": ["kind": "range", "assetId": "a", "streamId": streamId, "range": sourceRange],
                "available": [sampleRange], "context": [["source": sourceRange, "sampleRange": sampleRange]]]],
            "processing": [["target": clip, "mediaKind": "audio", "inputs": [], "steps": []],
                ["target": target, "mediaKind": "audio", "inputs": [clip], "steps": []],
                ["target": ["kind": "output"], "mediaKind": "output", "inputs": [target], "steps": []]]]
        let data = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        try data.write(to: directory.appendingPathComponent(name + ".request.json"))
        let plan = try JSONDecoder().decode(CompositionAudioPlan.self, from: data)
        let result = try await CompositionAudio.write(plan)
        let resultData = try JSONEncoder().encode(result)
        try resultData.write(to: directory.appendingPathComponent(name + ".result.json"))
        let decoded = try readPCM(output)
        let raw = decoded.samples.withUnsafeBufferPointer { Data(buffer: $0) }
        try raw.write(to: directory.appendingPathComponent(name + ".f32"))
        pcm[name] = raw
        peaks[name] = decoded.samples.map(abs).max() ?? 0
        let independent = try readPCM(source)
        let actualMarkers = independent.samples.indices.filter { independent.samples[$0] != 0 }
        metrics[name] = ["inputMarkers": actualMarkers, "outputFrames": decoded.frames,
            "outputRate": decoded.rate, "outputChannels": decoded.channels,
            "peak": peaks[name]!, "sourcePTS": ["value": trackRange.start.value, "timescale": trackRange.start.timescale]]
        try JSONSerialization.data(withJSONObject: metrics, options: [.prettyPrinted, .sortedKeys])
            .write(to: directory.appendingPathComponent("metrics.json"))
        precondition(trackRange.start == .zero && independent.rate == 44_100 && independent.channels == 1
            && independent.frames == 264_600 && actualMarkers == markers,
            "Independent source/container inspection must preserve the original native clock and markers")
        precondition(decoded.rate == 48_000 && decoded.channels == 2 && decoded.frames == outputFrames
            && decoded.samples.allSatisfy { $0.isFinite }, "Current composition must deliver exact finite48k stereo output")
        let remaining = try Data(contentsOf: source)
        precondition(sourceBytes == remaining, "Resampling must leave source bytes intact")
    }
    precondition(peaks["zero"] == 0 && pcm["outside"] == pcm["zero"],
        "Excluded nearest-start and ceil-end neighbors must never influence current composition PCM: \(metrics)")
    for name in ["inside-start", "inside-end"] {
        precondition(peaks[name]! > 0 && pcm[name] != pcm["zero"],
            "Each admitted boundary impulse must survive current resampling: \(name), \(metrics)")
    }
    print("PASS current resampling endpoints: exact167999 stereo frames, excluded neighbors byte-identical to zero, both admitted boundary impulses survive")
}
