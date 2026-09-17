@preconcurrency import AVFoundation
import CoreImage
import Darwin
import Foundation
import ScreenRecorderMedia

public struct VideoRenderSpan: Codable, Sendable {
    public let source: FrameInterval
    public let playback: FrameInterval
}

public struct RenderedVideo: Sendable {
    public let durationUs: Int64
    public let width: Int
    public let height: Int
    public let frameCount: Int
}

/// Sequential video-only rendering. The plan owns cuts; sample support owns visible
/// content. Explicit empty edits map to the measured default player's opaque black.
/// Unexplained gaps never inherit either the previous image or this appearance rule.
public enum VideoRenderer {
    /// Writes an H.264 MP4 at `file`, a private path the caller owns and publishes.
    public static func write(
        source: URL, plan: [VideoRenderSpan], into file: URL,
        pointerSchedule: PointerScheduleReceipt? = nil
    ) async throws
        -> RenderedVideo
    {
        let through = try PresentationSource.duration(of: plan)
        let presentation = try await PresentationSource(
            source: source.resolvingSymlinksInPath().standardizedFileURL, plan: plan)
        let width = presentation.width
        let height = presentation.height
        let pointers = try pointerSchedule.map {
            try PointerSchedule($0, plan: plan, width: width, height: height)
        }
        var clock = try presentation.movieClock(plan: plan)
        if let pointers { try clock.include(pointers.clock.timescale) }
        let writer = try AVAssetWriter(outputURL: file, fileType: .mp4)
        let input = AVAssetWriterInput(
            mediaType: .video,
            outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width,
                AVVideoHeightKey: height,
                AVVideoCompressionPropertiesKey: [AVVideoAllowFrameReorderingKey: false],
            ])
        input.mediaTimeScale = clock.timescale
        writer.movieTimeScale = clock.timescale
        writer.add(input)
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height,
                kCVPixelBufferIOSurfacePropertiesKey as String: [:],
            ])
        defer {
            if writer.status == .writing {
                writer.cancelWriting()
            }
        }
        guard writer.startWriting() else {
            throw NativeFailure.decodeFailed("Cannot start sequential video render.")
        }
        writer.startSession(atSourceTime: .zero)
        let context = CIContext(options: [.cacheIntermediates: false])
        var count = 0
        for (spanIndex, span) in plan.enumerated() {
            var at = time(microseconds: span.source.startUs)
            let end = time(microseconds: span.source.endUs)
            while at < end {
                let selected = try presentation.selection(at: at, end: end)
                let state = try pointers?.selection(spanIndex: spanIndex, at: at, end: selected.end)
                let next = state?.1 ?? selected.end
                guard next > at else {
                    throw NativeFailure("INVALID_REQUEST", "Pointer composition made no progress.")
                }
                _ = try clock.exact(at)
                _ = try clock.exact(next)
                let image: CIImage
                if let buffer = selected.buffer {
                    image = try autoreleasepool {
                        try FrameImage(
                            buffer: buffer, transform: presentation.transform,
                            overlay: state.map { FrameOverlay(pointer: $0.0) },
                            agedFromUs: 0, crop: nil, maxLongEdge: max(width, height)
                        ).image
                    }
                } else {
                    image = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 1))
                        .cropped(to: CGRect(x: 0, y: 0, width: width, height: height))
                }
                let timestamp = try clock.exact(
                    CMTimeAdd(
                        time(microseconds: span.playback.startUs),
                        CMTimeSubtract(at, time(microseconds: span.source.startUs))))
                let deadline = ContinuousClock.now.advanced(by: .seconds(10))
                var destination: CVPixelBuffer?
                while destination == nil {
                    guard writer.status == .writing, ContinuousClock.now < deadline else {
                        throw NativeFailure.decodeFailed("Video encoder stopped making progress.")
                    }
                    if input.isReadyForMoreMediaData, let pool = adaptor.pixelBufferPool {
                        let status = CVPixelBufferPoolCreatePixelBufferWithAuxAttributes(
                            nil, pool,
                            [kCVPixelBufferPoolAllocationThresholdKey: 4] as CFDictionary,
                            &destination)
                        guard
                            status == kCVReturnSuccess
                                || status == kCVReturnWouldExceedAllocationThreshold
                        else {
                            throw NativeFailure.decodeFailed("Cannot allocate bounded render buffer.")
                        }
                    }
                    if destination == nil { try await Task.sleep(for: .milliseconds(1)) }
                }
                context.render(
                    image, to: destination!,
                    bounds: CGRect(x: 0, y: 0, width: width, height: height),
                    colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
                // CI writes sRGB pixels. New pool buffers carry no source color tags;
                // propagate the working representation so encoders/readers do not guess.
                CVBufferSetAttachment(
                    destination!, kCVImageBufferColorPrimariesKey,
                    kCVImageBufferColorPrimaries_ITU_R_709_2, .shouldPropagate)
                CVBufferSetAttachment(
                    destination!, kCVImageBufferTransferFunctionKey,
                    kCVImageBufferTransferFunction_sRGB, .shouldPropagate)
                CVBufferSetAttachment(
                    destination!, kCVImageBufferYCbCrMatrixKey,
                    kCVImageBufferYCbCrMatrix_ITU_R_709_2, .shouldPropagate)
                var format: CMVideoFormatDescription?
                var sample: CMSampleBuffer?
                var timing = CMSampleTimingInfo(
                    duration: try clock.exact(CMTimeSubtract(next, at)),
                    presentationTimeStamp: timestamp, decodeTimeStamp: .invalid)
                guard
                    CMVideoFormatDescriptionCreateForImageBuffer(
                        allocator: nil,
                        imageBuffer: destination!, formatDescriptionOut: &format) == noErr,
                    CMSampleBufferCreateReadyWithImageBuffer(
                        allocator: nil, imageBuffer: destination!,
                        formatDescription: format!, sampleTiming: &timing, sampleBufferOut: &sample)
                        == noErr,
                    input.append(sample!)
                else {
                    throw NativeFailure.decodeFailed("Cannot append timed video sample.")
                }
                destination = nil
                count += 1
                at = next
            }
        }
        try pointers?.finish()
        writer.endSession(atSourceTime: time(microseconds: through))
        input.markAsFinished()
        await writer.finishWriting()
        guard writer.status == .completed else {
            throw NativeFailure.decodeFailed("Video encoder did not finish output.")
        }
        let actual = try await AVURLAsset(url: file).load(.duration)
        guard CMTimeCompare(actual, time(microseconds: through)) == 0 else {
            throw NativeFailure.decodeFailed("Encoded video duration does not match the pinned plan.")
        }
        return RenderedVideo(durationUs: through, width: width, height: height, frameCount: count)
    }
}
