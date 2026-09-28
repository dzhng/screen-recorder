@preconcurrency import AVFoundation
import CoreImage
import Foundation
import ScreenRecorderMedia

/// Bounded inspection of selected-source presentation membership, including gaps between grid points.
public enum SourceVisualSamples {
    public struct Request: Codable {
        public let asset: CompositionAsset
        let available: [TimeSpan]
        let atSourceUs: [Int64]
    }
    public struct Clock: Encodable {
        let value: String
        let timescale: Int32
        let endValue: String
        let endTimescale: Int32
    }
    public struct Observation: Encodable {
        let requestedSourceUs: Int64
        let status: String
        let reason: String?
        let actualSourceUs: Int64?
        let sample: Clock?
        let width: Int?
        let height: Int?
        let rgbBase64: String?
        let continuousFromPrevious: Bool
    }
    public struct Result: Encodable {
        let assetId: String
        let streamId: String
        let originUs: Int64
        let sourceWidth: Int
        let sourceHeight: Int
        let samples: [Observation]
        let decodedSamples: Int
        let readerOpens = 1
    }
    public static func read(_ request: Request) async throws -> Result {
        try Task.checkCancellation()
        let times = request.atSourceUs
        guard !request.asset.assetId.isEmpty, !request.asset.streamId.isEmpty,
            !times.isEmpty, times.count <= 52,
            times.allSatisfy({ $0 >= 0 && $0 <= TimeSpan.maximumMicroseconds }),
            zip(times, times.dropFirst()).allSatisfy({ $0 < $1 }),
            times.last! - times.first! <= 10_200_000,
            TimeSpan.areAvailable(request.available)
        else { throw NativeFailure("INVALID_REQUEST", "Invalid selected visual sample grid.") }
        func container(_ at: Int64) throws -> CMTime {
            let (value, overflow) = at.addingReportingOverflow(request.asset.originUs)
            guard !overflow else { throw NativeFailure("INVALID_REQUEST", "Visual source clock overflow.") }
            return time(microseconds: value)
        }
        let first = try container(times[0])
        let source = try await PresentationSource(source: URL(fileURLWithPath: request.asset.path),
            streamId: request.asset.streamId, startUs: microseconds(first))
        try await VideoColorPolicy.requireSupportedColor(source.track)
        let context = CIContext(options: [.cacheIntermediates: false])
        var previous: (at: CMTime, support: Int)?
        var thumbnail: (buffer: CVPixelBuffer, width: Int, height: Int, rgb: String)?
        var observations: [Observation] = []
        var traversed = 0
        for requested in times {
            try Task.checkCancellation()
            guard let support = request.available.firstIndex(where: { $0.startUs <= requested && requested < $0.endUs }) else {
                observations.append(Observation(requestedSourceUs: requested, status: "unavailable",
                    reason: "outside_support", actualSourceUs: nil, sample: nil, width: nil, height: nil,
                    rgbBase64: nil, continuousFromPrevious: false))
                previous = nil
                continue
            }
            let at = try container(requested)
            var continuous = previous.map { prior in
                (prior.support..<support).allSatisfy {
                    request.available[$0].endUs == request.available[$0 + 1].startUs
                }
            } ?? false
            if let prior = previous, continuous {
                var cursor = prior.at
                while cursor < at {
                    try Task.checkCancellation()
                    traversed += 1
                    guard traversed <= 100_000 else {
                        throw NativeFailure("LIMIT_EXCEEDED", "Visual sample traversal exceeds its bounded work budget.")
                    }
                    let span = try source.selection(at: cursor, end: at, maximumDecodedSamples: 100_000)
                    guard span.end > cursor else { throw NativeFailure("UNAVAILABLE", "Visual sample traversal made no progress.") }
                    if span.buffer == nil { continuous = false }
                    cursor = span.end
                }
            }
            let selected = try source.selection(at: at, end: .positiveInfinity, maximumDecodedSamples: 100_000)
            previous = (at, support)
            guard let buffer = selected.buffer, let stamp = selected.sampleTime else {
                observations.append(Observation(requestedSourceUs: requested, status: "unavailable",
                    reason: "empty_edit", actualSourceUs: nil, sample: nil, width: nil, height: nil,
                    rgbBase64: nil, continuousFromPrevious: false))
                thumbnail = nil
                continue
            }
            if thumbnail?.buffer !== buffer {
                thumbnail = try autoreleasepool {
                    let image = try FrameImage(buffer: buffer, transform: source.transform,
                        overlay: nil, agedFromUs: 0, crop: nil, maxLongEdge: 64)
                    return (buffer, image.width, image.height, image.rgb(context: context).base64EncodedString())
                }
            }
            let (actual, overflow) = microseconds(stamp).subtractingReportingOverflow(request.asset.originUs)
            guard !overflow else { throw NativeFailure("INVALID_REQUEST", "Visual sample clock overflow.") }
            observations.append(Observation(requestedSourceUs: requested, status: "available", reason: nil,
                actualSourceUs: actual, sample: Clock(value: String(stamp.value), timescale: stamp.timescale,
                    endValue: String(selected.end.value), endTimescale: selected.end.timescale),
                width: thumbnail!.width, height: thumbnail!.height, rgbBase64: thumbnail!.rgb,
                continuousFromPrevious: continuous))
        }
        return Result(assetId: request.asset.assetId, streamId: request.asset.streamId,
            originUs: request.asset.originUs, sourceWidth: source.width, sourceHeight: source.height,
            samples: observations, decodedSamples: source.decodedCount)
    }
}
