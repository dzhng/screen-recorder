@preconcurrency import AVFoundation
import Foundation
import ScreenCaptureKit
import ScreenRecorderCapture
import ScreenRecorderMedia
import ScreenRecorderWire

private func gapRetimed(_ sample: CMSampleBuffer, at pts: CMTime, duration: CMTime? = nil) throws
  -> CMSampleBuffer
{
  var count = 0
  var status = CMSampleBufferGetSampleTimingInfoArray(
    sample, entryCount: 0, arrayToFill: nil, entriesNeededOut: &count)
  precondition(status == noErr)
  var timing = [CMSampleTimingInfo](repeating: CMSampleTimingInfo(), count: count)
  status = CMSampleBufferGetSampleTimingInfoArray(
    sample, entryCount: count, arrayToFill: &timing, entriesNeededOut: &count)
  precondition(status == noErr)
  let shift = CMTimeSubtract(pts, sample.presentationTimeStamp)
  for n in timing.indices {
    timing[n].presentationTimeStamp = CMTimeAdd(timing[n].presentationTimeStamp, shift)
    if timing[n].decodeTimeStamp.isNumeric {
      timing[n].decodeTimeStamp = CMTimeAdd(timing[n].decodeTimeStamp, shift)
    }
    if let duration { timing[n].duration = duration }
  }
  var copy: CMSampleBuffer?
  status = CMSampleBufferCreateCopyWithNewTiming(
    allocator: kCFAllocatorDefault, sampleBuffer: sample, sampleTimingEntryCount: count,
    sampleTimingArray: &timing, sampleBufferOut: &copy)
  precondition(status == noErr)
  return copy!
}

/// Calls the real production writer only. Never starts a stream, devices or cursor sampling.
func runCaptureAudioGapProbe(output rootPath: String, corpus: String) async throws {
  let root = URL(fileURLWithPath: rootPath)
  try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
  for mode in ["continuous", "omitted-buffer", "pause"] {
    let directory = root.appendingPathComponent(mode)
    let writer = try CaptureWriter(
      request: CaptureRequest(
        source: CaptureSource(kind: "offline-prerecorded"), outputDirectory: directory.path,
        microphone: true, systemAudio: false), width: 160, height: 96, sessionID: mode,
      requestedSourceRect: nil, onFailure: { _ in })
    let stream = SCStream(
      filter: SCContentFilter(), configuration: SCStreamConfiguration(), delegate: nil)
    var origin = CaptureHostTime.nowUs() - 3_000_000
    if mode == "pause" {
      writer.pause()
      try await Task.sleep(for: .milliseconds(20))
      writer.resume()
      let lines = try String(
        contentsOf: directory.appendingPathComponent("capture.journal.jsonl"), encoding: .utf8
      ).split(separator: "\n")
      let event = try lines.map {
        try JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any]
      }.first { $0["event"] as? String == "pauseBegan" }!
      origin = (event["data"] as! [String: Any])["hostUs"] as! Int64 - 800_000
    }
    let video = AVURLAsset(url: URL(fileURLWithPath: corpus).appendingPathComponent("a.mov"))
    let videoTrack = try await video.loadTracks(withMediaType: .video).first!
    let videoReader = try AVAssetReader(asset: video)
    let videoOutput = AVAssetReaderTrackOutput(
      track: videoTrack,
      outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
    videoReader.add(videoOutput)
    precondition(videoReader.startReading())
    let first = videoOutput.copyNextSampleBuffer()!
    let screen = try gapRetimed(
      first, at: time(microseconds: origin), duration: time(microseconds: 500_000))
    let attachments =
      CMSampleBufferGetSampleAttachmentsArray(screen, createIfNecessary: true)! as NSArray
    (attachments[0] as! NSMutableDictionary)[SCStreamFrameInfo.status.rawValue] =
      SCFrameStatus.complete.rawValue
    writer.queue.sync { writer.stream(stream, didOutputSampleBuffer: screen, of: .screen) }
    // A known video tail gives interrupted finalization a bounded media endpoint.
    let tail = try gapRetimed(
      screen, at: time(microseconds: origin + 2_300_000), duration: time(microseconds: 200_000))
    writer.queue.sync { writer.stream(stream, didOutputSampleBuffer: tail, of: .screen) }
    let audio = AVURLAsset(url: URL(fileURLWithPath: corpus).appendingPathComponent("a-audio.wav"))
    let audioTrack = try await audio.loadTracks(withMediaType: .audio).first!
    let reader = try AVAssetReader(asset: audio)
    let source = AVAssetReaderTrackOutput(
      track: audioTrack, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
    reader.add(source)
    precondition(reader.startReading())
    var observations: [[String: Any]] = []
    var index = 0
    while let sample = source.copyNextSampleBuffer() {
      let mediaPTS = sample.presentationTimeStamp
      let hostPTS = CMTimeAdd(time(microseconds: origin + 100_000), mediaPTS)
      let delivered = mode != "omitted-buffer" || index != 4
      let raw = try gapRetimed(sample, at: hostPTS)
      let format = CMAudioFormatDescriptionGetStreamBasicDescription(sample.formatDescription!)!
        .pointee
      observations.append([
        "index": index, "mediaPTSValue": mediaPTS.value, "mediaPTSTimescale": mediaPTS.timescale,
        "hostUs": microseconds(hostPTS), "durationUs": microseconds(sample.duration),
        "frames": sample.numSamples, "sampleRate": format.mSampleRate,
        "channels": format.mChannelsPerFrame, "formatID": format.mFormatID,
        "formatFlags": format.mFormatFlags, "bitsPerChannel": format.mBitsPerChannel,
        "deliveredToWriter": delivered,
      ])
      if delivered {
        writer.queue.sync { writer.stream(stream, didOutputSampleBuffer: raw, of: .microphone) }
      }
      index += 1
      // Offline feeding must not turn real-time backpressure into the experiment's variable.
      try await Task.sleep(for: .milliseconds(5))
    }
    precondition(reader.status == .completed)
    if mode == "pause" {
      // End-host must follow the controlled prerecorded tail; no artificial clock override.
      let waitUs = origin + 2_500_000 - CaptureHostTime.nowUs()
      if waitUs > 0 { try await Task.sleep(for: .microseconds(waitUs)) }
    }
    writer.seal()
    let result = await writer.finish(
      failure: CaptureFailure("INTERRUPTED", "Offline probe stops at its known video tail"))
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    try encoder.encode(result).write(to: directory.appendingPathComponent("capture-result.json"))
    try encoder.encode(await MediaRecovery.inspect(directory: directory.path)).write(
      to: directory.appendingPathComponent("recovery.json"))
    try JSONSerialization.data(
      withJSONObject: ["mode": mode, "originHostUs": origin, "inputs": observations],
      options: [.prettyPrinted, .sortedKeys]
    ).write(to: directory.appendingPathComponent("input.json"))
  }
}
