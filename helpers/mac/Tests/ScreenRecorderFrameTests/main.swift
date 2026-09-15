@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderFrames

let evidence = URL(
    fileURLWithPath: ProcessInfo.processInfo.environment["SCREENREC_FRAME_EVIDENCE"]
        ?? NSTemporaryDirectory() + "screenrec-frame-tests")
try FileManager.default.createDirectory(at: evidence, withIntermediateDirectories: true)
let images = evidence.appendingPathComponent("images")
try FileManager.default.createDirectory(at: images, withIntermediateDirectories: true)

func steps(_ count: Int, everyUs: Int64) -> [CMTime] {
    (0..<count).map { CMTime(value: Int64($0) * everyUs, timescale: 1_000_000) }
}

let stepsFixture = evidence.appendingPathComponent("steps-10fps.mp4")
try await FixtureWriter.write(to: stepsFixture, times: steps(30, everyUs: 100_000))
let stepsTruth = try await FixtureTruth.presentationMicroseconds(of: stepsFixture)
precondition(
    stepsTruth == (0..<30).map { Int64($0) * 100_000 },
    "Fixture must present 30 frames every 100000us, got \(stepsTruth)")
print("PASS fixture presents \(stepsTruth.count) samples from \(stepsTruth.first!) to \(stepsTruth.last!)us")

let source = try await FrameSource(url: stepsFixture)
let whole = FrameInterval(startUs: 0, endUs: 3_000_000)

let nearest = try await source.decodeFrame(
    FrameRequest(
        atSourceUs: 140_000, kept: whole, output: images.appendingPathComponent("nearest.png")))
precondition(
    nearest.actualSourceUs == 100_000 && nearest.distanceUs == 40_000,
    "Nearest sample to 140000us must be the frame at 100000us, got \(nearest)")
let nearestImage = try FixtureImage(contentsOf: URL(fileURLWithPath: nearest.file))
precondition(
    nearestImage.statedFrameIndex() == 1,
    "Decoded image must show frame 1, shows \(nearestImage.statedFrameIndex())")
print("PASS nearest sample 140000us -> \(nearest.actualSourceUs)us showing frame 1")

func decode(
    _ named: String, atSourceUs: Int64, in kept: FrameInterval, from source: FrameSource,
    crop: FrameCrop? = nil, maxLongEdge: Int = FrameLimits.defaultLongEdge
) async throws -> DecodedFrame {
    try await source.decodeFrame(
        FrameRequest(
            atSourceUs: atSourceUs, kept: kept, output: images.appendingPathComponent("\(named).png"),
            crop: crop, maxLongEdge: maxLongEdge))
}

func failure(_ body: () async throws -> Void) async -> FrameFailure? {
    do {
        try await body()
        return nil
    } catch let error as FrameFailure {
        return error
    } catch {
        return FrameFailure("UNEXPECTED", "\(error)")
    }
}

let tie = try await decode("tie", atSourceUs: 150_000, in: whole, from: source)
let tieImage = try FixtureImage(contentsOf: URL(fileURLWithPath: tie.file))
precondition(
    tie.actualSourceUs == 100_000 && tie.distanceUs == 50_000 && tieImage.statedFrameIndex() == 1,
    "Equidistant samples must resolve to the earlier frame 1 at 100000us, got \(tie) showing \(tieImage.statedFrameIndex())")
print("PASS tie at 150000us -> earlier frame 1 at 100000us")

let endBound = try await decode(
    "end-boundary", atSourceUs: 195_000, in: FrameInterval(startUs: 0, endUs: 200_000), from: source)
precondition(
    endBound.actualSourceUs == 100_000,
    "A half-open interval must exclude the sample at its end, got \(endBound)")
print("PASS interval end 200000us excludes its own sample, held frame 1 at distance \(endBound.distanceUs)us")

let startBound = try await decode(
    "start-boundary", atSourceUs: 200_000, in: FrameInterval(startUs: 200_000, endUs: 400_000),
    from: source)
