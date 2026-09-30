@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderMedia

public struct AudioPCMFormat: Sendable {
    public enum Layout: Sendable { case mono, stereo }
    public enum Representation: Sendable { case float32Interleaved }
    public let sampleRate: Int
    public let channels: Int
    public let layout: Layout
    public let representation: Representation = .float32Interleaved
}

public struct AudioPCMBlock: Sendable {
    public let startFrame: Int64
    public let frameCount: Int
    /// Exactly frameCount * format.channels interleaved Float samples, never padded capacity.
    public let samples: [Float]
}

/// A finite, backpressured PCM source. The sink finishes using each block before returning.
/// Media producers own decoding and mixing; consumers choose the encoding.
public protocol AudioPCMSource {
    var format: AudioPCMFormat { get }
    func consume(_ sink: (AudioPCMBlock) async throws -> Void) async throws
}

/// One finite consumption. No decoder advances while the asynchronous consumer holds a block.
/// Consumers must finish using a block before returning rather than retaining an unbounded queue.
public final class AudioPCMStream: AudioPCMSource {
    public static let maximumBlockFrames = 8_192
    public let format: AudioPCMFormat
    public private(set) var decodedFrames: Int64 = 0
    public let frames: Int64
    public let durationUs: Int64
    public let reports: [AudioSourceReport]
    public let sourceURLs: [URL]
    private let sources: [SourceTrack]
    private let maps: [[Int]]
    private let layout: ExcerptLayout
    private let intervals: [[Interval]]
    private let gain: Float
    private var consumed = false

    private struct Interval {
        let start: Int64
        let end: Int64
        let decodeRange: (origin: ExactTime, start: Int64, end: Int64?)
    }

    /// `sampleRate` defaults to the highest rate among the tracks, so nothing is resampled down
    /// unless the consumer names the rate it needs.
    public static func open(tracks: [AudioTrackPlan], spans: [TimeSpan], sampleRate: Int? = nil)
        async throws -> AudioPCMStream
    {
        try ExcerptValidation.check(
            tracks: tracks, spans: spans, maximumDurationUs: TimeSpan.maximumMicroseconds,
            maximumSpans: AudioLimits.maximumRetainedSpans,
            maximumAvailableIntervals: AudioLimits.maximumRetainedAvailableIntervals)
        if let sampleRate, !(1...AudioLimits.maximumSampleRate).contains(sampleRate) {
            throw NativeFailure("INVALID_REQUEST", "Output rate \(sampleRate) Hz is out of bounds.")
        }
        var opened: [SourceTrack] = []
        for track in tracks {
            opened.append(try await SourceTrack.open(selection: track.selection))
        }
        return try AudioPCMStream(sources: opened, spans: spans.map(ExactRange.init), sampleRate: sampleRate)
    }

    /// A selected immutable source uses the same interval layout/conversion as recording mixes.
    public static func open(source: AudioSourceSelection, spans: [ExactRange], sampleRate: Int? = nil)
        async throws -> AudioPCMStream {
        try ExcerptValidation.check(source: source, maximumIntervals: AudioLimits.maximumRetainedAvailableIntervals)
        try ExcerptValidation.check(spans: spans, maximumDurationUs: TimeSpan.maximumMicroseconds,
            maximumSpans: AudioLimits.maximumRetainedSpans)
        if let sampleRate, !(1...AudioLimits.maximumSampleRate).contains(sampleRate) {
            throw NativeFailure("INVALID_REQUEST", "Output rate is out of bounds.")
        }
        return try await AudioPCMStream(sources: [SourceTrack.open(selection: source)],
            spans: spans, sampleRate: sampleRate)
    }

    /// One source-clock window retains the full support-run origin for repeatable sample selection.
    public static func open(source: AudioSourceSelection, range: ExactRange) async throws -> AudioPCMStream {
        try ExcerptValidation.check(source: source, maximumIntervals: AudioLimits.maximumRetainedAvailableIntervals)
        try ExcerptValidation.check(spans: [range], maximumDurationUs: TimeSpan.maximumMicroseconds, maximumSpans: 1)
        let track = try await SourceTrack.open(selection: source, strictWindowFormat: true)
        return try AudioPCMStream(sources: [track], spans: [range], sampleRate: nil, sourceWindow: true)
    }

    /// Physical occupancy intersected with the caller's selected acquisition support.
    public static func readableIntervals(of source: AudioSourceSelection) async throws -> [ExactRange] {
        try ExcerptValidation.check(source: source, maximumIntervals: AudioLimits.maximumRetainedAvailableIntervals)
        return try await SourceTrack.open(selection: source).available.map(\.support)
    }

