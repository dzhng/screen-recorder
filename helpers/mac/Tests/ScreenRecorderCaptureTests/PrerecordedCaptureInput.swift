@preconcurrency import AVFoundation
import Foundation
import ScreenCaptureKit
import ScreenRecorderCapture
import ScreenRecorderMedia

/// Only the physical input boundary is substituted. NativeCapture creates and closes the real writer.
@MainActor
final class PrerecordedCaptureInput: CaptureInputSession {
    let width = RecoveryFixture.width
    let height = RecoveryFixture.height
    let requestedSourceRect: CGRect? = nil
    let source: URL
    let refusesAfterDelivery: Bool
    var stops = 0
    var onFailure: (@Sendable (CaptureFailure) -> Void)?
    var audio: URL?
    var omittedAudioBuffer: Int?
    var audioRoles: [SCStreamOutputType] = [.microphone]
    var expectedPCM = Data()
    var expectedRate: Int64 = 0
    var expectedChannels: Int64 = 0
    var offeredAudioBuffers = 0
    var holdStop = false
    let stopEntered = InputGate()
    let releaseStop = InputGate()

    init(source: URL, refusesAfterDelivery: Bool = false) {
        self.source = source
        self.refusesAfterDelivery = refusesAfterDelivery
    }

    func start(writer: CaptureWriter, onFailure: @escaping @Sendable (CaptureFailure) -> Void,
        checkInterruption: () throws -> Void) async throws {
        self.onFailure = onFailure
        let asset = AVURLAsset(url: source)
        let track = try await asset.loadTracks(withMediaType: .video).first!
        let reader = try AVAssetReader(asset: asset)
        let output = AVAssetReaderTrackOutput(track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        reader.add(output)
        precondition(reader.startReading())
        // An inert SCStream only supplies the existing callback's identity. Never start it.
        let stream = SCStream(filter: SCContentFilter(), configuration: SCStreamConfiguration(), delegate: nil)
        let origin = CaptureHostTime.nowUs() - (audio == nil ? 400_000 : 3_000_000)
        while let sample = output.copyNextSampleBuffer() {
            let timed = try captureFixtureRetimed(sample,
                at: CMTimeAdd(time(microseconds: origin), sample.presentationTimeStamp))
            let attachments = CMSampleBufferGetSampleAttachmentsArray(timed, createIfNecessary: true)! as NSArray
            (attachments[0] as! NSMutableDictionary)[SCStreamFrameInfo.status.rawValue] = SCFrameStatus.complete.rawValue
            writer.queue.sync { writer.stream(stream, didOutputSampleBuffer: timed, of: .screen) }
            try checkInterruption()
            if refusesAfterDelivery { throw CaptureFailure("INPUT_START_FAILED", "Prerecorded partial start") }
        }
        precondition(reader.status == .completed)
        if let audio {
            for role in audioRoles {
                let asset = AVURLAsset(url: audio)
                let track = try await asset.loadTracks(withMediaType: .audio).first!
                let reader = try AVAssetReader(asset: asset)
                let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
                    AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 32,
                    AVLinearPCMIsFloatKey: true, AVLinearPCMIsNonInterleaved: false,
                    AVLinearPCMIsBigEndianKey: false])
                reader.add(output)
                precondition(reader.startReading())
                var index = 0
                while let sample = output.copyNextSampleBuffer() {
                    if index != omittedAudioBuffer {
                        let raw = try captureFixtureRetimed(sample,
                            at: CMTimeAdd(time(microseconds: origin + 100001), sample.presentationTimeStamp))
                        writer.queue.sync { writer.stream(stream, didOutputSampleBuffer: raw, of: role) }
                        if role == audioRoles.first {
                            let format = CMAudioFormatDescriptionGetStreamBasicDescription(sample.formatDescription!)!.pointee
                            expectedRate = Int64(format.mSampleRate)
                            expectedChannels = Int64(format.mChannelsPerFrame)
                            let block = sample.dataBuffer!
                            var bytes = Data(count: CMBlockBufferGetDataLength(block))
                            let status = bytes.withUnsafeMutableBytes {
                                CMBlockBufferCopyDataBytes(block, atOffset: 0, dataLength: $0.count, destination: $0.baseAddress!)
                            }
                            precondition(status == noErr)
                            expectedPCM.append(bytes)
                            offeredAudioBuffers += 1
                        }
                    }
                    index += 1
                    // Pace prerecorded delivery so the real-time writer's backpressure is not the oracle variable.
                    try await Task.sleep(for: .milliseconds(5))
                }
                precondition(reader.status == .completed)
            }
        }
    }
    func startCursorSampling(writer: CaptureWriter) {}
    func observeDeviceLoss(onFailure: @escaping @Sendable (CaptureFailure) -> Void) {}
    func stop() async -> CaptureFailure? {
        stops += 1
        stopEntered.release()
        if holdStop { await releaseStop.wait() }
        return nil
    }
}

@MainActor
final class InputGate {
    private var open = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    func wait() async { if !open { await withCheckedContinuation { waiters.append($0) } } }
    func release() { open = true; let pending = waiters; waiters.removeAll(); for waiter in pending { waiter.resume() } }
}

func captureFixtureRetimed(_ sample: CMSampleBuffer, at pts: CMTime, duration: CMTime? = nil) throws
  -> CMSampleBuffer
{
  var count = 0
  var status = CMSampleBufferGetSampleTimingInfoArray(
    sample, entryCount: 0, arrayToFill: nil, entriesNeededOut: &count)
  precondition(status == noErr)
  var timing = [CMSampleTimingInfo](repeating: CMSampleTimingInfo(), count: count)
  status = CMSampleBufferGetSampleTimingInfoArray(
    sample, entryCount: count, arrayToFill: &timing, entriesNeededOut: &count)
  precondition(status == noErr)
  let shift = CMTimeSubtract(pts, sample.presentationTimeStamp)
  for n in timing.indices {
    timing[n].presentationTimeStamp = CMTimeAdd(timing[n].presentationTimeStamp, shift)
    if timing[n].decodeTimeStamp.isNumeric {
      timing[n].decodeTimeStamp = CMTimeAdd(timing[n].decodeTimeStamp, shift)
    }
    if let duration { timing[n].duration = duration }
  }
  var copy: CMSampleBuffer?
  status = CMSampleBufferCreateCopyWithNewTiming(
    allocator: kCFAllocatorDefault, sampleBuffer: sample, sampleTimingEntryCount: count,
    sampleTimingArray: &timing, sampleBufferOut: &copy)
  precondition(status == noErr)
  return copy!
}

