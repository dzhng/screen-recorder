import FluidAudio
import Foundation

/// A word as the evaluated FluidAudio CLI reports it: engine seconds and token-averaged confidence,
/// beside the part of that span the word was actually spoken in.
public struct EngineWord: Codable, Sendable {
    public let word: String
    public let startTime: TimeInterval
    public let endTime: TimeInterval
    /// When this word was said: the extent of its tokens that carry speech.
    ///
    /// The engine ends a sentence with a punctuation token of its own, and places it wherever it
    /// decided the sentence was over — on this model, up to a second after the last sound. That
    /// token belongs in the word's text, which is why the CLI's grouping puts it there, but not in
    /// its time: a word's span is what a cut, an excerpt and a frame request are aimed by, and a
    /// span that runs on through silence takes that silence with it.
    public let spokenStart: TimeInterval
    public let spokenEnd: TimeInterval
    public let confidence: Float
}

/// The grouping is ported verbatim from FluidAudio 0.15.7
/// `Sources/FluidAudioCLI/.../TranscribeCommand.swift` (`WordTimingMerger.mergeTokensIntoWords`),
/// which lives in the CLI target rather than the library. The model gate evaluated the CLI's word
/// timings, so the worker must group tokens the same way: a token with leading whitespace starts a
/// word, and confidence is the token average. The library's public `buildWordTimings` differs (no
/// confidence, skips blank pieces) and is not a substitute.
///
/// The spoken extent is this repository's own, and the only thing here the CLI does not report.
public enum WordTimingMerger {
    public static func mergeTokensIntoWords(_ tokenTimings: [TokenTiming]) -> [EngineWord] {
        guard !tokenTimings.isEmpty else { return [] }

        var wordTimings: [EngineWord] = []
        var currentWord = ""
        var currentStartTime: TimeInterval?
        var currentEndTime: TimeInterval = 0
        var currentSpoken: (start: TimeInterval, end: TimeInterval)?
        var currentConfidences: [Float] = []

        /// A token that says something out loud, rather than only marking how a sentence ends.
        func spoken(_ token: String) -> Bool {
            token.contains { $0.isLetter || $0.isNumber }
        }

        func flush() {
            guard !currentWord.isEmpty, let startTime = currentStartTime else { return }
            // Nothing in this word was said — it is punctuation on its own — so it keeps the only
            // time the engine gave it.
            let extent = currentSpoken ?? (start: startTime, end: currentEndTime)
            wordTimings.append(
                EngineWord(
                    word: currentWord,
                    startTime: startTime,
                    endTime: currentEndTime,
                    spokenStart: extent.start,
                    spokenEnd: extent.end,
                    confidence: averageConfidence(currentConfidences)
                ))
        }

        for timing in tokenTimings {
            let token = timing.token

            if token.hasPrefix(" ") || token.hasPrefix("\n") || token.hasPrefix("\t") {
                flush()

                currentWord = token.trimmingCharacters(in: .whitespacesAndNewlines)
                currentStartTime = timing.startTime
                currentEndTime = timing.endTime
                currentSpoken = spoken(token) ? (timing.startTime, timing.endTime) : nil
                currentConfidences = [timing.confidence]
            } else {
                if currentStartTime == nil {
                    currentStartTime = timing.startTime
                }
                currentWord += token
                currentEndTime = timing.endTime
                if spoken(token) {
                    currentSpoken = (currentSpoken?.start ?? timing.startTime, timing.endTime)
                }
                currentConfidences.append(timing.confidence)
            }
        }

        flush()

        return wordTimings
    }

    private static func averageConfidence(_ confidences: [Float]) -> Float {
        confidences.isEmpty ? 0.0 : confidences.reduce(0, +) / Float(confidences.count)
    }
}
