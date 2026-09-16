import Foundation

/// Where each requested span lands in the concatenated output, and how long its join ramps are.
/// Every boundary is quantised from the cumulative playback microseconds that precede it, not from
/// the sum of the spans' own rounded lengths: rounding each span on its own loses up to a frame per
/// span, which a thousand fractional spans turn into a visibly short excerpt. Resolving from the
/// running total instead keeps the error of the whole excerpt, and of every boundary inside it,
/// within half a frame of the requested playback time.
struct ExcerptLayout {
    let spans: [SourceSpan]
    let sampleRate: Int
    /// `spans.count + 1` playback microsecond boundaries; entry `i` is how much playback time the
    /// spans before span `i` hold, and the last entry is the excerpt's requested duration.
    let playedUs: [Int64]
    /// `spans.count + 1` frame boundaries, each quantised from the matching `playedUs`.
    let starts: [Int64]

    init(spans: [SourceSpan], sampleRate: Int) {
        self.spans = spans
        self.sampleRate = sampleRate
        var played: [Int64] = [0]
        for span in spans { played.append(played.last! + (span.endUs - span.startUs)) }
        playedUs = played
        starts = played.map { Self.frames(ofUs: $0, at: sampleRate) }
    }

    var totalFrames: Int64 { starts.last! }

    var durationUs: Int64 {
        (totalFrames * 1_000_000 + Int64(sampleRate) / 2) / Int64(sampleRate)
    }

    /// The output frame holding recording source time `us`, which must lie inside span `index`.
    /// Quantised from the same cumulative playback timeline as the span boundaries, so material
    /// inside a span cannot land a frame away from where that span was placed.
    func frame(ofUs us: Int64, inSpan index: Int) -> Int64 {
        Self.frames(ofUs: playedUs[index] + (us - spans[index].startUs), at: sampleRate)
    }

    /// Ramp length at a join. Half of a short span, so a fade-out and a fade-in inside the same
    /// span never overlap and the span keeps its full length.
    func rampFrames(ofSpan index: Int) -> Int64 {
        min(
            Self.frames(ofUs: AudioLimits.joinRampUs, at: sampleRate),
            (starts[index + 1] - starts[index]) / 2)
    }

    static func frames(ofUs us: Int64, at sampleRate: Int) -> Int64 {
        (us * Int64(sampleRate) + 500_000) / 1_000_000
    }
}

/// Half-open interval algebra over recording source time. `covering` must be ascending and
/// disjoint, which is what a track's own occupied segments already are.
enum SpanMath {
    static func intersection(_ first: SourceSpan, _ second: SourceSpan) -> SourceSpan? {
        let start = max(first.startUs, second.startUs)
        let end = min(first.endUs, second.endUs)
        return end > start ? SourceSpan(startUs: start, endUs: end) : nil
    }

    /// The intervals both lists hold. Both must be ascending and disjoint; the result is too.
    static func intersection(_ first: [SourceSpan], _ second: [SourceSpan]) -> [SourceSpan] {
        var overlap: [SourceSpan] = []
        var left = 0
        var right = 0
        while left < first.count, right < second.count {
            if let shared = intersection(first[left], second[right]) { overlap.append(shared) }
            if first[left].endUs < second[right].endUs { left += 1 } else { right += 1 }
        }
        return overlap
    }

    static func subtract(_ span: SourceSpan, covering: [SourceSpan]) -> [SourceSpan] {
        var missing: [SourceSpan] = []
        var cursor = span.startUs
        for covered in covering {
            if covered.startUs > cursor { missing.append(SourceSpan(startUs: cursor, endUs: covered.startUs)) }
            cursor = max(cursor, covered.endUs)
        }
        if cursor < span.endUs { missing.append(SourceSpan(startUs: cursor, endUs: span.endUs)) }
        return missing
    }
}

