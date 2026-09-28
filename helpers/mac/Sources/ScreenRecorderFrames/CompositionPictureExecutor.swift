@preconcurrency import AVFoundation
import CoreImage
import Foundation
import ScreenRecorderMedia

/// Executes compiled pictures for both direct inspection and movie delivery.
public final class CompositionPictureExecutor {
    static let maximumSequentialAdvanceUs: Int64 = 1_000_000
    public struct Canvas: Codable {
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
    public struct Sample: Encodable {
        let value: String
        let timescale: Int32
        let originUs: Int64
    }
    public struct Picture: Encodable {
        let status: String
        var clipId: String? = nil
        var assetId: String? = nil
        var streamId: String? = nil
        var requestedSourceUs: Int64? = nil
        // Physical sample rounded to microseconds, ties away from zero, then origin subtracted.
        // The sample field retains exact native time.
        var actualSourceUs: Int64? = nil
        var sample: Sample? = nil
        var reason: String? = nil
    }
    private enum RasterKey: Equatable {
        case background
        case picture(reader: Int, sampleTime: CMTime)
    }
    private let canvas: Canvas
    private let assets: [String: CompositionAsset]
    private let background: CIImage
    let color = CVImageBufferCreateColorSpaceFromAttachments(
        [
            kCVImageBufferColorPrimariesKey as String: kCVImageBufferColorPrimaries_ITU_R_709_2,
            kCVImageBufferTransferFunctionKey as String:
                kCVImageBufferTransferFunction_ITU_R_709_2,
            kCVImageBufferYCbCrMatrixKey as String: kCVImageBufferYCbCrMatrix_ITU_R_709_2,
        ] as CFDictionary)!.takeRetainedValue()
    let context = CIContext(options: [.cacheIntermediates: false])
    private var source: PresentationSource?
    private var key: String?
    private var sourceTime: Int64 = -1
    private var decoded = 0
    private(set) var opens = 0
    private(set) var rasterized = 0
    private var retainedRaster: (key: RasterKey, buffer: CVPixelBuffer)?
    private(set) var picture = Picture(status: "background")
    var decodedSamples: Int { decoded + (source?.decodedCount ?? 0) }

    init(canvas: Canvas, processing: [CompositionProcessing], bindings: [CompositionAsset]) throws {
        guard canvas.width > 0, canvas.height > 0, canvas.width <= 8192, canvas.height <= 8192,
            canvas.width.isMultiple(of: 2), canvas.height.isMultiple(of: 2),
            canvas.fps.numerator > 0, canvas.fps.denominator > 0
        else {
            throw Self.invalid(
                "Pictures require even canvas dimensions up to 8192 and a positive frame rate.")
        }
        for node in processing {
            guard ["audio", "video", "output"].contains(node.mediaKind) else {
                throw Self.invalid("Unknown processing media kind.")
            }
            for step in node.steps {
                guard step.processor.type == "gain", step.processor.gain.isFinite,
                    step.processor.gain >= 0
                else {
                    throw Self.unsupported("Unknown processing step: \(step.processor.type).")
                }
                if node.mediaKind == "video" {
                    throw Self.unsupported("Visual processing is not implemented.")
                }
            }
        }
        var assets: [String: CompositionAsset] = [:]
        for asset in bindings {
            let key = asset.assetId + "\u{0}" + asset.streamId
            guard assets.updateValue(asset, forKey: key) == nil else {
                throw Self.invalid("Duplicate source binding.")
            }
        }
        self.background = try Self.background(canvas)
        self.canvas = canvas
        self.assets = assets
    }

    func render(_ frame: Frame, allocate: (CVPixelBuffer?) async throws -> CVPixelBuffer)
        async throws
        -> CVPixelBuffer
    {
        try Task.checkCancellation()
        guard frame.layers.count <= 1 else {
            throw Self.unsupported("Layer composition is not implemented.")
        }
        picture = Picture(status: "background")
        var image = background
        var rasterKey = RasterKey.background
        if let layer = frame.layers.first {
            guard layer.sourceUs >= 0, layer.sourceUs <= TimeSpan.maximumMicroseconds,
                layer.placement == "contain"
            else { throw Self.invalid("Invalid compiled layer.") }
            let nextKey = layer.assetId + "\u{0}" + layer.streamId
            guard let asset = assets[nextKey] else {
                throw Self.invalid("Missing retained source binding.")
            }
            let (at, overflow) = layer.sourceUs.addingReportingOverflow(asset.originUs)
            guard !overflow, at >= -TimeSpan.maximumMicroseconds,
                at <= TimeSpan.maximumMicroseconds
            else { throw Self.invalid("Source clock exceeds native precision.") }
            if key != nextKey || at < sourceTime
                || at - sourceTime > Self.maximumSequentialAdvanceUs
            {
                decoded += source?.decodedCount ?? 0
                source = nil
                source = try await PresentationSource(
                    source: URL(fileURLWithPath: asset.path), streamId: asset.streamId,
                    startUs: at)
                try await VideoColorPolicy.requireSupportedColor(source!.track)
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
            default: throw Self.invalid("Unknown compiled source availability.")
            }
            picture = Picture(
                status: "unavailable", clipId: layer.clipId, assetId: layer.assetId,
                streamId: layer.streamId, requestedSourceUs: layer.sourceUs,
                reason: layer.availability == "source-unavailable"
                    ? "source-unavailable" : "physical-empty"
            )
            // The compiler can exclude physically occupied media for this occurrence.
            // Selection above still proves the exact stream's physical timing before masking.
            if layer.availability == "available", let buffer = selected.buffer {
                guard let sampleTime = selected.sampleTime else {
                    throw Self.invalid("Selected picture has no physical sample time.")
                }
                picture = Picture(
                    status: "available", clipId: layer.clipId, assetId: layer.assetId,
                    streamId: layer.streamId, requestedSourceUs: layer.sourceUs,
                    actualSourceUs: microseconds(sampleTime) - asset.originUs,
                    sample: Sample(
                        value: String(sampleTime.value), timescale: sampleTime.timescale,
                        originUs: asset.originUs))
                rasterKey = .picture(reader: opens, sampleTime: sampleTime)
                if retainedRaster?.key != rasterKey {
                    image = Self.contained(buffer, transform: source!.transform, canvas: canvas)
                        .composited(over: background)
                }
            }
        }
        let reused = retainedRaster?.key == rasterKey
        let destination = try await allocate(reused ? retainedRaster!.buffer : nil)
        if !reused {
            context.render(
                image, to: destination,
                bounds: CGRect(x: 0, y: 0, width: canvas.width, height: canvas.height),
                colorSpace: color)
            CVBufferSetAttachment(
                destination, kCVImageBufferCGColorSpaceKey, color, .shouldPropagate)
            CVBufferSetAttachment(
                destination, kCVImageBufferColorPrimariesKey,
                kCVImageBufferColorPrimaries_ITU_R_709_2,
                .shouldPropagate)
            CVBufferSetAttachment(
                destination, kCVImageBufferTransferFunctionKey,
                kCVImageBufferTransferFunction_ITU_R_709_2,
                .shouldPropagate)
            CVBufferSetAttachment(
                destination, kCVImageBufferYCbCrMatrixKey,
                kCVImageBufferYCbCrMatrix_ITU_R_709_2,
                .shouldPropagate)
            // Current supported visual inputs are static: one contained picture and canvas.
            // Reuse only this immutable raster; every compiled interval still gets its own sample.
            retainedRaster = (rasterKey, destination)
            rasterized += 1
        }
        return destination
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
