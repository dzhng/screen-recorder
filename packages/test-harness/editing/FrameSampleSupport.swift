@preconcurrency import AVFoundation
import Foundation

// Reads cursor timing without importing or executing either picture renderer.
@main struct FrameSampleSupport {
    struct Point: Decodable { let numerator: Int64; let denominator: Int32 }
    struct Input: Decodable { let file: String; let points: [Point] }
    struct Clock: Encodable, Hashable {
        let value: String
        let timescale: Int32
        init(_ time: CMTime) { value = String(time.value); timescale = time.timescale }
    }
    struct Sample: Encodable {
        let mediaPTS: Clock
        let mediaDuration: Clock
        let start: Clock
        let end: Clock
        let roundedUs: Int64
        let segment: Int
    }
    struct Segment: Encodable {
        let ordinal: Int
        let empty: Bool
        let sourceStart: Clock
        let sourceDuration: Clock
        let targetStart: Clock
        let targetDuration: Clock
    }
    struct Receipt: Encodable {
        let file: String
        let trackId: Int32
        let segments: [Segment]
        let samples: [Sample]
    }
    static func main() async throws {
        let input = try JSONDecoder().decode(Input.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
        let asset = AVURLAsset(url: URL(fileURLWithPath: input.file))
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard tracks.count == 1 else { throw NSError(domain: "Expected one video track", code: 1) }
        let track = tracks[0]
        let segments = try await track.load(.segments)
        var samples: [Clock: Sample] = [:]
        for (ordinal, segment) in segments.enumerated() where !segment.isEmpty {
            let mapping = segment.timeMapping
            for point in input.points {
                let at = CMTime(value: point.numerator, timescale: point.denominator * 1_000_000)
                let mapped = CMTimeMapTimeFromRangeToRange(at, fromRange: mapping.target, toRange: mapping.source)
                guard let cursor = track.makeSampleCursor(presentationTimeStamp: mapped) else { continue }
                _ = cursor.stepInPresentationOrder(byCount: -3)
                for _ in 0..<8 {
                    let pts = cursor.presentationTimeStamp
                    if mapping.source.containsTime(pts) {
                        let duration = cursor.currentSampleDuration
                        guard duration.isNumeric, duration > .zero else { throw NSError(domain: "Missing sample duration", code: 1) }
                        let start = CMTimeMapTimeFromRangeToRange(pts, fromRange: mapping.source, toRange: mapping.target)
                        let end = CMTimeMinimum(CMTimeAdd(start, CMTimeMapDurationFromRangeToRange(duration, fromRange: mapping.source, toRange: mapping.target)), CMTimeRangeGetEnd(mapping.target))
                        samples[Clock(start)] = Sample(mediaPTS: Clock(pts), mediaDuration: Clock(duration), start: Clock(start), end: Clock(end), roundedUs: CMTimeConvertScale(start, timescale: 1_000_000, method: .roundHalfAwayFromZero).value, segment: ordinal)
                    }
                    if cursor.stepInPresentationOrder(byCount: 1) != 1 { break }
                }
            }
        }
        let receipt = Receipt(file: input.file, trackId: track.trackID, segments: segments.enumerated().map { ordinal, value in
            Segment(ordinal: ordinal, empty: value.isEmpty, sourceStart: Clock(value.timeMapping.source.start), sourceDuration: Clock(value.timeMapping.source.duration), targetStart: Clock(value.timeMapping.target.start), targetDuration: Clock(value.timeMapping.target.duration))
        }, samples: samples.values.sorted { $0.roundedUs < $1.roundedUs })
        FileHandle.standardOutput.write(try JSONEncoder().encode(receipt))
    }
}
