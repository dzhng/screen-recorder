import CryptoKit
import FluidAudio
import Foundation
import YapAudio
import YapMedia

/// One readable interval of the selected source and what became of it. Time outside every segment
/// was never acquired, so it has no segment rather than a silent one.
public struct SpeechSegment: Codable, Sendable, Equatable {
    public enum State: String, Codable, Sendable { case transcribed, skipped }
    public let ordinal: Int
    public let source: ExactRange
    public let state: State
    /// Why a segment was skipped: `too_short` when the engine cannot accept that little audio.
    public let reason: String?
    public let wordCount: Int
}

public struct SpeechOutput: Codable, Sendable, Equatable {
    public let file: String
    public let bytes: Int
    public let sha256: String
}

public struct SpeechResources: Codable, Sendable, Equatable {
    public let peakResidentBytes: Int64
}

public struct SpeechTranscript: Codable, Sendable, Equatable {
    public let output: SpeechOutput
    public let engine: SpeechEngine
    public let segments: [SpeechSegment]
    public let wordCount: Int
    public let details: SpeechResources
}

/// Selected source audio transcribed into a raw engine record. Each readable interval is read, mixed
/// down and resampled on its own and transcribed with a fresh decoder, so neither an unacquired gap
/// nor the neighbouring interval can shape its words, and every word maps back into its interval.
public enum SourceTranscript {
    /// The longest interval transcribed in one piece; its samples are held in memory together.
    public static let maximumIntervalUs: Int64 = 2 * 60 * 60 * 1_000_000

    /// One line of `raw.jsonl` per segment: FluidAudio's own result, untouched, beside the words the
    /// evaluated merge produced from its tokens, in engine seconds and in source microseconds.
    struct RawSegment: Codable {
        let ordinal: Int
        let source: ExactRange
        let state: SpeechSegment.State
        let reason: String?
        let sampleRate: Int
        let samples: Int64
        let result: ASRResult?
        let words: [RawWord]
    }

    /// Recognition and speech-bearing token estimates remain distinct. Neither estimate is
    /// independent audible ground truth or permission to cut the source.
    struct RawWord: Codable {
        let text: String
        let startSeconds: TimeInterval
        let endSeconds: TimeInterval
        let spokenStartSeconds: TimeInterval
        let spokenEndSeconds: TimeInterval
        let confidence: Float
        let source: TimeSpan
    }

