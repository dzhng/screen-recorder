@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderAudio

let evidence = URL(
    fileURLWithPath: ProcessInfo.processInfo.environment["SCREENREC_AUDIO_EVIDENCE"]
        ?? NSTemporaryDirectory() + "screenrec-audio-tests")
try FileManager.default.createDirectory(at: evidence, withIntermediateDirectories: true)

let rate = 48_000.0
// Narration: 1000 Hz left, 1500 Hz right, a full-scale marker at [2.0,2.5) that no retained span
// includes, and recorded silence at [5.0,5.5).
let fixtureFrames = Int(8 * rate)
let narrationTone = FixtureTone(
    frequencies: [1_000, 1_500], sampleRate: rate, stampFrames: fixtureFrames,
    markedUs: .init(startUs: 2_000_000, endUs: 2_500_000),
    silentUs: .init(startUs: 5_000_000, endUs: 5_500_000))
let narration = evidence.appendingPathComponent("narration.mov")
try await FixtureAudioWriter.write(narrationTone, frames: fixtureFrames, to: narration)

let systemTone = FixtureTone(
    frequencies: [400, 600], sampleRate: rate, stampFrames: fixtureFrames, markedUs: nil,
    silentUs: nil)
let system = evidence.appendingPathComponent("system.mov")
try await FixtureAudioWriter.write(systemTone, frames: fixtureFrames, to: system)

func plan(_ role: AudioRole, _ url: URL, offsetUs: Int64 = 0) -> AudioTrackPlan {
    AudioTrackPlan(role: role, source: url.path, sourceOffsetUs: offsetUs)
}

func excerpt(_ named: String, tracks: [AudioTrackPlan], spans: [SourceSpan]) async throws -> (AudioExcerpt, FixtureWave) {
    let output = evidence.appendingPathComponent("\(named).wav")
    let result = try await AudioExcerpts.write(
        AudioExcerptRequest(tracks: tracks, spans: spans, output: output))
    return (result, try FixtureWave(contentsOf: output))
}

let (single, singleWave) = try await excerpt(
    "single-span", tracks: [plan(.narration, narration)],
    spans: [SourceSpan(startUs: 1_000_000, endUs: 1_500_000)])
precondition(
    single.sampleRate == 48_000 && single.channels == 2 && single.frames == 24_000
        && single.durationUs == 500_000,
    "A 500000us span of 48 kHz stereo narration must give 24000 frames, got \(single)")
precondition(
    singleWave.container == "RIFF" && singleWave.format == "WAVE" && singleWave.formatTag == 3
        && singleWave.bitsPerSample == 32 && singleWave.frames == 24_000 && singleWave.channels == 2
        && singleWave.sampleRate == 48_000,
    "The excerpt file must be a 48 kHz stereo float WAVE of 24000 frames, got \(singleWave)")
let singleBytes = try Data(contentsOf: URL(fileURLWithPath: single.file)).count
precondition(
    single.bytes == singleBytes,
    "Reported byte count must be the file's size, got \(single.bytes) for \(singleBytes) bytes")
for offset in stride(from: 0, to: 24_000, by: 97) {
    for channel in 0..<2 {
        let expected = narrationTone.sample(frame: narrationTone.frame(ofUs: 1_000_000) + offset, channel: channel)
        let actual = singleWave.sample(frame: offset, channel: channel)
        precondition(
            abs(actual - expected) < 1e-6,
            "Frame \(offset) channel \(channel) must equal source sample, expected \(expected) got \(actual)")
    }
}
precondition(
    singleWave.magnitude(ofHz: 1_000, channel: 0, from: 0, count: 4_800) > 0.2
        && singleWave.magnitude(ofHz: 1_500, channel: 0, from: 0, count: 4_800) < 0.02
        && singleWave.magnitude(ofHz: 1_500, channel: 1, from: 0, count: 4_800) > 0.2
        && singleWave.magnitude(ofHz: 1_000, channel: 1, from: 0, count: 4_800) < 0.02,
    "Each excerpt channel must carry only its own source tone")
precondition(
    single.tracks == [
        AudioTrackReport(role: .narration, gain: 1, sampleRate: 48_000, channels: 2, unavailable: [])
    ], "A lone available track plays at unity gain with nothing unavailable, got \(single.tracks)")
