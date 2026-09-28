@preconcurrency import AVFoundation
import CoreImage
import Foundation
import ScreenRecorderMedia

/// Executes compiler records verbatim. Source support is decoded; editorial time is never inferred.
public enum CompositionVideoRenderer {
    // Limit discarded sequential decode to a local source window, even for extreme retiming.
    private static let maximumSequentialAdvanceUs: Int64 = 1_000_000
    struct Canvas: Codable {
        struct FPS: Codable {
            let numerator: Int
            let denominator: Int
        }
        let width: Int
        let height: Int
        let fps: FPS
        let background: String
    }
    public struct Frame: Codable {
        struct Layer: Codable {
            let clipId: String
            let trackId: String
            let assetId: String
            let streamId: String
            let sourceUs: Int64
            let availability: String
            let placement: String
        }
        let index: Int64
        let sampleAtUs: Int64
        let visibleRange: TimeSpan
        let layers: [Layer]
    }
    public struct Request: Codable {
        public let output: String
        public let frames: String
        public let range: TimeSpan
        let canvas: Canvas
        let profile: String
        public let processing: [CompositionProcessing]
        public let assets: [CompositionAsset]
        public func replacingOutput(_ path: String) -> Self {
            Self(
                output: path, frames: frames, range: range, canvas: canvas, profile: profile,
                processing: processing, assets: assets)
        }
    }
    private enum RasterKey: Equatable {
        case background
        case picture(reader: Int, sampleTime: CMTime)
    }
    public struct Result: Encodable {
        let file: String
        let mediaType = "video/mp4"
        let profile = "h264-rec709"
        public let durationUs: Int64
        public let width: Int
        public let height: Int
        public let frames: Int
        let rasterizedFrames: Int
        let decodedSamples: Int
        let readerOpens: Int
        let bytes: Int
        let retainedSourceBuffersBound = 1
        let pixelPoolAllocationThreshold = 4
        let maximumSequentialAdvanceUs = CompositionVideoRenderer.maximumSequentialAdvanceUs
    }