    public static func write(models: SpeechModelFiles, track: AudioSourceSelection, output: String)
        async throws -> SpeechTranscript
    {
        try ParakeetEngine.checkList(models)
        try models.verify()
        let destination = try NewFile(at: output, assembledAs: "raw.jsonl")
        defer { destination.discard() }

        let intervals = try await AudioPCMStream.readableIntervals(of: track)
        if let long = try intervals.first(where: { try $0.endUs.subtract($0.startUs).compare(ExactTime(Int128(maximumIntervalUs))) == .orderedDescending }) {
            throw NativeFailure(
                "LIMIT_EXCEEDED",
                "Source interval [\(long.startUs),\(long.endUs)) is longer than \(maximumIntervalUs) microseconds.")
        }

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        var engine: ParakeetEngine?
        var raw = Data()
        var segments: [SpeechSegment] = []
        for (ordinal, interval) in intervals.enumerated() {
            let samples = try await monoSamples(of: track, in: interval)
            var line = RawSegment(
                ordinal: ordinal, source: interval, state: .skipped, reason: "too_short",
                sampleRate: ParakeetEngine.sampleRate, samples: Int64(samples.count), result: nil,
                words: [])
            if samples.count >= ParakeetEngine.minimumSamples {
                if engine == nil { engine = try await ParakeetEngine.load(models) }
                let result = try await engine!.transcribe(samples)
                for (tokenIndex, token) in (result.tokenTimings ?? []).enumerated() {
                    _ = try sourceSpan(from: token.startTime, to: token.endTime, in: interval,
                        observation: "Segment \(ordinal) token \(tokenIndex)")
                }
                let words = try WordTimingMerger.mergeTokensIntoWords(result.tokenTimings ?? []).enumerated().map { index, word in
                    RawWord(
                        text: word.word, startSeconds: word.startTime, endSeconds: word.endTime,
                        spokenStartSeconds: word.spokenStart, spokenEndSeconds: word.spokenEnd,
                        confidence: word.confidence,
                        source: try sourceSpan(from: word.spokenStart, to: word.spokenEnd, in: interval,
                            observation: "Segment \(ordinal) word \(index)"))
                }
                line = RawSegment(
                    ordinal: ordinal, source: interval, state: .transcribed, reason: nil,
                    sampleRate: line.sampleRate, samples: line.samples, result: result, words: words)
            }
            do { raw.append(try encoder.encode(line)) } catch {
                throw NativeFailure(
                    "INVALID_SPEECH_TIMING", "Segment \(ordinal) engine evidence is not representable: \(error.localizedDescription)")
            }
            raw.append(0x0a)
            segments.append(
                SpeechSegment(
                    ordinal: ordinal, source: interval, state: line.state, reason: line.reason,
                    wordCount: line.words.count))
        }

        try destination.write(raw)
        let bytes = try destination.publish()
        return SpeechTranscript(
            output: SpeechOutput(
                file: output, bytes: bytes,
                sha256: SHA256.hash(data: raw).map { String(format: "%02x", $0) }.joined()),
            engine: ParakeetEngine.identity, segments: segments,
            wordCount: segments.reduce(0) { $0 + $1.wordCount },
            details: SpeechResources(peakResidentBytes: ProcessResources.peakResidentBytes()))
    }

    /// One interval as 16 kHz mono, read through the shared audio owner. Channels are averaged; the
    /// interval lies inside readable time, so the stream must report nothing unavailable.
    private static func monoSamples(of track: AudioSourceSelection, in interval: ExactRange) async throws
        -> [Float]
    {
        let stream = try await AudioPCMStream.open(
            source: track, spans: [interval], sampleRate: ParakeetEngine.sampleRate)
        guard stream.reports.allSatisfy({ $0.unavailable.isEmpty }) else {
            throw NativeFailure.decodeFailed("Source media changed while it was being read.")
        }
        let channels = stream.format.channels
        var samples: [Float] = []
        samples.reserveCapacity(Int(stream.frames))
        try await stream.consume { block in
            if channels == 1 {
                samples.append(contentsOf: block.samples)
                return
            }
            for frame in 0..<block.frameCount {
                var sum: Float = 0
                for channel in 0..<channels { sum += block.samples[frame * channels + channel] }
                samples.append(sum / Float(channels))
            }
        }
        return samples
    }

    /// Valid engine estimates offset the exact interval before the one integer-label projection.
    package static func sourceSpan(from start: TimeInterval, to end: TimeInterval, in interval: ExactRange,
        observation: String = "Engine observation") throws -> TimeSpan
    {
        guard start.isFinite, end.isFinite, start >= 0, end >= start,
              end <= Double(maximumIntervalUs) / 1_000_000 else {
            throw NativeFailure("INVALID_SPEECH_TIMING",
                "\(observation): invalid engine estimate [\(start),\(end)] for interval [\(interval.startUs),\(interval.endUs)).")
        }
        let lower = try interval.startUs.adding(ExactTime(seconds: start))
        let upper = try interval.startUs.adding(ExactTime(seconds: end))
        guard try upper.compare(interval.endUs) != .orderedDescending else {
            throw NativeFailure("INVALID_SPEECH_TIMING",
                "\(observation): engine estimate [\(start),\(end)] exceeds interval [\(interval.startUs),\(interval.endUs)).")
        }
        return try TimeSpan(startUs: lower.sample(1_000_000, nearest: true),
                            endUs: upper.sample(1_000_000, nearest: true))
    }
}