print("PASS single span of narration is 24000 frames of its own samples at unity gain")

/// The excerpt the contract describes, stated from the fixture definitions rather than from the
/// decoder: each span's own samples concatenated, summed at the contract's gain, with linear ramps
/// inside the spans on both sides of every join.
func expectedExcerpt(
    of planned: [(tone: FixtureTone, offsetUs: Int64)], spans: [SourceSpan], sampleRate: Double,
    channels: Int
) -> [Float] {
    func frames(ofUs us: Int64) -> Int { Int((Double(us) / 1_000_000 * sampleRate).rounded()) }
    let gain: Float = planned.count == 1 ? 1 : 0.5
    var samples: [Float] = []
    for (index, span) in spans.enumerated() {
        let spanFrames = frames(ofUs: span.endUs - span.startUs)
        let ramp = min(frames(ofUs: 5_000), spanFrames / 2)
        for offset in 0..<spanFrames {
            var envelope: Float = 1
            if index > 0 && offset < ramp { envelope *= Float(offset) / Float(ramp) }
            if index < spans.count - 1 && offset >= spanFrames - ramp {
                envelope *= Float(spanFrames - 1 - offset) / Float(ramp)
            }
            for channel in 0..<channels {
                var value: Float = 0
                for track in planned {
                    let frame = track.tone.frame(ofUs: span.startUs - track.offsetUs) + offset
                    value += gain * track.tone.sample(
                        frame: frame, channel: min(channel, track.tone.channels - 1))
                }
                samples.append(value * envelope)
            }
        }
    }
    return samples
}

func assertMatches(
    _ wave: FixtureWave, _ expected: [Float], _ description: String, tolerance: Float = 1e-6
) {
    precondition(
        wave.samples.count == expected.count,
        "\(description): expected \(expected.count) interleaved samples, got \(wave.samples.count)")
    for index in 0..<expected.count where abs(wave.samples[index] - expected[index]) >= tolerance {
        preconditionFailure(
            "\(description): interleaved sample \(index) (frame \(index / wave.channels) channel \(index % wave.channels)) expected \(expected[index]), got \(wave.samples[index])")
    }
}

// Two retained spans separated by a removed region that holds full-scale marker samples.
let disjoint = [
    SourceSpan(startUs: 1_000_000, endUs: 1_500_000), SourceSpan(startUs: 4_000_000, endUs: 4_250_000),
]
let (joined, joinedWave) = try await excerpt(
    "disjoint-spans", tracks: [plan(.narration, narration)], spans: disjoint)
precondition(
    joined.frames == 36_000 && joined.durationUs == 750_000,
    "Two spans of 500000us and 250000us must concatenate to 36000 frames, got \(joined)")
assertMatches(
    joinedWave, expectedExcerpt(of: [(narrationTone, 0)], spans: disjoint, sampleRate: rate, channels: 2),
    "disjoint spans")
// The join is sample-exact: material after it belongs to 4.0s, not to the removed continuation of
// 1.5s. The ramp is 240 frames, so the comparison starts at the first unattenuated frame.
let ramp = 240
var distinguishable: Float = 0
for offset in 0..<480 {
    for channel in 0..<2 {
        let atJoin = narrationTone.sample(
            frame: narrationTone.frame(ofUs: 4_000_000) + ramp + offset, channel: channel)
        let continued = narrationTone.sample(
            frame: narrationTone.frame(ofUs: 1_500_000) + ramp + offset, channel: channel)
        precondition(
            abs(joinedWave.sample(frame: 24_000 + ramp + offset, channel: channel) - atJoin) < 1e-6,
            "Frame \(24_000 + ramp + offset) must hold 4.0s material, not the removed continuation of 1.5s")
        distinguishable = max(distinguishable, abs(atJoin - continued))
    }
}
precondition(
    distinguishable > 0.05,
    "The compared windows must differ enough for the previous check to fail on a wrong span, got \(distinguishable)")
precondition(
    joinedWave.sample(frame: 23_999, channel: 0) == 0 && joinedWave.sample(frame: 24_000, channel: 0) == 0,
    "A join must end and start on silence, got \(joinedWave.sample(frame: 23_999, channel: 0)) and \(joinedWave.sample(frame: 24_000, channel: 0))")
