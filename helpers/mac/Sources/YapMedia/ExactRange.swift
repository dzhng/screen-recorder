import Foundation

/// Half-open physical support and selected source/placement ranges share one exact clock.
/// Wire selections are nonnegative; internal capture masks may precede that origin.
public struct ExactRange: Codable, Sendable, Equatable {
    public let startUs: ExactTime
    public let endUs: ExactTime

    private enum CodingKeys: String, CodingKey { case startUs, endUs }
    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        startUs = try values.decode(ExactTime.self, forKey: .startUs)
        endUs = try values.decode(ExactTime.self, forKey: .endUs)
        guard startUs.numerator >= 0, try endUs.compare(startUs) == .orderedDescending else {
            throw NativeFailure("INVALID_REQUEST", "Selected ranges require nonnegative, increasing endpoints.")
        }
    }

    package init(startUs: ExactTime, endUs: ExactTime) {
        self.startUs = startUs
        self.endUs = endUs
    }
    public init(startUs: Int64, endUs: Int64) {
        self.init(startUs: ExactTime(Int128(startUs)), endUs: ExactTime(Int128(endUs)))
    }
    public init(_ span: TimeSpan) {
        self.init(startUs: span.startUs, endUs: span.endUs)
    }
    package func intersection(_ other: Self) throws -> Self? {
        let start = try startUs.compare(other.startUs) != .orderedAscending ? startUs : other.startUs
        let end = try endUs.compare(other.endUs) != .orderedDescending ? endUs : other.endUs
        return try end.compare(start) == .orderedDescending ? Self(startUs: start, endUs: end) : nil
    }
    package func contains(_ time: ExactTime) throws -> Bool {
        try time.compare(startUs) != .orderedAscending && time.compare(endUs) == .orderedAscending
    }
    package static func areAvailable(_ spans: [Self]) throws -> Bool {
        var end = ExactTime(0)
        for span in spans {
            guard try span.startUs.compare(end) != .orderedAscending,
                try span.endUs.compare(span.startUs) == .orderedDescending else { return false }
            end = span.endUs
        }
        return true
    }
    /// `covering` contains ascending disjoint intersections with this range.
    package func subtracting(_ covering: [Self]) throws -> [Self] {
        var missing: [Self] = []
        var cursor = startUs
        for covered in covering {
            if try covered.startUs.compare(cursor) == .orderedDescending {
                missing.append(Self(startUs: cursor, endUs: covered.startUs))
            }
            if try covered.endUs.compare(cursor) == .orderedDescending { cursor = covered.endUs }
        }
        if try cursor.compare(endUs) == .orderedAscending {
            missing.append(Self(startUs: cursor, endUs: endUs))
        }
        return missing
    }
    /// Recording receipts retain their integer observation domain, after physical mapping.
    package func roundedSpan() throws -> TimeSpan {
        TimeSpan(startUs: try startUs.sample(1_000_000, nearest: true),
            endUs: try endUs.sample(1_000_000, nearest: true))
    }
}
