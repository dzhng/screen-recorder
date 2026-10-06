@preconcurrency import AVFoundation
import Foundation
import ScreenCaptureKit
import YapCapture

/// Live audio callbacks can omit frame duration even though PCM declares its sample grid.
func runLivePCMTimingTests() async throws {
    let root = RecoveryFixture.directory("live-pcm-timing")
    defer { try? FileManager.default.removeItem(at: root) }
    let movie = root.appendingPathComponent("input.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: movie, timesUs: [0, 100000], endUs: 200000)
    let asset = AVURLAsset(url: movie)
    let track = try await asset.loadTracks(withMediaType: .video).first!
    let reader = try AVAssetReader(asset: asset)
    let video = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
    reader.add(video)
    precondition(reader.startReading())
    let origin = CaptureHostTime.nowUs() - 500000
    let writer = try CaptureWriter(request: .init(source: .init(kind: "camera", deviceID: "synthetic"),
        outputDirectory: root.appendingPathComponent("capture").path, microphone: true, systemAudio: false),
        width: RecoveryFixture.width, height: RecoveryFixture.height, sessionID: "live-pcm",
        requestedSourceRect: nil, onFailure: { _ in })
    let picture = try captureFixtureRetimed(video.copyNextSampleBuffer()!, at: CMTime(value: origin, timescale: 1000000), duration: CMTime(value: 200000, timescale: 1000000))
    writer.queue.sync { _ = writer.ingestPrimaryVideo(picture) }
    let frames = 256
    var asbd = AudioStreamBasicDescription(mSampleRate: 48000, mFormatID: kAudioFormatLinearPCM,
        mFormatFlags: kAudioFormatFlagIsSignedInteger | kAudioFormatFlagIsPacked,
        mBytesPerPacket: 2, mFramesPerPacket: 1, mBytesPerFrame: 2,
        mChannelsPerFrame: 1, mBitsPerChannel: 16, mReserved: 0)
    var format: CMAudioFormatDescription?
    precondition(CMAudioFormatDescriptionCreate(allocator: nil, asbd: &asbd, layoutSize: 0,
        layout: nil, magicCookieSize: 0, magicCookie: nil, extensions: nil, formatDescriptionOut: &format) == noErr)
    var block: CMBlockBuffer?
    precondition(CMBlockBufferCreateWithMemoryBlock(allocator: nil, memoryBlock: nil,
        blockLength: frames * 2, blockAllocator: nil, customBlockSource: nil, offsetToData: 0,
        dataLength: frames * 2, flags: 0, blockBufferOut: &block) == noErr)
    let values = [Int16](repeating: 8192, count: frames)
    precondition(values.withUnsafeBytes { CMBlockBufferReplaceDataBytes(with: $0.baseAddress!, blockBuffer: block!, offsetIntoDestination: 0, dataLength: $0.count) } == noErr)
    var audio: CMSampleBuffer?
    let pts = CMTime(value: origin + 50000, timescale: 1000000)
    precondition(CMAudioSampleBufferCreateReadyWithPacketDescriptions(allocator: nil,
        dataBuffer: block!, formatDescription: format!, sampleCount: frames,
        presentationTimeStamp: pts, packetDescriptions: nil, sampleBufferOut: &audio) == noErr)
    var timing = CMSampleTimingInfo(duration: .invalid, presentationTimeStamp: pts, decodeTimeStamp: .invalid)
    var live: CMSampleBuffer?
    precondition(CMSampleBufferCreateCopyWithNewTiming(allocator: nil, sampleBuffer: audio!,
        sampleTimingEntryCount: 1, sampleTimingArray: &timing, sampleBufferOut: &live) == noErr)
    let receipt = writer.queue.sync { writer.ingestObserved(live!, of: .microphone) }
    precondition(receipt.disposition == "accepted", "Native camera narration with unspecified frame duration must be accepted: \(receipt.disposition)")
    writer.seal()
    let result = await writer.finish(failure: nil)
    precondition(result.failure == nil, "Live PCM conversion must not interrupt the take")
    let recorded = AVURLAsset(url: root.appendingPathComponent("capture/narration.packed.mov"))
    let audioTrack = try await recorded.loadTracks(withMediaType: .audio).first!
    let decoded = try AVAssetReader(asset: recorded)
    let output = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: [
        AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMIsFloatKey: true,
        AVLinearPCMBitDepthKey: 32, AVLinearPCMIsNonInterleaved: false])
    decoded.add(output)
    precondition(decoded.startReading())
    var samples: [Float] = []
    while let sample = output.copyNextSampleBuffer() {
        let data = sample.dataBuffer!
        var bytes = Data(count: CMBlockBufferGetDataLength(data))
        precondition(bytes.withUnsafeMutableBytes { CMBlockBufferCopyDataBytes(data, atOffset: 0, dataLength: $0.count, destination: $0.baseAddress!) } == noErr)
        samples += bytes.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }
    }
    precondition(samples == [Float](repeating: 0.25, count: frames), "Conversion preserves every narration sample without resampling")
    print("PASS live camera PCM with unspecified duration preserves all decoded samples")
}