let startImage = try FixtureImage(contentsOf: URL(fileURLWithPath: startBound.file))
precondition(
    startBound.actualSourceUs == 200_000 && startBound.distanceUs == 0
        && startImage.statedFrameIndex() == 2,
    "An interval must include the sample at its start, got \(startBound) showing \(startImage.statedFrameIndex())")
print("PASS interval start 200000us keeps its own sample, frame 2")

let afterCut = try await decode(
    "cut-following-span", atSourceUs: 1_010_000,
    in: FrameInterval(startUs: 1_005_000, endUs: 1_400_000), from: source)
let afterCutImage = try FixtureImage(contentsOf: URL(fileURLWithPath: afterCut.file))
precondition(
    afterCut.actualSourceUs == 1_100_000 && afterCutImage.statedFrameIndex() == 11,
    "A removed frame 10000us away must lose to the kept frame 90000us away, got \(afterCut) showing \(afterCutImage.statedFrameIndex())")
print("PASS removed neighbour at 1000000us rejected for kept frame 11 at 1100000us")

let beforeCut = try await decode(
    "cut-preceding-span", atSourceUs: 1_190_000,
    in: FrameInterval(startUs: 1_000_000, endUs: 1_195_000), from: source)
precondition(
    beforeCut.actualSourceUs == 1_100_000 && beforeCut.distanceUs == 90_000,
    "A removed frame past the interval end must lose to the kept frame inside it, got \(beforeCut)")
print("PASS removed neighbour at 1200000us rejected for kept frame at 1100000us")

let empty = await failure {
    _ = try await decode(
        "unavailable", atSourceUs: 1_050_000, in: FrameInterval(startUs: 1_010_000, endUs: 1_090_000),
        from: source)
}
precondition(
    empty?.code == "UNAVAILABLE",
    "An interval between two samples must report unavailable, got \(String(describing: empty))")
print("PASS interval [1010000,1090000) holds no sample: \(empty!.message)")

let sparseFixture = evidence.appendingPathComponent("sparse.mp4")
try await FixtureWriter.write(
    to: sparseFixture,
    times: [0, 2_500_000, 7_000_000].map { CMTime(value: $0, timescale: 1_000_000) })
let sparseTruth = try await FixtureTruth.presentationMicroseconds(of: sparseFixture)
precondition(
    sparseTruth == [0, 2_500_000, 7_000_000],
    "Sparse fixture must present three samples, got \(sparseTruth)")
let sparse = try await FrameSource(url: sparseFixture)

let heldSparse = try await decode(
    "sparse-held", atSourceUs: 6_900_000, in: FrameInterval(startUs: 2_000_000, endUs: 8_000_000),
    from: sparse)
let sparseImage = try FixtureImage(contentsOf: URL(fileURLWithPath: heldSparse.file))
precondition(
    heldSparse.actualSourceUs == 7_000_000 && heldSparse.distanceUs == 100_000
        && sparseImage.statedFrameIndex() == 2,
    "Sparse media must report the actual sample and its distance, got \(heldSparse) showing \(sparseImage.statedFrameIndex())")
let staleSparse = try await decode(
    "sparse-distant", atSourceUs: 4_000_000, in: FrameInterval(startUs: 2_000_000, endUs: 6_000_000),
    from: sparse)
precondition(
    staleSparse.actualSourceUs == 2_500_000 && staleSparse.distanceUs == 1_500_000,
    "A held sparse frame must report its real 1500000us distance, got \(staleSparse)")
let sparseGap = await failure {
    _ = try await decode(
        "sparse-gap", atSourceUs: 4_000_000, in: FrameInterval(startUs: 3_000_000, endUs: 6_000_000),
        from: sparse)
}
precondition(
    sparseGap?.code == "UNAVAILABLE",
    "A sparse frame must not be held across an interval that excludes its sample, got \(String(describing: sparseGap))")
print("PASS sparse media holds frame 2 at 100000us, reports 1500000us distance, and never crosses its interval")