    public static func write(_ request: Request, nextFrame: () throws -> Frame?) async throws
        -> Result
    {
        guard request.profile == "h264-rec709" else {
            throw unsupported("Unknown video export profile.")
        }
        let canvas = request.canvas
        guard canvas.width > 0, canvas.height > 0, canvas.width <= 8192, canvas.height <= 8192,
            canvas.width.isMultiple(of: 2), canvas.height.isMultiple(of: 2),
            canvas.fps.numerator > 0, canvas.fps.denominator > 0,
            request.range.startUs >= 0, request.range.endUs > request.range.startUs,
            request.range.endUs <= TimeSpan.maximumMicroseconds
        else {
            throw invalid("Video requires a positive range and even canvas dimensions up to 8192.")
        }
        for node in request.processing {
            guard ["audio", "video", "output"].contains(node.mediaKind) else {
                throw invalid("Unknown processing media kind.")
            }
            for step in node.steps {
                guard step.processor.type == "gain", step.processor.gain.isFinite,
                    step.processor.gain >= 0
                else {
                    throw unsupported("Unknown processing step: \(step.processor.type).")
                }
                if node.mediaKind == "video" {
                    throw unsupported("Visual processing is not implemented.")
                }
            }
        }
        var assets: [String: CompositionAsset] = [:]
        for asset in request.assets {
            let key = asset.assetId + "\u{0}" + asset.streamId
            guard assets.updateValue(asset, forKey: key) == nil else {
                throw invalid("Duplicate source binding.")
            }
        }
        let background = try background(canvas)
        let output = try NewFile(at: request.output, assembledAs: "video.mp4")
        defer { output.discard() }
        let writer = try AVAssetWriter(outputURL: output.url, fileType: .mp4)
        defer { if writer.status == .writing { writer.cancelWriting() } }
        let settings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: canvas.width,
            AVVideoHeightKey: canvas.height,
            AVVideoCompressionPropertiesKey: [AVVideoAllowFrameReorderingKey: false],
            AVVideoColorPropertiesKey: [
                AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
                AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
                AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
            ],
        ]
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
        let color = CVImageBufferCreateColorSpaceFromAttachments(
            [
                kCVImageBufferColorPrimariesKey as String: kCVImageBufferColorPrimaries_ITU_R_709_2,
                kCVImageBufferTransferFunctionKey as String:
                    kCVImageBufferTransferFunction_ITU_R_709_2,
                kCVImageBufferYCbCrMatrixKey as String: kCVImageBufferYCbCrMatrix_ITU_R_709_2,
            ] as CFDictionary)!.takeRetainedValue()
        let context = CIContext(options: [.cacheIntermediates: false])
        var source: PresentationSource?
        var key: String?
        var sourceTime: Int64 = -1
        var through = request.range.startUs
        var lastIndex: Int64 = -1
        var lastSample: Int64 = -1
        var frames = 0
        var decoded = 0
        var opens = 0
        var rasterized = 0
        var retainedRaster: (key: RasterKey, buffer: CVPixelBuffer)?
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
            guard frame.layers.count <= 1 else {
                throw unsupported("Layer composition is not implemented.")
            }
            var image = background
            var rasterKey = RasterKey.background
            if let layer = frame.layers.first {
                guard layer.sourceUs >= 0, layer.sourceUs <= TimeSpan.maximumMicroseconds,
                    layer.placement == "contain"
                else { throw invalid("Invalid compiled layer.") }
                let nextKey = layer.assetId + "\u{0}" + layer.streamId
                guard let asset = assets[nextKey] else {
                    throw invalid("Missing retained source binding.")
                }
                let (at, overflow) = layer.sourceUs.addingReportingOverflow(asset.originUs)
                guard !overflow, at >= -TimeSpan.maximumMicroseconds,
                    at <= TimeSpan.maximumMicroseconds
                else { throw invalid("Source clock exceeds native precision.") }
                if key != nextKey || at < sourceTime || at - sourceTime > maximumSequentialAdvanceUs
                {
                    decoded += source?.decodedCount ?? 0
                    source = nil
                    source = try await PresentationSource(
                        source: URL(fileURLWithPath: asset.path), streamId: asset.streamId,
                        startUs: at)
                    try await requireSupportedColor(source!.track)
                    key = nextKey
                    opens += 1
                }
                sourceTime = at
                let selected = try source!.selection(
                    at: time(microseconds: at), end: time(microseconds: at + 1))
                switch layer.availability {
                case "available", "source-unavailable": break
                case "anchor-unavailable":
                    throw NativeFailure("UNAVAILABLE", "Compiled ancestor support is unavailable.")
                default: throw invalid("Unknown compiled source availability.")
                }
                // The compiler can exclude physically occupied media for this occurrence.
                // Selection above still proves the exact stream's physical timing before masking.
                if layer.availability == "available", let buffer = selected.buffer {
                    guard let sampleTime = selected.sampleTime else {
                        throw invalid("Selected picture has no physical sample time.")
                    }
                    rasterKey = .picture(reader: opens, sampleTime: sampleTime)
                    if retainedRaster?.key != rasterKey {
                        image = contained(buffer, transform: source!.transform, canvas: canvas)
                            .composited(over: background)
                    }
                }
            }
            let deadline = ContinuousClock.now.advanced(by: .seconds(10))
            var destination: CVPixelBuffer?
            let reused = retainedRaster?.key == rasterKey
            while destination == nil {
                try Task.checkCancellation()
                guard writer.status == .writing, ContinuousClock.now < deadline else {
                    throw NativeFailure.decodeFailed("Video writer stopped making progress.")
                }
                if video.isReadyForMoreMediaData, reused {
                    destination = retainedRaster!.buffer
                } else if video.isReadyForMoreMediaData, let pool = adaptor.pixelBufferPool {
                    let status = CVPixelBufferPoolCreatePixelBufferWithAuxAttributes(
                        nil, pool,
                        [kCVPixelBufferPoolAllocationThresholdKey: 4] as CFDictionary, &destination)
                    guard
                        status == kCVReturnSuccess
                            || status == kCVReturnWouldExceedAllocationThreshold
                    else { throw invalid("Cannot allocate render buffer.") }
                }
                if destination == nil { try await Task.sleep(for: .milliseconds(1)) }
            }
            if !reused {
                context.render(
                    image, to: destination!,
                    bounds: CGRect(x: 0, y: 0, width: canvas.width, height: canvas.height),
                    colorSpace: color)
                CVBufferSetAttachment(
                    destination!, kCVImageBufferCGColorSpaceKey, color, .shouldPropagate)
                CVBufferSetAttachment(
                    destination!, kCVImageBufferColorPrimariesKey,
                    kCVImageBufferColorPrimaries_ITU_R_709_2,
                    .shouldPropagate)
                CVBufferSetAttachment(
                    destination!, kCVImageBufferTransferFunctionKey,
                    kCVImageBufferTransferFunction_ITU_R_709_2,
                    .shouldPropagate)
                CVBufferSetAttachment(
                    destination!, kCVImageBufferYCbCrMatrixKey,
                    kCVImageBufferYCbCrMatrix_ITU_R_709_2,
                    .shouldPropagate)
                // Current supported visual inputs are static: one contained picture and canvas.
                // Reuse only this immutable raster; every compiled interval still gets its own sample.
                retainedRaster = (rasterKey, destination!)
                rasterized += 1
            }
            var format: CMVideoFormatDescription?
            var sample: CMSampleBuffer?
            var timing = CMSampleTimingInfo(
                duration: time(microseconds: frame.visibleRange.endUs - through),
                presentationTimeStamp: time(microseconds: through - request.range.startUs),
                decodeTimeStamp: .invalid)
            guard
                CMVideoFormatDescriptionCreateForImageBuffer(
                    allocator: nil, imageBuffer: destination!, formatDescriptionOut: &format)
                    == noErr,
                CMSampleBufferCreateReadyWithImageBuffer(
                    allocator: nil, imageBuffer: destination!, formatDescription: format!,
                    sampleTiming: &timing, sampleBufferOut: &sample) == noErr,
                video.append(sample!)
            else { throw writer.error ?? invalid("Cannot append compiled picture.") }
            through = frame.visibleRange.endUs
            lastIndex = frame.index
            lastSample = frame.sampleAtUs
            frames += 1
        }
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
        decoded += source?.decodedCount ?? 0
        let bytes = try output.publish()
        return Result(
            file: request.output, durationUs: through - request.range.startUs, width: canvas.width,
            height: canvas.height, frames: frames, rasterizedFrames: rasterized,
            decodedSamples: decoded, readerOpens: opens,
            bytes: bytes)
    }

    private static func requireSupportedColor(_ track: AVAssetTrack) async throws {
        for format in try await track.load(.formatDescriptions) {
            func value(_ key: CFString) -> CFPropertyList? {
                CMFormatDescriptionGetExtension(format, extensionKey: key)
            }
            func permits(_ key: CFString, _ supported: [CFString]) -> Bool {
                guard let actual = value(key) else { return true }
                return (actual as? String).map { text in
                    supported.contains { ($0 as String) == text }
                } ?? false
            }
            guard
                permits(
                    kCMFormatDescriptionExtension_ColorPrimaries,
                    [kCMFormatDescriptionColorPrimaries_ITU_R_709_2]),
                permits(
                    kCMFormatDescriptionExtension_TransferFunction,
                    [
                        kCMFormatDescriptionTransferFunction_ITU_R_709_2,
                        kCMFormatDescriptionTransferFunction_sRGB,
                    ]),
                permits(
                    kCMFormatDescriptionExtension_YCbCrMatrix,
                    [
                        kCMFormatDescriptionYCbCrMatrix_ITU_R_709_2,
                        kCMFormatDescriptionYCbCrMatrix_ITU_R_601_4,
                    ]),
                [
                    kCMFormatDescriptionExtension_ICCProfile,
                    kCMFormatDescriptionExtension_GammaLevel,
                    kCMFormatDescriptionExtension_AlternativeTransferCharacteristics,
                    kCMFormatDescriptionExtension_LogTransferFunction,
                    kCMFormatDescriptionExtension_MasteringDisplayColorVolume,
                    kCMFormatDescriptionExtension_ContentLightLevelInfo,
                ]
                .allSatisfy({ value($0) == nil })
            else {
                throw unsupported(
                    "Source color profile requires an explicit HDR, wide-gamut or custom-profile conversion."
                )
            }
        }
    }

    private static func contained(
        _ buffer: CVPixelBuffer, transform: CGAffineTransform, canvas: Canvas
    ) -> CIImage {
        var image = orientedVideoImage(buffer, transform: transform)
        let scale = min(
            CGFloat(canvas.width) / image.extent.width, CGFloat(canvas.height) / image.extent.height
        )
        image = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        return image.transformed(
            by: CGAffineTransform(
                translationX: (CGFloat(canvas.width) - image.extent.width) / 2,
                y: (CGFloat(canvas.height) - image.extent.height) / 2))
    }
    private static func background(_ canvas: Canvas) throws -> CIImage {
        guard canvas.background.count == 9, canvas.background.first == "#",
            let rgba = UInt32(canvas.background.dropFirst(), radix: 16), rgba & 255 == 255
        else {
            throw unsupported("H.264 canvas requires an opaque RGBA background.")
        }
        return CIImage(
            color: CIColor(
                red: CGFloat((rgba >> 24) & 255) / 255,
                green: CGFloat((rgba >> 16) & 255) / 255, blue: CGFloat((rgba >> 8) & 255) / 255,
                alpha: 1)
        )
        .cropped(to: CGRect(x: 0, y: 0, width: canvas.width, height: canvas.height))
    }
    private static func invalid(_ message: String) -> NativeFailure {
        NativeFailure("INVALID_REQUEST", message)
    }
    private static func unsupported(_ message: String) -> NativeFailure {
        NativeFailure("NOT_READY", message)
    }

}
