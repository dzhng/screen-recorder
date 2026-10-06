import Foundation

/// A half-open interval of integer microseconds. Recording source time, playback time and
/// acquisition evidence all use it; the field that holds one names its timeline.
public struct TimeSpan: Codable, Sendable, Equatable {
    public let startUs: Int64
    public let endUs: Int64

    public init(startUs: Int64, endUs: Int64) {
        self.startUs = startUs
        self.endUs = endUs
    }

    /// Safe integer microseconds on both sides of the wire.
    public static let maximumMicroseconds: Int64 = 9_007_199_254_740_991

    /// Whether `spans` can be a revision's retained source spans: non-empty safe ranges, ascending,
    /// and never touching, because adjacent retained spans are one span. Accepting a touching pair
    /// would make renderers ramp or cut at a join that does not exist.
    public static func areRetained(_ spans: [TimeSpan]) -> Bool {
        areAvailable(spans) && zip(spans, spans.dropFirst()).allSatisfy { $0.endUs < $1.startUs }
    }

    /// Availability can be split at metadata boundaries without missing any time at the join.
    public static func areAvailable(_ spans: [TimeSpan]) -> Bool {
        spans.allSatisfy {
            $0.startUs >= 0 && $0.endUs > $0.startUs && $0.endUs <= maximumMicroseconds
        } && zip(spans, spans.dropFirst()).allSatisfy { $0.endUs <= $1.startUs }
    }

    public func intersection(_ other: TimeSpan) -> TimeSpan? {
        let start = max(startUs, other.startUs)
        let end = min(endUs, other.endUs)
        return end > start ? TimeSpan(startUs: start, endUs: end) : nil
    }

    /// The time both lists hold. Both must be ascending and disjoint; the result is too.
    public static func intersection(_ first: [TimeSpan], _ second: [TimeSpan]) -> [TimeSpan] {
        var overlap: [TimeSpan] = []
        var left = 0
        var right = 0
        while left < first.count, right < second.count {
            if let shared = first[left].intersection(second[right]) { overlap.append(shared) }
            if first[left].endUs < second[right].endUs { left += 1 } else { right += 1 }
        }
        return overlap
    }

    /// The parts of this span `covering` leaves uncovered. `covering` must be ascending and
    /// disjoint.
    public func subtracting(_ covering: [TimeSpan]) -> [TimeSpan] {
        var missing: [TimeSpan] = []
        var cursor = startUs
        for covered in covering {
            if covered.startUs > cursor {
                missing.append(TimeSpan(startUs: cursor, endUs: covered.startUs))
            }
            cursor = max(cursor, covered.endUs)
        }
        if cursor < endUs { missing.append(TimeSpan(startUs: cursor, endUs: endUs)) }
        return missing
    }

    /// Whether `next`, which starts no earlier, continues this span. Converting timestamps to
    /// microseconds can open a one-microsecond seam between contiguous samples; any larger hole is
    /// a real gap that must stay visible.
    public func isContinued(by next: TimeSpan) -> Bool { next.startUs <= endUs + 1 }

    /// This span extended through `next`.
    public func merged(with next: TimeSpan) -> TimeSpan {
        TimeSpan(startUs: min(startUs, next.startUs), endUs: max(endUs, next.endUs))
    }
}