// The removed region is the only full-scale material in the source, so its absence is checkable
// without trusting the sample-by-sample comparison above.
precondition(
    joinedWave.peak(from: 0, count: Int(joined.frames)) <= 0.5 + 1e-6,
    "Full-scale marker samples from the removed region must never reach the excerpt, peak \(joinedWave.peak(from: 0, count: Int(joined.frames)))")
print("PASS disjoint spans concatenate sample-exactly and never read the removed region")

// A track that started a second after the video: recording time 2.0s is its own time 1.0s.
let (late, lateWave) = try await excerpt(
    "offset-positive", tracks: [plan(.narration, narration, offsetUs: 1_000_000)],
    spans: [SourceSpan(startUs: 2_000_000, endUs: 2_500_000)])
precondition(
    late.frames == single.frames && lateWave.samples == singleWave.samples,
    "A +1000000us offset must make recording time 2.0s read the track's own 1.0s, got \(late)")
// Recording time before the track's own zero has no media, and must be reported rather than
// passed off as recorded silence.
let (partial, partialWave) = try await excerpt(
    "offset-before-start", tracks: [plan(.narration, narration, offsetUs: 1_000_000)],
    spans: [SourceSpan(startUs: 500_000, endUs: 1_500_000)])
precondition(
    partial.frames == 48_000
        && partial.tracks[0].unavailable == [SourceSpan(startUs: 500_000, endUs: 1_000_000)],
    "The half second before an offset track's zero must be reported unavailable, got \(partial)")
precondition(
    partialWave.peak(from: 0, count: 24_000) == 0,
    "Unavailable material must be silent, got peak \(partialWave.peak(from: 0, count: 24_000))")
for offset in stride(from: 0, to: 24_000, by: 97) {
    for channel in 0..<2 {
        precondition(
            abs(partialWave.sample(frame: 24_000 + offset, channel: channel)
                - narrationTone.sample(frame: offset, channel: channel)) < 1e-6,
            "Available material must start at the output frame its recording time names, frame \(offset)")
    }
}

// A track holding material from before recording source zero.
let (early, earlyWave) = try await excerpt(
    "offset-negative", tracks: [plan(.narration, narration, offsetUs: -1_000_000)],
    spans: [SourceSpan(startUs: 0, endUs: 500_000)])
precondition(
    earlyWave.samples == singleWave.samples && early.tracks[0].unavailable.isEmpty,
    "A -1000000us offset must make recording time 0.0s read the track's own 1.0s, got \(early)")
print("PASS positive and negative source offsets map recording time onto each track's own timeline")

let mixedSpans = [SourceSpan(startUs: 1_000_000, endUs: 1_500_000)]
let (alone, aloneWave) = try await excerpt(
    "system-alone", tracks: [plan(.system, system)], spans: mixedSpans)
assertMatches(
    aloneWave, expectedExcerpt(of: [(systemTone, 0)], spans: mixedSpans, sampleRate: rate, channels: 2),
    "system alone")
precondition(alone.tracks[0].gain == 1, "A lone system track plays at unity, got \(alone.tracks)")

let (mixed, mixedWave) = try await excerpt(
    "mixed", tracks: [plan(.narration, narration), plan(.system, system)], spans: mixedSpans)
precondition(
    mixed.tracks.map(\.gain) == [0.5, 0.5],
    "Two summed tracks each play at half gain, got \(mixed.tracks.map(\.gain))")
assertMatches(
    mixedWave,
    expectedExcerpt(of: [(narrationTone, 0), (systemTone, 0)], spans: mixedSpans, sampleRate: rate, channels: 2),
    "narration and system mix")
// Both sources must be audible in the mix, each at about half the amplitude it has alone.
for (frequency, channel) in [(1_000.0, 0), (1_500.0, 1), (400.0, 0), (600.0, 1)] {
    let solo = (frequency < 800 ? aloneWave : singleWave).magnitude(
        ofHz: frequency, channel: channel, from: 0, count: 4_800)
    let inMix = mixedWave.magnitude(ofHz: frequency, channel: channel, from: 0, count: 4_800)
    precondition(
        abs(inMix - solo / 2) < 0.01 && inMix > 0.1,
        "\(frequency) Hz must appear in the mix at half its solo magnitude \(solo), got \(inMix)")
}
print("PASS a single track keeps unity gain and two tracks sum at half gain each")

