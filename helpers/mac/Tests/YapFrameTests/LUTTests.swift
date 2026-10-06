import CoreGraphics
import CoreImage
import CryptoKit
import Foundation
import YapMedia
@testable import YapFrames

func verifyLUTs(in directory: URL) async throws {
    func text(_ size: Int, _ response: (Float, Float, Float) -> [Float]) -> String {
        var rows = ["TITLE \"Numeric control\"", "LUT_3D_SIZE \(size)", "DOMAIN_MIN 0 0 0", "DOMAIN_MAX 1 1 1"]
        for b in 0..<size { for g in 0..<size { for r in 0..<size {
            rows.append(response(Float(r)/Float(size-1), Float(g)/Float(size-1), Float(b)/Float(size-1)).map { String($0) }.joined(separator: " "))
        } } }
        return rows.joined(separator: "\n") + "\n"
    }
    let identityText = text(2) { [$0, $1, $2] }
    let identity = try CubeLUT(data: Data(identityText.utf8))
    precondition(identity.metadata.size == 2 && identity.rgba[4...7] == [1,0,0,1])
    for malformed in [identityText.replacingOccurrences(of: "LUT_3D_SIZE 2", with: "LUT_3D_SIZE 34"), identityText.replacingOccurrences(of: "DOMAIN_MIN 0 0 0", with: "DOMAIN_MIN -1 0 0"), identityText + "1 1 1\n", identityText.replacingOccurrences(of: "0.0 1.0 1.0", with: "NaN 1 1"), identityText + "LUT_1D_SIZE 2\n", "LUT_3D_SIZE 2\n0 0 0\n"] {
        do { _ = try CubeLUT(data: Data(malformed.utf8)); preconditionFailure("Malformed cube admitted") }
        catch let failure as NativeFailure { precondition(failure.code == "UNSUPPORTED_MEDIA") }
    }
    let linear = CGColorSpace(name: CGColorSpace.linearSRGB)!
    let context = CIContext(options: [.workingColorSpace: linear, .workingFormat: CIFormat.RGBAf.rawValue])
    // Premultiplied input: opaque, partial alpha, and transparent black.
    let source: [Float] = [0.25, 0.625, 0.75, 1, 0.125, 0.3125, 0.375, 0.5, 0,0,0,0, -0.125,1.25,0.75,1]
    let image = CIImage(bitmapData: source.withUnsafeBytes { Data($0) }, bytesPerRow: 64, size: CGSize(width: 4, height: 1), format: .RGBAf, colorSpace: linear)
    func pixels(_ value: CIImage) -> [Float] {
        var result = [Float](repeating: 0, count: source.count)
        result.withUnsafeMutableBytes { context.render(value, toBitmap: $0.baseAddress!, rowBytes: 64, bounds: image.extent, format: .RGBAf, colorSpace: linear) }
        return result
    }
    let dry = pixels(image)
    for size in [2, 3, 17, 33] {
        let unit = try CubeLUT(data: Data(text(size) { [$0,$1,$2] }.utf8))
        let same = pixels(try LUTColor.apply(unit, to: image))
        for i in dry.indices { precondition(abs(same[i] - dry[i]) < 0.0001, "Identity changed channel \(i): \(same) vs \(dry)") }
    }
    // 3x grid squares red, reverses green, holds blue: interior red uses 0->0.25 ramp.
    let transform = try CubeLUT(data: Data(text(3) { r,g,b in [r*r,1-g,b] }.utf8))
    let actual = pixels(try LUTColor.apply(transform, to: image))
    let expected: [Float] = [0.125,0.375,0.75,1, 0.0625,0.1875,0.375,0.5, 0,0,0,0, -0.0625,-0.25,0.75,1]
    for i in actual.indices { precondition(abs(actual[i] - expected[i]) < 0.0002, "Trilinear/alpha channel \(i): \(actual) vs \(expected)") }
    let config = SDRCorrection.Parameters(exposureEV: 1, contrast: 1, saturation: 1,
        shadows: 0, highlights: 0, neutralKelvin: 6500, neutralTint: 0)
    let firstLUT = pixels(try SDRCorrection.apply(config, to: LUTColor.apply(transform, to: image)))
    let firstExposure = pixels(try LUTColor.apply(transform, to: SDRCorrection.apply(config, to: image)))
    precondition(abs(firstLUT[0] - 0.25) < 0.0002 && abs(firstLUT[1] - 0.75) < 0.0002)
    precondition(abs(firstExposure[0] - 0.25) < 0.0002 && abs(firstExposure[1] + 0.25) < 0.0002)
    precondition(firstLUT != firstExposure, "Ordered grading steps must not commute implicitly")
    let file = directory.appendingPathComponent("immutable.cube")
    try Data(identityText.utf8).write(to: file)
    let digest = SHA256.hash(data: Data(identityText.utf8)).map { String(format: "%02x", $0) }.joined()
    let binding = try JSONDecoder().decode(LUTAssetBinding.self, from: JSONSerialization.data(withJSONObject: ["assetId": digest,"path":file.path]))
    _ = try CubeLUT.load(binding)
    try Data("changed".utf8).write(to: file)
    do { _ = try CubeLUT.load(binding); preconditionFailure("Changed LUT bytes accepted") }
    catch let failure as NativeFailure { precondition(failure.message == "LUT_CHANGED") }
    try FileManager.default.removeItem(at: file)
    do { _ = try CubeLUT.load(binding); preconditionFailure("Missing LUT bytes accepted") } catch {}
    let output = directory.appendingPathComponent("lut-numeric.png")
    try context.writePNGRepresentation(of: try LUTColor.apply(transform, to: image), to: output, format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
    print("PASS bounded cube parsing, identity, independent trilinear RGB response and unchanged alpha, extrapolation, order and immutable-byte refusal")
}
