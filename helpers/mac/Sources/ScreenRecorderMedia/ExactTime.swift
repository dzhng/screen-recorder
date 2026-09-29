import Foundation
import CoreMedia

/// Exact microseconds for source and placement relationships. Arithmetic rejects excess precision rather than
/// rounding a source/placement relationship; final conversion to a decoder sample is explicit.
package struct ExactTime: Codable, Sendable {
    package let numerator: Int128
    package let denominator: Int128

    package init(from decoder: Decoder) throws {
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
    package func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if denominator == 1 {
            try container.encode(Int64(numerator))
        } else {
            try container.encode(
                Fraction(numerator: Int64(numerator), denominator: Int64(denominator)))
        }
    }
    package init(_ time: CMTime) throws {
        guard time.isNumeric, time.timescale > 0 else {
            throw NativeFailure.decodeFailed("Audio segment has invalid presentation time.")
        }
        self.init(Int128(time.value) * 1_000_000, Int128(time.timescale))
    }
    package init(_ numerator: Int128, _ denominator: Int128 = 1) {
        var a = numerator.magnitude
        var b = denominator.magnitude
        while b != 0 { (a, b) = (b, a % b) }
        let divisor = Int128(a)
        self.numerator = numerator / divisor
        self.denominator = denominator / divisor
    }
    package func subtract(_ other: ExactTime) throws -> ExactTime {
        let left = numerator.multipliedReportingOverflow(by: other.denominator)
        let right = other.numerator.multipliedReportingOverflow(by: denominator)
        let bottom = denominator.multipliedReportingOverflow(by: other.denominator)
        let top = left.partialValue.subtractingReportingOverflow(right.partialValue)
        guard !left.overflow, !right.overflow, !bottom.overflow, !top.overflow else {
            throw NativeFailure("NOT_READY", "Audio time exceeds native exact arithmetic capacity.")
        }
        return ExactTime(top.partialValue, bottom.partialValue)
    }
    package func sample(_ rate: Int, ceil: Bool = false, nearest: Bool = false) throws -> Int64 {
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
    package func equals(_ other: ExactTime) -> Bool {
        numerator == other.numerator && denominator == other.denominator
    }
}
