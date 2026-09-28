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
        let source: TimeSpan
        let start: Int64
        let end: Int64
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
            opened.append(try await SourceTrack.open(plan: track))
        }
        return try AudioPCMStream(sources: opened, roles: tracks.map(\.role), spans: spans, sampleRate: sampleRate)
    }

    /// Where one planned track can be read, in recording source time: its acquisition evidence
    /// intersected with the file's own occupied segments. A consumer that must never hear
    /// unavailable time as silence opens one stream per interval rather than one across a gap.
    public static func readableIntervals(of track: AudioTrackPlan) async throws -> [TimeSpan] {
        try ExcerptValidation.check(
            tracks: [track], maximumAvailableIntervals: AudioLimits.maximumRetainedAvailableIntervals)
        return try await SourceTrack.open(plan: track).available
    }

    private init(sources: [SourceTrack], roles: [AudioRole], spans: [TimeSpan], sampleRate: Int?) throws {
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
        let layout = ExcerptLayout(spans: spans, sampleRate: sampleRate)
        let gain: Float = sources.count == 1 ? 1 : 0.5
        var intervals: [[Interval]] = []
        var reports: [AudioTrackReport] = []
        for (trackIndex, track) in sources.enumerated() {
            var readableIntervals: [Interval] = []
            var unavailable: [TimeSpan] = []
            var availableIndex = 0
            for (index, span) in spans.enumerated() {
                while availableIndex < track.available.count,
                    track.available[availableIndex].endUs <= span.startUs
                { availableIndex += 1 }
                var cursor = availableIndex
                var readable: [TimeSpan] = []
                while cursor < track.available.count,
                    track.available[cursor].startUs < span.endUs
                {
                    if let interval = span.intersection(track.available[cursor]) {
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
                unavailable.append(contentsOf: span.subtracting(readable))
            }
            intervals.append(readableIntervals)
            reports.append(
                AudioTrackReport(
                    role: roles[trackIndex], gain: Double(gain), sampleRate: track.sampleRate,
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
        let decoders = sources.map { AudioSourceReader(source: $0) }
        var indices = [Int](repeating: 0, count: sources.count)
        var conversions = [ConvertedAudioInterval?](repeating: nil, count: sources.count)
        defer { conversions.removeAll() }
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
                            conversions[track] = try ConvertedAudioInterval(
                                source: sources[track], decoder: decoders[track], interval: interval.source,
                                outputRate: format.sampleRate, owed: interval.end - interval.start)
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