// Three retained 100 ms spans: the outer edges of the excerpt are not joins, the two interior
// boundaries are. At 48 kHz the 5 ms contract ramp is 240 frames.
let joinSpans = (0..<3).map {
    SourceSpan(startUs: 1_000_000 + Int64($0) * 300_000, endUs: 1_100_000 + Int64($0) * 300_000)
}
let (ramped, rampedWave) = try await excerpt(
    "join-ramps", tracks: [plan(.narration, narration)], spans: joinSpans)
precondition(
    ramped.frames == 14_400 && ramped.durationUs == 300_000,
    "Ramps must not shorten the timeline: three 100000us spans stay 14400 frames, got \(ramped)")
assertMatches(
    rampedWave, expectedExcerpt(of: [(narrationTone, 0)], spans: joinSpans, sampleRate: rate, channels: 2),
    "join ramps")
func sourceSample(_ span: Int, _ offset: Int, _ channel: Int) -> Float {
    narrationTone.sample(
        frame: narrationTone.frame(ofUs: joinSpans[span].startUs) + offset, channel: channel)
}
precondition(
    rampedWave.sample(frame: 0, channel: 0) == sourceSample(0, 0, 0)
        && rampedWave.sample(frame: 14_399, channel: 1) == sourceSample(2, 4_799, 1),
    "The excerpt's own first and last frames are not joins and must keep their full amplitude")
precondition(
    rampedWave.sample(frame: 4_799, channel: 0) == 0 && rampedWave.sample(frame: 4_800, channel: 0) == 0
        && rampedWave.sample(frame: 9_599, channel: 0) == 0 && rampedWave.sample(frame: 9_600, channel: 0) == 0,
    "Both joins must reach silence on each side")
precondition(
    abs(rampedWave.sample(frame: 4_920, channel: 0) - sourceSample(1, 120, 0) * 120 / 240) < 1e-6
        && abs(rampedWave.sample(frame: 4_680, channel: 0) - sourceSample(0, 4_680, 0) * 119 / 240) < 1e-6
        && rampedWave.sample(frame: 5_040, channel: 0) == sourceSample(1, 240, 0),
    "The join ramp must be linear over 240 frames and full amplitude immediately after it")

// Spans shorter than two ramps clamp to half their own length and still keep every frame.
let shortSpans = (0..<3).map {
    SourceSpan(startUs: 1_000_000 + Int64($0) * 300_000, endUs: 1_006_000 + Int64($0) * 300_000)
}
let (clamped, clampedWave) = try await excerpt(
    "short-span-ramps", tracks: [plan(.narration, narration)], spans: shortSpans)
precondition(
    clamped.frames == 864 && clamped.durationUs == 18_000,
    "A 6000us span clamps its ramps but keeps all 288 frames, got \(clamped)")
assertMatches(
    clampedWave, expectedExcerpt(of: [(narrationTone, 0)], spans: shortSpans, sampleRate: rate, channels: 2),
    "clamped ramps")
func shortSource(_ span: Int, _ offset: Int, _ channel: Int) -> Float {
    narrationTone.sample(
        frame: narrationTone.frame(ofUs: shortSpans[span].startUs) + offset, channel: channel)
}
// The middle span is 288 frames with 144-frame ramps: the fade-in ends exactly where the fade-out
// begins, so no frame is attenuated twice and none is skipped.
precondition(
    abs(clampedWave.sample(frame: 288 + 143, channel: 0) - shortSource(1, 143, 0) * 143 / 144) < 1e-6
        && abs(clampedWave.sample(frame: 288 + 144, channel: 0) - shortSource(1, 144, 0) * 143 / 144) < 1e-6,
    "A clamped fade-in and fade-out must meet without overlapping, got \(clampedWave.sample(frame: 431, channel: 0)) and \(clampedWave.sample(frame: 432, channel: 0))")
print("PASS join ramps are linear, clamp to half a short span, and never shorten the excerpt")

