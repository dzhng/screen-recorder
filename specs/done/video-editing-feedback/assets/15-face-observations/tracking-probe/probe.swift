import CoreGraphics
import Foundation
import ImageIO
import Vision
@main struct Main {
 static func main() {
  let cases:[(String,CGRect,String)] = [("graham",CGRect(x:280,y:68,width:116,height:164),"full"),("madison",CGRect(x:234,y:56,width:167,height:210),"madison-full"),("lily",CGRect(x:242,y:134,width:141,height:203),"lily-full")]
  func iou(_ a:CGRect,_ b:CGRect)->Double {let i=a.intersection(b);if i.isNull{return 0};let ia=i.width*i.height;return Double(ia/(a.width*a.height+b.width*b.height-ia))}
  func image(_ p:String)->CGImage {let s=CGImageSourceCreateWithURL(URL(fileURLWithPath:p) as CFURL,nil)!;return CGImageSourceCreateImageAtIndex(s,0,nil)!}
  for (name,zone,dir) in cases {var prev:VNDetectedObjectObservation?=nil;var vals:[Double]=[];for n in 0..<72 {let p="/tmp/yap-face-track-20261007/\(dir)/"+String(format:"%03d.png",n);let cg=image(p);let h=VNImageRequestHandler(cgImage:cg,orientation:.up,options:[:]);if n==0 {let q=VNDetectFaceRectanglesRequest();try! h.perform([q]);if let f=q.results?.first as? VNFaceObservation{prev=VNDetectedObjectObservation(boundingBox:f.boundingBox)}} else if let prior=prev {let q=VNTrackObjectRequest(detectedObjectObservation:prior);q.trackingLevel = .accurate;try! h.perform([q]);if let o=q.results?.first as? VNDetectedObjectObservation{prev=o}else{prev=nil}};if let o=prev{let b=o.boundingBox;let x=CGRect(x:b.minX*640,y:(1-b.maxY)*360,width:b.width*640,height:b.height*360);vals.append(iou(x,zone))}}
 print("\(name) frames=\(vals.count) pass=\(vals.filter{$0>=0.5}.count) min=\(vals.min() ?? 0) max=\(vals.max() ?? 0)")}
 }
}
