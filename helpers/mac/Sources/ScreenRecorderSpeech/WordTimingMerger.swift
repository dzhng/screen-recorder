import FluidAudio
import Foundation

/// A word as the evaluated FluidAudio CLI reports it: engine seconds and token-averaged confidence.
struct EngineWord: Codable, Sendable {
    let word: String
    let startTime: TimeInterval
    let endTime: TimeInterval
    let confidence: Float
}

/// Ported verbatim from FluidAudio 0.15.7 `Sources/FluidAudioCLI/.../TranscribeCommand.swift`
/// (`WordTimingMerger.mergeTokensIntoWords`), which lives in the CLI target rather than the
/// library. The model gate evaluated the CLI's word timings, so the worker must group tokens the
/// same way: a token with leading whitespace starts a word, and confidence is the token average.
/// The library's public `buildWordTimings` differs (no confidence, skips blank pieces) and is not a
/// substitute.
enum WordTimingMerger {
    static func mergeTokensIntoWords(_ tokenTimings: [TokenTiming]) -> [EngineWord] {
        guard !tokenTimings.isEmpty else { return [] }

        var wordTimings: [EngineWord] = []
        var currentWord = ""
        var currentStartTime: TimeInterval?
        var currentEndTime: TimeInterval = 0
        var currentConfidences: [Float] = []

        for timing in tokenTimings {
            let token = timing.token

            if token.hasPrefix(" ") || token.hasPrefix("\n") || token.hasPrefix("\t") {
                if !currentWord.isEmpty, let startTime = currentStartTime {
                    wordTimings.append(
                        EngineWord(
                            word: currentWord,
                            startTime: startTime,
                            endTime: currentEndTime,
                            confidence: averageConfidence(currentConfidences)
                        ))
                }

                currentWord = token.trimmingCharacters(in: .whitespacesAndNewlines)
                currentStartTime = timing.startTime
                currentEndTime = timing.endTime
                currentConfidences = [timing.confidence]
            } else {
                if currentStartTime == nil {
                    currentStartTime = timing.startTime
                }
                currentWord += token
                currentEndTime = timing.endTime
                currentConfidences.append(timing.confidence)
            }
        }

        if !currentWord.isEmpty, let startTime = currentStartTime {
            wordTimings.append(
                EngineWord(
                    word: currentWord,
                    startTime: startTime,
                    endTime: currentEndTime,
                    confidence: averageConfidence(currentConfidences)
                ))
        }

        return wordTimings
    }

    private static func averageConfidence(_ confidences: [Float]) -> Float {
        confidences.isEmpty ? 0.0 : confidences.reduce(0, +) / Float(confidences.count)
    }
}
