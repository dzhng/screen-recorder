import AVFoundation
import CoreVideo
import Foundation
import ScreenRecorderCapture

private let frameWidth = 1920
private let frameHeight = 1080
private let frameDurationUs: Int64 = 33_333

/// A recycled set of noisy frames. The encoder needs real detail before it falls behind, but
/// painting that detail per frame is slower than the encoder itself and hides the backpressure
/// these tests exist to reproduce.
private struct Frames {
    private let pool: [CVPixelBuffer]

    init(count: Int = 8) {
        pool = (0..<count).map { index in
            var pixels: CVPixelBuffer?
            CVPixelBufferCreate(
                kCFAllocatorDefault, frameWidth, frameHeight, kCVPixelFormatType_32BGRA,
                [kCVPixelBufferIOSurfacePropertiesKey: [:] as CFDictionary] as CFDictionary,
                &pixels)
            guard let buffer = pixels else { preconditionFailure("Cannot allocate a test frame") }
            CVPixelBufferLockBaseAddress(buffer, [])
            if let base = CVPixelBufferGetBaseAddress(buffer) {
                let bytesPerRow = CVPixelBufferGetBytesPerRow(buffer)
                for row in 0..<frameHeight {
                    let line = base.advanced(by: row * bytesPerRow)
                        .assumingMemoryBound(to: UInt8.self)
                    for column in stride(from: 0, to: bytesPerRow, by: 3) {
                        line[column] = UInt8((row &* 31 &+ column &* 17 &+ index &* 13) & 0xFF)
                    }
                }
            }
            CVPixelBufferUnlockBaseAddress(buffer, [])
            return buffer
        }
    }

    func sample(_ index: Int, atUs ptsUs: Int64) -> CMSampleBuffer {
        let buffer = pool[index % pool.count]
        var format: CMVideoFormatDescription?
        CMVideoFormatDescriptionCreateForImageBuffer(
            allocator: kCFAllocatorDefault, imageBuffer: buffer, formatDescriptionOut: &format)
        var timing = CMSampleTimingInfo(
            duration: CMTime(value: 1, timescale: 30),
            presentationTimeStamp: CMTime(value: ptsUs, timescale: 1_000_000),
            decodeTimeStamp: .invalid)
        var sample: CMSampleBuffer?
        CMSampleBufferCreateForImageBuffer(
            allocator: kCFAllocatorDefault, imageBuffer: buffer, dataReady: true,
            makeDataReadyCallback: nil, refcon: nil, formatDescription: format!,
            sampleTiming: &timing, sampleBufferOut: &sample)
        guard let sample else { preconditionFailure("Cannot build a test frame") }
        return sample
    }
}

/// A video writer configured the way `CaptureWriter` configures a take's video track.
private func startVideoWriter() -> (AVAssetWriter, AVAssetWriterInput, URL) {
    let directory = URL(fileURLWithPath: NSTemporaryDirectory())
        .appendingPathComponent("screenrec-held-tail-\(UUID().uuidString)")
    try! FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let url = directory.appendingPathComponent("video.mov")
    let writer = try! AVAssetWriter(outputURL: url, fileType: .mov)
    let input = AVAssetWriterInput(
        mediaType: .video,
        outputSettings: [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: frameWidth,
            AVVideoHeightKey: frameHeight,
            AVVideoCompressionPropertiesKey: [
                AVVideoExpectedSourceFrameRateKey: 30, AVVideoMaxKeyFrameIntervalKey: 30,
            ],
        ])
    input.expectsMediaDataInRealTime = true
    writer.add(input)
    precondition(writer.startWriting(), "Test writer must start")
    writer.startSession(atSourceTime: .zero)
    return (writer, input, url)
}

/// Feeds frames until the encoder actually refuses more, which is the stop-time condition a
/// held tail has to survive. Returns how many frames landed.
private func fillUntilBusy(_ input: AVAssetWriterInput, from frames: Frames) -> Int {
    var count = 0
    while count < 2000 && input.isReadyForMoreMediaData {
        precondition(
            input.append(frames.sample(count, atUs: Int64(count) * frameDurationUs)),
            "Test frame \(count) must append")
        count += 1
    }
    precondition(
        !input.isReadyForMoreMediaData,
        "Test could not make the encoder busy in \(count) frames; it cannot pin backpressure")
    return count
}