    private init(sources: [SourceTrack], spans: [ExactRange], sampleRate: Int?, sourceWindow: Bool = false) throws {
        let sampleRate = sampleRate ?? sources.map(\.sampleRate).max()!
        let channels = sources.map(\.channels).max()!
        guard channels <= 2 else {
            throw NativeFailure(
                "UNSUPPORTED_FORMAT", "Retained audio supports mono or stereo output.")
        }
        let maps = try sources.map { source in
            if source.channels == channels { return Array(0..<channels) }
            if source.channels == 1 && channels == 2 { return [0, 0] }
            throw NativeFailure(
                "UNSUPPORTED_FORMAT",
                "Cannot map acquired audio channels without inventing a layout.")
        }
        let layout = try sourceWindow ? ExcerptLayout(window: spans[0], sampleRate: sampleRate) : ExcerptLayout(spans: spans, sampleRate: sampleRate)
        let gain: Float = sources.count == 1 ? 1 : 0.5
        var intervals: [[Interval]] = []
        var reports: [AudioSourceReport] = []
        for track in sources {
            var readableIntervals: [Interval] = []
            var unavailable: [ExactRange] = []
            var availableIndex = 0
            for (index, span) in spans.enumerated() {
                let selection = span
                while availableIndex < track.available.count,
                    try track.available[availableIndex].support.endUs.subtract(selection.startUs).numerator <= 0
                { availableIndex += 1 }
                var cursor = availableIndex
                var readable: [(interval: ExactRange, run: SourceTrack.Run)] = []
                while cursor < track.available.count,
                    try track.available[cursor].support.startUs.subtract(selection.endUs).numerator < 0
                {
                    if let interval = try selection.intersection(track.available[cursor].support) {
                        readable.append((interval, track.available[cursor]))
                    }
                    cursor += 1
                }
                for piece in readable {
                    let interval = piece.interval
                    let start = try layout.frame(at: interval.startUs, inSpan: index)
                    let end = try layout.frame(at: interval.endUs, inSpan: index)
                    if end > start {
                        let decodeRange: (origin: ExactTime, start: Int64, end: Int64?)
                        if sourceWindow {
                            let run = piece.run
                            let first = try track.frame(at: run.support.startUs, in: run)
                            let skip = try interval.startUs.sample(sampleRate) - run.support.startUs.sample(sampleRate)
                            let limit = try track.frame(at: run.support.endUs, in: run, ceil: true)
                            decodeRange = (run.nativeOrigin, first + skip, limit)
                        } else {
                            // Excerpts retain the converter's requested-duration lookahead.
                            decodeRange = (piece.run.nativeOrigin, try track.frame(at: interval.startUs, in: piece.run), nil)
                        }
                        readableIntervals.append(Interval(start: start, end: end, decodeRange: decodeRange))
                    }
                }
                unavailable.append(contentsOf: try span.subtracting(readable.map(\.interval)))
            }
            intervals.append(readableIntervals)
            reports.append(
                AudioSourceReport(
                    gain: Double(gain), sampleRate: track.sampleRate,
                    channels: track.channels, unavailable: unavailable))
        }
        self.format = AudioPCMFormat(
            sampleRate: sampleRate, channels: channels, layout: channels == 1 ? .mono : .stereo)
        self.frames = layout.totalFrames
        self.durationUs = layout.durationUs
        self.reports = reports
        self.sourceURLs = sources.map(\.url)
        self.sources = sources
        self.maps = maps
        self.layout = layout
        self.intervals = intervals
        self.gain = gain
    }

    public func consume(_ sink: (AudioPCMBlock) async throws -> Void) async throws {
        guard !consumed else {
            throw NativeFailure("INVALID_REQUEST", "Audio stream already consumed.")
        }
        consumed = true
        let decoders = sources.map {
            AudioSourceReader(input: $0.input, asset: $0.asset, track: $0.track,
                sampleRate: $0.sampleRate, packetFrames: $0.packetFrames, channels: $0.channels)
        }
        var indices = [Int](repeating: 0, count: sources.count)
        var conversions = [ConvertedAudioInterval?](repeating: nil, count: sources.count)
        defer {
            decodedFrames = decoders.reduce(0) { $0 + $1.decodedFrames }
            conversions.removeAll()
        }
        for span in layout.spans.indices {
            var position = layout.starts[span]
            let spanEnd = layout.starts[span + 1]
            while position < spanEnd {
                try Task.checkCancellation()
                let count = Int(min(Int64(Self.maximumBlockFrames), spanEnd - position))
                let end = position + Int64(count)
                var mixed = [Float](repeating: 0, count: count * format.channels)
                for track in sources.indices {
                    while indices[track] < intervals[track].count {
                        let interval = intervals[track][indices[track]]
                        if interval.end <= position {
                            conversions[track] = nil
                            indices[track] += 1
                            continue
                        }
                        if interval.start >= end { break }
                        if conversions[track] == nil {
                            let range = interval.decodeRange
                            conversions[track] = try ConvertedAudioInterval(source: sources[track], decoder: decoders[track], origin: range.origin, start: range.start,
                                outputRate: format.sampleRate, owed: interval.end - interval.start, support: .outputDuration(limit: range.end))
                        }
                        let begin = max(position, interval.start)
                        let finish = min(end, interval.end)
                        try conversions[track]!.mix(
                            into: &mixed, at: Int(begin - position), frames: Int(finish - begin),
                            gain: gain, channelMap: maps[track])
                        if interval.end <= end {
                            conversions[track] = nil
                            indices[track] += 1
                        } else {
                            break
                        }
                    }
                }
                let ramp = layout.rampFrames(ofSpan: span)
                if ramp > 0 {
                    for offset in 0..<count {
                        let absolute = position + Int64(offset)
                        var factor: Float = 1
                        if span > 0 && absolute - layout.starts[span] < ramp {
                            factor = Float(absolute - layout.starts[span]) / Float(ramp)
                        }
                        if span < layout.spans.count - 1 && spanEnd - 1 - absolute < ramp {
                            factor = Float(spanEnd - 1 - absolute) / Float(ramp)
                        }
                        for channel in 0..<format.channels {
                            mixed[offset * format.channels + channel] *= factor
                        }
                    }
                }
                try await sink(
                    AudioPCMBlock(startFrame: position, frameCount: count, samples: mixed))
                position = end
            }
        }
    }
}
