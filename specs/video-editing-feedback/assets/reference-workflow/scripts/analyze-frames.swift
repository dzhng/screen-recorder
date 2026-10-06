// Per-frame QA with Apple Vision + pixel stats.
//   swift scripts/analyze-frames.swift img1.png img2.png ...
// One JSON line per image:
//   faces: count; face: largest face {cx, cy, top, bottom, left, right} normalized (top-left origin)
//   luma: mean frame luma 0-255; faceLuma: mean luma inside the largest face box
//   clipHi / crushLo: % of pixels with luma > 250 / < 8
//   bars: rows/cols of near-black (mean luma < 6) touching each edge, as % of height/width
import Foundation
import Vision
import ImageIO
import CoreGraphics

func stats(_ img: CGImage, faceBox: CGRect?) -> [String: Any] {
    let w = img.width, h = img.height
    let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
    let p = ctx.data!.bindMemory(to: UInt8.self, capacity: w * h * 4)
    func luma(_ x: Int, _ y: Int) -> Double { // y from top
        let i = ((h - 1 - y) * w + x) * 4
        _ = i
        let j = (y * w + x) * 4 // CGContext memory is top-row first for bitmap contexts
        return 0.2126 * Double(p[j]) + 0.7152 * Double(p[j + 1]) + 0.0722 * Double(p[j + 2])
    }
    var sum = 0.0, hi = 0, lo = 0, n = 0
    var rowMean = [Double](repeating: 0, count: h), colMean = [Double](repeating: 0, count: w)
    for y in stride(from: 0, to: h, by: 1) { for x in stride(from: 0, to: w, by: 2) {
        let l = luma(x, y); sum += l; n += 1; if l > 250 { hi += 1 }; if l < 8 { lo += 1 }
        rowMean[y] += l; colMean[x] += l
    } }
    for y in 0..<h { rowMean[y] /= Double(w / 2) }
    for x in stride(from: 0, to: w, by: 2) { colMean[x] /= Double(h) }
    func run(_ a: [Double], _ step: Int, _ rev: Bool) -> Int {
        var c = 0; let idx = rev ? Array(stride(from: a.count - step, through: 0, by: -step)) : Array(stride(from: 0, to: a.count, by: step))
        for i in idx { if a[i] < 6 { c += step } else { break } }
        return c
    }
    var fl: Double? = nil
    if let b = faceBox {
        var s = 0.0, k = 0
        let x0 = max(0, Int(b.minX * Double(w))), x1 = min(w - 1, Int(b.maxX * Double(w)))
        let y0 = max(0, Int(b.minY * Double(h))), y1 = min(h - 1, Int(b.maxY * Double(h)))
        if x1 > x0 && y1 > y0 { for y in stride(from: y0, to: y1, by: 2) { for x in stride(from: x0, to: x1, by: 2) { s += luma(x, y); k += 1 } } }
        if k > 0 { fl = s / Double(k) }
    }
    return ["luma": (sum / Double(n) * 10).rounded() / 10, "faceLuma": fl.map { ($0 * 10).rounded() / 10 } as Any,
            "clipHi": (Double(hi) / Double(n) * 1000).rounded() / 10, "crushLo": (Double(lo) / Double(n) * 1000).rounded() / 10,
            "bars": ["top": Double(run(rowMean, 1, false)) / Double(h) * 100, "bottom": Double(run(rowMean, 1, true)) / Double(h) * 100,
                     "left": Double(run(colMean, 2, false)) / Double(w) * 100, "right": Double(run(colMean, 2, true)) / Double(w) * 100]]
}

for path in CommandLine.arguments.dropFirst() {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }
    let req = VNDetectFaceRectanglesRequest()
    try? VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
    let faces = (req.results ?? []).sorted { $0.boundingBox.width * $0.boundingBox.height > $1.boundingBox.width * $1.boundingBox.height }
    var out: [String: Any] = ["file": (path as NSString).lastPathComponent, "faces": faces.count]
    var box: CGRect? = nil
    if let f = faces.first {
        let b = f.boundingBox
        box = CGRect(x: b.minX, y: 1 - b.maxY, width: b.width, height: b.height) // top-left origin
        out["face"] = ["cx": (b.midX * 1000).rounded() / 1000, "cy": ((1 - b.midY) * 1000).rounded() / 1000,
                       "top": ((1 - b.maxY) * 1000).rounded() / 1000, "bottom": ((1 - b.minY) * 1000).rounded() / 1000,
                       "left": (b.minX * 1000).rounded() / 1000, "right": (b.maxX * 1000).rounded() / 1000]
    }
    for (k, v) in stats(img, faceBox: box) { out[k] = v }
    let data = try JSONSerialization.data(withJSONObject: out, options: [.sortedKeys])
    print(String(data: data, encoding: .utf8)!)
}
