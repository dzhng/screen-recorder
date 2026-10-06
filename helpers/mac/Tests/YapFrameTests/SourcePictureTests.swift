@preconcurrency import AVFoundation
import Foundation
import ImageIO
@testable import YapFrames
import YapMedia

func verifySourcePictures(in parent: URL) async throws {
    let directory = parent.appendingPathComponent("source-pictures")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    let source = directory.appendingPathComponent("source.mp4")
    let rotated = directory.appendingPathComponent("rotated.mp4")
    let times = (0..<8).map { CMTime(value: Int64($0), timescale: 10) }
    try await FixtureWriter.write(to: source, times: times)
    try await FixtureWriter.write(to: rotated, times: times,
        transform: CGAffineTransform(rotationAngle: .pi / 2))
    let sourceBefore = try Data(contentsOf: source)

    func request(_ source: URL, output: URL, atUs: Int64 = 500_000,
                 maxLongEdge: Int? = nil, maxEncodedBytes: Int? = nil) async throws
        -> SourceFrameRenderer.Request
    {
        let tracks = try await AVURLAsset(url: source).loadTracks(withMediaType: .video)
        precondition(tracks.count == 1)
        var body: [String: Any] = [
            "asset": ["assetId": source.lastPathComponent, "streamId": "track:\(tracks[0].trackID)",
                      "path": source.path, "originUs": 0],
            "available": [["startUs": 0, "endUs": 800_000]],
            "atUs": atUs, "output": output.path,
        ]
        if let maxLongEdge { body["maxLongEdge"] = maxLongEdge }
        if let maxEncodedBytes { body["maxEncodedBytes"] = maxEncodedBytes }
        return try JSONDecoder().decode(SourceFrameRenderer.Request.self,
            from: JSONSerialization.data(withJSONObject: body))
    }

    let referenceURL = directory.appendingPathComponent("reference-frame-7.png")
    try FixtureFrame.referencePNG(index: 7, atUs: 700_000, width: 320, height: 240).write(to: referenceURL)
    let decoded = try await SourceFrameRenderer.write(request(source,
        output: directory.appendingPathComponent("decoded-frame-7.png"), atUs: 700_000))
    let image = try FixtureImage(contentsOf: URL(fileURLWithPath: decoded.file))
    let reference = try FixtureImage(contentsOf: referenceURL)
    let difference = image.difference(to: reference)
    precondition(decoded.width == 320 && decoded.height == 240,
        "A source below the default long-edge bound must not be upscaled")
    precondition(decoded.actualSourceUs == 700_000 && image.statedFrameIndex() == 7 && difference < 0.03,
        "Selected frame 7 must match its generated reference, mean channel difference \(difference)")

    let rotatedRequest = try await request(rotated, output: directory.appendingPathComponent("rotated.png"))
    let rotatedFrame = try await SourceFrameRenderer.write(rotatedRequest)
    let rotatedImage = try FixtureImage(contentsOf: URL(fileURLWithPath: rotatedFrame.file))
    // The platform image generator is independent of the source-picture renderer's transform.
    let generator = AVAssetImageGenerator(asset: AVURLAsset(url: rotated,
        options: [AVURLAssetPreferPreciseDurationAndTimingKey: true]))
    generator.appliesPreferredTrackTransform = true
    generator.requestedTimeToleranceBefore = .zero
    generator.requestedTimeToleranceAfter = .zero
    let (oracleImage, _) = try await generator.image(at: CMTime(value: 500_000, timescale: 1_000_000))
    let oracleURL = directory.appendingPathComponent("rotated-oracle.png")
    let oracleData = NSMutableData()
    let destination = CGImageDestinationCreateWithData(oracleData, "public.png" as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, oracleImage, nil)
    precondition(CGImageDestinationFinalize(destination))
    try (oracleData as Data).write(to: oracleURL)
    let oracle = try FixtureImage(contentsOf: oracleURL)
    func corners(_ image: FixtureImage) -> [(red: Double, green: Double, blue: Double)] {
        [(0, 0), (image.width - 8, 0), (0, image.height - 8), (image.width - 8, image.height - 8)].map {
            image.color(x: $0.0, y: $0.1)
        }
    }
    let actualCorners = corners(rotatedImage)
    let oracleCorners = corners(oracle)
    precondition(rotatedFrame.sourceWidth == 240 && rotatedFrame.sourceHeight == 320
        && rotatedImage.width == 240 && rotatedImage.height == 320
        && rotatedImage.width == oracle.width && rotatedImage.height == oracle.height,
        "Quarter-turn source pictures must retain oriented dimensions")
    let cornerDeltas = zip(actualCorners, oracleCorners).map { actual, expected in
        max(abs(actual.red - expected.red), abs(actual.green - expected.green), abs(actual.blue - expected.blue))
    }
    precondition(cornerDeltas.allSatisfy { $0 < 0.12 },
        "Selected source corners must match the orientation oracle: \(cornerDeltas)")
    precondition(actualCorners.firstIndex { $0.red > 0.6 && $0.green < 0.4 && $0.blue < 0.4 } == 1,
        "A quarter turn must move the top-left marker to the top right")

    let observations = try await SourceVisualSamples.read(.init(
        asset: rotatedRequest.asset, available: rotatedRequest.available, atSourceUs: [500_000]))
    try JSONEncoder().encode(observations).write(to: directory.appendingPathComponent("rotation-samples.json"))
    let sample = observations.samples[0]
    let rgb = [UInt8](Data(base64Encoded: sample.rgbBase64!)!)
    precondition(sample.status == "available" && sample.actualSourceUs == 500_000
        && sample.width == 48 && sample.height == 64 && rgb.count == 48 * 64 * 3,
        "Selected RGB observations must retain the sample clock, oriented aspect ratio and complete RGB bytes")
    let rgbDeltas = [(0, 0), (47, 0), (0, 63), (47, 63)].enumerated().map { index, xy in
        let offset = (xy.1 * 48 + xy.0) * 3
        let expected = oracleCorners[index]
        return max(abs(Double(rgb[offset]) / 255 - expected.red),
                   abs(Double(rgb[offset + 1]) / 255 - expected.green),
                   abs(Double(rgb[offset + 2]) / 255 - expected.blue))
    }
    precondition(rgbDeltas.allSatisfy { $0 < 0.15 },
        "Selected RGB must retain top-left row-major corner geometry: \(rgbDeltas)")

    let capped = directory.appendingPathComponent("bounded.png")
    do {
        _ = try await SourceFrameRenderer.write(request(source, output: capped, maxEncodedBytes: 2_000))
        preconditionFailure("Oversize PNG must refuse its requested encoded-byte limit")
    } catch let error as NativeFailure { precondition(error.code == "LIMIT_EXCEEDED", "\(error)") }
    precondition(!FileManager.default.fileExists(atPath: capped.path),
        "An over-limit source PNG must not leave a truncated output")
    let bounded = try await SourceFrameRenderer.write(request(source, output: capped,
        maxLongEdge: 64, maxEncodedBytes: 2_000))
    let boundedImage = try FixtureImage(contentsOf: capped)
    let boundedBytes = try Data(contentsOf: capped)
    precondition(bounded.width == 64 && bounded.height == 48
        && boundedImage.width == 64 && boundedImage.height == 48
        && bounded.bytes > 0 && bounded.bytes <= 2_000
        && bounded.bytes == boundedBytes.count,
        "The same byte limit must accept the correctly scaled 64x48 source picture")

    let alias = directory.appendingPathComponent("source-alias")
    try FileManager.default.createSymbolicLink(at: alias, withDestinationURL: directory)
    defer { try? FileManager.default.removeItem(at: alias) }
    for output in [source, alias.appendingPathComponent(source.lastPathComponent)] {
        do {
            _ = try await SourceFrameRenderer.write(request(source, output: output))
            preconditionFailure("A source picture must not overwrite its source or a directory-symlink alias")
        } catch let error as NativeFailure { precondition(error.code == "INVALID_OUTPUT", "\(error)") }
    }
    let sourceAfter = try Data(contentsOf: source)
    precondition(sourceAfter == sourceBefore, "Source bytes must remain unchanged")
    let remaining = try FileManager.default.contentsOfDirectory(atPath: directory.path)
    precondition(!remaining.contains { $0.hasPrefix(".yap-output-") },
        "Refused or completed source pictures must not leave private staging")
    let metrics: [String: Any] = ["referenceDifference": difference, "cornerDeltas": cornerDeltas,
        "rgbCornerDeltas": rgbDeltas, "boundedBytes": bounded.bytes]
    try JSONSerialization.data(withJSONObject: metrics, options: [.prettyPrinted, .sortedKeys])
        .write(to: directory.appendingPathComponent("metrics.json"))
    print("PASS selected source pictures preserve generated-reference pixels, independent orientation, RGB geometry, encoded-byte refusal/retry and immutable source aliases: \(metrics)")
}
