@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderMedia

/// Executes compiler records verbatim. Source support is decoded; editorial time is never inferred.
public enum CompositionVideoRenderer {
    public struct Request: Codable {
        public let output: String
        public let frames: String
        public let range: TimeSpan
        let canvas: CompositionPictureExecutor.Canvas
        public let settings: OutputSettings
        public let processing: [CompositionProcessing]
        public let assets: [CompositionAsset]
        let pointers: PreparedPointersReceipt?
        public func validateOutput(hasAudio: Bool) throws {
            try canvas.validate()
            try settings.validate(
                width: canvas.width, height: canvas.height,
                frameRate: Double(canvas.fps.numerator) / Double(canvas.fps.denominator),
                hasAudio: hasAudio)
        }
        public func replacingOutput(_ path: String) -> Self {
            Self(
                output: path, frames: frames, range: range, canvas: canvas, settings: settings,
                processing: processing, assets: assets, pointers: pointers)
        }
    }
    public struct Result: Encodable {
        let file: String
        let mediaType = "video/mp4"
        let settings: OutputSettings
        public let encodedVideo: OutputSettings.EncodedVideo
        public let durationUs: Int64
        public let width: Int
        public let height: Int
        public let frames: Int
        let rasterizedFrames: Int
        let pointerRasterizations: Int
        let decodedImages: Int
        let decodedSamples: Int
        let readerOpens: Int
        let bytes: Int
        let retainedSourceBuffersBound: Int
        let pixelPoolAllocationThreshold = 4
        let maximumSequentialAdvanceUs = CompositionPictureExecutor.maximumSequentialAdvanceUs
    }

    public static func write(
        _ request: Request, nextFrame: () throws -> CompositionPictureExecutor.Frame?
    ) async throws
        -> Result
    {
        let canvas = request.canvas
        guard request.range.startUs >= 0, request.range.endUs > request.range.startUs,
            request.range.endUs <= TimeSpan.maximumMicroseconds
        else {
            throw invalid("Video requires a positive range.")
        }
        try request.validateOutput(hasAudio: false)
        let pictures = try CompositionPictureExecutor(
            canvas: canvas, bindings: request.assets, pointers: request.pointers)
        let output = try NewFile(at: request.output, assembledAs: "video.mp4")
        defer { output.discard() }
        let writer = try AVAssetWriter(outputURL: output.url, fileType: .mp4)
        defer { if writer.status == .writing { writer.cancelWriting() } }
        let settings = try request.settings.videoDictionary(
            width: canvas.width, height: canvas.height,
            frameRate: Double(canvas.fps.numerator) / Double(canvas.fps.denominator))
        guard writer.canApply(outputSettings: settings, forMediaType: .video) else {
            throw unsupported("Video profile cannot encode this canvas.")
        }
        let video = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
        video.mediaTimeScale = 1_000_000
        writer.movieTimeScale = 1_000_000
        writer.add(video)
        let adaptor = AVAssetWriterInputPixelBufferAdaptor(
            assetWriterInput: video,
            sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: canvas.width,
                kCVPixelBufferHeightKey as String: canvas.height,
                kCVPixelBufferIOSurfacePropertiesKey as String: [:],
            ])
        guard writer.startWriting() else {
            throw writer.error ?? invalid("Cannot start video writer.")
        }
        writer.startSession(atSourceTime: .zero)
        var through = request.range.startUs
        var lastIndex: Int64 = -1
        var lastSample: Int64 = -1
        var frames = 0
        while let frame = try nextFrame() {
            try Task.checkCancellation()
            guard frame.index >= 0, frame.index <= TimeSpan.maximumMicroseconds,
                frame.index > lastIndex,
                frame.sampleAtUs >= 0, frame.sampleAtUs <= TimeSpan.maximumMicroseconds,
                frame.sampleAtUs > lastSample,
                frame.sampleAtUs <= frame.visibleRange.startUs,
                frame.visibleRange.startUs == through, frame.visibleRange.endUs > through,
                frame.visibleRange.endUs <= request.range.endUs
            else { throw invalid("Invalid or discontinuous compiled frame stream.") }
            let destination = try await pictures.render(frame) { retained in
                let deadline = ContinuousClock.now.advanced(by: .seconds(10))
                var destination: CVPixelBuffer?
                while destination == nil {
                    try Task.checkCancellation()
                    guard writer.status == .writing, ContinuousClock.now < deadline else {
                        throw NativeFailure.decodeFailed("Video writer stopped making progress.")
                    }
                    if video.isReadyForMoreMediaData, let retained {
                        destination = retained
                    } else if video.isReadyForMoreMediaData, let pool = adaptor.pixelBufferPool {
                        let status = CVPixelBufferPoolCreatePixelBufferWithAuxAttributes(
                            nil, pool,
                            [kCVPixelBufferPoolAllocationThresholdKey: 4] as CFDictionary,
                            &destination)
                        guard
                            status == kCVReturnSuccess
                                || status == kCVReturnWouldExceedAllocationThreshold
                        else { throw invalid("Cannot allocate render buffer.") }
                    }
                    if destination == nil { try await Task.sleep(for: .milliseconds(1)) }
                }
                return destination!
            }
            if !pictures.outputIsKnownOpaque {
                try CompositionPictureExecutor.requireOpaque(destination)
            }
            var format: CMVideoFormatDescription?
            var sample: CMSampleBuffer?
            var timing = CMSampleTimingInfo(
                duration: time(microseconds: frame.visibleRange.endUs - through),
                presentationTimeStamp: time(microseconds: through - request.range.startUs),
                decodeTimeStamp: .invalid)
            guard
                CMVideoFormatDescriptionCreateForImageBuffer(
                    allocator: nil, imageBuffer: destination, formatDescriptionOut: &format)
                    == noErr,
                CMSampleBufferCreateReadyWithImageBuffer(
                    allocator: nil, imageBuffer: destination, formatDescription: format!,
                    sampleTiming: &timing, sampleBufferOut: &sample) == noErr,
                video.append(sample!)
            else { throw writer.error ?? invalid("Cannot append compiled picture.") }
            through = frame.visibleRange.endUs
            lastIndex = frame.index
            lastSample = frame.sampleAtUs
            frames += 1
        }
        try pictures.finishPointers()
        guard through == request.range.endUs else {
            throw invalid("Compiled frames do not cover the requested range.")
        }
        video.markAsFinished()
        writer.endSession(
            atSourceTime: time(microseconds: request.range.endUs - request.range.startUs))
        await writer.finishWriting()
        try Task.checkCancellation()
        guard writer.status == .completed else {
            throw writer.error ?? invalid("Video writer did not complete.")
        }
        let encodedVideo = try await request.settings.inspectVideo(output.url)
        let bytes = try output.publish()
        return Result(
            file: request.output, settings: request.settings, encodedVideo: encodedVideo,
            durationUs: through - request.range.startUs,
            width: canvas.width,
            height: canvas.height, frames: frames, rasterizedFrames: pictures.rasterized,
            pointerRasterizations: pictures.pointerRasterizations,
            decodedImages: pictures.decodedImages, decodedSamples: pictures.decodedSamples,
            readerOpens: pictures.opens,
            bytes: bytes, retainedSourceBuffersBound: pictures.maximumActiveSources)
    }

    private static func invalid(_ message: String) -> NativeFailure {
        NativeFailure("INVALID_REQUEST", message)
    }
    private static func unsupported(_ message: String) -> NativeFailure {
        NativeFailure("NOT_READY", message)
    }

}
