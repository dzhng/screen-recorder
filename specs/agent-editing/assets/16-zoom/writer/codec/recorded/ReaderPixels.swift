@preconcurrency import AVFoundation
import Foundation
import CryptoKit
@main struct Read {
 static func main() async throws {
  let asset=AVURLAsset(url:URL(fileURLWithPath:CommandLine.arguments[1]))
  let track=try await asset.loadTracks(withMediaType:.video)[0]
  let reader=try AVAssetReader(asset:asset)
  let output=AVAssetReaderTrackOutput(track:track,outputSettings:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA])
  reader.add(output);precondition(reader.startReading())
  var index=0
  while let sample=output.copyNextSampleBuffer() {
   if [0,10,20,29].contains(index) {
    let b=CMSampleBufferGetImageBuffer(sample)!; CVPixelBufferLockBaseAddress(b,.readOnly);defer{CVPixelBufferUnlockBaseAddress(b,.readOnly)}
    var bytes=Data();let base=CVPixelBufferGetBaseAddress(b)!,stride=CVPixelBufferGetBytesPerRow(b),width=CVPixelBufferGetWidth(b),height=CVPixelBufferGetHeight(b)
    for y in 0..<height{bytes.append(base.advanced(by:y*stride).assumingMemoryBound(to:UInt8.self),count:width*4)}
    try bytes.write(to:URL(fileURLWithPath:CommandLine.arguments[2]+"/frame-\(index).bgra"))
    let color = CVBufferCopyAttachment(b,kCVImageBufferCGColorSpaceKey,nil) as! CGColorSpace
    print("ICC",SHA256.hash(data:color.copyICCData()! as Data).map{String(format:"%02x",$0)}.joined())
    print(index,CMSampleBufferGetPresentationTimeStamp(sample),CVBufferCopyAttachments(b,.shouldPropagate) as Any)
   };index+=1
  };precondition(reader.status == .completed);print("frames",index)
 }
}
