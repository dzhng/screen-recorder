@preconcurrency import AVFoundation
import Foundation
import YapMedia

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
    private let source: SourceTrack
    private let channelMap: [Int]
    private let layout: ExcerptLayout
    private let intervals: [Interval]
    private var consumed = false

    private struct Interval {
        let start: Int64
        let end: Int64
        let decodeRange: (origin: ExactTime, start: Int64, end: Int64?)
    }

    /// Selected transcription spans preserve their cumulative sample clock and join ramps.
    public static func open(source: AudioSourceSelection, spans: [ExactRange], sampleRate: Int? = nil,
        strictWindowFormat: Bool = false)
        async throws -> AudioPCMStream {
        try ExcerptValidation.check(source: source, maximumIntervals: AudioLimits.maximumRetainedAvailableIntervals)
        try ExcerptValidation.check(spans: spans, maximumDurationUs: TimeSpan.maximumMicroseconds,
            maximumSpans: AudioLimits.maximumRetainedSpans)
        if let sampleRate, !(1...AudioLimits.maximumSampleRate).contains(sampleRate) {
            throw NativeFailure("INVALID_REQUEST", "Output rate is out of bounds.")
        }
        return try await AudioPCMStream(source: SourceTrack.open(selection: source,
            strictWindowFormat: strictWindowFormat),
            spans: spans, sampleRate: sampleRate)
    }

    /// One source-clock window retains the full support-run origin for repeatable sample selection.
    public static func open(source: AudioSourceSelection, range: ExactRange) async throws -> AudioPCMStream {
        try ExcerptValidation.check(source: source, maximumIntervals: AudioLimits.maximumRetainedAvailableIntervals)
        try ExcerptValidation.check(spans: [range], maximumDurationUs: TimeSpan.maximumMicroseconds, maximumSpans: 1)
        let track = try await SourceTrack.open(selection: source, strictWindowFormat: true)
        return try AudioPCMStream(source: track, spans: [range], sampleRate: nil, sourceWindow: true)
    }

    /// Physical occupancy intersected with the caller's selected acquisition support.
    public static func readableIntervals(of source: AudioSourceSelection) async throws -> [ExactRange] {
        try ExcerptValidation.check(source: source, maximumIntervals: AudioLimits.maximumRetainedAvailableIntervals)
        return try await SourceTrack.open(selection: source).available.map(\.support)
    }

    private init(source: SourceTrack, spans: [ExactRange], sampleRate: Int?, sourceWindow: Bool = false) throws {
        let sampleRate = sampleRate ?? source.sampleRate
        let channels = source.channels
        guard channels <= 2 else {
            throw NativeFailure(
                "UNSUPPORTED_FORMAT", "Retained audio supports mono or stereo output.")
        }
        let layout = try sourceWindow ? ExcerptLayout(window: spans[0], sampleRate: sampleRate) : ExcerptLayout(spans: spans, sampleRate: sampleRate)
        var readableIntervals: [Interval] = []
        var unavailable: [ExactRange] = []
        var availableIndex = 0
        for (index, span) in spans.enumerated() {
            let selection = span
            while availableIndex < source.available.count,
                try source.available[availableIndex].support.endUs.subtract(selection.startUs).numerator <= 0
            { availableIndex += 1 }
            var cursor = availableIndex
            var readable: [(interval: ExactRange, run: SourceTrack.Run)] = []
            while cursor < source.available.count,
                try source.available[cursor].support.startUs.subtract(selection.endUs).numerator < 0
            {
                if let interval = try selection.intersection(source.available[cursor].support) {
                    readable.append((interval, source.available[cursor]))
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
                        let first = try source.frame(at: run.support.startUs, in: run)
                        let skip = try interval.startUs.sample(sampleRate) - run.support.startUs.sample(sampleRate)
                        let limit = try source.frame(at: run.support.endUs, in: run, ceil: true)
                        decodeRange = (run.nativeOrigin, first + skip, limit)
                    } else {
                        // Transcription spans retain the converter's requested-duration lookahead.
                        decodeRange = (piece.run.nativeOrigin, try source.frame(at: interval.startUs, in: piece.run), nil)
                    }
                    readableIntervals.append(Interval(start: start, end: end, decodeRange: decodeRange))
                }
            }
            unavailable.append(contentsOf: try span.subtracting(readable.map(\.interval)))
        }
        self.format = AudioPCMFormat(
            sampleRate: sampleRate, channels: channels, layout: channels == 1 ? .mono : .stereo)
        self.frames = layout.totalFrames
        self.durationUs = layout.durationUs
        self.reports = [AudioSourceReport(gain: 1, sampleRate: source.sampleRate,
            channels: source.channels, unavailable: unavailable)]
        self.sourceURLs = [source.url]
        self.source = source
        self.channelMap = Array(0..<channels)
        self.layout = layout
        self.intervals = readableIntervals
    }

    public func consume(_ sink: (AudioPCMBlock) async throws -> Void) async throws {
        guard !consumed else {
            throw NativeFailure("INVALID_REQUEST", "Audio stream already consumed.")
        }
        consumed = true
        let decoder = AudioSourceReader(input: source.input, asset: source.asset, track: source.track,
            sampleRate: source.sampleRate, packetFrames: source.packetFrames, channels: source.channels)
        var index = 0
        var conversion: ConvertedAudioInterval?
        defer {
            decodedFrames = decoder.decodedFrames
            conversion = nil
        }
        for span in layout.spans.indices {
            var position = layout.starts[span]
            let spanEnd = layout.starts[span + 1]
            while position < spanEnd {
                try Task.checkCancellation()
                let count = Int(min(Int64(Self.maximumBlockFrames), spanEnd - position))
                let end = position + Int64(count)
                var samples = [Float](repeating: 0, count: count * format.channels)
                while index < intervals.count {
                    let interval = intervals[index]
                    if interval.end <= position {
                        conversion = nil
                        index += 1
                        continue
                    }
                    if interval.start >= end { break }
                    if conversion == nil {
                        let range = interval.decodeRange
                        conversion = try ConvertedAudioInterval(source: source, decoder: decoder, origin: range.origin, start: range.start,
                            outputRate: format.sampleRate, owed: interval.end - interval.start, support: .outputDuration(limit: range.end))
                    }
                    let begin = max(position, interval.start)
                    let finish = min(end, interval.end)
                    try conversion!.mix(
                        into: &samples, at: Int(begin - position), frames: Int(finish - begin),
                        gain: 1, channelMap: channelMap)
                    if interval.end <= end {
                        conversion = nil
                        index += 1
                    } else {
                        break
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
                            samples[offset * format.channels + channel] *= factor
                        }
                    }
                }
                try await sink(
                    AudioPCMBlock(startFrame: position, frameCount: count, samples: samples))
                position = end
            }
        }
    }
}