// A track whose media survives only in two intervals, the shape a recovered capture has. Empty
// edits read back as silence, so the excerpt has to decide absence from the edit list itself.
let gapped = evidence.appendingPathComponent("gapped.mov")
try await FixtureAudioWriter.writeGapped(
    from: narration,
    occupied: [
        (CMTimeRange(start: CMTime(value: 1, timescale: 1), duration: CMTime(value: 1, timescale: 1)), CMTime(value: 1, timescale: 1)),
        (CMTimeRange(start: CMTime(value: 4, timescale: 1), duration: CMTime(value: 1, timescale: 1)), CMTime(value: 4, timescale: 1)),
    ], to: gapped, duration: CMTime(value: 6, timescale: 1))
let (recovered, recoveredWave) = try await excerpt(
    "edit-list-gaps", tracks: [plan(.narration, gapped)],
    spans: [SourceSpan(startUs: 500_000, endUs: 5_500_000)])
precondition(
    recovered.frames == 240_000 && recovered.tracks[0].unavailable == [
        SourceSpan(startUs: 500_000, endUs: 1_000_000),
        SourceSpan(startUs: 2_000_000, endUs: 4_000_000),
        SourceSpan(startUs: 5_000_000, endUs: 5_500_000),
    ], "Empty edits inside a requested span must be reported as unavailable, got \(recovered)")
for (start, count) in [(0, 24_000), (72_000, 96_000), (216_000, 24_000)] {
    precondition(
        recoveredWave.peak(from: start, count: count) == 0,
        "Unavailable material must be silent at output frame \(start), got \(recoveredWave.peak(from: start, count: count))")
}
for (outputStart, sourceUs) in [(24_000, Int64(1_000_000)), (168_000, Int64(4_000_000))] {
    for offset in stride(from: 0, to: 48_000, by: 211) {
        for channel in 0..<2 {
            precondition(
                abs(recoveredWave.sample(frame: outputStart + offset, channel: channel)
                    - narrationTone.sample(frame: narrationTone.frame(ofUs: sourceUs) + offset, channel: channel)) < 1e-6,
                "Surviving media must land at the output frame its recording time names, frame \(outputStart + offset)")
        }
    }
}
// Recorded quiet is not absence: narration is genuinely silent from 5.0s to 5.5s, and that region
// is inside a surviving edit of its own file.
let (quiet, quietWave) = try await excerpt(
    "recorded-silence", tracks: [plan(.narration, narration)],
    spans: [SourceSpan(startUs: 5_000_000, endUs: 5_400_000)])
precondition(
    quiet.tracks[0].unavailable.isEmpty && quietWave.peak(from: 0, count: 19_200) == 0,
    "Recorded silence must read as available and silent, got \(quiet.tracks[0].unavailable)")
print("PASS empty edits are reported unavailable while recorded silence stays available")

// A narrower, slower track mixed with a wider, faster one.
let monoTone = FixtureTone(
    frequencies: [800], sampleRate: 44_100, stampFrames: Int(4 * 44_100), markedUs: nil, silentUs: nil)
let mono = evidence.appendingPathComponent("mono-44k.mov")
try await FixtureAudioWriter.write(monoTone, frames: Int(4 * 44_100), to: mono)

let (monoAlone, monoWave) = try await excerpt(
    "mono-alone", tracks: [plan(.system, mono)],
    spans: [SourceSpan(startUs: 500_000, endUs: 1_000_000)])
precondition(
    monoAlone.sampleRate == 44_100 && monoAlone.channels == 1 && monoAlone.frames == 22_050
        && monoWave.sampleRate == 44_100 && monoWave.channels == 1,
    "A lone 44100 Hz mono track keeps its own rate and channel count, got \(monoAlone)")
assertMatches(
    monoWave,
    expectedExcerpt(
        of: [(monoTone, 0)], spans: [SourceSpan(startUs: 500_000, endUs: 1_000_000)],
        sampleRate: 44_100, channels: 1), "mono alone")

let (widened, widenedWave) = try await excerpt(
    "mono-mixed", tracks: [plan(.narration, narration), plan(.system, mono)], spans: mixedSpans)
precondition(
    widened.sampleRate == 48_000 && widened.channels == 2 && widened.frames == 24_000
        && widened.tracks.map(\.sampleRate) == [48_000, 44_100]
        && widened.tracks.map(\.channels) == [2, 1],
    "The output takes the widest planned rate and channel count while reporting each source's own, got \(widened)")
