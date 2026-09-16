@preconcurrency import AVFoundation
import CoreImage
import Darwin
import Foundation
import ScreenRecorderMediaTime

public struct VideoRenderSpan: Codable, Sendable {
    public let source: FrameInterval
    public let playback: FrameInterval
}

public struct RenderedVideo: Codable, Sendable {
    public let file: String
    public let mediaType: String
    public let codec: String
    public let durationUs: Int64
    public let width: Int
    public let height: Int
    public let frameCount: Int
    public let bytes: Int
}

/// Sequential video-only rendering. The plan owns cuts; sample support owns visible
/// content. Explicit empty edits map to the measured default player's opaque black.
/// Unexplained gaps never inherit either the previous image or this appearance rule.
public enum VideoRenderer {
    public static func write(source: URL, plan: [VideoRenderSpan], output: URL) async throws
        -> RenderedVideo
    {
        var through: Int64 = 0
        var sourceEnd: Int64 = 0
        guard !plan.isEmpty, plan.count <= 10_000 else {
            throw FrameFailure("INVALID_REQUEST", "Render plan requires 1...10000 spans.")
        }
        for span in plan {
            guard span.source.startUs >= sourceEnd, span.source.endUs > span.source.startUs,
                span.source.endUs <= FrameLimits.maximumMicroseconds,
                span.playback.startUs == through, span.playback.endUs > through,
                span.playback.endUs <= FrameLimits.maximumMicroseconds,
                span.source.endUs - span.source.startUs == span.playback.endUs - through
            else {
                throw FrameFailure(
                    "INVALID_REQUEST", "Render plan has invalid source or playback ranges.")
            }
            sourceEnd = span.source.endUs
            through = span.playback.endUs
        }
        let canonicalSource = source.resolvingSymlinksInPath().standardizedFileURL
        var info = stat()
        guard source.path.hasPrefix("/"), output.path.hasPrefix("/"),
            canonicalSource != output.resolvingSymlinksInPath().standardizedFileURL,
            lstat(output.path, &info) != 0, errno == ENOENT
        else {
            throw FrameFailure(
                "INVALID_OUTPUT", "Render output must be a new absolute path, distinct from source."
            )
        }
        let asset = AVURLAsset(
            url: canonicalSource,
            options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        let sourceDuration = try await asset.load(.duration)
        guard let track = try await asset.loadTracks(withMediaType: .video).first,
            try await track.load(.canProvideSampleCursors),
            time(microseconds: sourceEnd) <= sourceDuration
        else { throw FrameFailure("UNAVAILABLE", "Render plan exceeds a usable video source.") }
        let segments = try await track.load(.segments)
        let occupied = SourceSegment.occupied(of: segments)
        let transform = try await track.load(.preferredTransform)
        let natural = try await track.load(.naturalSize).applying(transform)
        let width = Int(abs(natural.width).rounded())
        let height = Int(abs(natural.height).rounded())
        guard width > 0, height > 0, width <= 8192, height <= 8192,
            width.isMultiple(of: 2), height.isMultiple(of: 2)
        else {
            throw FrameFailure(
                "UNAVAILABLE", "Video renderer requires even dimensions up to 8192 pixels.")
        }
        let reader = try AVAssetReader(asset: asset)
        let decoded = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        decoded.alwaysCopiesSampleData = false
        reader.add(decoded)
        let stagingDirectory = output.deletingLastPathComponent()
            .appendingPathComponent(".video-render-\(UUID().uuidString)")
        guard mkdir(stagingDirectory.path, 0o700) == 0 else {
            throw FrameFailure("INVALID_OUTPUT", "Cannot create owned render staging directory.")
        }
        defer { try? FileManager.default.removeItem(at: stagingDirectory) }
        let staging = stagingDirectory.appendingPathComponent("video.mp4")
        let writer = try AVAssetWriter(outputURL: staging, fileType: .mp4)
        let input = AVAssetWriterInput(
            mediaType: .video,
            outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width,
                AVVideoHeightKey: height,
                AVVideoCompressionPropertiesKey: [AVVideoAllowFrameReorderingKey: false],
            ])
        input.mediaTimeScale = 1_000_000
        writer.movieTimeScale = 1_000_000
        writer.add(input)
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: input,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height,
                kCVPixelBufferIOSurfacePropertiesKey as String: [:],
            ])
        defer {
            reader.cancelReading()
            if writer.status == .writing {
                writer.cancelWriting()
            }
        }
        guard reader.startReading(), writer.startWriting() else {
            throw FrameFailure("NATIVE_DECODE_FAILED", "Cannot start sequential video render.")
        }
        writer.startSession(atSourceTime: .zero)
        let context = CIContext(options: [.cacheIntermediates: false])
        var held: CMSampleBuffer?
        var heldStart = CMTime.invalid
        var heldEnd = CMTime.invalid
        var segmentIndex = 0
        var count = 0
        for span in plan {
            var at = time(microseconds: span.source.startUs)
            let end = time(microseconds: span.source.endUs)
            while at < end {
                try Task.checkCancellation()
                while segmentIndex < segments.count
                    && CMTimeRangeGetEnd(segments[segmentIndex].timeMapping.target) <= at
                { segmentIndex += 1 }
                guard segmentIndex < segments.count,
                    segments[segmentIndex].timeMapping.target.containsTime(at)
                else {
                    throw FrameFailure("UNAVAILABLE", "Retained time has no proven track support.")
                }
                let segment = segments[segmentIndex]
                let image: CIImage
                let next: CMTime
                if segment.isEmpty {
                    image = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 1))
                        .cropped(to: CGRect(x: 0, y: 0, width: width, height: height))
                    next = CMTimeMinimum(end, CMTimeRangeGetEnd(segment.timeMapping.target))
                } else {
                    while held == nil || heldEnd <= at {
                        try Task.checkCancellation()
                        held = nil
                        guard
                            let sample = autoreleasepool(invoking: {
                                decoded.copyNextSampleBuffer()
                            })
                        else {
                            throw FrameFailure(
                                "UNAVAILABLE", "Decoder ended before retained sample support.")
                        }
                        let pts = CMSampleBufferGetPresentationTimeStamp(sample)
                        // Readers can emit duplicate pictures inside empty edits. Only the
                        // segment/cursor mapping can prove their nonempty presentation support.
                        guard
                            let supportEnd = assetEnd(
                                ofSamplePresentedAt: pts, in: occupied, of: track)
                        else { continue }
                        held = sample
                        heldStart = pts
                        heldEnd = supportEnd
                    }
                    guard heldStart <= at, let buffer = CMSampleBufferGetImageBuffer(held!) else {
                        throw FrameFailure(
                            "UNAVAILABLE", "Retained time has unknown sample support.")
                    }
                    let oriented = try autoreleasepool {
                        try FrameImage(
                            buffer: buffer, transform: transform, overlay: nil,
                            agedFromUs: 0, crop: nil, maxLongEdge: max(width, height))
                    }
                    image = oriented.image
                    next = CMTimeMinimum(end, heldEnd)
                }
                let timestamp = CMTimeAdd(
                    time(microseconds: span.playback.startUs),
                    CMTimeSubtract(at, time(microseconds: span.source.startUs)))
                let deadline = ContinuousClock.now.advanced(by: .seconds(10))
                var destination: CVPixelBuffer?
                while destination == nil {
                    try Task.checkCancellation()
                    guard writer.status == .writing, ContinuousClock.now < deadline else {
                        throw FrameFailure(
                            "NATIVE_DECODE_FAILED", "Video encoder stopped making progress.")
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
                            throw FrameFailure(
                                "NATIVE_DECODE_FAILED", "Cannot allocate bounded render buffer.")
                        }
                    }
                    if destination == nil { try await Task.sleep(for: .milliseconds(1)) }
                }
                context.render(
                    image, to: destination!,
                    bounds: CGRect(x: 0, y: 0, width: width, height: height),
                    colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
                var format: CMVideoFormatDescription?
                var sample: CMSampleBuffer?
                var timing = CMSampleTimingInfo(
                    duration: CMTimeSubtract(next, at),
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
                    throw FrameFailure("NATIVE_DECODE_FAILED", "Cannot append timed video sample.")
                }
                destination = nil
                count += 1
                at = next
            }
        }
        writer.endSession(atSourceTime: time(microseconds: through))
        input.markAsFinished()
        await writer.finishWriting()
        try Task.checkCancellation()
        guard writer.status == .completed else {
            throw FrameFailure("NATIVE_DECODE_FAILED", "Video encoder did not finish output.")
        }
        let result = AVURLAsset(url: staging)
        let actual = microseconds(try await result.load(.duration))
        guard actual == through else {
            throw FrameFailure(
                "NATIVE_DECODE_FAILED", "Encoded video duration does not match the pinned plan.")
        }
        let bytes = try FileManager.default.attributesOfItem(atPath: staging.path)[.size] as! Int
        // A hard-link publication is atomic and refuses a destination created while
        // rendering. Failure cleanup never owns or removes the destination name.
        guard link(staging.path, output.path) == 0 else {
            throw FrameFailure(
                "INVALID_OUTPUT", "Cannot publish video to an unoccupied destination.")
        }
        return RenderedVideo(
            file: output.path, mediaType: "video/mp4", codec: "h264",
            durationUs: actual, width: width, height: height, frameCount: count, bytes: bytes)
    }
}
