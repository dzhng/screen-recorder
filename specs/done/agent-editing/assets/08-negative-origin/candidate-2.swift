@preconcurrency import AVFoundation
import Foundation
let input = URL(fileURLWithPath: "/tmp/screenrec-negative-origin/negative-session.caf.mov")
let output = URL(fileURLWithPath: "/tmp/screenrec-negative-origin/negative-composition.mov")
func describe(_ asset: AVAsset) async throws -> [[String: Any]] {
 var tracks: [[String:Any]] = []
 for track in try await asset.loadTracks(withMediaType: .audio) {
  tracks.append(["trackID": track.trackID, "segments": try await track.load(.segments).map { segment in
   ["empty": segment.isEmpty, "sourceStart": CMTimeGetSeconds(segment.timeMapping.source.start), "sourceDuration": CMTimeGetSeconds(segment.timeMapping.source.duration), "targetStart": CMTimeGetSeconds(segment.timeMapping.target.start), "targetDuration": CMTimeGetSeconds(segment.timeMapping.target.duration)] as [String:Any]
  }])
 }
 return tracks
}
var result: [String:Any] = ["candidate": output.path, "requestedTargetStartSeconds": -0.25]
do {
 let asset = AVURLAsset(url: input)
 let source = try await asset.loadTracks(withMediaType: .audio)[0]
 let composition = AVMutableComposition()
 let target = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
 try target.insertTimeRange(CMTimeRange(start: .zero, duration: CMTime(value: 48000, timescale: 48000)), of: source, at: CMTime(value: -12000, timescale: 48000))
 result["inMemoryTracks"] = try await describe(composition)
 let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough)!
 try await export.export(to: output, as: .mov)
 result["exportedTracks"] = try await describe(AVURLAsset(url: output))
 result["outcome"] = "exported"
} catch {
 let e = error as NSError
 result["outcome"] = "refused"
 result["error"] = ["domain": e.domain, "code": e.code, "description": e.localizedDescription, "details": String(describing: e.userInfo)]
}
print(String(data: try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted,.sortedKeys]), encoding: .utf8)!)
