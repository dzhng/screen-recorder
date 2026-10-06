import FluidAudio
import Foundation

import YapSpeech
import YapMedia

/// The engine's tokens, grouped into words the way the evaluated CLI groups them, and timed by the
/// speech-bearing tokens while retaining overlapping estimates.

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
let sentence = try WordTimingMerger.mergeTokensIntoWords([
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
let inside = try WordTimingMerger.mergeTokensIntoWords([
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
let alone = try WordTimingMerger.mergeTokensIntoWords([
    timing(" first", 0.5, 0.9),
    timing(" --", 2.0, 2.2),
])
check(alone.count == 2 && alone[1].word == "--", "Got \(alone.map(\.word))")
check(
    alone[1].spokenStart == 2.0 && alone[1].spokenEnd == 2.2,
    "Got \(alone[1].spokenStart)–\(alone[1].spokenEnd)")
print("PASS a word that is only a mark keeps the one time the engine gave it")

// Ordinary words are unchanged: what the CLI reports is what this reports.
let plain = try WordTimingMerger.mergeTokensIntoWords([
    timing(" Open", 1.68, 2.24, 0.5),
    timing(" the", 2.24, 2.48, 1.0),
])
check(plain.count == 2, "Got \(plain.map(\.word))")
check(
    plain.allSatisfy { $0.spokenStart == $0.startTime && $0.spokenEnd == $0.endTime },
    "Spoken extent must equal the engine's span when every token is speech")
check(abs(plain[0].confidence - 0.5) < 1e-6, "Confidence stays the token average")
print("PASS a word of plain speech reports exactly the engine's own span")

// The engine puts several tokens on one frame, so a contraction's first word can be reported as
// covering the whole of the next one. Estimates retain that uncertainty rather than cutting it away.
let contraction = try WordTimingMerger.mergeTokensIntoWords([
    timing(" I", 7.008, 7.168),
    timing("'", 7.168, 7.248),
    timing("m", 7.248, 7.328),
    timing(" going", 7.248, 7.328),
])
check(contraction.map(\.word) == ["I'm", "going"], "Got \(contraction.map(\.word))")
check(
    contraction[0].spokenEnd == 7.328 && contraction[1].spokenStart == 7.248,
    "Overlapping estimates must retain their operands, got "
        + "\(contraction[0].spokenEnd) and \(contraction[1].spokenStart)")
check(
    contraction[0].spokenStart == 7.008 && contraction[1].spokenEnd == 7.328,
    "Only the overlap moves: got \(contraction[0].spokenStart) and \(contraction[1].spokenEnd)")
print("PASS overlapping word estimates retain both extents")

// A word's last token is not always its latest, for the same reason.
let unordered = try WordTimingMerger.mergeTokensIntoWords([
    timing(" wo", 1.0, 1.4),
    timing("rd", 1.2, 1.28),
])
check(
    unordered[0].spokenEnd == 1.4 && unordered[0].endTime == 1.4,
    "A word ends where its speech ends, got \(unordered[0].spokenEnd)")
print("PASS a word ends at its latest token, not its last one")

// Numbers are speech too; a year must not be read as punctuation.
let number = try WordTimingMerger.mergeTokensIntoWords([timing(" 2026", 3.0, 3.4)])
check(
    number[0].spokenStart == 3.0 && number[0].spokenEnd == 3.4,
    "Got \(number[0].spokenStart)–\(number[0].spokenEnd)")
print("PASS digits count as speech")

// Binary-exact engine offsets straddle the nearest-microsecond boundary only after adding
// the physical interval origin; pre-rounding the offset loses the lower word boundary.
let exactInterval = ExactRange(startUs: ExactTime(1, 4), endUs: ExactTime(2_000_001, 4))
let mapped = try SourceTranscript.sourceSpan(from: 1.0 / 4_194_304, to: 1.0 / 2_097_152, in: exactInterval)
check(mapped == TimeSpan(startUs: 0, endUs: 1), "Engine labels must round only after exact origin mapping")
for (start, end) in [(-1.0, 0.1), (0.2, 0.1), (0.0, 9000.0), (Double.nan, 0.1)] {
    do {
        _ = try SourceTranscript.sourceSpan(from: start, to: end, in: exactInterval)
        preconditionFailure("Invalid timing \(start)–\(end) must refuse rather than clamp")
    } catch let error as NativeFailure {
        check(error.code == "INVALID_SPEECH_TIMING" && !error.retryable,
              "Invalid speech operands are nonretryable: \(error)")
    }
}
print("PASS exact speech interval mapping before integer word-label projection")

// The API returns the binary Double, not an ideal decimal half microsecond. Preserve that value
// through mapping; multiplying first can round it to a different side of the final label boundary.
let decimalHalf = try SourceTranscript.sourceSpan(from: 0.0000005, to: 0.0000015,
    in: ExactRange(startUs: 0, endUs: 10))
check(decimalHalf == TimeSpan(startUs: 0, endUs: 2), "Double authority must survive label mapping")
print("PASS binary engine seconds at a decimal half-microsecond label boundary")

for invalid in [timing(" bad", .nan, 0.1), timing(" bad", 0.2, 0.1),
                timing(" bad", -0.1, 0.1), timing(" bad", 0, 0.1, .nan),
                timing(" bad", 0, 0.1, 1.1)] {
    do {
        _ = try WordTimingMerger.mergeTokensIntoWords([timing(" ok", 0, 0.1), invalid])
        preconditionFailure("Invalid token operands must refuse before grouping")
    } catch let error as NativeFailure {
        check(error.code == "INVALID_SPEECH_TIMING" && !error.retryable && error.message.contains("Token 1"),
              "Invalid evidence must identify its token and be nonretryable: \(error)")
    }
}
print("PASS malformed token timing/confidence reports the offending token")
