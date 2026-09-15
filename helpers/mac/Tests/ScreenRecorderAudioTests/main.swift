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

/// Acquisition evidence wide enough to cover every fixture: capture was running throughout, so the
/// file's own occupied segments decide what is readable. Tests about acquisition state their own.
let capturedThroughout = [SourceSpan(startUs: -60_000_000, endUs: 60_000_000)]

func plan(
    _ role: AudioRole, _ url: URL, offsetUs: Int64 = 0, available: [SourceSpan] = capturedThroughout
) -> AudioTrackPlan {
    AudioTrackPlan(role: role, source: url.path, sourceOffsetUs: offsetUs, available: available)
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

/// One planned track of a converted excerpt, stated from the fixture that produced it.
struct PlannedTone {
    let tone: FixtureTone
    let offsetUs: Int64
    let available: [SourceSpan]
    init(_ tone: FixtureTone, offsetUs: Int64 = 0, available: [SourceSpan] = capturedThroughout) {
        self.tone = tone
        self.offsetUs = offsetUs
        self.available = available
    }
}

/// The excerpt a correct conversion owes, stated from the fixture definitions rather than from any
/// converter: every output frame holds the tone its own time names, whatever rate its track was
/// recorded at. Each selected interval is converted from its own first source frame, so an interval
/// that stops short of the frames it owes, starts a frame away, or fills with silence shows up at
/// every frame it touches.
///
/// `edges` names the frames at either end of a converted interval. A converter holds no material
/// past the boundary of the interval it was given, so it answers those frames from what its filter
/// carries; they are pinned to a share of the converted material they owe, which `converted` states
/// on its own, rather than to the summed sample. Every other frame, the excerpt's own first and last
/// included, is pinned outright.
struct ConversionReference {
    let samples: [Float]
    /// The part of each sample that came from a track recorded at another rate.
    let converted: [Float]
    let edges: Set<Int>
}

func expectedConversion(
    of planned: [PlannedTone], spans: [SourceSpan], sampleRate: Double, channels: Int
) -> ConversionReference {
    func frames(ofUs us: Int64) -> Int { Int((Double(us) / 1_000_000 * sampleRate).rounded()) }
    let gain: Float = planned.count == 1 ? 1 : 0.5
    // Every boundary is quantised once from cumulative playback time, as the excerpt places them.
    var playedUs: Int64 = 0
    var starts = [0]
    for span in spans {
        playedUs += span.endUs - span.startUs
        starts.append(frames(ofUs: playedUs))
    }
    var samples = [Float](repeating: 0, count: starts.last! * channels)
    var converted = samples
    var edges: Set<Int> = []
    playedUs = 0
    for (index, span) in spans.enumerated() {
        for track in planned {
            for acquired in track.available {
                let startUs = max(acquired.startUs, span.startUs)
                let endUs = min(acquired.endUs, span.endUs)
                guard endUs > startUs else { continue }
                let from = frames(ofUs: playedUs + (startUs - span.startUs))
                let to = frames(ofUs: playedUs + (endUs - span.startUs))
                let source = Double(track.tone.frame(ofUs: startUs - track.offsetUs))
                let step = track.tone.sampleRate / sampleRate
                let resampled = track.tone.sampleRate != sampleRate
                for frame in from..<to {
                    for channel in 0..<channels {
                        let value =
                            gain
                            * track.tone.value(
                                atFrame: source + Double(frame - from) * step,
                                channel: min(channel, track.tone.channels - 1))
                        samples[frame * channels + channel] += value
                        if resampled { converted[frame * channels + channel] += value }
                    }
                }
                if resampled {
                    edges.formUnion(from..<min(from + conversionEdgeFrames, to))
                    edges.formUnion(max(from, to - conversionEdgeFrames)..<to)
                }
            }
        }
        // Ramps scale whatever the span holds, the silence of an acquisition hole included.
        let spanFrames = starts[index + 1] - starts[index]
        let ramp = min(frames(ofUs: 5_000), spanFrames / 2)
        for offset in 0..<spanFrames {
            var envelope: Float = 1
            if index > 0 && offset < ramp { envelope *= Float(offset) / Float(ramp) }
            if index < spans.count - 1 && offset >= spanFrames - ramp {
                envelope *= Float(spanFrames - 1 - offset) / Float(ramp)
            }
            guard envelope != 1 else { continue }
            for channel in 0..<channels {
                samples[(starts[index] + offset) * channels + channel] *= envelope
                converted[(starts[index] + offset) * channels + channel] *= envelope
            }
        }
        playedUs += span.endUs - span.startUs
    }
    return ConversionReference(samples: samples, converted: converted, edges: edges)
}

/// How far a conversion may sit from the sample it owes. A source frame does not land on an output
/// frame across rates, so a converter states the sample in between and no two of them round it
/// identically. This is quantisation, not absence: measured at 8.1e-4 over these excerpts.
let conversionTolerance: Float = 2e-3
/// The frames at either end of a converted interval, and the share of its own material one may lose
/// to the boundary it was computed against. Measured at 15 percent of the frame it owes, over five
/// frames of a 1.378125 ratio; a conversion that stops at its last full buffer loses all of it.
let conversionEdgeFrames = 8
let conversionEdgeShare: Float = 0.25

/// Compares every frame of an excerpt against what a correct conversion owes, and reports the worst
/// deviation of each kind so the conversion's own quantisation stays visible rather than implied.
func assertConverted(
    _ wave: FixtureWave, _ reference: ConversionReference, _ description: String
) -> (interior: Float, edgeShare: Float) {
    precondition(
        wave.samples.count == reference.samples.count,
        "\(description): expected \(reference.samples.count) interleaved samples, got \(wave.samples.count)")
    var worst: (interior: Float, edgeShare: Float) = (0, 0)
    for index in 0..<reference.samples.count {
        let owed = reference.samples[index]
        let deviation = abs(wave.samples[index] - owed)
        let frame = index / wave.channels
        if reference.edges.contains(frame) {
            // Measured against the converted material itself, with the tolerance as a floor: an edge
            // frame keeps what it owes, while a tail that was never delivered loses all of it.
            let owedByConversion = abs(reference.converted[index])
            precondition(
                deviation <= max(conversionEdgeShare * owedByConversion, conversionTolerance),
                "\(description): edge frame \(frame) channel \(index % wave.channels) owes \(owed) including \(reference.converted[index]) converted, got \(wave.samples[index])")
            if owedByConversion > conversionTolerance {
                worst.edgeShare = max(worst.edgeShare, deviation / owedByConversion)
            }
        } else {
            precondition(
                deviation < conversionTolerance,
                "\(description): frame \(frame) channel \(index % wave.channels) owes \(owed), got \(wave.samples[index])")
            worst.interior = max(worst.interior, deviation)
        }
    }
    return worst
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
    joinedWave, expectedConversion(of: [PlannedTone(narrationTone)], spans: disjoint, sampleRate: rate, channels: 2).samples,
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
    aloneWave, expectedConversion(of: [PlannedTone(systemTone)], spans: mixedSpans, sampleRate: rate, channels: 2).samples,
    "system alone")
precondition(alone.tracks[0].gain == 1, "A lone system track plays at unity, got \(alone.tracks)")

let (mixed, mixedWave) = try await excerpt(
    "mixed", tracks: [plan(.narration, narration), plan(.system, system)], spans: mixedSpans)
precondition(
    mixed.tracks.map(\.gain) == [0.5, 0.5],
    "Two summed tracks each play at half gain, got \(mixed.tracks.map(\.gain))")
assertMatches(
    mixedWave,
    expectedConversion(
        of: [PlannedTone(narrationTone), PlannedTone(systemTone)], spans: mixedSpans,
        sampleRate: rate, channels: 2
    ).samples,
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
    rampedWave, expectedConversion(of: [PlannedTone(narrationTone)], spans: joinSpans, sampleRate: rate, channels: 2)
        .samples,
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
    clampedWave, expectedConversion(of: [PlannedTone(narrationTone)], spans: shortSpans, sampleRate: rate, channels: 2)
        .samples,
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
    expectedConversion(
        of: [PlannedTone(monoTone)], spans: [SourceSpan(startUs: 500_000, endUs: 1_000_000)],
        sampleRate: 44_100, channels: 1
    ).samples, "mono alone")

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

// Upsampling under everything the excerpt already owes: several retained spans, durations that are
// not whole frames, a span shorter than one output frame, both gains, and the join ramps. Span
// boundaries are whole milliseconds, so each track's material starts on a frame of its own file and
// the reference states one unambiguous source position per output frame.
let convertedSpans = [
    SourceSpan(startUs: 500_000, endUs: 510_010),
    SourceSpan(startUs: 1_000_000, endUs: 1_003_333),
    SourceSpan(startUs: 1_200_000, endUs: 1_200_010),
    SourceSpan(startUs: 2_600_000, endUs: 3_100_517),
]
let (upsampled, upsampledWave) = try await excerpt(
    "converted-upsampled", tracks: [plan(.narration, narration), plan(.system, mono)],
    spans: convertedSpans)
precondition(
    upsampled.sampleRate == 48_000 && upsampled.channels == 2 && upsampled.frames == 24_666
        && upsampled.durationUs == 513_875 && upsampled.tracks.allSatisfy { $0.unavailable.isEmpty },
    "The converted excerpt owes every frame of its 513870 us of spans, got \(upsampled)")
let upsampledReference = expectedConversion(
    of: [PlannedTone(narrationTone), PlannedTone(monoTone)], spans: convertedSpans, sampleRate: rate,
    channels: 2)
let upsampledWorst = assertConverted(upsampledWave, upsampledReference, "upsampled mix")
// What a converter that stops at its last converted buffer loses: the frames its filter still owes
// when the input ends. They are interior material in every span but the last, where they are the
// excerpt's own final frames, so the comparison above must be able to see them.
let withoutSlower = expectedConversion(
    of: [PlannedTone(narrationTone), PlannedTone(monoTone, available: [])], spans: convertedSpans,
    sampleRate: rate, channels: 2)
var tailMaterial: Float = 0
for frame in (Int(upsampled.frames) - 20)..<Int(upsampled.frames) {
    for channel in 0..<2 {
        let index = frame * 2 + channel
        tailMaterial = max(
            tailMaterial, abs(upsampledReference.samples[index] - withoutSlower.samples[index]))
    }
}
precondition(
    tailMaterial > 0.05,
    "The last 20 frames must owe the 44100 Hz track material a dropped tail would lose, got \(tailMaterial)")
print(
    "PASS an upsampled mix holds every frame of every span, worst deviation \(upsampledWorst.interior) and edge share \(upsampledWorst.edgeShare)"
)

// Cumulative quantisation can round a span's last output frame up past the material the span's own
// microseconds hold: 1459 us of a 44100 Hz track carries 70 frames of 48000 Hz output, and placed
// after 1010 us of playback the excerpt owns 71 of them there. The conversion is given the playback
// its output frames own rather than the span's own microseconds for that reason — reading the span
// alone leaves that frame undeliverable, and the interval fails rather than fabricating it.
let quantisedSpans = [
    SourceSpan(startUs: 1_000_000, endUs: 1_001_010),
    SourceSpan(startUs: 2_600_000, endUs: 2_601_459),
]
let (quantised, quantisedWave) = try await excerpt(
    "converted-quantised", tracks: [plan(.narration, narration), plan(.system, mono)],
    spans: quantisedSpans)
precondition(
    quantised.frames == 119 && quantisedWave.frames == 119,
    "1010 us and 1459 us of playback quantise to 48 and 71 frames, got \(quantised.frames)")
let quantisedWorst = assertConverted(
    quantisedWave,
    expectedConversion(
        of: [PlannedTone(narrationTone), PlannedTone(monoTone)], spans: quantisedSpans,
        sampleRate: rate, channels: 2), "quantised spans")
print(
    "PASS a span quantised past its own microseconds still owes every frame, worst deviation \(quantisedWorst.interior) and edge share \(quantisedWorst.edgeShare)"
)

// Two rates that are neither each other nor the excerpt's usual one: a 32000 Hz stereo track and a
// 44100 Hz mono track make a 44100 Hz stereo excerpt, so one track is converted at a ratio of
// 1.378125 while the other passes through into both channels.
let slowTone = FixtureTone(
    frequencies: [700, 900], sampleRate: 32_000, stampFrames: Int(3 * 32_000), markedUs: nil,
    silentUs: nil)
let slow = evidence.appendingPathComponent("slow-32k.mov")
try await FixtureAudioWriter.write(slowTone, frames: Int(3 * 32_000), to: slow)
let unequalSpans = [
    SourceSpan(startUs: 300_000, endUs: 800_000), SourceSpan(startUs: 1_500_000, endUs: 1_507_770),
]
let (unequal, unequalWave) = try await excerpt(
    "converted-unequal", tracks: [plan(.narration, slow), plan(.system, mono)], spans: unequalSpans)
precondition(
    unequal.sampleRate == 44_100 && unequal.channels == 2 && unequal.frames == 22_393
        && unequal.tracks.map(\.sampleRate) == [32_000, 44_100]
        && unequal.tracks.allSatisfy { $0.unavailable.isEmpty },
    "Unequal rates make a 44100 Hz stereo excerpt of 22393 frames, got \(unequal)")
let unequalReference = expectedConversion(
    of: [PlannedTone(slowTone), PlannedTone(monoTone)], spans: unequalSpans, sampleRate: 44_100,
    channels: 2)
let unequalWorst = assertConverted(unequalWave, unequalReference, "unequal rates")
print(
    "PASS unequal rates convert into the wider one, worst deviation \(unequalWorst.interior) and edge share \(unequalWorst.edgeShare)"
)

// A hole in acquisition cuts one span into two selected intervals, each converted on its own. The
// tail of the first interval is interior to the excerpt, where silence left by a short conversion
// would be invisible to a peak or a frequency check.
let interrupted = [
    SourceSpan(startUs: -60_000_000, endUs: 1_200_000), SourceSpan(startUs: 1_300_000, endUs: 60_000_000),
]
let (acrossHole, acrossHoleWave) = try await excerpt(
    "converted-hole", tracks: [plan(.narration, narration), plan(.system, mono, available: interrupted)],
    spans: mixedSpans)
precondition(
    acrossHole.frames == 24_000
        && acrossHole.tracks[1].unavailable == [SourceSpan(startUs: 1_200_000, endUs: 1_300_000)],
    "The unacquired 100000 us must be reported against a full length excerpt, got \(acrossHole)")
let holeReference = expectedConversion(
    of: [PlannedTone(narrationTone), PlannedTone(monoTone, available: interrupted)], spans: mixedSpans,
    sampleRate: rate, channels: 2)
let holeWorst = assertConverted(
    acrossHoleWave, holeReference, "converted across an acquisition hole")
print(
    "PASS each interval either side of an acquisition hole is converted whole, worst deviation \(holeWorst.interior) and edge share \(holeWorst.edgeShare)"
)

// A four channel file, each channel carrying its own tone. Capture records mono or stereo, so the
// excerpt has no layout to state for this one: the only ways to answer it are to invent a spatial
// placement nobody recorded or to drop channels, and it refuses instead.
let quadTone = FixtureTone(
    frequencies: [300, 500, 700, 900], sampleRate: rate, stampFrames: Int(rate), markedUs: nil,
    silentUs: nil)
let quad = evidence.appendingPathComponent("quad.mov")
try await FixtureAudioWriter.write(quadTone, frames: Int(rate), to: quad)
let quadSpans = [SourceSpan(startUs: 100_000, endUs: 600_000)]
func layoutRefusal(_ name: String, _ tracks: [AudioTrackPlan]) async -> AudioFailure? {
    await failure {
        _ = try await AudioExcerpts.write(
            AudioExcerptRequest(
                tracks: tracks, spans: quadSpans,
                output: evidence.appendingPathComponent("\(name).wav")))
    }
}
for (name, tracks) in [
    ("quad-alone", [plan(.system, quad)]),
    ("stereo-into-quad", [plan(.narration, narration), plan(.system, quad)]),
    ("mono-into-quad", [plan(.narration, mono), plan(.system, quad)]),
] {
    let refusal = await layoutRefusal(name, tracks)
    precondition(
        refusal?.code == "UNSUPPORTED_FORMAT",
        "\(name) has no honest channel mapping and must be refused, got \(String(describing: refusal))")
    precondition(
        !FileManager.default.fileExists(atPath: evidence.appendingPathComponent("\(name).wav").path),
        "A refused layout must not leave an output file behind")
}
// The mono and stereo contract the capture actually produces still maps: a mono track is heard on
// both sides of a stereo excerpt, and a stereo track keeps its own two channels.
precondition(
    widened.channels == 2 && monoAlone.channels == 1,
    "Mono and stereo excerpts stay supported, got \(widened.channels) and \(monoAlone.channels)")
print("PASS mono and stereo map through and a layout with no honest mapping is refused")

// Spans that are not a whole number of frames: at 48 kHz 10010 us is 480.48 frames. Quantising
// each span on its own would drop that fraction 700 times over and hand back an excerpt a third of
// a second short of the timeline the agent asked for, with every span after the first misplaced.
let fractionalSpans = (0..<700).map {
    SourceSpan(startUs: Int64($0) * 11_000, endUs: Int64($0) * 11_000 + 10_010)
}
let (fractional, fractionalWave) = try await excerpt(
    "fractional-spans", tracks: [plan(.narration, narration)], spans: fractionalSpans)
precondition(
    fractional.frames == 336_336 && fractional.durationUs == 7_007_000,
    "700 spans of 10010 us must hold 336336 frames of 7007000 us, got \(fractional)")
precondition(
    fractional.frames - 700 * 480 == 336,
    "Per-span quantisation would have lost 336 frames; this excerpt must not")
assertMatches(
    fractionalWave,
    expectedConversion(of: [PlannedTone(narrationTone)], spans: fractionalSpans, sampleRate: rate, channels: 2)
        .samples,
    "fractional spans")
// Placement is stated from cumulative playback time, so the last span's material is where 6.996
// seconds of playback puts it, not 336 frames earlier.
let lastStart = Int((Double(699 * 10_010) / 1_000_000 * rate).rounded())
precondition(lastStart == 335_856, "The last span opens at frame 335856, not \(lastStart)")
// Past its 240 frame fade-in, the last span carries its own material at full amplitude.
for offset in [240, 300, 400] {
    for channel in 0..<2 {
        let expected = narrationTone.sample(
            frame: narrationTone.frame(ofUs: fractionalSpans[699].startUs) + offset, channel: channel)
        precondition(
            abs(fractionalWave.sample(frame: lastStart + offset, channel: channel) - expected) < 1e-6,
            "The last span must start at output frame \(lastStart), offset \(offset) channel \(channel)")
    }
}
// A span shorter than a single frame still costs its own playback time, and the excerpt still ends
// where the requested total says.
let subFrameSpans = (0..<8).map {
    SourceSpan(startUs: Int64($0) * 1_000_000, endUs: Int64($0) * 1_000_000 + 10)
}
let (subFrame, subFrameWave) = try await excerpt(
    "sub-frame-spans", tracks: [plan(.narration, narration)], spans: subFrameSpans)
precondition(
    subFrame.frames == 4 && subFrame.durationUs == 83 && subFrameWave.frames == 4,
    "Eight 10 us spans total 80 us, which is 4 frames at 48 kHz, got \(subFrame)")
print("PASS spans that are not whole frames neither accumulate drift nor lose their playback time")

// Acquisition evidence the container cannot supply. The system fixture holds loud material over
// its whole length and has no empty edit, so a decoder answers every range it is asked for; only
// the caller knows that nothing was being captured between 3.00001 s and 3.5 s. The hole opens
// half a frame from a frame boundary, where a decoder hands back one sample more than the interval
// holds, so the excerpt has to stop at the interval's own end and not at the span's.
let acquired = [
    SourceSpan(startUs: 0, endUs: 3_000_010), SourceSpan(startUs: 3_500_000, endUs: 8_000_000),
]
let holeSpans = [SourceSpan(startUs: 2_500_000, endUs: 4_000_000)]
let (holed, holedWave) = try await excerpt(
    "acquisition-hole", tracks: [plan(.system, system, available: acquired)], spans: holeSpans)
precondition(
    holed.frames == 72_000
        && holed.tracks[0].unavailable == [SourceSpan(startUs: 3_000_010, endUs: 3_500_000)],
    "The interval nothing was captured over must be reported exactly, got \(holed)")
var holeSourcePeak: Float = 0
for frame in systemTone.frame(ofUs: 3_000_010)..<systemTone.frame(ofUs: 3_500_000) {
    for channel in 0..<2 { holeSourcePeak = max(holeSourcePeak, abs(systemTone.sample(frame: frame, channel: channel))) }
}
precondition(
    holeSourcePeak > 0.1,
    "The source must be loud across the hole for its silence to mean anything, got \(holeSourcePeak)")
precondition(
    holedWave.peak(from: 24_000, count: 24_000) == 0,
    "A known acquisition hole must be silent however much the container will decode there, got \(holedWave.peak(from: 24_000, count: 24_000))")
// Available material either side is complete to the boundary frame: the hole is not paid for by
// truncating what was captured, and no padding creeps across the edge.
for (outputStart, sourceUs) in [(0, Int64(2_500_000)), (48_000, Int64(3_500_000))] {
    for offset in Array(stride(from: 0, to: 24_000, by: 173)) + [23_999] {
        for channel in 0..<2 {
            precondition(
                abs(holedWave.sample(frame: outputStart + offset, channel: channel)
                    - systemTone.sample(frame: systemTone.frame(ofUs: sourceUs) + offset, channel: channel)) < 1e-6,
                "Captured material must survive to the hole's edge, output frame \(outputStart + offset)")
        }
    }
}
// A track nothing was acquired for is a success whose report covers every requested span.
let (nothing, nothingWave) = try await excerpt(
    "nothing-acquired", tracks: [plan(.system, system, available: [])], spans: holeSpans)
precondition(
    nothing.tracks[0].unavailable == holeSpans && nothingWave.peak(from: 0, count: 72_000) == 0
        && nothing.frames == 72_000,
    "A track with no acquired interval must report every span unavailable and be silent, got \(nothing)")

// Availability is recording source time, so it is read through the same offset the media is.
let (lateAvailable, lateAvailableWave) = try await excerpt(
    "availability-positive-offset",
    tracks: [
        plan(
            .narration, narration, offsetUs: 1_000_000,
            available: [SourceSpan(startUs: 1_500_000, endUs: 3_000_000)])
    ], spans: [SourceSpan(startUs: 1_000_000, endUs: 3_500_000)])
precondition(
    lateAvailable.tracks[0].unavailable == [
        SourceSpan(startUs: 1_000_000, endUs: 1_500_000),
        SourceSpan(startUs: 3_000_000, endUs: 3_500_000),
    ], "Acquisition bounds must be read in recording time, got \(lateAvailable.tracks[0].unavailable)")
precondition(
    lateAvailableWave.peak(from: 0, count: 24_000) == 0
        && lateAvailableWave.peak(from: 96_000, count: 24_000) == 0,
    "Unacquired material must be silent on both sides")
for offset in stride(from: 0, to: 72_000, by: 331) {
    for channel in 0..<2 {
        precondition(
            abs(lateAvailableWave.sample(frame: 24_000 + offset, channel: channel)
                - narrationTone.sample(frame: narrationTone.frame(ofUs: 500_000) + offset, channel: channel)) < 1e-6,
            "Acquired material must read the track's own 0.5 s onwards, frame \(offset)")
    }
}
// A track holding material from before recording zero states its acquisition there too.
let (earlyAvailable, earlyAvailableWave) = try await excerpt(
    "availability-negative-offset",
    tracks: [
        plan(
            .narration, narration, offsetUs: -1_000_000,
            available: [SourceSpan(startUs: -500_000, endUs: 500_000)])
    ], spans: [SourceSpan(startUs: 0, endUs: 1_000_000)])
precondition(
    earlyAvailable.tracks[0].unavailable == [SourceSpan(startUs: 500_000, endUs: 1_000_000)],
    "A negative acquisition bound must be honoured, got \(earlyAvailable.tracks[0].unavailable)")
precondition(
    earlyAvailableWave.peak(from: 24_000, count: 24_000) == 0,
    "Material past the acquired interval must be silent")
for offset in stride(from: 0, to: 24_000, by: 173) {
    for channel in 0..<2 {
        precondition(
            abs(earlyAvailableWave.sample(frame: offset, channel: channel)
                - narrationTone.sample(frame: narrationTone.frame(ofUs: 1_000_000) + offset, channel: channel)) < 1e-6,
            "Acquired material before recording zero must read the track's own 1.0 s onwards, frame \(offset)")
    }
}
// Recorded quiet inside an acquired interval is still available: the microphone was open.
let (acquiredQuiet, acquiredQuietWave) = try await excerpt(
    "acquired-silence", tracks: [plan(.narration, narration, available: [SourceSpan(startUs: 0, endUs: 8_000_000)])],
    spans: [SourceSpan(startUs: 5_000_000, endUs: 5_400_000)])
precondition(
    acquiredQuiet.tracks[0].unavailable.isEmpty && acquiredQuietWave.peak(from: 0, count: 19_200) == 0,
    "Recorded silence inside an acquired interval stays available, got \(acquiredQuiet.tracks[0].unavailable)")
print("PASS acquisition evidence decides absence, and the container cannot relabel a hole as silence")


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
        reject(
            [
                AudioTrackPlan(
                    role: .narration, source: "narration.mov", sourceOffsetUs: 0,
                    available: capturedThroughout)
            ], valid)
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
    // Acquisition evidence is held to the shape of the retained spans it is intersected with, so a
    // malformed claim is refused rather than quietly reordered into one.
    "reversed available interval": (
        "INVALID_RANGE",
        reject(
            [plan(.narration, narration, available: [SourceSpan(startUs: 900_000, endUs: 400_000)])],
            valid)
    ),
    "empty available interval": (
        "INVALID_RANGE",
        reject(
            [plan(.narration, narration, available: [SourceSpan(startUs: 500_000, endUs: 500_000)])],
            valid)
    ),
    "touching available intervals": (
        "INVALID_RANGE",
        reject(
            [
                plan(
                    .narration, narration,
                    available: [
                        SourceSpan(startUs: 0, endUs: 1_000_000),
                        SourceSpan(startUs: 1_000_000, endUs: 2_000_000),
                    ])
            ], valid)
    ),
    "descending available intervals": (
        "INVALID_RANGE",
        reject(
            [
                plan(
                    .narration, narration,
                    available: [
                        SourceSpan(startUs: 2_000_000, endUs: 3_000_000),
                        SourceSpan(startUs: 1_000_000, endUs: 1_500_000),
                    ])
            ], valid)
    ),
    "unsafe available interval": (
        "INVALID_RANGE",
        reject(
            [
                plan(
                    .narration, narration,
                    available: [SourceSpan(startUs: 0, endUs: AudioLimits.maximumMicroseconds + 1)])
            ], valid)
    ),
    "unsafe negative available interval": (
        "INVALID_RANGE",
        reject(
            [
                plan(
                    .narration, narration,
                    available: [SourceSpan(startUs: -AudioLimits.maximumMicroseconds - 1, endUs: 0)])
            ], valid)
    ),
    "too many available intervals": (
        "LIMIT_EXCEEDED",
        reject(
            [
                plan(
                    .narration, narration,
                    available: (0..<(AudioLimits.maximumAvailableIntervals + 1)).map {
                        SourceSpan(startUs: Int64($0) * 20, endUs: Int64($0) * 20 + 10)
                    })
            ], valid)
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
