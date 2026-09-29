import AVFoundation
import Foundation
func inspect(_ error: NSError) -> [String:Any] {
 var result:[String:Any] = ["domain":error.domain,"code":error.code,"message":error.localizedDescription]
 if let underlying = error.userInfo[NSUnderlyingErrorKey] as? NSError { result["underlying"] = inspect(underlying) }
 return result
}
do { _ = try await AVURLAsset(url: URL(fileURLWithPath: CommandLine.arguments[1])).loadTracks(withMediaType: .video); fatalError("Expected permission failure") }
catch { print(String(data:try JSONSerialization.data(withJSONObject:inspect(error as NSError),options:[.prettyPrinted]),encoding:.utf8)!) }
