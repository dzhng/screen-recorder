@preconcurrency import AVFoundation
import Foundation
#if DEBUG
@testable import ScreenRecorderAudio
@testable import ScreenRecorderMedia
#else
import ScreenRecorderMedia
import ScreenRecorderAudio
#endif

#if DEBUG
// A seek is an interior point in an already selected native cell, including negative
// presentation origins and phases whose denominator cannot combine into CMTimeScale.
for rate in [8000, 44100, 48000, 192000] {
    for origin in [ExactTime(-100001), ExactTime(100001), ExactTime(100013),
        ExactTime(100000000001, 999983), ExactTime(Int128(TimeSpan.maximumMicroseconds) * 2)] {
        for frame: Int64 in [0, 1, 4096] {
            let seek = try ExactTime(AudioSourceReader.seekTime(origin: origin, frame: frame, sampleRate: rate))
            let start = try origin.subtract(ExactTime(-Int128(frame) * 1_000_000, Int128(rate)))
            let end = try origin.subtract(ExactTime(-Int128(frame + 1) * 1_000_000, Int128(rate)))
            let afterStart = try seek.subtract(start).numerator > 0
            let beforeEnd = try end.subtract(seek).numerator > 0
            precondition(afterStart && beforeEnd)
        }
    }
}

#endif

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
// A sample-aligned physical edit need not have an integral microsecond boundary.
let rationalInput = try await pcmMovie(fixture(rate: 48_000, channels: 1, name: "rational-source", seconds: 2.1))
let rationalAsset = AVURLAsset(url: rationalInput)
let rationalSource = try await rationalAsset.loadTracks(withMediaType: .audio)[0]
let rationalComposition = AVMutableComposition()
let rationalTrack = rationalComposition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
rationalTrack.naturalTimeScale = 6_000_000
for (sourceStart, count, targetStart) in [(0, 32768, 4800), (40960, 55040, 45760)] {
    try rationalTrack.insertTimeRange(
        CMTimeRange(start: CMTime(value: Int64(sourceStart), timescale: 48000), duration: CMTime(value: Int64(count), timescale: 48000)),
        of: rationalSource, at: CMTime(value: Int64(targetStart), timescale: 48000))
}
let rationalURL = directory.appendingPathComponent("rational-segments.mov")
try await AVAssetExportSession(asset: rationalComposition, presetName: AVAssetExportPresetPassthrough)!.export(to: rationalURL, as: .mov)
let rationalPublished = try await AVURLAsset(url: rationalURL).loadTracks(withMediaType: .audio)[0]
let rationalSegments = SourceSegment.occupied(of: try await rationalPublished.load(.segments))
precondition(rationalSegments[1].asset.start == CMTime(value: 45760, timescale: 48000))
let rationalSelection = AudioSourceSelection(source: rationalURL.path, sourceOffsetUs: 0, available: [.init(startUs: 0, endUs: 2_100_000)])
let rationalFullURL = directory.appendingPathComponent("rational-full.wav")
_ = try await SourceAudio.write(source: rationalSelection, range: .init(startUs: 0, endUs: 2_100_000), output: rationalFullURL)
let rationalFull = try wave(rationalFullURL).samples
var rationalExpected = [Float](repeating: 0, count: 100800)
for (sourceStart, count, targetStart) in [(0, 32768, 4800), (40960, 55040, 45760)] {
    for frame in 0..<count { rationalExpected[targetStart + frame] = Float(((sourceStart + frame) * 3) % 101 - 50) / 100 }
}
precondition(rationalFull == rationalExpected, "Physical rational segments changed full source sample placement")
let rationalLateURL = directory.appendingPathComponent("rational-late.wav")
_ = try await SourceAudio.write(source: rationalSelection, range: .init(startUs: 1_200_000, endUs: 1_400_000), output: rationalLateURL)
let rationalLate = try wave(rationalLateURL).samples
precondition(rationalLate == Array(rationalExpected[57600..<67200]), "Late source window lost the physical segment phase")
// Acquisition remains binding even when physical media exists outside it.
let acquiredURL = directory.appendingPathComponent("rational-acquired.wav")
_ = try await SourceAudio.write(
    source: .init(source: rationalURL.path, sourceOffsetUs: 0, available: [.init(startUs: 1_200_000, endUs: 1_400_000)]),
    range: .init(startUs: 1_000_000, endUs: 1_500_000), output: acquiredURL)
let acquired = try wave(acquiredURL).samples
precondition(acquired == [Float](repeating: 0, count: 9600) + Array(rationalExpected[57600..<67200]) + [Float](repeating: 0, count: 4800))
print("PASS exact physical segment phase in full/late windows with binding acquisition support")

