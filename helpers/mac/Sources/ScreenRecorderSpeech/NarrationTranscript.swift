import CryptoKit
import FluidAudio
import Foundation
import ScreenRecorderAudio
import ScreenRecorderMedia

/// One readable interval of the narration track and what became of it. Time outside every segment
/// was never acquired, so it has no segment rather than a silent one.
public struct SpeechSegment: Codable, Sendable, Equatable {
    public enum State: String, Codable, Sendable { case transcribed, skipped }
    public let ordinal: Int
    public let source: TimeSpan
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

/// Acquired narration transcribed into a raw engine record. Each readable interval is read, mixed
/// down and resampled on its own and transcribed with a fresh decoder, so neither an unacquired gap
/// nor the neighbouring interval can shape its words, and every word maps back into its interval.
public enum NarrationTranscript {
    /// The longest interval transcribed in one piece; its samples are held in memory together.
    public static let maximumIntervalUs: Int64 = 2 * 60 * 60 * 1_000_000

    /// One line of `raw.jsonl` per segment: FluidAudio's own result, untouched, beside the words the
    /// evaluated merge produced from its tokens, in engine seconds and in source microseconds.
    struct RawSegment: Codable {
        let ordinal: Int
        let source: TimeSpan
        let state: SpeechSegment.State
        let reason: String?
        let sampleRate: Int
        let samples: Int64
        let result: ASRResult?
        let words: [RawWord]
    }

    /// `startSeconds` and `endSeconds` are the engine's own, kept so this record can still be
    /// compared token for token with the evaluated CLI. `source` is when the word was spoken,
    /// which is what every later read and edit is aimed by.
    struct RawWord: Codable {
        let text: String
        let startSeconds: TimeInterval
        let endSeconds: TimeInterval
        let spokenStartSeconds: TimeInterval
        let spokenEndSeconds: TimeInterval
        let confidence: Float
        let source: TimeSpan
    }

    public static func write(models: SpeechModelFiles, track: AudioTrackPlan, output: String)
        async throws -> SpeechTranscript
    {
        guard track.role == .narration else {
            throw NativeFailure("INVALID_REQUEST", "Only the narration track is transcribed.")
        }
        try ParakeetEngine.checkList(models)
        try models.verify()
        let destination = try NewFile(at: output, assembledAs: "raw.jsonl")
        defer { destination.discard() }

        let intervals = try await AudioPCMStream.readableIntervals(of: track)
        if let long = intervals.first(where: { $0.endUs - $0.startUs > maximumIntervalUs }) {
            throw NativeFailure(
                "LIMIT_EXCEEDED",
                "Narration interval [\(long.startUs),\(long.endUs)) is longer than \(maximumIntervalUs) microseconds.")
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
                let words = WordTimingMerger.mergeTokensIntoWords(result.tokenTimings ?? []).map {
                    RawWord(
                        text: $0.word, startSeconds: $0.startTime, endSeconds: $0.endTime,
                        spokenStartSeconds: $0.spokenStart, spokenEndSeconds: $0.spokenEnd,
                        confidence: $0.confidence,
                        source: sourceSpan(from: $0.spokenStart, to: $0.spokenEnd, in: interval))
                }
                line = RawSegment(
                    ordinal: ordinal, source: interval, state: .transcribed, reason: nil,
                    sampleRate: line.sampleRate, samples: line.samples, result: result, words: words)
            }
            do { raw.append(try encoder.encode(line)) } catch {
                throw NativeFailure(
                    "TRANSCRIPTION_FAILED", "Cannot record the engine result: \(error.localizedDescription)",
                    retryable: true)
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
    private static func monoSamples(of track: AudioTrackPlan, in interval: TimeSpan) async throws
        -> [Float]
    {
        let stream = try await AudioPCMStream.open(
            tracks: [track], spans: [interval], sampleRate: ParakeetEngine.sampleRate)
        guard stream.reports.allSatisfy({ $0.unavailable.isEmpty }) else {
            throw NativeFailure.decodeFailed("Narration media changed while it was being read.")
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

    /// Engine seconds are offsets from the interval's first sample; they are rounded to microseconds
    /// and clamped into the interval, since a token's duration can reach past the audio it was given.
    static func sourceSpan(from start: TimeInterval, to end: TimeInterval, in interval: TimeSpan)
        -> TimeSpan
    {
        func clamped(_ seconds: TimeInterval) -> Int64 {
            guard seconds.isFinite else { return interval.startUs }
            let offset = (seconds * 1_000_000).rounded()
            guard offset > 0 else { return interval.startUs }
            guard offset < Double(interval.endUs - interval.startUs) else { return interval.endUs }
            return interval.startUs + Int64(offset)
        }
        let startUs = clamped(start)
        return TimeSpan(startUs: startUs, endUs: max(startUs, clamped(end)))
    }
}
