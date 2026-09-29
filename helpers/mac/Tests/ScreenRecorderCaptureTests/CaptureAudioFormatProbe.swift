@preconcurrency import AVFoundation
import Foundation
import ScreenCaptureKit
import ScreenRecorderCapture
import ScreenRecorderMedia

/// Actual callback/writer format changes; no device queries, stream start or live capture.
func runCaptureAudioFormatProbe(output rootPath: String, corpus: String, stereoFixture: String)
  async throws
{
  let root = URL(fileURLWithPath: rootPath)
  try FileManager.default.createDirectory(at: root, withIntermediateDirectories: false)
  let fixture = URL(fileURLWithPath: corpus)
  for mode in [
    "same-format", "representation", "initial-int16", "int16-to-float", "rate", "channels",
    "stereo-float", "stereo-planar", "packed24", "float64",
  ] {
    let directory = root.appendingPathComponent(mode)
    let writer = try CaptureWriter(
      request: CaptureRequest(
        source: CaptureSource(kind: "offline-format"), outputDirectory: directory.path,
        microphone: true, systemAudio: false), width: 160, height: 96, sessionID: mode,
      requestedSourceRect: nil, onFailure: { _ in })
    let stream = SCStream(
      filter: SCContentFilter(), configuration: SCStreamConfiguration(), delegate: nil)
    let origin = CaptureHostTime.nowUs() - 3_000_000
    let video = AVURLAsset(url: fixture.appendingPathComponent("a.mov"))
    let vt = try await video.loadTracks(withMediaType: .video).first!
    let vr = try AVAssetReader(asset: video)
    let vo = AVAssetReaderTrackOutput(
      track: vt,
      outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
    vr.add(vo)
    precondition(vr.startReading())
    let screen = try captureFixtureRetimed(
      vo.copyNextSampleBuffer()!, at: time(microseconds: origin),
      duration: time(microseconds: 1_000_000))
    let attachments =
      CMSampleBufferGetSampleAttachmentsArray(screen, createIfNecessary: true)! as NSArray
    (attachments[0] as! NSMutableDictionary)[SCStreamFrameInfo.status.rawValue] =
      SCFrameStatus.complete.rawValue
    writer.queue.sync { writer.stream(stream, didOutputSampleBuffer: screen, of: .screen) }
    var observations: [[String: Any]] = []
    var nextPTS = time(microseconds: origin + 100000)
    for index in 0...1 {
      let rate = mode == "rate" && index == 1 ? 44100 : 48000
      let stereo = ["stereo-float", "stereo-planar", "packed24", "float64"].contains(mode)
      let channels = stereo || (mode == "channels" && index == 1) ? 2 : 1
      let bits =
        mode == "packed24"
        ? 24
        : (mode == "float64" && index == 1
          ? 64
          : (mode == "initial-int16" || (mode == "int16-to-float" && index == 0)
            || (mode == "representation" && index == 1) ? 16 : 32))
      let audio = AVURLAsset(
        url: stereo
          ? URL(fileURLWithPath: stereoFixture + (bits == 64 ? ".f64.wav" : ""))
          : fixture.appendingPathComponent("a-audio.wav"))
      let at = try await audio.loadTracks(withMediaType: .audio).first!
      let reader = try AVAssetReader(asset: audio)
      reader.timeRange = CMTimeRange(
        start: CMTime(value: Int64(index), timescale: 2), duration: CMTime(value: 1, timescale: 2))
      let output = AVAssetReaderTrackOutput(
        track: at,
        outputSettings: bits == 64
          ? nil
          : [
            AVFormatIDKey: kAudioFormatLinearPCM, AVSampleRateKey: rate,
            AVNumberOfChannelsKey: channels, AVLinearPCMBitDepthKey: bits,
            AVLinearPCMIsFloatKey: bits == 32 || bits == 64, AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsNonInterleaved: mode == "stereo-planar" && index == 1,
          ])
      reader.add(output)
      precondition(reader.startReading())
      let sample = try captureFixtureRetimed(output.copyNextSampleBuffer()!, at: nextPTS)
      let asbd = CMAudioFormatDescriptionGetStreamBasicDescription(sample.formatDescription!)!
        .pointee
      let block = sample.dataBuffer!
      var raw = Data(count: CMBlockBufferGetDataLength(block))
      let status = raw.withUnsafeMutableBytes {
        CMBlockBufferCopyDataBytes(
          block, atOffset: 0, dataLength: $0.count, destination: $0.baseAddress!)
      }
      precondition(status == kCMBlockBufferNoErr)
      try raw.write(to: directory.appendingPathComponent("input-\(index).raw"))
      observations.append([
        "rate": asbd.mSampleRate, "channels": asbd.mChannelsPerFrame, "formatID": asbd.mFormatID,
        "flags": asbd.mFormatFlags, "bits": asbd.mBitsPerChannel, "frames": sample.numSamples,
        "sourceUs": microseconds(nextPTS) - origin, "durationUs": microseconds(sample.duration),
      ])
      writer.queue.sync { writer.stream(stream, didOutputSampleBuffer: sample, of: .microphone) }
      nextPTS = CMTimeAdd(nextPTS, sample.duration)
      try await Task.sleep(for: .milliseconds(20))
    }
    writer.seal()
    let result = await writer.finish(failure: nil)
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    try encoder.encode(result).write(to: directory.appendingPathComponent("result.json"))
    try JSONSerialization.data(
      withJSONObject: observations, options: [.prettyPrinted, .sortedKeys]
    ).write(to: directory.appendingPathComponent("inputs.json"))
  }
}
