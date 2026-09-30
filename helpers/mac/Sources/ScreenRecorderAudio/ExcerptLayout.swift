import Foundation
import ScreenRecorderMedia

/// Where each requested span lands in the concatenated output, and how long its join ramps are.
/// Every boundary is quantised from the cumulative playback microseconds that precede it, not from
/// the sum of the spans' own rounded lengths: rounding each span on its own loses up to a frame per
/// span, which a thousand fractional spans turn into a visibly short excerpt. Resolving from the
/// running total instead keeps the error of the whole excerpt, and of every boundary inside it,
/// within half a frame of the requested playback time.
struct ExcerptLayout {
    let spans: [ExactRange]
    let sampleRate: Int
    /// `spans.count + 1` playback microsecond boundaries; entry `i` is how much playback time the
    /// spans before span `i` hold, and the last entry is the excerpt's requested duration.
    let playedUs: [ExactTime]
    /// `spans.count + 1` frame boundaries, each quantised from the matching `playedUs`.
    let starts: [Int64]
    let sourceOriginFrame: Int64?

    init(spans: [ExactRange], sampleRate: Int) throws {
        sourceOriginFrame = nil
        self.spans = spans
        self.sampleRate = sampleRate
        var played = [ExactTime(0)]
        for span in spans { played.append(try played.last!.adding(span.endUs.subtract(span.startUs))) }
        playedUs = played
        starts = try played.map { try $0.sample(sampleRate, nearest: true) }
    }

    init(window: ExactRange, sampleRate: Int) throws {
        spans = [window]
        self.sampleRate = sampleRate
        let start = try window.startUs.sample(sampleRate)
        let end = try window.endUs.sample(sampleRate)
        sourceOriginFrame = start
        playedUs = [ExactTime(0), try window.endUs.subtract(window.startUs)]
        starts = [0, end - start]
    }

    var totalFrames: Int64 { starts.last! }

    var durationUs: Int64 {
        (totalFrames / Int64(sampleRate)) * 1_000_000
            + ((totalFrames % Int64(sampleRate)) * 1_000_000 + Int64(sampleRate) / 2)
            / Int64(sampleRate)
    }

    /// The output frame holding recording exact source time, which must lie inside span `index`.
    /// Quantised from the same cumulative playback timeline as the span boundaries, so material
    /// inside a span cannot land a frame away from where that span was placed.
    func frame(at time: ExactTime, inSpan index: Int) throws -> Int64 {
        if let sourceOriginFrame { return try time.sample(sampleRate) - sourceOriginFrame }
        let offset = try spans[index].startUs.subtract(playedUs[index])
        return try time.subtract(offset).sample(sampleRate, nearest: true)
    }
    /// Ramp length at a join. Half of a short span, so a fade-out and a fade-in inside the same
    /// span never overlap and the span keeps its full length.
    func rampFrames(ofSpan index: Int) -> Int64 {
        min(
            Self.frames(ofUs: AudioLimits.joinRampUs, at: sampleRate),
            (starts[index + 1] - starts[index]) / 2)
    }

    static func frames(ofUs us: Int64, at sampleRate: Int) -> Int64 {
        (us / 1_000_000) * Int64(sampleRate)
            + ((us % 1_000_000) * Int64(sampleRate) + 500_000) / 1_000_000
    }
}

enum ExcerptValidation {
    /// Rejects everything the excerpt owner cannot execute honestly, before any media is opened.
    static func check(
        tracks: [AudioTrackPlan], spans: [TimeSpan], maximumDurationUs: Int64,
        maximumSpans: Int = AudioLimits.maximumSpans,
        maximumAvailableIntervals: Int = AudioLimits.maximumAvailableIntervals
    ) throws {
        try check(tracks: tracks, maximumAvailableIntervals: maximumAvailableIntervals)
        try check(spans: spans, maximumDurationUs: maximumDurationUs, maximumSpans: maximumSpans)
    }

    static func check(spans: [TimeSpan], maximumDurationUs: Int64, maximumSpans: Int) throws {
        try check(spans: spans.map(ExactRange.init), maximumDurationUs: maximumDurationUs,
            maximumSpans: maximumSpans)
    }

