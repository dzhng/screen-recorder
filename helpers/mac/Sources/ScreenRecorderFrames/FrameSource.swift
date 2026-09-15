@preconcurrency import AVFoundation
import CoreImage
import Foundation

/// Immutable source video opened once and reused for random frame requests. Each request seeks to
/// the chosen sample instead of decoding the file from zero.
public actor FrameSource {
    private let asset: AVURLAsset
    private let track: AVAssetTrack
    private let selector: SampleSelector
    private let transform: CGAffineTransform
    private let context = CIContext()
    public nonisolated let url: URL
    public nonisolated let durationUs: Int64
    public nonisolated let width: Int
    public nonisolated let height: Int

    public init(url: URL) async throws {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw FrameFailure("NATIVE_DECODE_FAILED", "No source media at \(url.path).")
        }
        self.url = url.standardizedFileURL
        asset = AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        guard let video = try await asset.loadTracks(withMediaType: .video).first else {
            throw FrameFailure("NATIVE_DECODE_FAILED", "Source has no video track: \(url.path).")
        }
        track = video
        // Sample cursors are the seek mechanism; without them selection would mean decoding forward
        // from zero for every request.
        guard try await video.load(.canProvideSampleCursors) else {
            throw FrameFailure(
                "NATIVE_DECODE_FAILED", "Video track cannot provide sample cursors: \(url.path).")
        }
        selector = SampleSelector(track: video, segments: try await video.load(.segments))
        transform = try await video.load(.preferredTransform)
        durationUs = microseconds(try await asset.load(.duration))
        let natural = try await video.load(.naturalSize).applying(transform)
        width = Int(abs(natural.width).rounded())
        height = Int(abs(natural.height).rounded())
    }

    /// The sample this source would decode, without decoding it.
    public func selection(atSourceUs requestedUs: Int64, in kept: FrameInterval) throws -> FrameSelection {
        try nearestSample(atSourceUs: requestedUs, in: kept).1
    }

    public func decodeFrame(_ request: FrameRequest) throws -> DecodedFrame {
        try validate(request)
        let (sampleTime, selected) = try nearestSample(atSourceUs: request.atSourceUs, in: request.kept)
        let decoded = try decode(at: sampleTime, actualUs: selected.actualSourceUs)
        let image = try FrameImage(
            buffer: decoded, transform: transform, crop: request.crop, maxLongEdge: request.maxLongEdge)
        let data = try image.png(context: context)
        guard data.count <= request.maxEncodedBytes else {
            throw FrameFailure(
                "LIMIT_EXCEEDED",
                "Encoded frame is \(data.count) bytes, over the \(request.maxEncodedBytes) byte limit.")
        }
        do {
            try data.write(to: request.output, options: .atomic)
        } catch {
            throw FrameFailure(
                "NATIVE_DECODE_FAILED",
                "Cannot write \(request.output.path): \(error.localizedDescription)")
        }
        return DecodedFrame(
            file: request.output.path, mediaType: "image/png", requestedSourceUs: request.atSourceUs,
            actualSourceUs: selected.actualSourceUs, distanceUs: selected.distanceUs,
            width: image.width, height: image.height, sourceWidth: width, sourceHeight: height,
            crop: request.crop, bytes: data.count)
    }

    private func nearestSample(atSourceUs requestedUs: Int64, in kept: FrameInterval) throws
        -> (CMTime, FrameSelection)
    {
        try validate(requestedUs: requestedUs, kept: kept)
        guard let (sampleTime, actualUs) = selector.nearestSample(toUs: requestedUs, in: kept) else {
            throw FrameFailure(
                "UNAVAILABLE",
                "No video sample inside [\(kept.startUs),\(kept.endUs)) microseconds of \(url.lastPathComponent).")
        }
        return (
            sampleTime,
            FrameSelection(actualSourceUs: actualUs, distanceUs: abs(actualUs - requestedUs))
        )
    }

    private func decode(at sampleTime: CMTime, actualUs: Int64) throws -> CVPixelBuffer {
        let reader: AVAssetReader
        do { reader = try AVAssetReader(asset: asset) } catch {
            throw FrameFailure("NATIVE_DECODE_FAILED", "Cannot read \(url.path): \(error.localizedDescription)")
        }
        // A one-second window is enough to reach the selected sample; the reader still starts from
        // the sync sample preceding it rather than from the beginning of the file.
        reader.timeRange = CMTimeRange(start: sampleTime, duration: CMTime(value: 1, timescale: 1))
        let output = AVAssetReaderTrackOutput(
            track: track,
            outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        output.alwaysCopiesSampleData = false
        guard reader.canAdd(output) else {
            throw FrameFailure("NATIVE_DECODE_FAILED", "Cannot decode video track of \(url.path).")
        }
        reader.add(output)
        reader.startReading()
        defer { reader.cancelReading() }
        while let sample = output.copyNextSampleBuffer() {
            let decodedUs = microseconds(CMSampleBufferGetPresentationTimeStamp(sample))
            // The window can open on a sample that merely overlaps its start; the selected sample is
            // the one whose own timestamp matches, and nothing later may stand in for it.
            if decodedUs < actualUs { continue }
            guard decodedUs == actualUs, let buffer = CMSampleBufferGetImageBuffer(sample) else { break }
            return buffer
        }
        throw FrameFailure(
            "NATIVE_DECODE_FAILED", "Decoder did not produce the sample at \(actualUs) microseconds.")
    }

    private func validate(requestedUs: Int64, kept: FrameInterval) throws {
        guard requestedUs >= 0, requestedUs <= FrameLimits.maximumMicroseconds else {
            throw FrameFailure(
                "INVALID_RANGE",
                "Requested source time \(requestedUs) is not a safe non-negative microsecond value.")
        }
        guard kept.startUs >= 0, kept.endUs <= FrameLimits.maximumMicroseconds,
            kept.endUs > kept.startUs
        else {
            throw FrameFailure(
                "INVALID_RANGE", "Kept interval [\(kept.startUs),\(kept.endUs)) is not a valid half-open range.")
        }
    }

    private func validate(_ request: FrameRequest) throws {
        guard request.maxLongEdge > 0, request.maxLongEdge <= FrameLimits.maximumLongEdge else {
            throw FrameFailure(
                "INVALID_RANGE",
                "Long edge \(request.maxLongEdge) is outside 1...\(FrameLimits.maximumLongEdge) pixels.")
        }
        guard request.maxEncodedBytes > 0, request.maxEncodedBytes <= FrameLimits.maximumEncodedBytes else {
            throw FrameFailure(
                "INVALID_RANGE",
                "Encoded limit \(request.maxEncodedBytes) is outside 1...\(FrameLimits.maximumEncodedBytes) bytes.")
        }
        if let crop = request.crop {
            guard crop.width > 0, crop.height > 0, crop.x >= 0, crop.y >= 0,
                crop.x + crop.width <= width, crop.y + crop.height <= height
            else {
                throw FrameFailure(
                    "INVALID_RANGE",
                    "Crop \(crop.x),\(crop.y) \(crop.width)x\(crop.height) is outside the \(width)x\(height) source image.")
            }
        }
        guard request.output.standardizedFileURL != url else {
            throw FrameFailure("INVALID_OUTPUT", "Frame output would overwrite the source media.")
        }
    }
}
