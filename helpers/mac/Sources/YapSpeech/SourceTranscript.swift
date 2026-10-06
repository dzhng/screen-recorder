import CryptoKit
import FluidAudio
import Foundation
import Darwin
import YapAudio
import YapMedia

/// One decoded window and its explicit primary ownership; context never becomes acquired silence.
public struct SpeechSegment: Codable, Sendable, Equatable {
    public enum State: String, Codable, Sendable { case transcribed, skipped }
    public let ordinal: Int
    public let source: ExactRange
    public let state: State
    /// Why a segment was skipped: `too_short` when the engine cannot accept that little audio.
    public let reason: String?
    public let wordCount: Int
    public let owned: ExactRange
}

public struct SpeechOutput: Codable, Sendable, Equatable {
    public let file: String
    public let bytes: Int
    public let sha256: String
}

public struct SpeechResources: Codable, Sendable, Equatable {
    public let peakResidentBytes: Int64
    public let largestDecodedSamples: Int
}

public struct SpeechTranscript: Codable, Sendable, Equatable {
    public let output: SpeechOutput
    public let engine: SpeechEngine
    public let segments: [SpeechSegment]
    public let wordCount: Int
    public let details: SpeechResources
    public let execution: SpeechExecution
    public let available: [ExactRange]
}

/// Bounded selected-source windows retain untouched engine evidence, explicit context and original
/// source estimates. Unique shared-context correspondence settles primary ownership across seams.
public enum SourceTranscript {

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
        var words: [RawWord]
        let owned: ExactRange
        let observations: [RawWord]
        var selectedObservationIndexes: [Int]
        var boundary: SpeechBoundaryResolution?
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

    public static func write(models: SpeechModelFiles, track: AudioSourceSelection, output: String,
        execution: SpeechExecution) async throws -> SpeechTranscript
    {
        try ParakeetEngine.checkList(models)
        try models.verify()
        let available = try await AudioPCMStream.readableIntervals(of: track)
        let windows = try SpeechWindows.plan(available: available, execution: execution)
        let destination = try NewFile(at: output, assembledAs: "raw.jsonl")
        defer { destination.discard() }
        let descriptor = Darwin.open(destination.url.path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o666)
        guard descriptor >= 0 else { throw NativeFailure("INVALID_OUTPUT", "Cannot create speech output.") }
        let handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        defer { try? handle.close() }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        var engine: ParakeetEngine?
        var hash = SHA256()
        var totalBytes = 0
        var largestDecodedSamples = 0
        var segments: [SpeechSegment] = []
        var pending: RawSegment?
        func emit(_ segment: RawSegment) throws {
            let line: Data
            do { line = try encoder.encode(segment) + Data([10]) } catch {
                throw NativeFailure("INVALID_SPEECH_TIMING", "Segment \(segment.ordinal) engine evidence is not representable: \(error.localizedDescription)")
            }
            guard totalBytes <= 268_435_456 - line.count else { throw NativeFailure("LIMIT_EXCEEDED", "Speech evidence exceeds its output budget.") }
            try handle.write(contentsOf: line)
            hash.update(data: line)
            totalBytes += line.count
            segments.append(SpeechSegment(ordinal: segment.ordinal, source: segment.source, state: segment.state,
                reason: segment.reason, wordCount: segment.words.count, owned: segment.owned))
        }
        for (ordinal, window) in windows.enumerated() {
            try Task.checkCancellation()
            let samples = try await monoSamples(of: track, in: window.decoded)
            largestDecodedSamples = max(largestDecodedSamples, samples.count)
            var result: ASRResult?
            var observations: [RawWord] = []
            if samples.count >= ParakeetEngine.minimumSamples {
                if engine == nil { engine = try await ParakeetEngine.load(models) }
                result = try await engine!.transcribe(samples)
                for (tokenIndex, token) in (result!.tokenTimings ?? []).enumerated() {
                    _ = try sourceSpan(from: token.startTime, to: token.endTime, in: window.decoded,
                        observation: "Segment \(ordinal) token \(tokenIndex)")
                }
                observations = try WordTimingMerger.mergeTokensIntoWords(result!.tokenTimings ?? []).enumerated().map { index, word in
                    RawWord(text: word.word, startSeconds: word.startTime, endSeconds: word.endTime,
                        spokenStartSeconds: word.spokenStart, spokenEndSeconds: word.spokenEnd, confidence: word.confidence,
                        source: try sourceSpan(from: word.spokenStart, to: word.spokenEnd, in: window.decoded,
                            observation: "Segment \(ordinal) word \(index)"))
                }
            }
            var selected: Set<Int> = []
            for (index, word) in observations.enumerated() {
                let start = ExactTime(Int128(word.source.startUs)), end = ExactTime(Int128(word.source.endUs))
                // Intersect outer selection edges without shortening original estimates. Internal
                // starts select the provisional owner until explicit peer resolution settles it.
                let lower = ordinal > 0 && windows[ordinal - 1].owned.endUs == window.owned.startUs
                    ? try start.compare(window.owned.startUs) != .orderedAscending
                    : try (start == end ? start.compare(window.owned.startUs) != .orderedAscending : end.compare(window.owned.startUs) == .orderedDescending)
                let terminalPoint = start == end && start == window.owned.endUs && execution.executionRange == nil && window.owned.endUs == window.decoded.endUs
                if try lower && (start.compare(window.owned.endUs) == .orderedAscending || terminalPoint) { selected.insert(index) }
            }
            var current = RawSegment(ordinal: ordinal, source: window.decoded,
                state: result == nil ? .skipped : .transcribed, reason: result == nil ? "too_short" : nil,
                sampleRate: ParakeetEngine.sampleRate, samples: Int64(samples.count), result: result, words: [],
                owned: window.owned, observations: observations, selectedObservationIndexes: [], boundary: nil)
            if var previous = pending {
                var previousIndexes = Set(previous.selectedObservationIndexes)
                if previous.owned.endUs == current.owned.startUs,
                   let shared = try previous.source.intersection(current.source) {
                    let resolution = try SpeechBoundaryMerge.resolve(
                        left: previous.observations.map { SpeechObservation(text: $0.text, source: $0.source) },
                        right: observations.map { SpeechObservation(text: $0.text, source: $0.source) },
                        boundaryUs: current.owned.startUs, shared: shared)
                    current.boundary = resolution
                    for pair in resolution.pairs {
                        if pair.selected == .left { previousIndexes.insert(pair.left); selected.remove(pair.right) }
                        else { previousIndexes.remove(pair.left); selected.insert(pair.right) }
                    }
                }
                previous.selectedObservationIndexes = previousIndexes.sorted()
                previous.words = previous.selectedObservationIndexes.map { previous.observations[$0] }
                try emit(previous)
            }
            current.selectedObservationIndexes = selected.sorted()
            current.words = current.selectedObservationIndexes.map { observations[$0] }
            pending = current
        }
        if let pending { try emit(pending) }
        try handle.synchronize()
        let bytes = try destination.publish()
        return SpeechTranscript(output: SpeechOutput(file: output, bytes: bytes,
            sha256: hash.finalize().map { String(format: "%02x", $0) }.joined()),
            engine: ParakeetEngine.identity, segments: segments, wordCount: segments.reduce(0) { $0 + $1.wordCount },
            details: SpeechResources(peakResidentBytes: ProcessResources.peakResidentBytes(), largestDecodedSamples: largestDecodedSamples),
            execution: execution, available: available)
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
              end <= Double(SpeechWindows.windowUs + SpeechBoundaryMerge.contextUs * 2) / 1_000_000 else {
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
