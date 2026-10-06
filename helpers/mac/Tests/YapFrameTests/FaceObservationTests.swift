import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers
import YapFrames

func verifyFaceObservations(in parent: URL) throws {
    let directory = parent.appendingPathComponent("face-observations")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    let input = directory.appendingPathComponent("control.png")
    let pixels = Data(repeating: 0, count: 4 * 4 * 4)
    let image = CGImage(width: 4, height: 4, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: 16,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
        provider: CGDataProvider(data: pixels as CFData)!, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!
    let writer = CGImageDestinationCreateWithURL(input as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(writer, image, nil)
    precondition(CGImageDestinationFinalize(writer))
    let output = directory.appendingPathComponent("delivered.png")
    let body: [String: Any] = [
        "asset": ["assetId": "control", "streamId": "image:0", "path": input.path],
        "output": output.path, "maxLongEdge": 4,
        "faceObservations": ["recipe": "vision-face-rectangles-v1"],
    ]
    let request = try JSONDecoder().decode(SourceImageRenderer.Request.self, from: JSONSerialization.data(withJSONObject: body))
    let result = try SourceImageRenderer.write(request)
    let report = try JSONSerialization.jsonObject(with: JSONEncoder().encode(result)) as! [String: Any]
    let faces = report["faceObservations"] as! [String: Any]
    precondition(faces["status"] as! String == "no_face")
    precondition((faces["faces"] as! [[String: Any]]).isEmpty)
    precondition(faces["coordinateSpace"] as! String == "delivered-top-left-pixels")
    print("PASS no-face control returns explicit empty Vision observation")
}