// A crop that straddles the marker corner, the background and two bit blocks pins both crop axes;
// a crop landing inside one flat region would pass with the origin mirrored or transposed.
let straddle = try await decode(
    "crop-straddle", atSourceUs: 300_000, in: whole, from: source,
    crop: FrameCrop(x: 20, y: 20, width: 60, height: 60))
let straddleImage = try FixtureImage(contentsOf: URL(fileURLWithPath: straddle.file))
precondition(
    straddle.width == 60 && straddle.height == 60 && straddleImage.width == 60
        && straddleImage.height == 60,
    "A 60x60 crop must produce a 60x60 image, got \(straddle) file \(straddleImage.width)x\(straddleImage.height)")
let cropMarker = straddleImage.color(x: 4, y: 4)
let cropBackground = straddleImage.color(x: 34, y: 8)
let cropBlock = straddleImage.color(x: 32, y: 48)
let cropGap = straddleImage.color(x: 21, y: 48)
precondition(
    cropMarker.red > 0.75 && cropMarker.green < 0.35 && cropMarker.blue < 0.35,
    "Crop x,y is the top-left corner of the oriented image; expected the marker corner, got \(cropMarker)")
precondition(
    cropBackground.red < 0.35 && cropBackground.green < 0.35 && cropBackground.blue < 0.35,
    "Pixels right of the marker must stay background, got \(cropBackground)")
precondition(
    (cropBlock.red + cropBlock.green + cropBlock.blue) / 3 > 0.75,
    "Frame 3 sets bit 1, so its second block must appear 40 rows into the crop, got \(cropBlock)")
precondition(
    (cropGap.red + cropGap.green + cropGap.blue) / 3 < 0.35,
    "The gap between bit blocks must stay background, got \(cropGap)")
print("PASS crop 20,20 60x60 places the marker, background, bit block and block gap where the source has them")

let croppedAndScaled = try await decode(
    "crop-scaled", atSourceUs: 300_000, in: whole, from: source,
    crop: FrameCrop(x: 20, y: 20, width: 60, height: 60), maxLongEdge: 30)
precondition(
    croppedAndScaled.width == 30 && croppedAndScaled.height == 30,
    "Scaling applies to the crop, not the whole frame, got \(croppedAndScaled)")
print("PASS a 60x60 crop bounded to 30 pixels scales after cropping")

let downscaled = try await decode(
    "downscale", atSourceUs: 300_000, in: whole, from: source, maxLongEdge: 64)
let downscaledImage = try FixtureImage(contentsOf: URL(fileURLWithPath: downscaled.file))
precondition(
    downscaled.width == 64 && downscaled.height == 48 && downscaledImage.width == 64
        && downscaledImage.height == 48,
    "A 320x240 frame bounded to 64 pixels must become 64x48, got \(downscaled)")
let unscaled = try await decode("full-size", atSourceUs: 300_000, in: whole, from: source)
precondition(
    unscaled.width == 320 && unscaled.height == 240,
    "A frame below the long-edge bound must not be upscaled, got \(unscaled)")
print("PASS 64-pixel bound gives 64x48 and the default bound leaves 320x240")

let rotatedFixture = evidence.appendingPathComponent("rotated.mp4")
try await FixtureWriter.write(
    to: rotatedFixture, times: steps(12, everyUs: 100_000),
    transform: CGAffineTransform(rotationAngle: .pi / 2))
let rotated = try await FrameSource(url: rotatedFixture)
precondition(
    rotated.width == 240 && rotated.height == 320,
    "A quarter-turn track must report oriented 240x320, got \(rotated.width)x\(rotated.height)")
let rotatedFrame = try await decode(
    "rotated", atSourceUs: 500_000, in: FrameInterval(startUs: 0, endUs: 1_200_000), from: rotated)
let rotatedImage = try FixtureImage(contentsOf: URL(fileURLWithPath: rotatedFrame.file))

