import AVFoundation
import CoreMedia
import Foundation
import YapAudio
import YapCapture
import YapMedia

/// Bounded offline candidate: raw timestamp residue and explicit reader masks are distinct inputs.
func runPCMAdmissionProbe(output: String, canonical: String) async throws {
  let origin: Int64 = 100_000_000
  func time(_ firstFrame: Int64, _ rate: Int32, extraNs: Int64 = 0) -> CMTime {
    let ticks = (Int128(firstFrame) * 1_000_000_000 + Int128(rate) / 2) / Int128(rate)
    return CMTime(
      value: (origin + 100_000) * 1000 + Int64(ticks) + extraNs, timescale: 1_000_000_000)
  }
  func fresh() -> CaptureClock {
    var c = CaptureClock()
    precondition(c.start(at: origin))
    return c
  }
  let directory = URL(fileURLWithPath: output)
  try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
  var cases: [[String: Any]] = []
  for rate: Int32 in [44100, 48000] {
    var grouped: [[Int64]] = []
    for chunk: Int64 in [1024, 8192] {
      var clock = fresh()
      var first: Int64 = 0
      var joins = 0
      var addresses: [Int64] = []
      while first < Int64(rate) * 2 {
        let count = min(chunk, Int64(rate) * 2 - first)
        let p = try clock.recordAcceptedPCM(
          role: "narration", hostPTS: time(first, rate), frames: count, rate: rate)!
        precondition(p.anchorUs == 100000 && p.firstFrame == first)
        if p.joinsPrevious { joins += 1 }
        addresses.append(contentsOf: p.firstFrame..<(p.firstFrame + count))
        first += count
      }
      let runs = Int((first + chunk - 1) / chunk) - joins
      precondition(runs == 1)
      grouped.append(addresses)
      cases.append([
        "name": "grouping", "rate": rate, "chunk": chunk, "frames": first, "runs": runs,
        "joins": joins,
      ])
    }
    precondition(grouped[0] == grouped[1])
  }
  // Skipped/rejected appends do not call recordAcceptedPCM and cannot establish the phase.
  var firstAccepted = fresh()
  let accepted = try firstAccepted.recordAcceptedPCM(
    role: "narration", hostPTS: time(8192, 48000), frames: 8192, rate: 48000)!
  precondition(accepted.anchorUs == 270667 && accepted.firstFrame == 0)
  cases.append([
    "name": "first-accepted-phase", "anchorUs": accepted.anchorUs,
    "firstFrame": accepted.firstFrame,
  ])
  var offsetClock = CaptureClock()
  precondition(offsetClock.start(at: origin + 3))
  let nonzero = try offsetClock.recordAcceptedPCM(
    role: "narration", hostPTS: time(0, 48000, extraNs: 3499), frames: 1024, rate: 48000)!
  let later = try offsetClock.recordAcceptedPCM(
    role: "narration", hostPTS: time(1024, 48000, extraNs: 3499), frames: 1024, rate: 48000)!
  precondition(nonzero.anchorUs == 100000 && later.firstFrame == 1024 && later.joinsPrevious)
  cases.append([
    "name": "nonzero-origin", "relativeInitialRawResidueNs": 499, "anchorUs": nonzero.anchorUs,
    "laterFrame": later.firstFrame,
  ])
  var omitted = fresh()
  let before = try omitted.recordAcceptedPCM(
    role: "narration", hostPTS: time(0, 48000), frames: 32768, rate: 48000)!
  let after = try omitted.recordAcceptedPCM(
    role: "narration", hostPTS: time(40960, 48000), frames: 55040, rate: 48000)!
  precondition(before.anchorUs == 100000 && after.firstFrame == 40960 && !after.joinsPrevious)
  // At1.2s, subtract the fixed0.1s phase: original sample52800. No reader-private adjustment.
  precondition((1_200_000 - after.anchorUs) * 48000 / 1_000_000 == 52800)
  cases.append([
    "name": "omitted-buffer", "secondFrame": after.firstFrame,
    "gapFrames": after.firstFrame - before.frames, "lateOriginalFrame": 52800,
  ])
  var paused = fresh()
  _ = try paused.recordAcceptedPCM(
    role: "narration", hostPTS: time(0, 48000), frames: 32768, rate: 48000)
  paused.pause(at: origin + 800000)
  paused.resume(at: origin + 1_000_000)
  let crossing = try paused.recordAcceptedPCM(
    role: "narration", hostPTS: time(32768, 48000), frames: 8192, rate: 48000)
  precondition(crossing == nil)
  let resumed = try paused.recordAcceptedPCM(
    role: "narration", hostPTS: time(49152, 48000), frames: 8192, rate: 48000)!
  precondition(resumed.firstFrame == 39552 && !resumed.joinsPrevious)
  cases.append(["name": "pause", "crossingRejected": true, "resumedFrame": resumed.firstFrame])
  var overlap = fresh()
  _ = try overlap.recordAcceptedPCM(
    role: "narration", hostPTS: time(0, 48000), frames: 8192, rate: 48000)
  do {
    _ = try overlap.recordAcceptedPCM(
      role: "narration", hostPTS: time(8191, 48000), frames: 8192, rate: 48000)
    preconditionFailure("Overlapping buffer must refuse")
  } catch let failure as CaptureFailure { precondition(failure.code == "AUDIO_OVERLAP") }
  let valid = try overlap.recordAcceptedPCM(
    role: "narration", hostPTS: time(8192, 48000), frames: 8192, rate: 48000)!
  precondition(valid.joinsPrevious)
  cases.append(["name": "overlap", "refusedWithoutStateAdvance": true])
  // Exact half ties classify away from zero; each candidate has its own unchanged initial phase.
  for (ns, frame) in [(Int64(31_249), Int64(1)), (31_250, 2), (31_251, 2)] {
    var clock = fresh()
    _ = try clock.recordAcceptedPCM(
      role: "narration", hostPTS: time(0, 48000), frames: 1, rate: 48000)
    let p = try clock.recordAcceptedPCM(
      role: "narration", hostPTS: time(0, 48000, extraNs: ns), frames: 1, rate: 48000)!
    precondition(p.firstFrame == frame)
  }
  cases.append(["name": "ties", "nearestTiesAwayFromZero": true])
  var gap = fresh()
  _ = try gap.recordAcceptedPCM(
    role: "narration", hostPTS: time(0, 48000), frames: 8192, rate: 48000)
  let tiny = try gap.recordAcceptedPCM(
    role: "narration", hostPTS: time(8192, 48000, extraNs: 1000), frames: 8192, rate: 48000)!
  precondition(tiny.firstFrame == 8192 && tiny.joinsPrevious)
  // The1us raw perturbation supplied no explicit exclusion. It is residue under this candidate.
  let asset = AVURLAsset(url: URL(fileURLWithPath: canonical))
  let track = try await asset.loadTracks(withMediaType: .audio).first!
  let range = TimeSpan(startUs: 1_200_000, endUs: 1_400_000)
  let baseline = try await SourceAudio.write(
    source: AudioSourceSelection(
      source: canonical, streamId: "track:\(track.trackID)", sourceOffsetUs: ExactTime(0),
      available: [ExactRange(startUs: 0, endUs: 2_100_000)]), range: ExactRange(range),
    output: directory.appendingPathComponent("baseline.wav"))
  let masked = try await SourceAudio.write(
    source: AudioSourceSelection(
      source: canonical, streamId: "track:\(track.trackID)", sourceOffsetUs: ExactTime(0),
      available: [
        ExactRange(startUs: 0, endUs: 1_200_041), ExactRange(startUs: 1_200_042, endUs: 2_100_000),
      ]), range: ExactRange(range), output: directory.appendingPathComponent("masked.wav"))
  precondition(baseline.frames == 9600 && masked.frames == 9600)
  precondition(
    masked.unavailable.count == 1 && masked.unavailable[0].startUs == ExactTime(1_200_041)
      && masked.unavailable[0].endUs == ExactTime(1_200_042))
  cases.append([
    "name": "explicit-reader-mask", "startUs": 1_200_041, "endUs": 1_200_042, "binding": true,
  ])
  let report: [String: Any] = [
    "scope": "offline CaptureClock admission candidate; production writer unused", "cases": cases,
    "bankedPlacements": [
      [
        "anchorUs": before.anchorUs, "firstFrame": before.firstFrame, "frames": before.frames,
        "rate": Int64(before.rate),
      ],
      [
        "anchorUs": after.anchorUs, "firstFrame": after.firstFrame, "frames": after.frames,
        "rate": Int64(after.rate),
      ],
    ],
    "rawOneMicrosecondResidueClassifiedAdjacent": tiny.joinsPrevious,
    "explicitReaderMicrosecondMaskPreserved": true,
    "correction":
      "Earlier report mislabeled a raw PTS perturbation as an explicit support exclusion; the test had supplied no exclusion. External masks remain separately binding.",
    "rolloutReady": false,
  ]
  try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(
    to: directory.appendingPathComponent("report.json"))
}
