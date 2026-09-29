import AVFoundation
import Foundation
func inspect(_ error: NSError) -> [String:Any] {
 var result:[String:Any] = ["domain":error.domain,"code":error.code,"message":error.localizedDescription]
 if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError { result["underlying"] = inspect(underlying) }
 return result
}
let asset = AVURLAsset(url: URL(fileURLWithPath:CommandLine.arguments[1]))
let track = try await asset.loadTracks(withMediaType:.audio).first!
let reader = try AVAssetReader(asset:asset)
let output = AVAssetReaderTrackOutput(track:track, outputSettings:nil)
reader.add(output)
let started = reader.startReading()
let sample = output.copyNextSampleBuffer()
var result:[String:Any] = ["started":started,"sample":sample != nil,"status":reader.status.rawValue]
if let error = reader.error { result["error"] = inspect(error as NSError) }
print(String(data:try JSONSerialization.data(withJSONObject:result, options:[.prettyPrinted]),encoding:.utf8)!)