let left = widenedWave.magnitude(ofHz: 800, channel: 0, from: 1_000, count: 8_000)
let right = widenedWave.magnitude(ofHz: 800, channel: 1, from: 1_000, count: 8_000)
precondition(
    left > 0.05 && abs(left - right) < 0.01,
    "A mono track must reach both output channels equally, got \(left) and \(right)")
precondition(
    widenedWave.magnitude(ofHz: 1_000, channel: 0, from: 1_000, count: 8_000) > 0.1
        && widenedWave.magnitude(ofHz: 1_000, channel: 1, from: 1_000, count: 8_000) < 0.02,
    "Widening a mono track must not blur the stereo track's own channels")
print("PASS the output takes the widest planned format and a mono track feeds both channels")

func failure(_ body: () async throws -> Void) async -> AudioFailure? {
    do {
        try await body()
        return nil
    } catch let error as AudioFailure {
        return error
    } catch {
        return AudioFailure("UNEXPECTED", "\(error)")
    }
}

let atLimit = try await AudioExcerpts.write(
    AudioExcerptRequest(
        tracks: [plan(.narration, narration)],
        spans: [
            SourceSpan(startUs: 0, endUs: 7_000_000),
            SourceSpan(startUs: 7_500_000, endUs: 30_500_000),
        ], output: evidence.appendingPathComponent("at-limit.wav")))
precondition(
    atLimit.durationUs == 30_000_000 && atLimit.frames == 1_440_000,
    "Spans totalling exactly the 30 second bound must be accepted, got \(atLimit)")
let overLimit = await failure {
    _ = try await AudioExcerpts.write(
        AudioExcerptRequest(
            tracks: [plan(.narration, narration)],
            spans: [
                SourceSpan(startUs: 0, endUs: 7_000_000),
                SourceSpan(startUs: 7_500_000, endUs: 30_500_001),
            ], output: evidence.appendingPathComponent("over-limit.wav")))
}
precondition(
    overLimit?.code == "LIMIT_EXCEEDED",
    "One microsecond past the 30 second bound must be refused, got \(String(describing: overLimit))")
precondition(
    !FileManager.default.fileExists(atPath: evidence.appendingPathComponent("over-limit.wav").path),
    "A refused excerpt must not leave an output file behind")
print("PASS the excerpt bound accepts exactly 30 seconds and refuses 30.000001")

let sourceBefore = try Data(contentsOf: narration)
let valid = [SourceSpan(startUs: 1_000_000, endUs: 1_500_000)]
let output = evidence.appendingPathComponent("rejected.wav")
func reject(_ tracks: [AudioTrackPlan], _ spans: [SourceSpan], to destination: URL = output) async -> AudioFailure? {
    await failure {
        _ = try await AudioExcerpts.write(
            AudioExcerptRequest(tracks: tracks, spans: spans, output: destination))
    }
}
let junk = evidence.appendingPathComponent("not-media.mov")
try Data("not media".utf8).write(to: junk)
let occupied = evidence.appendingPathComponent("occupied.wav")
try? FileManager.default.removeItem(at: occupied)
try FileManager.default.createDirectory(at: occupied, withIntermediateDirectories: true)
let aliasDirectory = evidence.appendingPathComponent("source-alias")
try? FileManager.default.removeItem(at: aliasDirectory)
try FileManager.default.createSymbolicLink(at: aliasDirectory, withDestinationURL: evidence)

