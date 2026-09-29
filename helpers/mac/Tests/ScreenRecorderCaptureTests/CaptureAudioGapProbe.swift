@preconcurrency import AVFoundation
import Darwin
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

/// Isolated-process filesystem failure: only this worker's soft limit changes, restored before finish.
func runCaptureJournalFailureProbe(output rootPath: String, corpus: String) async throws {
  let root = URL(fileURLWithPath: rootPath)
  try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
  var trackStartBytes = 0
  for mode in ["healthy", "track-start-failure", "append-record-failure"] {
    let directory = root.appendingPathComponent(mode)
    // Keep every record under the journal's1MiB bound, but the journal larger than these tiny MOVs.
    let writer = try CaptureWriter(
      request: CaptureRequest(
        source: CaptureSource(kind: "offline-" + String(repeating: "x", count: 512 * 1024)),
        outputDirectory: directory.path, microphone: true, systemAudio: false), width: 160,
      height: 96, sessionID: mode, requestedSourceRect: nil, onFailure: { _ in })
    let stream = SCStream(
      filter: SCContentFilter(), configuration: SCStreamConfiguration(), delegate: nil)
    let origin = CaptureHostTime.nowUs() - 3_000_000
    let video = AVURLAsset(url: URL(fileURLWithPath: corpus).appendingPathComponent("a.mov"))
    let vt = try await video.loadTracks(withMediaType: .video).first!
    let vr = try AVAssetReader(asset: video)
    let vo = AVAssetReaderTrackOutput(
      track: vt,
      outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
    vr.add(vo)
    precondition(vr.startReading())
    let screen = try gapRetimed(
      vo.copyNextSampleBuffer()!, at: time(microseconds: origin),
      duration: time(microseconds: 500000))
    let attachments =
      CMSampleBufferGetSampleAttachmentsArray(screen, createIfNecessary: true)! as NSArray
    (attachments[0] as! NSMutableDictionary)[SCStreamFrameInfo.status.rawValue] =
      SCFrameStatus.complete.rawValue
    writer.queue.sync { writer.stream(stream, didOutputSampleBuffer: screen, of: .screen) }
    let audio = AVURLAsset(url: URL(fileURLWithPath: corpus).appendingPathComponent("a-audio.wav"))
    let at = try await audio.loadTracks(withMediaType: .audio).first!
    let ar = try AVAssetReader(asset: audio)
    let ao = AVAssetReaderTrackOutput(
      track: at, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
    ar.add(ao)
    precondition(ar.startReading())
    let sample = try gapRetimed(ao.copyNextSampleBuffer()!, at: time(microseconds: origin + 100000))
    let journal = directory.appendingPathComponent("capture.journal.jsonl")
    let before = try Data(contentsOf: journal).count
    let limit = before + (mode == "append-record-failure" ? trackStartBytes : 0)
    var observedErrno: Int32 = 0
    var mediaSizes: [String: Int] = [:]
    if mode == "healthy" {
      writer.queue.sync { writer.stream(stream, didOutputSampleBuffer: sample, of: .microphone) }
      let added = try Data(contentsOf: journal).dropFirst(before)
      trackStartBytes = added.firstIndex(of: 10)! - added.startIndex + 1
    } else {
      var prior = rlimit()
      precondition(getrlimit(RLIMIT_FSIZE, &prior) == 0)
      let priorSignal = signal(SIGXFSZ, SIG_IGN)
      var capped = prior
      capped.rlim_cur = rlim_t(limit)
      precondition(setrlimit(RLIMIT_FSIZE, &capped) == 0)
      do {
        defer {
          precondition(setrlimit(RLIMIT_FSIZE, &prior) == 0)
          signal(SIGXFSZ, priorSignal)
        }
        writer.queue.sync { writer.stream(stream, didOutputSampleBuffer: sample, of: .microphone) }
        var after = rlimit()
        precondition(getrlimit(RLIMIT_FSIZE, &after) == 0)
        precondition(after.rlim_cur == capped.rlim_cur && after.rlim_max == prior.rlim_max)
        let fd = Darwin.open(journal.path, O_WRONLY | O_APPEND)
        precondition(fd >= 0)
        defer { Darwin.close(fd) }
        precondition(lseek(fd, 0, SEEK_END) == limit)
        var byte: UInt8 = 0
        let writeResult = Darwin.write(fd, &byte, 1)
        precondition(writeResult == -1)
        observedErrno = errno
        precondition(observedErrno == EFBIG)
        let writtenCount = try Data(contentsOf: journal).count
        precondition(writtenCount == limit)
        for file in ["video.mov", "narration.mov"] {
          let size =
            (try FileManager.default.attributesOfItem(
              atPath: directory.appendingPathComponent(file).path)[.size] as! NSNumber).intValue
          mediaSizes[file] = size
          precondition(size < limit, "Media must not hit the journal-sized limit")
        }
      }
    }
    writer.seal()
    let result = await writer.finish(
      failure: mode == "healthy"
        ? CaptureFailure("INTERRUPTED", "Controlled tiny fixture tail") : nil)
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    try encoder.encode(result).write(to: directory.appendingPathComponent("result.json"))
    let recovery = await MediaRecovery.inspect(directory: directory.path)
    try encoder.encode(recovery).write(to: directory.appendingPathComponent("recovery.json"))
    let lines = try String(contentsOf: journal, encoding: .utf8).split(separator: "\n")
    let events = try lines.map {
      try JSONSerialization.jsonObject(with: Data($0.utf8)) as! [String: Any]
    }
    let acquired = events.filter { $0["event"] as? String == "audioSamples" }.count
    let narration = result.tracks.first { $0.role == "narration" }!
    let payload = try await journalFailurePCM(directory.appendingPathComponent("narration.mov"), startUs: 100000)
    let original = try await journalFailurePCM(
      URL(fileURLWithPath: corpus).appendingPathComponent("a-audio.wav"))
    let expectedBytes = sample.numSamples * 4
    let exactPCM = payload.count == expectedBytes && payload == original.prefix(expectedBytes)
    let receipt: [String: Any] = [
      "decodedPCMBytes": payload.count, "exactInputPCM": exactPCM,
      "mediaBytesDuringLimit": mediaSizes, "mode": mode,
      "acceptedReportedBuffers": narration.samples, "expectedInputFrames": sample.numSamples,
      "journaledAcquisitionRecords": acquired, "journalPrefixBytes": before,
      "softLimitBytes": limit, "observedErrno": observedErrno,
      "errnoName": mode == "healthy" ? "none" : "EFBIG", "trackStartBytes": trackStartBytes,
    ]
    try JSONSerialization.data(withJSONObject: receipt, options: [.prettyPrinted, .sortedKeys])
      .write(to: directory.appendingPathComponent("receipt.json"))
    precondition(
      narration.samples == 1, "Successful append must remain accepted after journal failure")
    precondition(exactPCM, "Retained decoded PCM must equal the original input frames")
    precondition(
      narration.firstSampleUs == 100000
        && narration.lastSampleEndUs == 100000 + microseconds(sample.duration))
    if mode != "healthy" {
      precondition(result.failure?.code == "JOURNAL_FAILED" && acquired == 0)
      let recovered = recovery.tracks.first { $0.role == "narration" }!
      precondition(
        recovered.decodedSamples > 0 && recovered.intervals.isEmpty,
        "Retain decoded payload without claiming unmapped acquisition")
    }
  }
}

private func journalFailurePCM(_ url: URL, startUs: Int64 = 0) async throws -> Data {
  let asset = AVURLAsset(url: url)
  let track = try await asset.loadTracks(withMediaType: .audio).first!
  let reader = try AVAssetReader(asset: asset)
  reader.timeRange = CMTimeRange(start: time(microseconds: startUs), duration: .positiveInfinity)
  let output = AVAssetReaderTrackOutput(
    track: track,
    outputSettings: [
      AVFormatIDKey: kAudioFormatLinearPCM, AVLinearPCMBitDepthKey: 32, AVLinearPCMIsFloatKey: true,
      AVLinearPCMIsBigEndianKey: false, AVLinearPCMIsNonInterleaved: false,
    ])
  reader.add(output)
  precondition(reader.startReading())
  var result = Data()
  while let sample = output.copyNextSampleBuffer() {
    let block = sample.dataBuffer!
    var bytes = Data(count: CMBlockBufferGetDataLength(block))
    let status = bytes.withUnsafeMutableBytes {
      CMBlockBufferCopyDataBytes(
        block, atOffset: 0, dataLength: $0.count, destination: $0.baseAddress!)
    }
    precondition(status == kCMBlockBufferNoErr)
    result.append(bytes)
  }
  precondition(reader.status == .completed)
  return result
}
