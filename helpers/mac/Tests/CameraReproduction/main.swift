@preconcurrency import AVFoundation
import Foundation
import ScreenCaptureKit
import ScreenRecorderCapture
import ScreenRecorderMedia
import ScreenRecorderWire

// Offline only: no device discovery, capture input, session start or permission request.
private struct Input: Codable {
  let role: String
  let path: String
  let offsetUs: Int64
  let simulatedRate: Double
  let simulatedAnchorUs: Int64
}
private struct Request: Codable {
  let output: String
  let inputs: [Input]
  let bypassConversion: Bool
}
private struct Stamp: Codable {
  let value: Int64
  let timescale: Int32
  let epoch: Int64
  init(_ t: CMTime) {
    value = t.value
    timescale = t.timescale
    epoch = t.epoch
  }
}
private struct Observation: Codable {
  let role: String
  let index: Int
  let mediaPTS: Stamp
  let simulatedPTS: Stamp
  let convertedHostPTS: Stamp
  let intendedHostUs: Int64
  let durationUs: Int64
  let mappedUs: Int64?
}
private struct RoleResult: Codable {
  let role: String
  let written: Int
  let omitted: Int
  let firstUs: Int64
  let endUs: Int64
  let recovered: RecoveredCapture
  let interrupted: RecoveredCapture?
}
private struct Report: Codable {
  let scope: String
  let originHostUs: Int64
  let pauses: [PauseEvent]
  let roles: [RoleResult]
}
private func check(_ ok: Bool, _ message: String) throws {
  if !ok { throw CaptureFailure("REPRODUCTION_FAILED", message) }
}
private func encode<T: Encodable>(_ value: T) throws -> Data {
  let encoder = JSONEncoder()
  encoder.outputFormatting = [.sortedKeys]
  return try encoder.encode(value)
}

// Compiled availability proof only. These getters are never called on live sources.
private func documentedClocks(_ screen: SCStream, _ camera: AVCaptureSession) -> [CMClock?] {
  [screen.synchronizationClock, camera.synchronizationClock]
}

