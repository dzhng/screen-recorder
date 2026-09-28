@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

let directory = URL(
    fileURLWithPath: ProcessInfo.processInfo.environment["SCREENREC_SOURCE_AUDIO_EVIDENCE"]
        ?? NSTemporaryDirectory() + UUID().uuidString)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
func wave(_ url: URL) throws -> (rate: Int, channels: Int, samples: [Float]) {
    let data = try Data(contentsOf: url)
    func number(_ offset: Int) -> UInt32 {
        data.withUnsafeBytes {
            UInt32(littleEndian: $0.loadUnaligned(fromByteOffset: offset, as: UInt32.self))
        }
    }
    var position = 12
    var rate = 0
    var channels = 0
    while position + 8 <= data.count {
        let tag = String(decoding: data[position..<position + 4], as: UTF8.self)
        let size = Int(number(position + 4))
        position += 8
        if tag == "fmt " {
            channels = Int(data[position + 2]) | Int(data[position + 3]) << 8
            rate = Int(number(position + 4))
        }
        if tag == "data" {
            let samples = stride(from: position, to: position + size, by: 4).map {
                Float(bitPattern: number($0))
            }
            return (rate, channels, samples)
        }
        position += size + size % 2
    }
    fatalError("WAVE data missing")
}
func fixture(
    rate: Double, channels: Int, name: String, poison: Bool = false, discrete: Bool = false,
    seconds: Double = 1.1
) throws -> URL {
    let url = directory.appendingPathComponent(name + ".caf")
    let format =
        channels > 2 || discrete
        ? AVAudioFormat(
            commonFormat: .pcmFormatFloat32, sampleRate: rate, interleaved: true,
            channelLayout: AVAudioChannelLayout(
                layoutTag: kAudioChannelLayoutTag_DiscreteInOrder | UInt32(channels))!)
        : AVAudioFormat(
            commonFormat: .pcmFormatFloat32, sampleRate: rate,
            channels: AVAudioChannelCount(channels), interleaved: true)!
    let file = try AVAudioFile(
        forWriting: url, settings: format.settings, commonFormat: .pcmFormatFloat32,
        interleaved: true)
    let count = Int(rate * seconds)
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(count))!
    buffer.frameLength = AVAudioFrameCount(count)
    for frame in 0..<count {
        for channel in 0..<channels {
            let excluded = frame >= Int(rate * 0.2) && frame < Int(rate * 0.3)
            buffer.floatChannelData![0][frame * channels + channel] =
                poison && excluded
                ? (channel == 0 ? 0.99 : -0.99) : Float((frame * (channel + 3)) % 101 - 50) / 100
        }
    }
    try file.write(from: buffer)
    return url
}
func pcmMovie(_ source: URL) async throws -> URL {
    let file = try AVAudioFile(
        forReading: source, commonFormat: .pcmFormatFloat32, interleaved: true)
    let format = file.processingFormat
    let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(file.length))!
    try file.read(into: buffer)
    let url = source.appendingPathExtension("mov")
    if FileManager.default.fileExists(atPath: url.path) { return url }
    let writer = try AVAssetWriter(outputURL: url, fileType: .mov)
    let input = AVAssetWriterInput(mediaType: .audio, outputSettings: format.settings)
    writer.add(input)
    precondition(writer.startWriting())
    writer.startSession(atSourceTime: .zero)
    var description: CMAudioFormatDescription?
    var basic = format.streamDescription.pointee
    CMAudioFormatDescriptionCreate(
        allocator: nil, asbd: &basic, layoutSize: 0, layout: nil,
        magicCookieSize: 0, magicCookie: nil, extensions: nil, formatDescriptionOut: &description)
    var sample: CMSampleBuffer?
    CMSampleBufferCreate(
        allocator: nil, dataBuffer: nil, dataReady: false, makeDataReadyCallback: nil, refcon: nil,
        formatDescription: description, sampleCount: Int(buffer.frameLength),
        sampleTimingEntryCount: 1,
        sampleTimingArray: [
            CMSampleTimingInfo(
                duration: CMTime(value: 1, timescale: Int32(format.sampleRate)),
                presentationTimeStamp: .zero, decodeTimeStamp: .invalid)
        ],
        sampleSizeEntryCount: 1, sampleSizeArray: [4 * Int(format.channelCount)],
        sampleBufferOut: &sample)
    precondition(
        CMSampleBufferSetDataBufferFromAudioBufferList(
            sample!, blockBufferAllocator: nil, blockBufferMemoryAllocator: nil, flags: 0,
            bufferList: buffer.audioBufferList) == noErr)
    while !input.isReadyForMoreMediaData { try await Task.sleep(for: .milliseconds(1)) }
    precondition(input.append(sample!))
    input.markAsFinished()
    await writer.finishWriting()
    precondition(writer.status == .completed)
    return url
}
let t: (Int64) -> CMTime = { CMTime(value: $0, timescale: 1_000_000) }
func movie(_ sources: [URL], name: String) async throws -> (URL, [String]) {
    let composition = AVMutableComposition()
    for source in sources {
        let input = try await pcmMovie(source)
        let asset = AVURLAsset(url: input)
        defer { withExtendedLifetime(asset) {} }
        let audio = try await asset.loadTracks(withMediaType: .audio)[0]
        let target = composition.addMutableTrack(
            withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
        for range in [
            TimeSpan(startUs: 0, endUs: 400_000), TimeSpan(startUs: 600_000, endUs: 1_000_000),
        ] {
            try target.insertTimeRange(
                CMTimeRange(start: t(range.startUs), end: t(range.endUs)), of: audio,
                at: t(1_250_000 + range.startUs))
        }
    }
    let url = directory.appendingPathComponent(name + ".mov")
    let export = AVAssetExportSession(
        asset: composition, presetName: AVAssetExportPresetPassthrough)!
    try await export.export(to: url, as: .mov)
    let tracks = try await AVURLAsset(url: url).loadTracks(withMediaType: .audio)
    return (url, tracks.map { "track:\($0.trackID)" })
}
var cases = 0
for rate in [44_100, 48_000] {
    let clean = try fixture(rate: Double(rate), channels: 2, name: "clean-\(rate)")
    let poison = try fixture(rate: Double(rate), channels: 2, name: "poison-\(rate)", poison: true)
    let other = try fixture(rate: Double(rate), channels: 1, name: "other-\(rate)")
    let (url, tracks) = try await movie([clean, other], name: "selected-\(rate)")
    let (poisonURL, poisonTracks) = try await movie(
        [poison, other], name: "poison-selected-\(rate)")
    let support = [
        TimeSpan(startUs: 13, endUs: 200_000), TimeSpan(startUs: 300_000, endUs: 999_987),
    ]
    let selection = AudioSourceSelection(
        source: url.path, streamId: tracks[0], sourceOffsetUs: -1_250_000, available: support)
    let fullRange = TimeSpan(startUs: 0, endUs: 1_000_000)
    let fullURL = directory.appendingPathComponent("full-\(rate).wav")
    let originalBytes = try Data(contentsOf: url)
    let full = try await SourceAudio.write(source: selection, range: fullRange, output: fullURL)
    let reference = try wave(fullURL)
    precondition(full.frames == Int64(rate) && reference.channels == 2)
    for frame in 0..<32 {
        for channel in 0..<2 {
            let expected = Float(((frame + 1) * (channel + 3)) % 101 - 50) / 100
            precondition(
                reference.samples[frame * 2 + channel] == expected,
                "Channel/source-frame mapping changed")
        }
    }
    precondition(
        full.unavailable == [
            TimeSpan(startUs: 0, endUs: 13), TimeSpan(startUs: 200_000, endUs: 300_000),
            TimeSpan(startUs: 400_000, endUs: 600_000),
            TimeSpan(startUs: 999_987, endUs: 1_000_000),
        ], "Unexpected unavailable: \(full.unavailable)")
    for (index, range) in [
        TimeSpan(startUs: 71, endUs: 199_991), TimeSpan(startUs: 199_997, endUs: 600_013),
        TimeSpan(startUs: 610_013, endUs: 999_981),
    ].enumerated() {
        let output = directory.appendingPathComponent("part-\(rate)-\(index).wav")
        let part = try await SourceAudio.write(source: selection, range: range, output: output)
        let actual = try wave(output)
        precondition(part.sampleRange.start == range.startUs * Int64(rate) / 1_000_000)
        precondition(part.sampleRange.end == range.endUs * Int64(rate) / 1_000_000)
        precondition(
            actual.samples
                == Array(
                    reference.samples[
                        Int(part.sampleRange.start) * 2..<Int(part.sampleRange.end) * 2]),
            "Window PCM differs from full source output")
        cases += 1
    }
    let poisonOutput = directory.appendingPathComponent("poison-\(rate).wav")
    _ = try await SourceAudio.write(
        source: .init(
            source: poisonURL.path, streamId: poisonTracks[0], sourceOffsetUs: -1_250_000,
            available: support), range: fullRange, output: poisonOutput)
    let poisoned = try wave(poisonOutput)
    precondition(poisoned.samples == reference.samples, "Excluded poison leaked")
    let monoOutput = directory.appendingPathComponent("mono-\(rate).wav")
    let mono = try await SourceAudio.write(
        source: .init(
            source: url.path, streamId: tracks[1], sourceOffsetUs: -1_250_000,
            available: [.init(startUs: 0, endUs: 1_000_000)]), range: fullRange, output: monoOutput)
    precondition(mono.channels == 1 && mono.layout == "mono")
    let remainingBytes = try Data(contentsOf: url)
    precondition(originalBytes == remainingBytes)
    let request: [String: Any] = [
        "source": [
            "source": url.path, "streamId": tracks[0], "sourceOffsetUs": -1_250_000,
            "available": support.map { ["startUs": $0.startUs, "endUs": $0.endUs] },
        ], "range": ["startUs": 0, "endUs": 1_000_000],
        "output": directory.appendingPathComponent("wire-\(rate).wav").path,
    ]
    try JSONSerialization.data(withJSONObject: request).write(
        to: directory.appendingPathComponent("request-\(rate).json"))
}
for (rate, channels, discrete) in [(44_100.5, 2, false), (48_000.0, 4, true), (48_000.0, 2, true)] {
    let source = try fixture(
        rate: rate, channels: channels, name: "unsupported-\(rate)-\(channels)", discrete: discrete)
    do {
        _ = try await SourceAudio.write(
            source: .init(
                source: source.path, sourceOffsetUs: 0,
                available: [.init(startUs: 0, endUs: 1_000_000)]),
            range: .init(startUs: 0, endUs: 100_000),
            output: directory.appendingPathComponent("unsupported-\(channels).wav"))
        fatalError("Unsupported source format accepted")
    } catch let error as NativeFailure { precondition(error.code == "UNSUPPORTED_FORMAT") }
}
let longSource = try fixture(rate: 48_000, channels: 2, name: "long", seconds: 60)
let longSelection = AudioSourceSelection(
    source: longSource.path, sourceOffsetUs: 0, available: [.init(startUs: 0, endUs: 60_000_000)])
let longOutput = directory.appendingPathComponent("long.wav")
_ = try await SourceAudio.write(
    source: longSelection, range: .init(startUs: 0, endUs: 60_000_000), output: longOutput)
let lateOutput = directory.appendingPathComponent("late.wav")
let late = try await SourceAudio.write(
    source: longSelection, range: .init(startUs: 59_000_071, endUs: 59_020_013), output: lateOutput)
let fullLong = try wave(longOutput)
let lateWave = try wave(lateOutput)
precondition(
    lateWave.samples
        == Array(fullLong.samples[Int(late.sampleRange.start) * 2..<Int(late.sampleRange.end) * 2]))
precondition(
    late.decodedFrames <= 48_000, "Late window decoded a source prefix: \(late.decodedFrames)")
print("Late 20ms window decoded \(late.decodedFrames) native frames from a 60-second source")
let capacitySource = directory.appendingPathComponent("clean-48000.caf")
let capacitySelection = AudioSourceSelection(
    source: capacitySource.path, sourceOffsetUs: 0, available: [])
let capacityOutput = directory.appendingPathComponent("oversize.wav")
do {
    _ = try await SourceAudio.write(
        source: capacitySelection, range: .init(startUs: 0, endUs: 20_000_000_000),
        output: capacityOutput)
    fatalError("Oversize RIFF accepted")
} catch let error as NativeFailure { precondition(error.code == "LIMIT_EXCEEDED") }
precondition(!FileManager.default.fileExists(atPath: capacityOutput.path))
let canceledOutput = directory.appendingPathComponent("canceled.wav")
let pending = Task.detached {
    try await SourceAudio.write(
        source: capacitySelection, range: .init(startUs: 0, endUs: 600_000_000),
        output: canceledOutput)
}
var began = false
for _ in 0..<1000 {
    let names = try FileManager.default.contentsOfDirectory(atPath: directory.path)
    if names.contains(where: { $0.hasPrefix(".screenrec-output-") }) {
        began = true
        break
    }
    try await Task.sleep(for: .milliseconds(1))
}
precondition(began, "Did not observe active output staging")
pending.cancel()
do {
    _ = try await pending.value
    fatalError("Canceled output published")
} catch is CancellationError {}
precondition(!FileManager.default.fileExists(atPath: canceledOutput.path))
let remaining = try FileManager.default.contentsOfDirectory(atPath: directory.path)
precondition(!remaining.contains(where: { $0.hasPrefix(".screenrec-output-") }))
print(
    "Source windows passed \(cases) full/range comparisons, dual stream mono/stereo, physical/acquisition gaps and poison isolation; unsupported rate/channel count refused. Evidence: \(directory.path)"
)
