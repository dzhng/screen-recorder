import Foundation

/// Where each requested span lands in the concatenated output, and how long its join ramps are.
/// Every frame index the excerpt writes comes from here, so a span's material cannot drift by the
/// accumulated rounding of the spans before it.
struct ExcerptLayout {
    let spans: [SourceSpan]
    let sampleRate: Int
    /// `spans.count + 1` boundaries; the last entry is the total frame count.
    let starts: [Int64]

    init(spans: [SourceSpan], sampleRate: Int) {
        self.spans = spans
        self.sampleRate = sampleRate
        var boundaries: [Int64] = [0]
        for span in spans {
            boundaries.append(
                boundaries.last! + Self.frames(ofUs: span.endUs - span.startUs, at: sampleRate))
        }
        starts = boundaries
    }

    var totalFrames: Int64 { starts.last! }

    var durationUs: Int64 {
        (totalFrames * 1_000_000 + Int64(sampleRate) / 2) / Int64(sampleRate)
    }

    /// The output frame holding recording source time `us`, which must lie inside span `index`.
    func frame(ofUs us: Int64, inSpan index: Int) -> Int64 {
        starts[index] + Self.frames(ofUs: us - spans[index].startUs, at: sampleRate)
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
        guard request.output.pathExtension.lowercased() == "wav" else {
            throw AudioFailure(
                "INVALID_OUTPUT",
                "Excerpt output must name a .wav file, got \(request.output.lastPathComponent).")
        }
    }
}
