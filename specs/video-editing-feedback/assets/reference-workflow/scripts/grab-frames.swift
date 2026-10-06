// Grab frames with AVFoundation (the decode/colour path QuickTime uses) as sRGB PNGs.
//   swift scripts/grab-frames.swift <video> <outdir> --fps <fps>    (every 1/fps s, names fNNNNN.png)
//   swift scripts/grab-frames.swift <video> <outdir> t1 t2 ...      (explicit seconds, names t<sec>.png)
import Foundation
import AVFoundation
import ImageIO
import UniformTypeIdentifiers

let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
let out = a[2]
try? FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: true)
let gen = AVAssetImageGenerator(asset: asset)
gen.requestedTimeToleranceBefore = .zero
gen.requestedTimeToleranceAfter = .zero
gen.appliesPreferredTrackTransform = true
let duration = CMTimeGetSeconds(asset.duration)
var times: [(Double, String)] = []
if a.count == 5, a[3] == "--fps", let fps = Double(a[4]) {
    var i = 0
    while Double(i) / fps < duration - 0.02 { times.append((Double(i) / fps, String(format: "f%05d.png", i))); i += 1 }
} else {
    for s in a.dropFirst(3) { if let t = Double(s) { times.append((t, "t\(s).png")) } }
}
let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
for (t, name) in times {
    guard let img = try? gen.copyCGImage(at: CMTime(seconds: t, preferredTimescale: 24000), actualTime: nil) else { continue }
    // Convert into sRGB explicitly so pixel stats are comparable to what a colour-managed player shows.
    let ctx = CGContext(data: nil, width: img.width, height: img.height, bitsPerComponent: 8, bytesPerRow: 0, space: srgb, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: img.width, height: img.height))
    let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: "\(out)/\(name)") as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
    CGImageDestinationFinalize(dest)
}
print("grabbed \(times.count) frames")
