@preconcurrency import AVFoundation
import Foundation
let directory = URL(fileURLWithPath: "/tmp/screenrec-negative-origin")
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
    writer.startSession(atSourceTime: CMTime(value: -12000, timescale: 48000))
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
                presentationTimeStamp: CMTime(value: -12000, timescale: 48000), decodeTimeStamp: .invalid)
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

let source = try fixture(rate: 48000, channels: 1, name: "negative-session", seconds: 2)
let url = try await pcmMovie(source)
let asset = AVURLAsset(url: url)
var results: [[String: Any]] = []
for track in try await asset.loadTracks(withMediaType: .audio) {
 let segments = try await track.load(.segments)
 results.append(["trackID": track.trackID, "segments": segments.map { segment in
  ["empty": segment.isEmpty, "sourceStart": CMTimeGetSeconds(segment.timeMapping.source.start), "sourceDuration": CMTimeGetSeconds(segment.timeMapping.source.duration), "targetStart": CMTimeGetSeconds(segment.timeMapping.target.start), "targetDuration": CMTimeGetSeconds(segment.timeMapping.target.duration)] as [String:Any]
 }])
}
let output: [String:Any] = ["candidate": url.path, "requestedPresentationStartSeconds": -0.25, "requestedSessionStartSeconds": -0.25, "tracks": results]
print(String(data: try JSONSerialization.data(withJSONObject: output, options: [.prettyPrinted,.sortedKeys]), encoding: .utf8)!)
