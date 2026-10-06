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

@preconcurrency import AVFoundation

func verifyFaceFixture(in parent: URL) async throws {
    guard let path = ProcessInfo.processInfo.environment["YAP_FACE_VIDEO"], !path.isEmpty else {
        preconditionFailure("YAP_FACE_VIDEO is required for --face-fixture")
    }
    let source = URL(fileURLWithPath: path)
    let outputRoot = parent.appendingPathComponent("face-fixture", isDirectory: true)
    try FileManager.default.createDirectory(at: outputRoot, withIntermediateDirectories: true)
    let tracks = try await AVURLAsset(url: source).loadTracks(withMediaType: .video)
    precondition(tracks.count == 1)
    let times = (ProcessInfo.processInfo.environment["YAP_FACE_TIMES"] ?? "0,100000,200000")
        .split(separator: ",").map { Int64($0.trimmingCharacters(in: .whitespaces))! }
    var available = [[String: Any]]()
    for atUs in times {
        let body: [String: Any] = [
            "asset": ["assetId": "fixture", "streamId": "track:\(tracks[0].trackID)", "path": source.path, "originUs": 0],
            "available": [["startUs": 0, "endUs": 3_000_000]], "atUs": atUs,
            "output": outputRoot.appendingPathComponent("face-\(atUs).png").path,
            "maxLongEdge": 640, "faceObservations": ["recipe": "vision-face-rectangles-v1"],
        ]
        let request = try JSONDecoder().decode(SourceFrameRenderer.Request.self, from: JSONSerialization.data(withJSONObject: body))
        let result = try await SourceFrameRenderer.write(request)
        let object = try JSONSerialization.jsonObject(with: JSONEncoder().encode(result)) as! [String: Any]
        let observations = object["faceObservations"] as? [String: Any]
        precondition(observations != nil, "fixture frame \(atUs) did not return face observations")
        precondition(observations?["status"] as? String == "available", "fixture frame \(atUs) must expose a face")
        precondition(
            observations?["coordinateSpace"] as? String == "delivered-top-left-pixels",
            "fixture frame \(atUs) returned an unexpected face coordinate space")
        guard let rasterWidth = observations?["width"] as? Int, let rasterHeight = observations?["height"] as? Int,
              rasterWidth > 0, rasterHeight > 0 else {
            preconditionFailure("fixture frame \(atUs) returned invalid raster dimensions")
        }
        guard let faces = observations?["faces"] as? [[String: Any]], !faces.isEmpty else {
            preconditionFailure("fixture frame \(atUs) reported available without face boxes")
        }
        for face in faces {
            precondition(face["id"] is String, "fixture frame \(atUs) returned a face without an id")
            guard let box = face["boundingBox"] as? [String: Any] else {
                preconditionFailure("fixture frame \(atUs) returned a face without a bounding box")
            }
            guard let x = box["x"] as? Int, let y = box["y"] as? Int,
                  let width = box["width"] as? Int, let height = box["height"] as? Int,
                  x >= 0, y >= 0, width > 0, height > 0,
                  x + width <= rasterWidth, y + height <= rasterHeight else {
                preconditionFailure("fixture frame \(atUs) returned an out-of-bounds bounding box")
            }
            guard let confidence = face["confidence"] as? Double,
                  confidence.isFinite, (0...1).contains(confidence) else {
                preconditionFailure("fixture frame \(atUs) returned an invalid confidence")
            }
        }
        available.append(["atUs": atUs, "faces": faces.count])
    }
    print("PASS real face fixture: \(available)")
}
