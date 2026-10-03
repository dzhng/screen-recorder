@preconcurrency import AVFoundation
import Foundation
import ScreenRecorderFrames
import ScreenRecorderMedia

// Outputs are published only at new paths, so a run starts from an empty evidence directory. A
// caller that supplies one supplies a fresh one.
let evidence: URL
if let supplied = ProcessInfo.processInfo.environment["SCREENREC_FRAME_EVIDENCE"] {
    evidence = URL(fileURLWithPath: supplied)
} else {
    evidence = URL(fileURLWithPath: NSTemporaryDirectory() + "screenrec-frame-tests")
    try? FileManager.default.removeItem(at: evidence)
}
try FileManager.default.createDirectory(at: evidence, withIntermediateDirectories: true)
let images = evidence.appendingPathComponent("images")
try FileManager.default.createDirectory(at: images, withIntermediateDirectories: true)

if CommandLine.arguments.contains("--pointer-readability") {
    try await verifyCompositionPointerReadability(in: images)
    exit(0)
}

try await verifyCompositionPNG(in: images)
try await verifyCompositionSourceColors(in: images)
try await verifyCompositionMovieTerminal(in: images)
if CommandLine.arguments.contains("--composition-png") { exit(0) }

try await verifyExactPresentation(in: images)
if CommandLine.arguments.contains("--exact-picture") { exit(0) }

try await verifySourcePictures(in: images)
if CommandLine.arguments.contains("--source-pictures") { exit(0) }

try await verifyCompositionPointerReadability(in: images)

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

try await verifySourceSceneBounds(source: stepsFixture)

try await verifyPresentationPublicationRace(source: stepsFixture, parent: evidence)
print("PASS current source and composition picture evidence written to \(evidence.path)")
