import Foundation
import CoreMedia
import ScreenRecorderMedia

/// The compiler's audio schedule and child-before-parent processing tree, plus resolved asset
/// locators. This is an execution plan, not another editable project document.
public struct CompositionAudioPlan: Codable, Sendable {
    public let output: String
    public let range: Samples
    public let clips: [Clip]
    public let processing: [CompositionProcessing]
    public let assets: [CompositionAsset]

    public init(
        output: String, range: Samples, clips: [Clip], processing: [CompositionProcessing],
        assets: [CompositionAsset]
    ) {
        self.output = output
        self.range = range
        self.clips = clips
        self.processing = processing
        self.assets = assets
    }

    public struct Samples: Codable, Sendable, Equatable {
        public let start: Int64
        public let end: Int64
        var valid: Bool { start >= 0 && end > start && end <= TimeSpan.maximumMicroseconds }
    }
    public struct Selection: Codable, Sendable {
        let startUs: ExactTime
        let endUs: ExactTime
    }
    public struct Clip: Codable, Sendable {
        let clipId: String
        let trackId: String
        let sampleRange: Samples
        let placement: Selection
        let source: Source
        let pitch: String
        let available: [Samples]
        let context: [Context]
    }
    public struct Context: Codable, Sendable {
        let source: Selection
        let sampleRange: Samples
    }
    public struct Source: Codable, Sendable {
        let kind: String
        let assetId: String?
        let streamId: String?
        let range: Selection?
    }

}

/// Exact microseconds on the compiler boundary. Arithmetic rejects excess precision rather than
/// rounding a source/placement relationship; final conversion to a decoder sample is explicit.
struct ExactTime: Codable, Sendable {
    let numerator: Int128
    let denominator: Int128

    init(from decoder: Decoder) throws {
        let single = try decoder.singleValueContainer()
        let n: Int64
        let d: Int64
        if let value = try? single.decode(Int64.self) {
            n = value
            d = 1
        } else {
            let value = try single.decode(Fraction.self)
            n = value.numerator
            d = value.denominator
        }
        guard n >= 0, n <= TimeSpan.maximumMicroseconds,
            d > 0, d <= TimeSpan.maximumMicroseconds
        else {
            throw NativeFailure("INVALID_REQUEST", "Invalid exact time.")
        }
        numerator = Int128(n)
        denominator = Int128(d)
    }
    private struct Fraction: Codable {
        let numerator: Int64
        let denominator: Int64
    }
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if denominator == 1 {
            try container.encode(Int64(numerator))
        } else {
            try container.encode(
                Fraction(numerator: Int64(numerator), denominator: Int64(denominator)))
        }
    }
    init(_ time: CMTime) throws {
        guard time.isNumeric, time.timescale > 0 else {
            throw NativeFailure.decodeFailed("Audio segment has invalid presentation time.")
        }
        self.init(Int128(time.value) * 1_000_000, Int128(time.timescale))
    }
    init(_ numerator: Int128, _ denominator: Int128 = 1) {
        var a = numerator.magnitude
        var b = denominator.magnitude
        while b != 0 { (a, b) = (b, a % b) }
        let divisor = Int128(a)
        self.numerator = numerator / divisor
        self.denominator = denominator / divisor
    }
    func subtract(_ other: ExactTime) throws -> ExactTime {
        let left = numerator.multipliedReportingOverflow(by: other.denominator)
        let right = other.numerator.multipliedReportingOverflow(by: denominator)
        let bottom = denominator.multipliedReportingOverflow(by: other.denominator)
        let top = left.partialValue.subtractingReportingOverflow(right.partialValue)
        guard !left.overflow, !right.overflow, !bottom.overflow, !top.overflow else {
            throw NativeFailure("NOT_READY", "Audio time exceeds native exact arithmetic capacity.")
        }
        return ExactTime(top.partialValue, bottom.partialValue)
    }
    func sample(_ rate: Int, ceil: Bool = false, nearest: Bool = false) throws -> Int64 {
        let top = numerator.multipliedReportingOverflow(by: Int128(rate))
        let bottom = denominator.multipliedReportingOverflow(by: 1_000_000)
        guard !top.overflow, !bottom.overflow else {
            throw NativeFailure(
                "NOT_READY", "Audio time exceeds native sample arithmetic capacity.")
        }
        let quotient = top.partialValue / bottom.partialValue
        let floor =
            quotient - (top.partialValue < 0 && top.partialValue % bottom.partialValue != 0 ? 1 : 0)
        let residue = top.partialValue - floor * bottom.partialValue
        let half = bottom.partialValue / 2
        let roundsUp =
            top.partialValue < 0
            ? residue > half : residue >= half + bottom.partialValue % 2
        let rounded = floor + ((nearest ? roundsUp : ceil && residue != 0) ? 1 : 0)
        guard let value = Int64(exactly: rounded) else {
            throw NativeFailure("INVALID_REQUEST", "Audio sample exceeds native bounds.")
        }
        return value
    }
    func equals(_ other: ExactTime) -> Bool {
        numerator == other.numerator && denominator == other.denominator
    }
}

extension CompositionAudioPlan.Selection {
    init(_ span: TimeSpan) {
        self.init(startUs: ExactTime(Int128(span.startUs)), endUs: ExactTime(Int128(span.endUs)))
    }
    func intersection(_ other: Self) throws -> Self? {
        let start = try startUs.subtract(other.startUs).numerator >= 0 ? startUs : other.startUs
        let end = try endUs.subtract(other.endUs).numerator <= 0 ? endUs : other.endUs
        return try end.subtract(start).numerator > 0 ? Self(startUs: start, endUs: end) : nil
    }
    /// Public microsecond evidence is a projection, never the execution clock.
    func roundedSpan() throws -> TimeSpan {
        TimeSpan(startUs: try startUs.sample(1_000_000, nearest: true),
            endUs: try endUs.sample(1_000_000, nearest: true))
    }
    static func intersection(_ left: [Self], _ right: [Self]) throws -> [Self] {
        var result: [Self] = []
        var a = 0, b = 0
        while a < left.count && b < right.count {
            if let value = try left[a].intersection(right[b]) { result.append(value) }
            if try left[a].endUs.subtract(right[b].endUs).numerator < 0 { a += 1 }
            else { b += 1 }
        }
        return result
    }
}