let rejected: [String: (String, AudioFailure?)] = await [
    "no tracks": ("INVALID_REQUEST", reject([], valid)),
    "repeated role": (
        "INVALID_REQUEST", reject([plan(.narration, narration), plan(.narration, system)], valid)
    ),
    "more tracks than roles": (
        "INVALID_REQUEST",
        reject([plan(.narration, narration), plan(.system, system), plan(.system, system)], valid)
    ),
    "relative source": (
        "INVALID_REQUEST",
        reject([AudioTrackPlan(role: .narration, source: "narration.mov", sourceOffsetUs: 0)], valid)
    ),
    "no spans": ("INVALID_RANGE", reject([plan(.narration, narration)], [])),
    "most negative offset": (
        "INVALID_RANGE", reject([plan(.narration, narration, offsetUs: .min)], valid)
    ),
    "most positive offset": (
        "INVALID_RANGE", reject([plan(.narration, narration, offsetUs: .max)], valid)
    ),
    "reversed span": (
        "INVALID_RANGE",
        reject([plan(.narration, narration)], [SourceSpan(startUs: 900_000, endUs: 400_000)])
    ),
    "empty span": (
        "INVALID_RANGE",
        reject([plan(.narration, narration)], [SourceSpan(startUs: 500_000, endUs: 500_000)])
    ),
    "negative span": (
        "INVALID_RANGE",
        reject([plan(.narration, narration)], [SourceSpan(startUs: -1, endUs: 400_000)])
    ),
    "unsafe span": (
        "INVALID_RANGE",
        reject(
            [plan(.narration, narration)],
            [SourceSpan(startUs: 0, endUs: AudioLimits.maximumMicroseconds + 1)])
    ),
    "descending spans": (
        "INVALID_RANGE",
        reject(
            [plan(.narration, narration)],
            [SourceSpan(startUs: 2_000_000, endUs: 2_500_000), SourceSpan(startUs: 1_000_000, endUs: 1_500_000)])
    ),
    "overlapping spans": (
        "INVALID_RANGE",
        reject(
            [plan(.narration, narration)],
            [SourceSpan(startUs: 1_000_000, endUs: 1_500_000), SourceSpan(startUs: 1_400_000, endUs: 1_800_000)])
    ),
    // Adjacent spans would have been unioned into one retained interval, so accepting them would
    // ramp a join that no cut created.
    "touching spans": (
        "INVALID_RANGE",
        reject(
            [plan(.narration, narration)],
            [SourceSpan(startUs: 1_000_000, endUs: 1_500_000), SourceSpan(startUs: 1_500_000, endUs: 1_800_000)])
    ),
    "too many spans": (
        "LIMIT_EXCEEDED",
        reject(
            [plan(.narration, narration)],
            (0..<(AudioLimits.maximumSpans + 1)).map {
                SourceSpan(startUs: Int64($0) * 20, endUs: Int64($0) * 20 + 10)
            })
    ),
    "output that is not a wave file": (
        "INVALID_OUTPUT",
        reject([plan(.narration, narration)], valid, to: evidence.appendingPathComponent("excerpt.caf"))
    ),
    "output over the source": (
        "INVALID_OUTPUT", reject([plan(.narration, narration)], valid, to: narration)
    ),
    "output over a source alias": (
        "INVALID_OUTPUT",
        reject(
            [plan(.narration, narration)], valid,
            to: aliasDirectory.appendingPathComponent(narration.lastPathComponent))
    ),
    "output path that is a directory": (
        "INVALID_OUTPUT", reject([plan(.narration, narration)], valid, to: occupied)
    ),
    "missing source": (
        "NATIVE_DECODE_FAILED",
        reject([plan(.narration, evidence.appendingPathComponent("absent.mov"))], valid)
    ),
    "source that is not media": ("NATIVE_DECODE_FAILED", reject([plan(.narration, junk)], valid)),
]
for (name, expectation) in rejected.sorted(by: { $0.key < $1.key }) {
    precondition(
        expectation.1?.code == expectation.0,
        "\(name) must be rejected as \(expectation.0), got \(String(describing: expectation.1))")
}
try FileManager.default.removeItem(at: aliasDirectory)
let sourceAfter = try Data(contentsOf: narration)
precondition(
    sourceAfter == sourceBefore, "Rejected requests must not touch the source media")
// Excerpts are published by moving a completed staging file into place, so a refused or failed
// write leaves neither a truncated output nor staging litter.
let litter = try FileManager.default.contentsOfDirectory(atPath: evidence.path).filter {
    $0.hasPrefix(".")
}
var stillDirectory: ObjCBool = false
precondition(
    litter.isEmpty && !FileManager.default.fileExists(atPath: output.path)
        && FileManager.default.fileExists(atPath: occupied.path, isDirectory: &stillDirectory)
        && stillDirectory.boolValue,
    "Failed excerpts must leave no output or staging file and must not replace a directory, found \(litter)")
print("PASS \(rejected.count) invalid requests are refused and the source media is unchanged")
