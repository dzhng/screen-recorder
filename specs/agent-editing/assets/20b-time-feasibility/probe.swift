@preconcurrency import AVFoundation
import Foundation

func stamp(_ t: CMTime) -> [String: Any] {
  ["value": t.value, "timescale": t.timescale, "epoch": t.epoch,
   "flags": t.flags.rawValue, "rounded": t.flags.contains(.hasBeenRounded)]
}
func copy(_ sample: CMSampleBuffer, _ pts: CMTime) throws -> CMSampleBuffer {
  var count = 0
  precondition(CMSampleBufferGetSampleTimingInfoArray(sample, entryCount: 0, arrayToFill: nil, entriesNeededOut: &count) == noErr)
  var timings = [CMSampleTimingInfo](repeating: CMSampleTimingInfo(), count: count)
  precondition(CMSampleBufferGetSampleTimingInfoArray(sample, entryCount: count, arrayToFill: &timings, entriesNeededOut: &count) == noErr)
  // Exact first-PTS replacement: avoids contaminating this control with shift/subtract arithmetic.
  precondition(timings.count == 1)
  timings[0].presentationTimeStamp = pts
  var result: CMSampleBuffer?
  precondition(CMSampleBufferCreateCopyWithNewTiming(allocator: kCFAllocatorDefault,
    sampleBuffer: sample, sampleTimingEntryCount: timings.count, sampleTimingArray: &timings,
    sampleBufferOut: &result) == noErr)
  return result!
}
func inspect(_ path: String, rate: Int32) async throws -> [String: Any] {
  let asset = AVURLAsset(url: URL(fileURLWithPath: path))
  let track = try await asset.loadTracks(withMediaType: .audio).first!
  let reader = try AVAssetReader(asset: asset)
  let output = AVAssetReaderTrackOutput(track: track, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
  reader.add(output); precondition(reader.startReading())
  var rows: [[String: Any]] = []
  let origin = CMTime(value: 99_900_000_000, timescale: 1_000_000_000)
  let anchor = CMTime(value: 100_000_000_001, timescale: 1_000_000_000)
  while let sample = output.copyNextSampleBuffer() {
    let media = sample.presentationTimeStamp
    let naive = CMTimeAdd(anchor, media)
    let exactNumerator = Int128(anchor.value) * Int128(media.timescale) + Int128(media.value) * Int128(anchor.timescale)
    let exactDenominator = Int128(anchor.timescale) * Int128(media.timescale)
    let nanos = Int64((exactNumerator * 1_000_000_000 + exactDenominator / 2) / exactDenominator)
    let observed = CMTime(value: nanos, timescale: 1_000_000_000)
    let recreated = try copy(sample, observed)
    var one = CMSampleTimingInfo()
    precondition(CMSampleBufferGetSampleTimingInfo(recreated, at: 0, timingInfoOut: &one) == noErr)
    var second = CMSampleTimingInfo()
    let secondStatus = CMSampleBufferGetSampleTimingInfo(recreated, at: 1, timingInfoOut: &second)
    let existingMicroHost = CMTimeAdd(CMTime(value: 100_000_000, timescale: 1_000_000), media)
    let existingMicroShift = CMTimeSubtract(existingMicroHost, media)
    let existingNanoShift = CMTimeSubtract(naive, media)
    rows.append(["secondSampleStatus": secondStatus, "secondSamplePTS": stamp(second.presentationTimeStamp),
      "existingMicroRecipePTS": stamp(CMTimeAdd(media, existingMicroShift)),
      "sameRecipeNanoPTS": stamp(CMTimeAdd(media, existingNanoShift)),"index":rows.count,"frames":sample.numSamples,"mediaPTS":stamp(media),
      "mediaDuration":stamp(sample.duration),"naiveHostAdd":stamp(naive),
      "observedHostPTS":stamp(recreated.presentationTimeStamp),"perSampleDuration":stamp(one.duration),
      "mappedBySameScaleSubtract":stamp(CMTimeSubtract(recreated.presentationTimeStamp, origin)),
      "bufferEndCMTime":stamp(CMTimeAdd(recreated.presentationTimeStamp,recreated.duration))])
  }
  precondition(reader.status == .completed)
  return ["path":path,"rate":rate,"origin":stamp(origin),"anchor":stamp(anchor),"buffers":rows]
}
let args=CommandLine.arguments
let report:[String:Any] = ["scope":"prerecorded timing and explicit nanosecond quantization controls only; no devices", "inputs":[
  try await inspect(args[1],rate:48000), try await inspect(args[2],rate:44100)]]
let data=try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys])
try data.write(to:URL(fileURLWithPath:args[3]))
