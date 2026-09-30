import AVFoundation
import CoreMedia
import Foundation
import ScreenRecorderAudio
import ScreenRecorderCapture
import ScreenRecorderMedia

func runPCMAdmissionWindows(output: String, canonical: String) async throws {
  let directory = URL(fileURLWithPath: output)
  try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
  let asset = AVURLAsset(url: URL(fileURLWithPath: canonical))
  let track = try await asset.loadTracks(withMediaType: .audio).first!
  let descriptions = try await track.load(.formatDescriptions)
  let rate = Int32(
    CMAudioFormatDescriptionGetStreamBasicDescription(descriptions[0])!.pointee.mSampleRate)
  precondition([44100, 48000].contains(rate))
  // Existing production policy rounds the usable video origin to microseconds before CaptureClock.start.
  let rawOrigin = CMTime(value: 100_000_000_499, timescale: 1_000_000_000)
  let declaredOrigin = CMTimeConvertScale(
    rawOrigin, timescale: 1_000_000, method: .roundHalfAwayFromZero
  ).value
  let rawFirst: Int64 = 100_100_000_501
  var phases: [[String: Any]] = []
  for chunk: Int64 in [1024, 8192] {
    var clock = CaptureClock()
    precondition(clock.start(at: declaredOrigin))
    var first: Int64 = 0
    var joins = 0
    var buffers = 0
    while first < Int64(rate) * 2 {
      let count = min(chunk, Int64(rate) * 2 - first)
      let delta = Int64((Int128(first) * 1_000_000_000 + Int128(rate) / 2) / Int128(rate))
      let placed = try clock.recordAcceptedPCM(
        role: "narration",
        hostPTS: CMTime(value: rawFirst + delta, timescale: 1_000_000_000), frames: count,
        rate: rate)!
      precondition(placed.anchorUs == 100001 && placed.firstFrame == first)
      if placed.joinsPrevious { joins += 1 }
      buffers += 1
      first += count
    }
    precondition(buffers - joins == 1)
    phases.append(["chunk": chunk, "frames": first, "anchorUs": 100001, "runs": buffers - joins])
  }
  // This is a disclosed current-origin policy difference, not equivalence to raw relative rounding.
  let exactRelativeRoundedUs = (rawFirst - rawOrigin.value + 500) / 1000
  precondition(exactRelativeRoundedUs == 100000)
  let source = AudioSourceSelection(
    source: canonical, streamId: "track:\(track.trackID)", sourceOffsetUs: ExactTime(0),
    available: [ExactRange(startUs: 0, endUs: 2_100_001)])
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
  for (name, range) in [
    ("native-full", TimeSpan(startUs: 0, endUs: 2_100_001)),
    ("native-window", TimeSpan(startUs: 1_200_011, endUs: 1_299_567)),
  ] {
    let result = try await SourceAudio.write(
      source: source, range: ExactRange(range), output: directory.appendingPathComponent(name + ".wav"))
    try encoder.encode(result).write(to: directory.appendingPathComponent(name + ".json"))
  }
  for (name, start, end) in [
    ("project-full", Int64(0), Int64(100800)), ("project-window", Int64(57601), Int64(62379)),
  ] {
    let bounds: [String: Int64] = ["start": start, "end": end]
    let extent: [String: Int64] = ["startUs": 0, "endUs": 2_100_001]
    let clip: [String: Any] = [
      "clipId": "pcm", "trackId": "audio", "sampleRange": bounds, "placement": extent,
      "source": [
        "kind": "range", "assetId": "capture", "streamId": "track:\(track.trackID)",
        "range": extent,
      ],
      "pitch": "preserve", "available": [bounds],
      "context": [["source": extent, "sampleRange": ["start": 0, "end": 100800]]],
    ]
    let processing: [[String: Any]] = [
      ["target": ["kind": "clip", "id": "pcm"], "mediaKind": "audio", "inputs": [], "steps": []],
      [
        "target": ["kind": "track", "id": "audio"], "mediaKind": "audio",
        "inputs": [["kind": "clip", "id": "pcm"]], "steps": [],
      ],
      [
        "target": ["kind": "output"], "mediaKind": "output",
        "inputs": [["kind": "track", "id": "audio"]], "steps": [],
      ],
    ]
    let request: [String: Any] = [
      "output": directory.appendingPathComponent(name + ".wav").path, "range": bounds,
      "clips": [clip], "processing": processing,
      "assets": [
        [
          "assetId": "capture", "streamId": "track:\(track.trackID)", "path": canonical,
          "originUs": 0,
        ]
      ],
    ]
    let data = try JSONSerialization.data(
      withJSONObject: request, options: [.prettyPrinted, .sortedKeys])
    try data.write(to: directory.appendingPathComponent(name + ".request.json"))
    let result = try await CompositionAudio.write(
      JSONDecoder().decode(CompositionAudioPlan.self, from: data))
    try encoder.encode(result).write(to: directory.appendingPathComponent(name + ".json"))
  }
  let report: [String: Any] = [
    "rate": rate, "groups": phases,
    "rawVideoOrigin": ["value": rawOrigin.value, "timescale": rawOrigin.timescale],
    "declaredOriginUs": declaredOrigin, "rawFirstAudioValue": rawFirst, "candidateAnchorUs": 100001,
    "rawRelativeRoundedOnceUs": exactRelativeRoundedUs, "originPolicyEquivalent": false,
    "scope": "existing integer-video-origin policy; no raw-origin equivalence or writer rollout",
  ]
  try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(
    to: directory.appendingPathComponent("report.json"))
}
