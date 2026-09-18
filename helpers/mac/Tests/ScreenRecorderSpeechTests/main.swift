import FluidAudio
import Foundation

import ScreenRecorderSpeech

/// The engine's tokens, grouped into words the way the evaluated CLI groups them, and timed by the
/// part of each word that was actually said.

func timing(_ token: String, _ start: TimeInterval, _ end: TimeInterval, _ confidence: Float = 1)
    -> TokenTiming
{
    TokenTiming(token: token, tokenId: 0, startTime: start, endTime: end, confidence: confidence)
}

func check(_ condition: Bool, _ message: @autoclosure () -> String) {
    precondition(condition, message())
}

// A sentence ends with a punctuation token of its own, which this model places well after the last
// sound. The word keeps the mark in its text and the engine's own times, and is timed by its speech.
let sentence = WordTimingMerger.mergeTokensIntoWords([
    timing(" dis", 4.72, 4.88),
    timing("pl", 4.88, 5.20),
    timing("ay", 5.20, 5.52),
    timing(".", 5.84, 6.16),
])
check(sentence.count == 1, "One word, got \(sentence.map(\.word))")
check(sentence[0].word == "display.", "Text keeps the mark, got \(sentence[0].word)")
check(sentence[0].endTime == 6.16, "The engine's own end is kept, got \(sentence[0].endTime)")
check(
    sentence[0].spokenStart == 4.72 && sentence[0].spokenEnd == 5.52,
    "Spoken extent must stop at the last sound, got \(sentence[0].spokenStart)–\(sentence[0].spokenEnd)")
print("PASS a trailing mark does not carry the word's end through the silence after it")

// A mark inside a word is surrounded by speech, so it changes nothing.
let inside = WordTimingMerger.mergeTokensIntoWords([
    timing(" U", 1.0, 1.2),
    timing(".", 1.2, 1.3),
    timing("S", 1.3, 1.5),
    timing(".", 1.5, 1.6),
])
check(inside.count == 1 && inside[0].word == "U.S.", "Got \(inside.map(\.word))")
check(
    inside[0].spokenStart == 1.0 && inside[0].spokenEnd == 1.5,
    "Got \(inside[0].spokenStart)–\(inside[0].spokenEnd)")
print("PASS a mark between letters leaves the word timed by its letters")

// Punctuation standing alone as its own word has no speech to be timed by, so it keeps its own.
let alone = WordTimingMerger.mergeTokensIntoWords([
    timing(" first", 0.5, 0.9),
    timing(" --", 2.0, 2.2),
])
check(alone.count == 2 && alone[1].word == "--", "Got \(alone.map(\.word))")
check(
    alone[1].spokenStart == 2.0 && alone[1].spokenEnd == 2.2,
    "Got \(alone[1].spokenStart)–\(alone[1].spokenEnd)")
print("PASS a word that is only a mark keeps the one time the engine gave it")

// Ordinary words are unchanged: what the CLI reports is what this reports.
let plain = WordTimingMerger.mergeTokensIntoWords([
    timing(" Open", 1.68, 2.24, 0.5),
    timing(" the", 2.24, 2.48, 1.0),
])
check(plain.count == 2, "Got \(plain.map(\.word))")
check(
    plain.allSatisfy { $0.spokenStart == $0.startTime && $0.spokenEnd == $0.endTime },
    "Spoken extent must equal the engine's span when every token is speech")
check(abs(plain[0].confidence - 0.5) < 1e-6, "Confidence stays the token average")
print("PASS a word of plain speech reports exactly the engine's own span")

// Numbers are speech too; a year must not be read as punctuation.
let number = WordTimingMerger.mergeTokensIntoWords([timing(" 2026", 3.0, 3.4)])
check(
    number[0].spokenStart == 3.0 && number[0].spokenEnd == 3.4,
    "Got \(number[0].spokenStart)–\(number[0].spokenEnd)")
print("PASS digits count as speech")