private func placeTail(
    _ frame: CMSampleBuffer, atUs ptsUs: Int64, in input: AVAssetWriterInput,
    of writer: AVAssetWriter
) -> (reason: CaptureFailure?, seconds: Double) {
    let timing = CMSampleTimingInfo(
        duration: CMTime(value: 1, timescale: 30),
        presentationTimeStamp: CMTime(value: ptsUs, timescale: 1_000_000),
        decodeTimeStamp: .invalid)
    let queue = DispatchQueue(label: "held-tail-test-writer")
    let settled = DispatchSemaphore(value: 0)
    nonisolated(unsafe) var reason: CaptureFailure?
    let start = Date()
    queue.sync {
        HeldTailFrame.place(frame, at: timing, in: input, of: writer, on: queue) {
            reason = $0
            settled.signal()
        }
    }
    precondition(settled.wait(timeout: .now() + 30) == .success, "A held tail must always settle")
    return (reason, Date().timeIntervalSince(start))
}

private func decodedPresentationTimes(_ url: URL) async -> [CMTime] {
    let asset = AVURLAsset(url: url)
    let tracks = try! await asset.loadTracks(withMediaType: .video)
    precondition(tracks.count == 1, "A finalized take must hold exactly one video track")
    let reader = try! AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(
        track: tracks[0],
        outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
    reader.add(output)
    precondition(reader.startReading(), "A finalized take must be readable")
    var stamps: [CMTime] = []
    while let sample = output.copyNextSampleBuffer() {
        precondition(sample.imageBuffer != nil, "Every decoded sample must carry an image")
        stamps.append(CMSampleBufferGetPresentationTimeStamp(sample))
    }
    return stamps
}

func runHeldTailFrameTests() async {
    let frames = Frames()

    let (writer, input, url) = startVideoWriter()
    let captured = fillUntilBusy(input, from: frames)
    let tailUs = Int64(captured) * frameDurationUs
    let lastDelivered = frames.sample(captured - 1, atUs: tailUs - frameDurationUs)
    let held = placeTail(lastDelivered, atUs: tailUs, in: input, of: writer)
    precondition(
        held.reason == nil,
        "A busy encoder is backpressure, not a failed take: \(held.reason?.message ?? "")")
    input.markAsFinished()
    writer.endSession(atSourceTime: CMTime(value: tailUs + frameDurationUs, timescale: 1_000_000))
    let finished = DispatchSemaphore(value: 0)
    writer.finishWriting { finished.signal() }
    precondition(finished.wait(timeout: .now() + 30) == .success, "The writer must finish")
    precondition(
        writer.status == .completed,
        "The writer must complete: \(writer.error?.localizedDescription ?? "")")
    let stamps = await decodedPresentationTimes(url)
    precondition(
        stamps.count == captured + 1,
        "Decoded take must hold \(captured) captured frames plus the held tail, got \(stamps.count)"
    )
    precondition(
        abs(CMTimeGetSeconds(stamps.last!) - Double(tailUs) / 1_000_000) < 0.001,
        "The held tail must sit at the stop boundary, got \(CMTimeGetSeconds(stamps.last!))")
    try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    print("PASS held tail waits out encoder backpressure and decodes")

    let (stopped, stoppedInput, stoppedURL) = startVideoWriter()
    precondition(stoppedInput.append(frames.sample(0, atUs: 0)), "Test frame must append")
    stopped.cancelWriting()
    let refused = placeTail(
        frames.sample(0, atUs: 0), atUs: frameDurationUs, in: stoppedInput, of: stopped)
    precondition(
        refused.reason?.code == "WRITE_FAILED",
        "A writer that stopped accepting samples must fail explicitly, got "
            + (refused.reason?.code ?? "success"))
    precondition(
        refused.seconds < 0.5,
        "A stopped writer must fail at once, not after the readiness budget: \(refused.seconds)s")
    try? FileManager.default.removeItem(at: stoppedURL.deletingLastPathComponent())
    print("PASS stopped writer fails the held tail without waiting")
}
