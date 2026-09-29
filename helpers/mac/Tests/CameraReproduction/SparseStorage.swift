@preconcurrency import AVFoundation
import CryptoKit
import Foundation
import ScreenRecorderAudio
import ScreenRecorderCapture
import ScreenRecorderMedia
import ScreenRecorderWire

private struct ExactTime: Codable {
  let value: Int64
  let timescale: Int32
  var time: CMTime { CMTime(value: value, timescale: timescale) }
}
private struct Run: Codable {
  let firstFrame: Int64
  let frames: Int64
  let sourceStart: ExactTime
}
private struct StorageRequest: Codable {
  let payload: String
  let output: String
  let rate: Int32
  let runs: [Run]
  let stopAfter: String?
}
private func demand(_ condition: Bool, _ message: String) throws {
  if !condition { throw CaptureFailure("STORAGE_PROOF_FAILED", message) }
}
private func digest(_ data: Data) -> String {
  SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
}
private func json<T: Encodable>(_ value: T) throws -> Data {
  let e = JSONEncoder()
  e.outputFormatting = [.sortedKeys, .prettyPrinted]
  return try e.encode(value)
}
private func stamp(_ t: CMTime) -> [String: Int64] {
  ["value": t.value, "timescale": Int64(t.timescale)]
}

/// Bounded storage proof using the existing08 composition/passthrough mechanism, not capture repair.
func runSparseStorageProbe(request path: String) async throws {
  let requestURL = URL(fileURLWithPath: path)
  try demand(
    try requestURL.resourceValues(forKeys: [.fileSizeKey]).fileSize! <= 65536,
    "Request exceeds64KiB bound")
  let request = try JSONDecoder().decode(
    StorageRequest.self, from: Data(contentsOf: requestURL))
  try demand(
    [44100, 48000].contains(request.rate) && !request.runs.isEmpty && request.runs.count <= 8,
    "Bounded proof accepts at most8 exact runs at44.1/48k")
  let exactScale: Int32 = request.rate == 48000 ? 6_000_000 : 441_000_000
  try demand(
    request.runs.allSatisfy {
      $0.firstFrame >= 0 && $0.firstFrame <= 1_000_000 && $0.frames > 0 && $0.frames <= 1_000_000
        && $0.sourceStart.value >= 0 && $0.sourceStart.value <= Int64(exactScale) * 30
        && $0.sourceStart.timescale > 0 && exactScale % $0.sourceStart.timescale == 0
    }, "Invalid exact frame run")
  let source = URL(fileURLWithPath: request.payload)
  try demand(
    try source.resourceValues(forKeys: [.fileSizeKey]).fileSize! <= 16 * 1024 * 1024,
    "Payload exceeds16MiB bound")
  let directory = URL(fileURLWithPath: request.output)
  try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
  let payloadHash = digest(try Data(contentsOf: source))
  let intent: [String: String] = [
    "payloadSha256": payloadHash, "mappingSha256": digest(try json(request.runs)),
    "rate": String(request.rate),
  ]
  let intentURL = directory.appendingPathComponent("intent.json")
  if FileManager.default.fileExists(atPath: intentURL.path) {
    let prior = try JSONDecoder().decode([String: String].self, from: Data(contentsOf: intentURL))
    try demand(prior == intent, "Restart mapping/payload identity differs")
  } else {
    try json(intent).write(to: intentURL, options: .atomic)
  }
  let asset = AVURLAsset(url: source)
  let tracks = try await asset.loadTracks(withMediaType: .audio)
  try demand(tracks.count == 1, "One packed PCM source required")
  let track = tracks[0]
  guard let description = try await track.load(.formatDescriptions).first,
    let basic = CMAudioFormatDescriptionGetStreamBasicDescription(description)
  else { throw CaptureFailure("STORAGE_PROOF_FAILED", "PCM description missing") }
  let format = basic.pointee
  try demand(
    format.mFormatID == kAudioFormatLinearPCM && format.mSampleRate == Double(request.rate),
    "Exact PCM rate required")
  let segments = SourceSegment.occupied(of: try await track.load(.segments))
  try demand(segments.count == 1, "Proof payload must be one contiguous occupied interval")
  let packedStart = segments[0].asset.start
  let packedEnd = CMTimeRangeGetEnd(segments[0].asset)
  var previousSourceEnd = CMTime.zero
  var previousFrameEnd: Int64 = 0
  for run in request.runs {
    let start = run.sourceStart.time
    let duration = CMTime(value: run.frames, timescale: request.rate)
    try demand(
      start >= previousSourceEnd && run.firstFrame >= previousFrameEnd,
      "Overlapping/backward run mapping is unsupported")
    try demand(
      CMTimeAdd(packedStart, CMTime(value: run.firstFrame + run.frames, timescale: request.rate))
        <= packedEnd, "Run exceeds known packed payload")
    previousSourceEnd = CMTimeAdd(start, duration)
    try demand(
      previousSourceEnd <= CMTime(value: 30, timescale: 1), "Proof source exceeds30s bound")
    previousFrameEnd = run.firstFrame + run.frames
  }
  let temporary = directory.appendingPathComponent("canonical.partial.mov")
  let canonical = directory.appendingPathComponent("canonical.mov")
  if !FileManager.default.fileExists(atPath: canonical.path)
    && !FileManager.default.fileExists(atPath: temporary.path)
  {
    let composition = AVMutableComposition()
    let target = composition.addMutableTrack(
      withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
    // LCM of supported rate and microseconds; other scales are refused, never rounded.
    target.naturalTimeScale = exactScale
    for run in request.runs {
      try target.insertTimeRange(
        CMTimeRange(
          start: CMTimeAdd(packedStart, CMTime(value: run.firstFrame, timescale: request.rate)),
          duration: CMTime(value: run.frames, timescale: request.rate)), of: track,
        at: run.sourceStart.time)
    }
    let exporter = AVAssetExportSession(
      asset: composition, presetName: AVAssetExportPresetPassthrough)!
    try await exporter.export(to: temporary, as: .mov)
  }
  let candidate = FileManager.default.fileExists(atPath: canonical.path) ? canonical : temporary
  let outputAsset = AVURLAsset(url: candidate)
  let outputTracks = try await outputAsset.loadTracks(withMediaType: .audio)
  try demand(outputTracks.count == 1, "Candidate requires one audio track")
  let outputTrack = outputTracks[0]
  let outputSegments = SourceSegment.occupied(of: try await outputTrack.load(.segments))
  try demand(outputSegments.count == request.runs.count, "Occupied run count changed")
  var rows: [[String: Any]] = []
  for (segment, run) in zip(outputSegments, request.runs) {
    try demand(
      segment.asset.start == run.sourceStart.time,
      "Run start changed: \(segment.asset.start) vs \(run.sourceStart.time)")
    try demand(
      segment.asset.duration == CMTime(value: run.frames, timescale: request.rate),
      "Exact frame duration changed")
    rows.append([
      "sourceStart": stamp(segment.asset.start), "sourceDuration": stamp(segment.asset.duration),
      "mediaStart": stamp(segment.media.start), "mediaDuration": stamp(segment.media.duration),
      "firstFrame": run.firstFrame, "frames": run.frames,
    ])
  }
  if request.stopAfter == "export" { exit(75) }
  if candidate == temporary { try FileManager.default.moveItem(at: temporary, to: canonical) }
  if request.stopAfter == "rename" { exit(75) }
  let completed = directory.appendingPathComponent("complete.json")
  if FileManager.default.fileExists(atPath: completed.path) {
    let prior =
      try JSONSerialization.jsonObject(with: Data(contentsOf: completed)) as! [String: Any]
    try demand(
      prior["canonicalSha256"] as? String == digest(try Data(contentsOf: canonical)),
      "Published canonical identity changed")
    return
  }
  // Diagnostics are attempt-local and reproducible; an interrupted write must not block restart.
  for label in ["reference", "full", "late"] {
    let file = directory.appendingPathComponent(label + ".wav")
    if FileManager.default.fileExists(atPath: file.path) {
      try FileManager.default.removeItem(at: file)
    }
  }
  let published = AVURLAsset(url: canonical)
  let publishedTrack = try await published.loadTracks(withMediaType: .audio).first!
  let endUs = microseconds(previousSourceEnd)
  let selection = AudioSourceSelection(
    source: canonical.path, streamId: "track:\(publishedTrack.trackID)", sourceOffsetUs: 0,
    available: [TimeSpan(startUs: 0, endUs: endUs)])
  if request.runs.count == 1 {
    _ = try await SourceAudio.write(
      source: AudioSourceSelection(
        source: source.path, streamId: "track:\(track.trackID)", sourceOffsetUs: 0,
        available: [TimeSpan(startUs: 0, endUs: endUs)]),
      range: TimeSpan(startUs: 0, endUs: endUs),
      output: directory.appendingPathComponent("reference.wav"))
  }
  var reads: [[String: Any]] = []
  for (label, range) in [
    ("full", TimeSpan(startUs: 0, endUs: endUs)),
    ("late", TimeSpan(startUs: 1_200_000, endUs: min(1_400_000, endUs))),
  ] where range.startUs < range.endUs {
    let result = try await SourceAudio.write(
      source: selection, range: range, output: directory.appendingPathComponent(label + ".wav"))
    if request.stopAfter == "diagnostic" && label == "full" { exit(75) }
    try json(result).write(to: directory.appendingPathComponent(label + ".json"))
    reads.append(["label": label, "start": result.sampleRange.start, "end": result.sampleRange.end])
  }
  try demand(digest(try Data(contentsOf: source)) == payloadHash, "Packed payload changed")
  let report: [String: Any] = [
    "completed": true, "scope": "probe-known exact mapping; no legacy journal reconstruction",
    "canonicalSha256": digest(try Data(contentsOf: canonical)), "payloadSha256": payloadHash,
    "segments": rows, "reads": reads,
  ]
  try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(
    to: directory.appendingPathComponent("complete.json"), options: .atomic)
}
