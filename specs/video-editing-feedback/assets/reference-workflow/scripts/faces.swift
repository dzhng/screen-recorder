// Detect the largest face in each image with Apple's Vision framework.
//   swift scripts/faces.swift img1.png img2.png ...
// Prints one JSON line per image: {"file", "x", "y", "w", "h"} — normalized, top-left origin,
// face box centre in x/y. Images with no face print null fields.
import Foundation
import Vision
import ImageIO

for path in CommandLine.arguments.dropFirst() {
    let url = URL(fileURLWithPath: path)
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
        print("{\"file\":\"\(path)\",\"error\":\"unreadable\"}"); continue
    }
    let req = VNDetectFaceRectanglesRequest()
    try? VNImageRequestHandler(cgImage: img, options: [:]).perform([req])
    let faces = (req.results ?? []).sorted { $0.boundingBox.width * $0.boundingBox.height > $1.boundingBox.width * $1.boundingBox.height }
    if let f = faces.first {
        let b = f.boundingBox // normalized, bottom-left origin
        let cx = b.midX, cy = 1 - b.midY
        print(String(format: "{\"file\":\"%@\",\"x\":%.4f,\"y\":%.4f,\"w\":%.4f,\"h\":%.4f,\"n\":%d}", path, cx, cy, b.width, b.height, faces.count))
    } else {
        print("{\"file\":\"\(path)\",\"x\":null,\"y\":null,\"w\":null,\"h\":null,\"n\":0}")
    }
}
