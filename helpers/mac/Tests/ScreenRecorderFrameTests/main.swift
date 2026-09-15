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
    overlay: FrameOverlay? = nil, crop: FrameCrop? = nil,
    maxLongEdge: Int = FrameLimits.defaultLongEdge
) async throws -> DecodedFrame {
    try await source.decodeFrame(
        FrameRequest(
            atSourceUs: atSourceUs, kept: kept, output: images.appendingPathComponent("\(named).png"),
            overlay: overlay, crop: crop, maxLongEdge: maxLongEdge))
}

/// How far a sampled patch sits from the fixture's flat background, 0...1. Overlay ink is the only
/// thing that moves a background patch, so this reads "was something drawn here".
func ink(_ image: FixtureImage, x: Int, y: Int, size: Int = 3) -> Double {
    let sampled = image.color(x: x, y: y, width: size, height: size)
    return max(
        abs(sampled.red - 0.12), abs(sampled.green - 0.12), abs(sampled.blue - 0.12))
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

// Cursor overlay ------------------------------------------------------------------------------

let clean = try await decode("overlay-clean", atSourceUs: 300_000, in: whole, from: source)
let cleanImage = try FixtureImage(contentsOf: URL(fileURLWithPath: clean.file))
precondition(clean.overlay == nil, "A frame requested without an overlay must report none, got \(clean)")

let pointerOnly = try await decode(
    "overlay-pointer", atSourceUs: 300_000, in: whole, from: source,
    overlay: FrameOverlay(pointer: CursorPoint(atSourceUs: 300_000, x: 180, y: 150)))
let pointerImage = try FixtureImage(contentsOf: URL(fileURLWithPath: pointerOnly.file))
precondition(
    ink(pointerImage, x: 181, y: 154) > 0.4,
    "The pointer must be drawn at its supplied hot spot, got ink \(ink(pointerImage, x: 181, y: 154))")
precondition(
    ink(cleanImage, x: 181, y: 154) < 0.1,
    "The same frame without an overlay must stay clean there, got ink \(ink(cleanImage, x: 181, y: 154))")
precondition(
    ink(pointerImage, x: 172, y: 148, size: 4) < 0.1 && ink(pointerImage, x: 177, y: 141, size: 4) < 0.1,
    "The pointer glyph must sit below and right of its hot spot, not around it")
precondition(
    pointerOnly.overlay?.pointerSourceUs == 300_000 && pointerOnly.overlay?.trailPoints == 0
        && pointerOnly.overlay?.trailStartUs == nil,
    "A pointer-only overlay must report the pointer time and no trail, got \(String(describing: pointerOnly.overlay))")
print("PASS pointer-only overlay draws an asymmetric glyph at its hot spot and leaves the clean frame clean")

/// A run of points along a fixture row, newest last, ending at `endUs`.
func row(from firstX: Int, to lastX: Int, y: Int, step: Int, endingUs: Int64, everyUs: Int64)
    -> [CursorPoint]
{
    let columns = Array(stride(from: firstX, through: lastX, by: step))
    return columns.enumerated().map { offset, x in
        CursorPoint(
            atSourceUs: endingUs - Int64(columns.count - 1 - offset) * everyUs, x: Double(x),
            y: Double(y))
    }
}

let trailRun = row(from: 150, to: 270, y: 210, step: 10, endingUs: 2_500_000, everyUs: 100_000)
let trailed = try await decode(
    "overlay-trail", atSourceUs: 2_500_000, in: whole, from: source,
    overlay: FrameOverlay(
        trail: [trailRun], trailUs: 2_000_000,
        pointer: CursorPoint(atSourceUs: 2_500_000, x: 270, y: 210)))
let trailImage = try FixtureImage(contentsOf: URL(fileURLWithPath: trailed.file))
let oldestInk = ink(trailImage, x: 149, y: 209)
let newestInk = ink(trailImage, x: 239, y: 209)
precondition(
    oldestInk > 0.15,
    "The oldest supplied point must still be drawn, got ink \(oldestInk)")
precondition(
    newestInk > oldestInk + 0.1,
    "A trail must fade with age: newest ink \(newestInk) against oldest \(oldestInk)")
precondition(
    ink(trailImage, x: 200, y: 180) < 0.1,
    "Nothing may be drawn off the supplied path, got ink \(ink(trailImage, x: 200, y: 180))")
precondition(
    trailed.overlay?.trailPoints == trailRun.count
        && trailed.overlay?.trailStartUs == trailRun.first!.atSourceUs
        && trailed.overlay?.trailEndUs == trailRun.last!.atSourceUs,
    "The result must report the trail it drew, got \(String(describing: trailed.overlay))")
print(
    String(
        format: "PASS trail draws every supplied point and fades with age: newest %.2f, oldest %.2f",
        newestInk, oldestInk))

// Two runs separated by a gap in the evidence: an invisible or unsampled pointer.
let gapped = try await decode(
    "overlay-gap", atSourceUs: 2_500_000, in: whole, from: source,
    overlay: FrameOverlay(
        trail: [
            row(from: 150, to: 180, y: 210, step: 10, endingUs: 1_700_000, everyUs: 100_000),
            row(from: 240, to: 270, y: 210, step: 10, endingUs: 2_500_000, everyUs: 100_000),
        ], trailUs: 2_000_000))
let gapImage = try FixtureImage(contentsOf: URL(fileURLWithPath: gapped.file))
precondition(
    ink(gapImage, x: 149, y: 209) > 0.15 && ink(gapImage, x: 269, y: 209) > 0.15,
    "Both runs must be drawn, got \(ink(gapImage, x: 149, y: 209)) and \(ink(gapImage, x: 269, y: 209))")
precondition(
    ink(gapImage, x: 209, y: 209, size: 6) < 0.1,
    "No path may be drawn across a gap between runs, got ink \(ink(gapImage, x: 209, y: 209, size: 6))")
precondition(
    gapped.overlay?.trailPoints == 8 && gapped.overlay?.trailStartUs == 1_400_000
        && gapped.overlay?.trailEndUs == 2_500_000,
    "Gapped runs must report their real first and last times, got \(String(describing: gapped.overlay))")
print("PASS two runs are drawn without a path across the gap between them")

// Source coordinates stay valid because drawing precedes the crop: read in cropped coordinates,
// every one of these points would land outside the 100x40 image.
let croppedOverlay = FrameOverlay(
    trail: [trailRun], trailUs: 2_000_000,
    pointer: CursorPoint(atSourceUs: 2_500_000, x: 200, y: 195))
let croppedTrail = try await decode(
    "overlay-cropped", atSourceUs: 2_500_000, in: whole, from: source, overlay: croppedOverlay,
    crop: FrameCrop(x: 140, y: 190, width: 100, height: 40))
let croppedImage = try FixtureImage(contentsOf: URL(fileURLWithPath: croppedTrail.file))
precondition(
    croppedImage.width == 100 && croppedImage.height == 40,
    "The crop must still bound the image, got \(croppedImage.width)x\(croppedImage.height)")
precondition(
    ink(croppedImage, x: 9, y: 19) > 0.15 && ink(croppedImage, x: 97, y: 19) > 0.15,
    "The trail must appear at its source coordinates inside the crop, got \(ink(croppedImage, x: 9, y: 19)) and \(ink(croppedImage, x: 97, y: 19))")
precondition(
    ink(croppedImage, x: 61, y: 9) > 0.4,
    "The pointer must appear at its source hot spot inside the crop, got \(ink(croppedImage, x: 61, y: 9))")
print("PASS overlay coordinates are source pixels: a 140,190 crop keeps the trail and pointer in place")

let scaledTrail = try await decode(
    "overlay-scaled", atSourceUs: 2_500_000, in: whole, from: source,
    overlay: FrameOverlay(trail: [trailRun], trailUs: 2_000_000), maxLongEdge: 160)
let scaledImage = try FixtureImage(contentsOf: URL(fileURLWithPath: scaledTrail.file))
precondition(
    scaledImage.width == 160 && scaledImage.height == 120,
    "The long-edge bound must still apply, got \(scaledImage.width)x\(scaledImage.height)")
precondition(
    ink(scaledImage, x: 134, y: 104, size: 2) > 0.15,
    "A halved frame must show the newest trail point at half its coordinates, got \(ink(scaledImage, x: 134, y: 104, size: 2))")
precondition(
    ink(scaledImage, x: 100, y: 90, size: 2) < 0.1,
    "Nothing may be drawn off the scaled path, got \(ink(scaledImage, x: 100, y: 90, size: 2))")
print("PASS the overlay is drawn before the long-edge bound and scales with the frame")

let repeated = try await decode(
    "overlay-repeat", atSourceUs: 2_500_000, in: whole, from: source, overlay: croppedOverlay)
let repeatedAgain = try await decode(
    "overlay-repeat-again", atSourceUs: 2_500_000, in: whole, from: source, overlay: croppedOverlay)
let repeatedBytes = try Data(contentsOf: URL(fileURLWithPath: repeated.file))
let repeatedAgainBytes = try Data(contentsOf: URL(fileURLWithPath: repeatedAgain.file))
precondition(
    repeatedBytes == repeatedAgainBytes,
    "The same overlay request must produce the same pixels, got \(repeatedBytes.count) and \(repeatedAgainBytes.count) bytes")
print("PASS repeating an overlay request produces identical bytes")

/// Share of a rectangle's pixels the overlay changed. A gesture that circles a control has to stay
/// readable over it, so this bounds how much of the target it is allowed to cover.
func changedShare(_ drawn: FixtureImage, from base: FixtureImage, x: Int, y: Int, width: Int, height: Int)
    -> Double
{
    var changed = 0
    for row in y..<(y + height) {
        for column in x..<(x + width) {
            let a = drawn.color(x: column, y: row, width: 1, height: 1)
            let b = base.color(x: column, y: row, width: 1, height: 1)
            if max(abs(a.red - b.red), abs(a.green - b.green), abs(a.blue - b.blue)) > 0.1 {
                changed += 1
            }
        }
    }
    return Double(changed) / Double(width * height)
}

let gestureUs: Int64 = 2_500_000
let circle = (0..<48).map { step -> CursorPoint in
    let angle = Double(step) / 48 * 2 * Double.pi
    return CursorPoint(
        atSourceUs: gestureUs - Int64(47 - step) * 34_000,
        x: 70 + 24 * cos(angle), y: 212 + 24 * sin(angle))
}
let wave = (0..<40).map { step -> CursorPoint in
    let progress = Double(step) / 39
    return CursorPoint(
        atSourceUs: gestureUs - Int64(39 - step) * 31_000, x: 12 + progress * 188,
        y: 155 + 13 * sin(progress * 3 * Double.pi))
}
let reviewModes: [(String, FrameOverlay?, FrameCrop?, Int)] = [
    ("review-clean", nil, nil, FrameLimits.defaultLongEdge),
    ("review-pointer-only", FrameOverlay(pointer: circle.last!), nil, FrameLimits.defaultLongEdge),
    (
        "review-circle-2s", FrameOverlay(trail: [circle], trailUs: 2_000_000, pointer: circle.last!),
        nil, FrameLimits.defaultLongEdge
    ),
    (
        "review-circle-10s",
        FrameOverlay(trail: [circle], trailUs: FrameLimits.maximumTrailUs, pointer: circle.last!),
        nil, FrameLimits.defaultLongEdge
    ),
    (
        "review-wave-2s", FrameOverlay(trail: [wave], trailUs: 2_000_000, pointer: wave.last!), nil,
        FrameLimits.defaultLongEdge
    ),
    (
        "review-circle-crop",
        FrameOverlay(trail: [circle], trailUs: 2_000_000, pointer: circle.last!),
        FrameCrop(x: 0, y: 180, width: 160, height: 60), FrameLimits.defaultLongEdge
    ),
    (
        "review-circle-scaled",
        FrameOverlay(trail: [circle], trailUs: 2_000_000, pointer: circle.last!), nil, 160
    ),
]
var reviewImages: [String: FixtureImage] = [:]
for (named, overlay, crop, maxLongEdge) in reviewModes {
    let frame = try await decode(
        named, atSourceUs: gestureUs, in: whole, from: source, overlay: overlay, crop: crop,
        maxLongEdge: maxLongEdge)
    reviewImages[named] = try FixtureImage(contentsOf: URL(fileURLWithPath: frame.file))
}
let circled = reviewImages["review-circle-2s"]!
let reviewClean = reviewImages["review-clean"]!
let buttonCover = changedShare(
    circled, from: reviewClean, x: FixtureFrame.buttonLeft, y: FixtureFrame.buttonTop,
    width: FixtureFrame.buttonWidth, height: FixtureFrame.buttonHeight)
precondition(
    buttonCover > 0.02 && buttonCover < 0.35,
    "A circle around the button must mark it without blanketing it, covered \(buttonCover)")
// The far side of the circle, well away from the pointer that closes it.
let farSide = (x: 44, y: 210, size: 5)
precondition(
    changedShare(
        reviewImages["review-pointer-only"]!, from: reviewClean, x: farSide.x, y: farSide.y,
        width: farSide.size, height: farSide.size) == 0,
    "A pointer-only frame must draw no path: the far side of the circle must match the clean frame")
precondition(
    changedShare(
        circled, from: reviewClean, x: farSide.x, y: farSide.y, width: farSide.size,
        height: farSide.size) > 0.5,
    "The same request with a trail must draw that same far side of the circle")
print(
    String(
        format: "PASS circle, wave and mode renders written; the circled button keeps %.0f%% of its pixels",
        (1 - buttonCover) * 100))

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
    "trail point off the source raster": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            overlay: FrameOverlay(
                trail: [[CursorPoint(atSourceUs: 400_000, x: 320.5, y: 10)]], trailUs: 2_000_000))
    },
    "trail point with a non-finite coordinate": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            overlay: FrameOverlay(
                trail: [[CursorPoint(atSourceUs: 400_000, x: .nan, y: 10)]], trailUs: 2_000_000))
    },
    "trail points out of order": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            overlay: FrameOverlay(
                trail: [[
                    CursorPoint(atSourceUs: 400_000, x: 10, y: 10),
                    CursorPoint(atSourceUs: 300_000, x: 20, y: 20),
                ]], trailUs: 2_000_000))
    },
    "trail runs overlapping in time": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            overlay: FrameOverlay(
                trail: [
                    [CursorPoint(atSourceUs: 400_000, x: 10, y: 10)],
                    [CursorPoint(atSourceUs: 300_000, x: 20, y: 20)],
                ], trailUs: 2_000_000))
    },
    "empty trail run": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            overlay: FrameOverlay(trail: [[]], trailUs: 2_000_000))
    },
    "trail over the point limit": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            overlay: FrameOverlay(
                trail: [
                    (0...FrameLimits.maximumTrailPoints).map {
                        CursorPoint(atSourceUs: Int64($0) * 100, x: Double($0 % 300), y: 10)
                    }
                ], trailUs: 2_000_000))
    },
    "trail duration over the maximum": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            overlay: FrameOverlay(
                trail: [[CursorPoint(atSourceUs: 400_000, x: 10, y: 10)]],
                trailUs: FrameLimits.maximumTrailUs + 1))
    },
    "trail without a duration": failure {
        _ = try await decode(
            "invalid", atSourceUs: 500_000, in: whole, from: source,
            overlay: FrameOverlay(trail: [[CursorPoint(atSourceUs: 400_000, x: 10, y: 10)]]))
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
            output: aliasDirectory.appendingPathComponent(stepsFixture.lastPathComponent),
            overlay: FrameOverlay(
                trail: [[CursorPoint(atSourceUs: 400_000, x: 10, y: 10)]], trailUs: 2_000_000,
                pointer: CursorPoint(atSourceUs: 500_000, x: 20, y: 20))))
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
