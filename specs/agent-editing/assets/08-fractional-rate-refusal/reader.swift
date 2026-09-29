@preconcurrency import AVFoundation
import Foundation
let asset = AVURLAsset(url: URL(fileURLWithPath: "/tmp/screenrec-fractional-clock/impulses.caf"))
let track = try await asset.loadTracks(withMediaType: .audio)[0]
let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [AVFormatIDKey:kAudioFormatLinearPCM, AVSampleRateKey:44101, AVNumberOfChannelsKey:1, AVLinearPCMBitDepthKey:32, AVLinearPCMIsFloatKey:true, AVLinearPCMIsBigEndianKey:false, AVLinearPCMIsNonInterleaved:false])
reader.add(output); precondition(reader.startReading())
var count = 0
var rates = Set<Double>()
var peaks: [[String:Any]] = []
var best: [(Float,Int,Double)] = [(0,0,0),(0,0,0)]
while let sample = output.copyNextSampleBuffer() {
 let basic = CMAudioFormatDescriptionGetStreamBasicDescription(CMSampleBufferGetFormatDescription(sample)!)!.pointee
 rates.insert(basic.mSampleRate)
 let stamp = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sample))
 let frames = CMSampleBufferGetNumSamples(sample)
 var list = AudioBufferList(); var block: CMBlockBuffer?
 precondition(CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(sample, bufferListSizeNeededOut:nil, bufferListOut:&list, bufferListSize:MemoryLayout<AudioBufferList>.size, blockBufferAllocator:nil, blockBufferMemoryAllocator:nil, flags:0, blockBufferOut:&block)==noErr)
 let values = list.mBuffers.mData!.assumingMemoryBound(to:Float.self)
 for index in 0..<frames {
  let time = stamp + Double(index)/basic.mSampleRate
  for (which,center) in [2.0,8.0].enumerated() {
   if abs(time-center)<0.001 && abs(values[index])>best[which].0 {best[which]=(abs(values[index]),count+index,time)}
  }
 }
 count += frames
}
precondition(reader.status == .completed)
for (i,value) in best.enumerated() {peaks.append(["impulseSeconds":[2,8][i],"absoluteFrame":value.1,"sampleTimeSeconds":value.2,"absoluteAmplitude":value.0])}
let result: [String:Any] = ["requestedRate":44101,"actualDecodedRates":Array(rates),"decodedFrames":count,"peaks":peaks]
print(String(data:try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]),encoding:.utf8)!)