    static func check(spans: [ExactRange], maximumDurationUs: Int64, maximumSpans: Int) throws {
        guard !spans.isEmpty else {
            throw NativeFailure("INVALID_RANGE", "An excerpt needs at least one retained span.")
        }
        guard spans.count <= maximumSpans else {
            throw NativeFailure("LIMIT_EXCEEDED", "Excerpt exceeds its span limit.")
        }
        guard try ExactRange.areAvailable(spans),
            try zip(spans, spans.dropFirst()).allSatisfy({ try $0.endUs.compare($1.startUs) == .orderedAscending }),
            try spans.allSatisfy({ try $0.endUs.compare(ExactTime(Int128(TimeSpan.maximumMicroseconds))) != .orderedDescending })
        else {
            throw NativeFailure("INVALID_RANGE", "Excerpt spans must be ascending, non-touching safe ranges.")
        }
        var total = ExactTime(0)
        for span in spans { total = try total.adding(span.endUs.subtract(span.startUs)) }
        guard try total.compare(ExactTime(Int128(maximumDurationUs))) != .orderedDescending else {
            throw NativeFailure("LIMIT_EXCEEDED", "Excerpt exceeds its duration limit.")
        }
    }

    /// Rejects track plans that cannot be read honestly, before any media is opened.
    static func check(tracks: [AudioTrackPlan], maximumAvailableIntervals: Int) throws {
        guard !tracks.isEmpty else {
            throw NativeFailure("INVALID_REQUEST", "An excerpt reads at least one planned track.")
        }
        // Capture stores one file per role, so uniqueness is also what bounds the plan's size.
        guard Set(tracks.map(\.role)).count == tracks.count else {
            throw NativeFailure(
                "INVALID_REQUEST", "Each track role may appear once in an excerpt plan.")
        }
        for track in tracks {
            try checkSourceFields(track.selection, maximumIntervals: maximumAvailableIntervals)
        }
    }

    static func check(source track: AudioSourceSelection, maximumIntervals: Int) throws {
        try checkSourceFields(track, maximumIntervals: maximumIntervals)
        guard try ExactRange.areAvailable(track.available) else {
            throw NativeFailure("INVALID_RANGE", "Selected source support must be nonnegative and ordered.")
        }
    }

    /// Capture masks can precede zero; their retained selections still cannot.
    private static func checkSourceFields(_ track: AudioSourceSelection, maximumIntervals: Int) throws {
        guard track.source.hasPrefix("/"), !track.source.contains("\0") else {
            throw NativeFailure("INVALID_REQUEST", "Audio source paths must be absolute and contain no NUL.")
        }
        guard try track.sourceOffsetUs.compare(ExactTime(-Int128(TimeSpan.maximumMicroseconds))) != .orderedAscending,
            try track.sourceOffsetUs.compare(ExactTime(Int128(TimeSpan.maximumMicroseconds))) != .orderedDescending else {
            throw NativeFailure("INVALID_RANGE", "Source offset is not a safe microsecond value.")
        }
        guard track.available.count <= maximumIntervals else {
            throw NativeFailure(
                "LIMIT_EXCEEDED",
                "Source lists \(track.available.count) available intervals, over the \(maximumIntervals) interval limit."
            )
        }
        var previous: ExactRange?
        for interval in track.available {
            guard try interval.startUs.compare(ExactTime(-Int128(TimeSpan.maximumMicroseconds))) != .orderedAscending,
                try interval.endUs.compare(ExactTime(Int128(TimeSpan.maximumMicroseconds))) != .orderedDescending,
                try interval.endUs.compare(interval.startUs) == .orderedDescending
            else {
                throw NativeFailure(
                    "INVALID_RANGE",
                    "Available interval [\(interval.startUs),\(interval.endUs)) is not a valid half-open range."
                )
            }
            if let previous, try interval.startUs.compare(previous.endUs) == .orderedAscending {
                throw NativeFailure(
                    "INVALID_RANGE",
                    "Available interval [\(interval.startUs),\(interval.endUs)) overlaps or precedes [\(previous.startUs),\(previous.endUs))."
                )
            }
            previous = interval
        }
    }
}