// Independent orientation oracle: AVAssetImageGenerator applies the same preferred transform.
let generator = AVAssetImageGenerator(
    asset: AVURLAsset(url: rotatedFixture, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true]))
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
let (oracleImage, _) = try await generator.image(at: CMTime(value: 500_000, timescale: 1_000_000))
let oracleURL = images.appendingPathComponent("rotated-oracle.png")
let oracleData = NSMutableData()
let oracleDestination = CGImageDestinationCreateWithData(oracleData, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(oracleDestination, oracleImage, nil)
precondition(CGImageDestinationFinalize(oracleDestination), "Cannot encode orientation oracle")
try (oracleData as Data).write(to: oracleURL)
let oracle = try FixtureImage(contentsOf: oracleURL)

func corners(_ image: FixtureImage) -> [(red: Double, green: Double, blue: Double)] {
    [(0, 0), (image.width - 8, 0), (0, image.height - 8), (image.width - 8, image.height - 8)].map {
        image.color(x: $0.0, y: $0.1)
    }
}
let decodedCorners = corners(rotatedImage)
let oracleCorners = corners(oracle)
precondition(
    rotatedImage.width == oracle.width && rotatedImage.height == oracle.height,
    "Oriented size must match the oracle, got \(rotatedImage.width)x\(rotatedImage.height) vs \(oracle.width)x\(oracle.height)")
for (index, pair) in zip(decodedCorners, oracleCorners).enumerated() {
    let delta = max(
        abs(pair.0.red - pair.1.red), abs(pair.0.green - pair.1.green),
        abs(pair.0.blue - pair.1.blue))
    precondition(
        delta < 0.12,
        "Corner \(index) must match the orientation oracle, got \(pair.0) vs \(pair.1)")
}
let redCorner = decodedCorners.firstIndex { $0.red > 0.6 && $0.green < 0.4 && $0.blue < 0.4 }
precondition(
    redCorner == 1,
    "A quarter turn must move the drawn top-left marker to the top right, got corner \(String(describing: redCorner))")
print("PASS rotated source is oriented 240x320 with corners matching the image-generator oracle")

let croppedPastOrientation = await failure {
    _ = try await decode(
        "invalid-rotated-crop", atSourceUs: 500_000, in: FrameInterval(startUs: 0, endUs: 1_200_000),
        from: rotated, crop: FrameCrop(x: 200, y: 0, width: 60, height: 60))
}
precondition(
    croppedPastOrientation?.code == "INVALID_RANGE",
    "A crop beyond the oriented width must be rejected, got \(String(describing: croppedPastOrientation))")
let sameCropUnrotated = try await decode(
    "crop-wide", atSourceUs: 500_000, in: whole, from: source,
    crop: FrameCrop(x: 200, y: 0, width: 60, height: 60))
precondition(
    sameCropUnrotated.width == 60,
    "The same crop must succeed on the wider unrotated source, got \(sameCropUnrotated)")
print("PASS crops are validated against the oriented image, not the stored raster")

let sourceBefore = try Data(contentsOf: stepsFixture)
let rejected = await [
    "reversed interval": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: FrameInterval(startUs: 900_000, endUs: 400_000),
            from: source)
    },
    "empty interval": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: FrameInterval(startUs: 500_000, endUs: 500_000),
            from: source)
    },
    "negative time": failure {
        _ = try await decode("invalid", atSourceUs: -1, in: whole, from: source)
    },
    "negative interval": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: FrameInterval(startUs: -100, endUs: 400_000),
            from: source)
    },
    "crop past the right edge": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            crop: FrameCrop(x: 300, y: 0, width: 40, height: 40))
    },
    "crop past the bottom edge": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            crop: FrameCrop(x: 0, y: 220, width: 40, height: 40))
    },
    "overflowing crop": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            crop: FrameCrop(x: Int.max, y: 0, width: 1, height: 1))
    },
    "zero-size crop": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            crop: FrameCrop(x: 0, y: 0, width: 0, height: 40))
    },
    "long edge over the maximum": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            maxLongEdge: FrameLimits.maximumLongEdge + 1)
    },
    "encoded limit over the maximum": failure {
        _ = try await source.decodeFrame(
            FrameRequest(
                atSourceUs: 500_000, kept: whole, output: images.appendingPathComponent("invalid.png"),
                maxEncodedBytes: FrameLimits.maximumEncodedBytes + 1))
    },
]
for (name, error) in rejected.sorted(by: { $0.key < $1.key }) {
    precondition(
        error?.code == "INVALID_RANGE",
        "\(name) must be rejected as INVALID_RANGE, got \(String(describing: error))")
}
let overwrite = await failure {
    _ = try await source.decodeFrame(
        FrameRequest(atSourceUs: 500_000, kept: whole, output: stepsFixture))
}
precondition(
    overwrite?.code == "INVALID_OUTPUT",
    "Writing the frame over its own source must be rejected, got \(String(describing: overwrite))")