@main struct CameraReproduction {
  static func main() async {
    do { try await run() } catch {
      let failure =
        error as? CaptureFailure
        ?? CaptureFailure("REPRODUCTION_FAILED", error.localizedDescription)
      try? FileHandle.standardError.write(contentsOf: encode(failure) + Data([10]))
      exit(2)
    }
  }
  private static func run() async throws {
    guard CommandLine.arguments.count == 2 else {
      throw CaptureFailure(
        "INVALID_REQUEST", "Pass an offline request JSON; live capture is unsupported")
    }
    let request = try JSONDecoder().decode(
      Request.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
    try check(
      Set(request.inputs.map(\.role)) == Set(["screen", "camera", "microphone"])
        && request.inputs.count == 3, "Select three explicit prerecorded inputs")
    for input in request.inputs {
      guard FileManager.default.fileExists(atPath: input.path) else {
        throw CaptureFailure(
          "SOURCE_UNAVAILABLE", "Selected prerecorded \(input.role) file is missing")
      }
    }
    let root = URL(fileURLWithPath: request.output)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
    let origin: Int64 = 100_000_000
    var clock = CaptureClock()
    clock.pause(at: origin + 800_000)
    clock.resume(at: origin + 1_200_000)
    try check(clock.start(at: origin), "Screen fixture establishes the shared origin")
    var roles: [RoleResult] = []
    for input in request.inputs {
      roles.append(
        try await write(
          input, root: root, clock: clock, origin: origin, bypass: request.bypassConversion))
    }
    let report = Report(
      scope:
        "offline controlled CMTimebase simulation; no device clocks or physical synchronization measured",
      originHostUs: origin, pauses: clock.pauses, roles: roles)
    try encode(report).write(to: root.appendingPathComponent("report.json"))
  }

  private static func write(
    _ selected: Input, root: URL, clock: CaptureClock, origin: Int64, bypass: Bool
  ) async throws -> RoleResult {
    let video = selected.role != "microphone"
    let asset = AVURLAsset(url: URL(fileURLWithPath: selected.path))
    guard let track = try await asset.loadTracks(withMediaType: video ? .video : .audio).first
    else {
      throw CaptureFailure(
        "SOURCE_UNAVAILABLE", "Selected prerecorded \(selected.role) track is missing")
    }
    try check(
      selected.simulatedRate.isFinite && selected.simulatedRate > 0 && selected.offsetUs >= 0,
      "Invalid controlled clock configuration")
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(
      track: track,
      outputSettings: video
        ? [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
        : [AVFormatIDKey: kAudioFormatLinearPCM])
    reader.add(output)
    try check(reader.startReading(), "Reader must start")
    let directory = root.appendingPathComponent(selected.role)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    let dimensions = video ? try await track.load(.naturalSize) : .zero
    let journal = try CaptureJournal(
      directory: directory.path,
      header: CaptureJournalHeader(
        schemaVersion: 1, sessionID: "offline-" + selected.role,
        source: CaptureSource(kind: "offline-prerecorded"), width: Int(dimensions.width),
        height: Int(dimensions.height), microphone: !video,
        systemAudio: false))
    try journal.recordPauseBegan(hostUs: origin + 800_000)
    try journal.recordPauseEnded(hostUs: origin + 1_200_000, pause: nil)
    try journal.recordOrigin(hostUs: origin, placedPauses: clock.pauses)
    let file = directory.appendingPathComponent(video ? "video.mov" : "narration.mov")
    let writer = try AVAssetWriter(outputURL: file, fileType: .mov)
    writer.movieTimeScale = 1_000_000
    writer.movieFragmentInterval = CMTime(value: 5, timescale: 1)
    writer.initialMovieFragmentInterval = CMTime(value: 1, timescale: 1)
    var target: AVAssetWriterInput?
    let observations = directory.appendingPathComponent("timestamps.jsonl")
    FileManager.default.createFile(atPath: observations.path, contents: nil)
    let log = try FileHandle(forWritingTo: observations)
    defer { try? log.close() }
    var timebase: CMTimebase?
    try check(
      CMTimebaseCreateWithSourceClock(
        allocator: kCFAllocatorDefault, sourceClock: CMClockGetHostTimeClock(),
        timebaseOut: &timebase) == noErr, "Create controlled timebase")
    let sourceClock = timebase!
    let sourceAnchor = time(microseconds: selected.simulatedAnchorUs)
    try check(
      CMTimebaseSetRateAndAnchorTime(
        sourceClock, rate: selected.simulatedRate, anchorTime: sourceAnchor,
        immediateSourceTime: time(microseconds: origin)) == noErr, "Set controlled anchor/rate")
    let segments = SourceSegment.occupied(of: try await track.load(.segments))
    var written = 0
    var omitted = 0
    var index = 0
    var first: Int64?
    var end: Int64 = 0
    while let sample = output.copyNextSampleBuffer() {
      let pts = CMSampleBufferGetPresentationTimeStamp(sample)
      let duration =
        video
        ? assetEnd(ofSamplePresentedAt: pts, in: segments, of: track).map {
          CMTimeSubtract($0, pts)
        } ?? .invalid
        : CMSampleBufferGetDuration(sample)
      try check(
        pts.isNumeric && duration.isNumeric && duration > .zero,
        "Fixture must provide exact sample timing")
      let relative = CMTimeAdd(pts, time(microseconds: selected.offsetUs))
      let raw = CMTimeAdd(
        sourceAnchor,
        CMTimeMultiplyByFloat64(
          CMTimeConvertScale(relative, timescale: 1_000_000_000, method: .roundHalfAwayFromZero),
          multiplier: selected.simulatedRate))
      let converted =
        bypass ? raw : CMSyncConvertTime(raw, from: sourceClock, to: CMClockGetHostTimeClock())
      let intended = origin + microseconds(relative)
      try check(
        converted.isNumeric && abs(microseconds(converted) - intended) <= 1,
        "Converted clock differs from controlled host time")
      let durationUs = microseconds(duration)
      let mapped = clock.sourceTime(for: microseconds(converted), durationUs: durationUs)
      let observation = Observation(
        role: selected.role, index: index, mediaPTS: Stamp(pts), simulatedPTS: Stamp(raw),
        convertedHostPTS: Stamp(converted), intendedHostUs: intended, durationUs: durationUs,
        mappedUs: mapped)
      try log.write(contentsOf: encode(observation) + Data([10]))
      index += 1
      guard let mapped else {
        omitted += 1
        continue
      }
      if target == nil {
        let settings: [String: Any]?
        if video {
          let size = try await track.load(.naturalSize)
          settings = [
            AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: Int(size.width),
            AVVideoHeightKey: Int(size.height),
            AVVideoCompressionPropertiesKey: [
              AVVideoMaxKeyFrameIntervalKey: 1, AVVideoAllowFrameReorderingKey: false,
            ],
          ]
        } else {
          guard let format = sample.formatDescription,
            let audio = CMAudioFormatDescriptionGetStreamBasicDescription(format)?.pointee
          else { throw CaptureFailure("REPRODUCTION_FAILED", "Missing PCM format") }
          settings = [
            AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: audio.mSampleRate,
            AVNumberOfChannelsKey: audio.mChannelsPerFrame, AVLinearPCMBitDepthKey: 32,
            AVLinearPCMIsFloatKey: true, AVLinearPCMIsNonInterleaved: false,
            AVLinearPCMIsBigEndianKey: false,
          ]
        }
        let input = AVAssetWriterInput(
          mediaType: video ? .video : .audio, outputSettings: settings,
          sourceFormatHint: sample.formatDescription)
        input.expectsMediaDataInRealTime = true
        if video { input.mediaTimeScale = 1_000_000 }
        try check(writer.canAdd(input), "Writer accepts explicit media kind")
        writer.add(input)
        target = input
        try check(writer.startWriting(), "Writer starts")
        writer.startSession(atSourceTime: .zero)
      }
      var count = 0
      CMSampleBufferGetSampleTimingInfoArray(
        sample, entryCount: 0, arrayToFill: nil, entriesNeededOut: &count)
      var timing = [CMSampleTimingInfo](repeating: CMSampleTimingInfo(), count: count)
      CMSampleBufferGetSampleTimingInfoArray(
        sample, entryCount: count, arrayToFill: &timing, entriesNeededOut: &count)
      let shift = CMTimeSubtract(time(microseconds: mapped), pts)
      for n in timing.indices {
        if video { timing[n].duration = duration }
        timing[n].presentationTimeStamp = CMTimeAdd(timing[n].presentationTimeStamp, shift)
        if timing[n].decodeTimeStamp.isNumeric {
          timing[n].decodeTimeStamp = CMTimeAdd(timing[n].decodeTimeStamp, shift)
        }
      }
      var retimed: CMSampleBuffer?
      try check(
        CMSampleBufferCreateCopyWithNewTiming(
          allocator: kCFAllocatorDefault, sampleBuffer: sample, sampleTimingEntryCount: count,
          sampleTimingArray: &timing, sampleBufferOut: &retimed) == noErr, "Retime buffer")
      let deadline = Date().addingTimeInterval(10)
      while !target!.isReadyForMoreMediaData && writer.status == .writing && Date() < deadline {
        try await Task.sleep(for: .milliseconds(1))
      }
      try check(
        target!.isReadyForMoreMediaData && target!.append(retimed!), "Append made bounded progress")
      if first == nil {
        try journal.recordTrackStarted(
          role: video ? "video" : "narration", file: file.lastPathComponent, firstSourceUs: mapped,
          sampleRate: nil, channelCount: nil)
      }
      if !video {
        try journal.recordAudioSamples(
          role: "narration", startUs: mapped, endUs: mapped + durationUs)
      }
      first = first ?? mapped
      end = max(end, mapped + durationUs)
      written += 1
    }
    try check(reader.status == .completed && written > 0, "Decode completes with admitted samples")
    var interrupted: RecoveredCapture?
    if selected.role == "camera" {
      let partial = root.appendingPathComponent("interrupted-camera")
      try FileManager.default.createDirectory(at: partial, withIntermediateDirectories: false)
      let snapshot = partial.appendingPathComponent("video.mov")
      let deadline = Date().addingTimeInterval(10)
      repeat {
        try await Task.sleep(for: .milliseconds(100))
        try? FileManager.default.removeItem(at: snapshot)
        try FileManager.default.copyItem(at: file, to: snapshot)
        let recovered = await MediaRecovery.inspect(directory: partial.path)
        if recovered.tracks.contains(where: { $0.role == "video" && $0.decodedSamples > 0 }) {
          interrupted = recovered
          break
        }
      } while Date() < deadline
      try check(
        writer.status == .writing && interrupted != nil,
        "Unfinalized fragmented camera copy is recoverable")
    }
    target!.markAsFinished()
    writer.endSession(atSourceTime: time(microseconds: end))
    await writer.finishWriting()
    try check(writer.status == .completed, "Finalize independent source")
    let recovered = await MediaRecovery.inspect(directory: directory.path)
    guard let found = recovered.tracks.first(where: { $0.role == (video ? "video" : "narration") })
    else { throw CaptureFailure("REPRODUCTION_FAILED", "Recovery lost role") }
    try check(
      found.failure == nil && found.decodedSamples > 0 && found.decodeReachedEnd,
      "Completed independent source recovers")
    return RoleResult(
      role: selected.role, written: written, omitted: omitted, firstUs: first!, endUs: end,
      recovered: recovered, interrupted: interrupted)
  }
}