enum ExcerptValidation {
    /// Rejects everything the excerpt owner cannot execute honestly, before any media is opened.
    static func check(_ request: AudioExcerptRequest) throws {
        guard !request.tracks.isEmpty else {
            throw AudioFailure("INVALID_REQUEST", "An excerpt reads at least one planned track.")
        }
        // Capture stores one file per role, so uniqueness is also what bounds the plan's size.
        guard Set(request.tracks.map(\.role)).count == request.tracks.count else {
            throw AudioFailure("INVALID_REQUEST", "Each track role may appear once in an excerpt plan.")
        }
        for track in request.tracks {
            guard track.source.hasPrefix("/") else {
                throw AudioFailure("INVALID_REQUEST", "Audio source paths must be absolute, got \(track.source).")
            }
            // Compared against each bound in turn: negating the most negative offset would trap
            // before this guard could reject it.
            guard track.sourceOffsetUs >= -AudioLimits.maximumMicroseconds,
                track.sourceOffsetUs <= AudioLimits.maximumMicroseconds
            else {
                throw AudioFailure(
                    "INVALID_RANGE",
                    "Source offset \(track.sourceOffsetUs) is not a safe microsecond value.")
            }
            try checkAvailability(of: track)
        }
        guard !request.spans.isEmpty else {
            throw AudioFailure("INVALID_RANGE", "An excerpt needs at least one retained span.")
        }
        guard request.spans.count <= AudioLimits.maximumSpans else {
            throw AudioFailure(
                "LIMIT_EXCEEDED",
                "Excerpt has \(request.spans.count) spans, over the \(AudioLimits.maximumSpans) span limit.")
        }
        var total: Int64 = 0
        var previous: SourceSpan?
        for span in request.spans {
            guard span.startUs >= 0, span.endUs <= AudioLimits.maximumMicroseconds, span.endUs > span.startUs
            else {
                throw AudioFailure(
                    "INVALID_RANGE",
                    "Span [\(span.startUs),\(span.endUs)) is not a valid half-open range.")
            }
            // Retained spans of a revision are disjoint and never touch; adjacent ones would have
            // been unioned, so accepting them here would ramp a join that does not exist.
            if let previous, span.startUs <= previous.endUs {
                throw AudioFailure(
                    "INVALID_RANGE",
                    "Span [\(span.startUs),\(span.endUs)) is not strictly after [\(previous.startUs),\(previous.endUs)).")
            }
            total += span.endUs - span.startUs
            previous = span
        }
        guard total <= AudioLimits.maximumExcerptUs else {
            throw AudioFailure(
                "LIMIT_EXCEEDED",
                "Excerpt spans total \(total) microseconds, over the \(AudioLimits.maximumExcerptUs) microsecond limit.")
        }

    }

    /// A track's acquired intervals are the caller's recovery evidence, so they are held to the
    /// same shape as the retained spans: ascending, non-touching, and safe microseconds. They may
    /// start before recording source zero, because a track may hold material from before it.
    private static func checkAvailability(of track: AudioTrackPlan) throws {
        guard track.available.count <= AudioLimits.maximumAvailableIntervals else {
            throw AudioFailure(
                "LIMIT_EXCEEDED",
                "Track \(track.role.rawValue) lists \(track.available.count) available intervals, over the \(AudioLimits.maximumAvailableIntervals) interval limit.")
        }
        var previous: SourceSpan?
        for interval in track.available {
            guard interval.startUs >= -AudioLimits.maximumMicroseconds,
                interval.endUs <= AudioLimits.maximumMicroseconds, interval.endUs > interval.startUs
            else {
                throw AudioFailure(
                    "INVALID_RANGE",
                    "Available interval [\(interval.startUs),\(interval.endUs)) of \(track.role.rawValue) is not a valid half-open range.")
            }
            if let previous, interval.startUs <= previous.endUs {
                throw AudioFailure(
                    "INVALID_RANGE",
                    "Available interval [\(interval.startUs),\(interval.endUs)) of \(track.role.rawValue) is not strictly after [\(previous.startUs),\(previous.endUs)).")
            }
            previous = interval
        }
    }
}