let aliasDirectory = evidence.appendingPathComponent("source-alias")
try? FileManager.default.removeItem(at: aliasDirectory)
try FileManager.default.createSymbolicLink(at: aliasDirectory, withDestinationURL: evidence)
let aliasOverwrite = await failure {
    _ = try await source.decodeFrame(
        FrameRequest(
            atSourceUs: 500_000, kept: whole,
            output: aliasDirectory.appendingPathComponent(stepsFixture.lastPathComponent)))
}
precondition(
    aliasOverwrite?.code == "INVALID_OUTPUT",
    "A directory symlink must not allow overwriting source media, got \(String(describing: aliasOverwrite))")
try FileManager.default.removeItem(at: aliasDirectory)
let sourceAfter = try Data(contentsOf: stepsFixture)
precondition(sourceAfter == sourceBefore, "Rejected requests must not touch the source media")
print("PASS \(rejected.count) invalid requests rejected, source media unchanged")

let capped = images.appendingPathComponent("over-limit.png")
try? FileManager.default.removeItem(at: capped)
let overLimit = await failure {
    _ = try await source.decodeFrame(
        FrameRequest(atSourceUs: 500_000, kept: whole, output: capped, maxEncodedBytes: 2_000))
}
precondition(
    overLimit?.code == "LIMIT_EXCEEDED",
    "An encoded frame over the requested byte limit must report LIMIT_EXCEEDED, got \(String(describing: overLimit))")
precondition(
    !FileManager.default.fileExists(atPath: capped.path),
    "An over-limit frame must not leave a truncated file behind")
let withinLimit = try await source.decodeFrame(
    FrameRequest(
        atSourceUs: 500_000, kept: whole, output: capped, maxLongEdge: 64, maxEncodedBytes: 2_000))
precondition(
    withinLimit.bytes <= 2_000 && withinLimit.bytes > 0,
    "A bounded frame must report its real encoded size, got \(withinLimit.bytes) bytes")
print("PASS encoded size limit rejects \(overLimit!.message) and accepts \(withinLimit.bytes) bytes at 64 pixels")

for (index, actualUs) in stepsTruth.enumerated() {
    let selected = try await source.selection(atSourceUs: actualUs, in: whole)
    precondition(
        selected.actualSourceUs == actualUs && selected.distanceUs == 0,
        "Requesting sample \(index) at \(actualUs)us must select itself, got \(selected)")
    let nudged = try await source.selection(atSourceUs: actualUs + 40_000, in: whole)
    precondition(
        nudged.actualSourceUs == actualUs && nudged.distanceUs == 40_000,
        "Requesting \(actualUs + 40_000)us must still select sample \(index), got \(nudged)")
}
print("PASS all \(stepsTruth.count) decoded sample timestamps are reachable and self-selecting")

let longFixture = evidence.appendingPathComponent("long-10min-10fps.mp4")
let longFrames = 6_000
let generationStart = Date()
try await FixtureWriter.write(
    to: longFixture, times: steps(longFrames, everyUs: 100_000), keyFrameInterval: 300)