// Independent native-address oracle for non-grid phases and acquisition-mask edges.
for rate in [44100, 48000] {
    let input = try await pcmMovie(fixture(rate: Double(rate), channels: 1, name: "phase-source-\(rate)", seconds: 2.1))
    let asset = AVURLAsset(url: input)
    defer { withExtendedLifetime(asset) {} }
    let track = try await asset.loadTracks(withMediaType: .audio)[0]
    for anchor: Int64 in [100001, 100013] {
        let composition = AVMutableComposition()
        let target = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
        target.naturalTimeScale = rate == 44100 ? 441000000 : 6000000
        try target.insertTimeRange(CMTimeRange(start: CMTime(value: 0, timescale: Int32(rate)), duration: CMTime(value: Int64(rate) * 2, timescale: Int32(rate))),
            of: track, at: CMTime(value: anchor, timescale: 1000000))
        let file = directory.appendingPathComponent("phase-\(rate)-\(anchor).mov")
        try await AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!.export(to: file, as: .mov)
        let end = anchor + 2000000
        for maskStart: Int64 in [anchor, 1200001, 1200013] {
            let maskEnd = maskStart == anchor ? end : 1400013
            let selection = AudioSourceSelection(source: file.path, sourceOffsetUs: 0,
                available: [.init(startUs: maskStart, endUs: maskEnd)])
            let fullURL = directory.appendingPathComponent("phase-\(rate)-\(anchor)-\(maskStart)-full.wav")
            _ = try await SourceAudio.write(source: selection, range: .init(startUs: 0, endUs: end), output: fullURL)
            let full = try wave(fullURL).samples
            var expected = [Float](repeating: 0, count: Int(end * Int64(rate) / 1000000))
            let outputStart = Int(maskStart * Int64(rate) / 1000000)
            let outputEnd = Int(maskEnd * Int64(rate) / 1000000)
            let sourceFirst = Int(((maskStart - anchor) * Int64(rate) + 500000) / 1000000)
            for i in outputStart..<outputEnd { expected[i] = Float(((sourceFirst + i - outputStart) * 3) % 101 - 50) / 100 }
            precondition(full == expected, "Physical phase or acquisition mask changed native sample identity")
            let lateURL = directory.appendingPathComponent("phase-\(rate)-\(anchor)-\(maskStart)-late.wav")
            _ = try await SourceAudio.write(source: selection, range: .init(startUs: 1200011, endUs: 1299567), output: lateURL)
            let late = try wave(lateURL).samples
            precondition(late == Array(expected[Int(1200011 * Int64(rate) / 1000000)..<Int(1299567 * Int64(rate) / 1000000)]))
        }
    }
}
print("PASS arbitrary physical phase and acquisition-mask native addresses at44.1/48k")

for (rate, channels, discrete) in [(44_100.5, 2, false), (48_000.0, 4, true), (48_000.0, 2, true)] {
    let source = try fixture(
        rate: rate, channels: channels, name: "unsupported-\(rate)-\(channels)", discrete: discrete)
    #if DEBUG
    if rate.rounded() != rate {
        do {
            _ = try await SourceTrack.open(
                source: source.path, streamId: nil, sourceOffsetUs: 0,
                available: [.init(startUs: 0, endUs: 1_000_000)])
            fatalError("Common audio execution accepted a fractional native rate")
        } catch let error as NativeFailure { precondition(error.code == "UNSUPPORTED_FORMAT") }
    }
    #endif
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
// Descriptor accounting is independent of whether an inspection-byte budget applies.
let descriptorFile = try FileHandle(forReadingFrom: longSource)
for purpose in [MediaInput.ReadPurpose.inspection, .streaming] {
    let input = try MediaInput(url: URL(fileURLWithPath: "/dev/fd/\(descriptorFile.fileDescriptor)"), purpose: purpose)
    let tracks = try await input.asset.loadTracks(withMediaType: .audio)
    precondition(!tracks.isEmpty)
    _ = try await tracks[0].load(.formatDescriptions)
    let work = input.readWork!
    FileHandle.standardError.write(Data("Descriptor \(purpose): read=\(work.readBytes) delivered=\(work.deliveredBytes)\n".utf8))
    precondition(work.deliveredBytes > 0, "Streaming reads must not masquerade as zero I/O")
    precondition(work.readBytes == work.deliveredBytes + 12)
}
try descriptorFile.close()
#if DEBUG
// The platform parser borrows positional reads from a retained descriptor. Its allowance
// is the caller's remaining inspection budget, including prior header/delivery work.
let identitySource = try fixture(rate: 48_000, channels: 2, name: "identity", seconds: 0.1)
let identityFile = try FileHandle(forReadingFrom: identitySource)
try identityFile.seek(toOffset: 123)
let identityDescriptor = try MediaDescriptor(
    url: URL(fileURLWithPath: "/dev/fd/\(identityFile.fileDescriptor)"), writable: false)!
let identity = try DescriptorAudioType.identify(identityDescriptor, maximumBytes: 64 * 1024 * 1024)
let identityOffset = try identityFile.offset()
precondition(identityOffset == 123)
try identityFile.close()
try FileManager.default.removeItem(at: identitySource)
let exactIdentity = try DescriptorAudioType.identify(identityDescriptor, maximumBytes: identity.readBytes)
precondition(exactIdentity.type.contentType == identity.type.contentType)
precondition(exactIdentity.readBytes == identity.readBytes)
for remaining in [Int64(0), identity.readBytes - 1] {
    do {
        _ = try DescriptorAudioType.identify(identityDescriptor, maximumBytes: remaining)
        fatalError("Identification exceeded its remaining inspection allowance")
    } catch let error as NativeFailure { precondition(error.code == "LIMIT_EXCEEDED") }
}
print("Container identification exact allowance \(identity.readBytes) bytes; one byte short refused; offset and closed/unlinked lifetime preserved")
#endif
let urlInput = try MediaInput(url: longSource)
precondition(urlInput.readWork == nil, "Opaque AVFoundation URL I/O is unknown")
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
