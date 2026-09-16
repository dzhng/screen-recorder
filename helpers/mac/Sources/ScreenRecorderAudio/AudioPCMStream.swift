@preconcurrency import AVFoundation
import Foundation

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

/// One finite consumption. No decoder advances while the asynchronous consumer holds a block.
/// Consumers must finish using a block before returning rather than retaining an unbounded queue.
public final class AudioPCMStream {
    public static let maximumBlockFrames = 8_192
    public let format: AudioPCMFormat
    public let frames: Int64
    public let durationUs: Int64
    public let reports: [AudioTrackReport]
    public let sourceURLs: [URL]
    private let sources: [SourceTrack]
    private let maps: [[Int]]
    private let layout: ExcerptLayout
    private let intervals: [[Interval]]
    private let gain: Float
    private var consumed = false

    private struct Interval {
        let source: SourceSpan
        let start: Int64
        let end: Int64
    }

    public static func open(tracks: [AudioTrackPlan], spans: [SourceSpan]) async throws
        -> AudioPCMStream
    {
        try ExcerptValidation.check(
            tracks: tracks, spans: spans, maximumDurationUs: AudioLimits.maximumMicroseconds,
            maximumSpans: AudioLimits.maximumRetainedSpans,
            maximumAvailableIntervals: AudioLimits.maximumRetainedAvailableIntervals)
        var opened: [SourceTrack] = []
        for track in tracks {
            try Task.checkCancellation()
            opened.append(try await SourceTrack.open(plan: track))
        }
        return try AudioPCMStream(sources: opened, spans: spans)
    }

    private init(sources: [SourceTrack], spans: [SourceSpan]) throws {
        let sampleRate = sources.map(\.sampleRate).max()!
        let channels = sources.map(\.channels).max()!
        guard channels <= 2 else {
            throw AudioFailure(
                "UNSUPPORTED_FORMAT", "Retained audio supports mono or stereo output.")
        }
        let maps = try sources.map { source in
            if source.channels == channels { return Array(0..<channels) }
            if source.channels == 1 && channels == 2 { return [0, 0] }
            throw AudioFailure(
                "UNSUPPORTED_FORMAT",
                "Cannot map acquired audio channels without inventing a layout.")
        }
        let layout = ExcerptLayout(spans: spans, sampleRate: sampleRate)
        let gain: Float = sources.count == 1 ? 1 : 0.5
        var intervals: [[Interval]] = []
        var reports: [AudioTrackReport] = []
        for track in sources {
            var readableIntervals: [Interval] = []
            var unavailable: [SourceSpan] = []
            var availableIndex = 0
            for (index, span) in spans.enumerated() {
                while availableIndex < track.available.count,
                    track.available[availableIndex].endUs <= span.startUs
                { availableIndex += 1 }
                var cursor = availableIndex
                var readable: [SourceSpan] = []
                while cursor < track.available.count,
                    track.available[cursor].startUs < span.endUs
                {
                    if let interval = SpanMath.intersection(span, track.available[cursor]) {
                        readable.append(interval)
                    }
                    cursor += 1
                }
                for interval in readable {
                    let start = layout.frame(ofUs: interval.startUs, inSpan: index)
                    let end = layout.frame(ofUs: interval.endUs, inSpan: index)
                    if end > start {
                        readableIntervals.append(Interval(source: interval, start: start, end: end))
                    }
                }
                unavailable.append(contentsOf: SpanMath.subtract(span, covering: readable))
            }
            intervals.append(readableIntervals)
            reports.append(
                AudioTrackReport(
                    role: track.plan.role, gain: Double(gain), sampleRate: track.sampleRate,
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
            throw AudioFailure("INVALID_REQUEST", "Audio stream already consumed.")
        }
        consumed = true
        var indices = [Int](repeating: 0, count: sources.count)
        var readers = [ConvertedAudioInterval?](repeating: nil, count: sources.count)
        defer { readers.removeAll() }
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
                            readers[track] = nil
                            indices[track] += 1
                            continue
                        }
                        if interval.start >= end { break }
                        if readers[track] == nil {
                            readers[track] = try ConvertedAudioInterval(
                                source: sources[track], interval: interval.source,
                                outputRate: format.sampleRate, owed: interval.end - interval.start)
                        }
                        let begin = max(position, interval.start)
                        let finish = min(end, interval.end)
                        try readers[track]!.mix(
                            into: &mixed, at: Int(begin - position), frames: Int(finish - begin),
                            gain: gain, channelMap: maps[track])
                        if interval.end <= end {
                            readers[track] = nil
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
                try Task.checkCancellation()
                position = end
            }
        }
    }
}