let generationSeconds = Date().timeIntervalSince(generationStart)
let sequentialStart = Date()
let longTruth = try await FixtureTruth.presentationMicroseconds(of: longFixture)
let sequentialSeconds = Date().timeIntervalSince(sequentialStart)
precondition(
    longTruth.count == longFrames && longTruth.last == Int64(longFrames - 1) * 100_000,
    "Long fixture must hold \(longFrames) samples ending at 599900000us, got \(longTruth.count) ending \(String(describing: longTruth.last))")

let longSource = try await FrameSource(url: longFixture)
// A fixed seed keeps the sampled positions identical between runs.
struct RepeatableIndexes {
    private var seed: UInt64 = 0x5EED_1234
    mutating func next(below bound: Int) -> Int {
        seed = seed &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
        return Int((seed >> 33) % UInt64(bound))
    }
}
var indexes = RepeatableIndexes()
var randomAccessSeconds: [Double] = []
for request in 0..<20 {
    let index = request == 0 ? longFrames - 1 : indexes.next(below: longFrames)
    let expectedUs = Int64(index) * 100_000
    let start = Date()
    let frame = try await decode(
        "long-\(index)", atSourceUs: expectedUs + 30_000,
        in: FrameInterval(startUs: 0, endUs: Int64(longFrames) * 100_000), from: longSource)
    randomAccessSeconds.append(Date().timeIntervalSince(start))
    let picture = try FixtureImage(contentsOf: URL(fileURLWithPath: frame.file))
    precondition(
        frame.actualSourceUs == expectedUs,
        "Random request near sample \(index) must decode \(expectedUs)us, got \(frame)")
    precondition(
        picture.statedFrameIndex() == index % 256,
        "Decoded picture must show frame \(index % 256), shows \(picture.statedFrameIndex())")
}
let slowest = randomAccessSeconds.max()!
let total = randomAccessSeconds.reduce(0, +)
precondition(
    slowest < sequentialSeconds / 4,
    "Random access must not cost a whole-video decode: slowest \(slowest)s against \(sequentialSeconds)s sequential")
print(
    String(
        format:
            "PASS 20 random frames from a %.0f-minute file: slowest %.3fs, total %.3fs, whole-file decode %.3fs",
        Double(longFrames) / 600, slowest, total, sequentialSeconds))

let measurements: [String: Any] = [
    "fixtureFrames": longFrames,
    "fixtureGenerationSeconds": generationSeconds,
    "wholeFileDecodeSeconds": sequentialSeconds,
    "randomAccessSeconds": randomAccessSeconds,
    "slowestRandomAccessSeconds": slowest,
    "medianRandomAccessSeconds": randomAccessSeconds.sorted()[randomAccessSeconds.count / 2],
    "images": images.path,
]
try JSONSerialization.data(
    withJSONObject: measurements, options: [.prettyPrinted, .sortedKeys]
).write(to: evidence.appendingPathComponent("random-access.json"))
print("PASS evidence written to \(evidence.path)")

let referenceIndex = 7
let referenceURL = images.appendingPathComponent("reference-frame-7.png")
try FixtureFrame.referencePNG(
    index: referenceIndex, atUs: Int64(referenceIndex) * 100_000, width: 320, height: 240
).write(to: referenceURL)
let decodedSeven = try await decode(
    "decoded-frame-7", atSourceUs: Int64(referenceIndex) * 100_000, in: whole, from: source)
let decodedImage = try FixtureImage(contentsOf: URL(fileURLWithPath: decodedSeven.file))
let reference = try FixtureImage(contentsOf: referenceURL)
let difference = decodedImage.difference(to: reference)
precondition(
    decodedSeven.actualSourceUs == 700_000 && difference < 0.03,
    "Decoded frame 7 must show the picture it was generated from, mean channel difference \(difference)")
print(String(format: "PASS decoded frame 7 matches its generated reference, mean difference %.4f", difference))
