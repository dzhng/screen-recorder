import CoreGraphics
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Standalone platform reproduction: numeric oracles and independent CoreGraphics profile conversion.
try FileManager.default.createDirectory(
  atPath: CommandLine.arguments[1], withIntermediateDirectories: false)
func numerical() throws {
  let output = CommandLine.arguments[1] + "/numerical"
  try FileManager.default.createDirectory(atPath: output, withIntermediateDirectories: false)
  let linear = CGColorSpace(name: CGColorSpace.extendedLinearSRGB)!
  let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
  let context = CIContext(options: [
    .cacheIntermediates: false, .workingColorSpace: linear, .workingFormat: CIFormat.RGBAh.rawValue,
  ])
  let samples: [[Float]] = [
    [0.1, 0.2, 0.3, 1], [0.18, 0.18, 0.18, 1], [1, 0, 0, 1], [0, 1, 0, 1], [0, 0, 1, 1],
    [1, 1, 1, 1], [0, 0, 0, 1], [0.05, 0.1, 0.15, 0.5], [0.025, 0.05, 0.075, 0.25], [0, 0, 0, 0],
    [-0.1, 1.2, 0.5, 1],
  ]
  let floats = samples.flatMap { $0 }
  let bytes = floats.withUnsafeBytes { Data($0) }
  let source = CIImage(
    bitmapData: bytes, bytesPerRow: samples.count * 16,
    size: CGSize(width: samples.count, height: 1), format: .RGBAf, colorSpace: linear)
  func pixels(_ image: CIImage) -> [[Float]] {
    var out = [Float](repeating: 0, count: floats.count)
    out.withUnsafeMutableBytes {
      context.render(
        image, toBitmap: $0.baseAddress!, rowBytes: samples.count * 16, bounds: source.extent,
        format: .RGBAf, colorSpace: linear)
    }
    return stride(from: 0, to: out.count, by: 4).map { Array(out[$0..<$0 + 4]) }
  }
  func grade(
    _ image: CIImage, _ ev: Double = 0, _ contrast: Double = 1, _ saturation: Double = 1,
    _ kelvin: Double = 6500, _ tint: Double = 0
  ) -> CIImage {
    var result = image
    if kelvin != 6500 || tint != 0 {
      result = result.applyingFilter(
        "CITemperatureAndTint",
        parameters: [
          "inputNeutral": CIVector(x: kelvin, y: tint),
          "inputTargetNeutral": CIVector(x: 6500, y: 0),
        ])
    }
    if ev != 0 {
      result = result.applyingFilter("CIExposureAdjust", parameters: [kCIInputEVKey: ev])
    }
    if contrast != 1 || saturation != 1 {
      result = result.applyingFilter(
        "CIColorControls",
        parameters: [
          kCIInputContrastKey: contrast, kCIInputSaturationKey: saturation,
          kCIInputBrightnessKey: 0,
        ])
    }
    return result
  }
  var results: [String: Any] = [:]
  func check(_ name: String, _ image: CIImage, _ expected: [[Float]]? = nil) {
    let actual = pixels(image)
    results[name] = actual
    if let expected {
      for i in actual.indices {
        for j in 0..<4 {
          precondition(
            abs(actual[i][j] - expected[i][j]) < 0.002,
            "\(name) \(i):\(j) actual\(actual[i][j]) expected\(expected[i][j])")
        }
      }
    }
  }
  check("identity", grade(source), samples)
  for ev in [-1.0, 1.0] {
    check(
      "exposure\(ev)", grade(source, ev),
      samples.map {
        [$0[0] * Float(pow(2, ev)), $0[1] * Float(pow(2, ev)), $0[2] * Float(pow(2, ev)), $0[3]]
      })
  }
  for c in [0.8, 1.2] {
    check(
      "contrast\(c)", grade(source, 0, c),
      samples.map { p in
        let a = p[3]
        return (0..<3).map { a == 0 ? Float(0) : (p[$0] - a * 0.5) * Float(c) + a * 0.5 } + [a]
      })
  }
  for s in [0.0, 1.5] {
    check(
      "saturation\(s)", grade(source, 0, 1, s),
      samples.map { p in
        let l = p[0] * 0.2125 + p[1] * 0.7154 + p[2] * 0.0721
        return (0..<3).map { l + (p[$0] - l) * Float(s) } + [p[3]]
      })
  }
  for k in [5000.0, 8000.0] {
    let image = grade(source, 0, 1, 1, k)
    check("whiteBalance\(k)", image)
    let p = pixels(image)
    precondition((p[1][2] > p[1][0]) == (k < 6500))
    for j in 0..<3 {
      precondition(abs(p[7][j] - p[0][j] * 0.5) < 0.002)
      precondition(abs(p[8][j] - p[0][j] * 0.25) < 0.002)
    }
    precondition(p[9] == [0, 0, 0, 0])
  }
  for t in [-20.0, 20.0] { check("tint\(t)", grade(source, 0, 1, 1, 6500, t)) }
  let combined = grade(source, 0.5, 1.15, 0.7, 5000, 10)
  check("combined", combined)
  let reversed = grade(grade(source, 0.5, 1.15, 0.7), 0, 1, 1, 5000, 10)
  check("reversed", reversed)
  precondition(
    zip(pixels(combined).flatMap { $0 }, pixels(reversed).flatMap { $0 }).contains {
      abs($0 - $1) > 0.005
    })
  func savePNG(_ image: CIImage, _ name: String) {
    let render = context.createCGImage(
      image.samplingNearest().transformed(by: CGAffineTransform(scaleX: 24, y: 48)),
      from: CGRect(x: 0, y: 0, width: samples.count * 24, height: 48), format: .RGBA8,
      colorSpace: srgb)!
    let url = URL(fileURLWithPath: output).appendingPathComponent(name + ".png")
    let dest = CGImageDestinationCreateWithURL(
      url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, render, nil)
    precondition(CGImageDestinationFinalize(dest))
  }
  savePNG(source, "control")
  savePNG(grade(source, 1), "exposure")
  savePNG(grade(source, 0, 1.2), "contrast")
  savePNG(grade(source, 0, 1, 0), "saturation")
  savePNG(grade(source, 0, 1, 1, 5000), "white-balance")
  savePNG(combined, "combined")
  let report: [String: Any] = [
    "samples": samples, "results": results,
    "os": ProcessInfo.processInfo.operatingSystemVersionString,
    "workingSpace": "extended linear sRGB", "format": "RGBAh", "passed": true,
  ]
  try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]).write(
    to: URL(fileURLWithPath: output).appendingPathComponent("report.json"))
}
func profiles() throws {
  let out = CommandLine.arguments[1] + "/profiles"
  try FileManager.default.createDirectory(atPath: out, withIntermediateDirectories: false)
  let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
  let linear = CGColorSpace(name: CGColorSpace.extendedLinearSRGB)!
  let ci = CIContext(options: [
    .cacheIntermediates: false, .workingColorSpace: linear, .workingFormat: CIFormat.RGBAh.rawValue,
  ])
  let width = 128
  let height = 64
  let patches: [[UInt8]] = [
    [100, 100, 100, 255], [220, 100, 40, 255], [40, 200, 80, 255], [10, 30, 240, 255],
    [40, 80, 120, 128], [0, 0, 0, 0], [255, 255, 255, 255], [0, 0, 0, 255],
  ]
  var values = [UInt8](repeating: 0, count: width * height * 4)
  for y in 0..<height {
    for x in 0..<width {
      let p = patches[x / 16]
      for c in 0..<4 { values[(y * width + x) * 4 + c] = p[c] }
    }
  }
  let data = Data(values)
  func encode(_ image: CGImage, _ path: String) {
    let dest = CGImageDestinationCreateWithURL(
      URL(fileURLWithPath: path) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, image, nil)
    precondition(CGImageDestinationFinalize(dest))
  }
  func cg(_ image: CGImage) -> (CGImage, Data) {
    let context = CGContext(
      data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
      space: srgb,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
    )!
    context.interpolationQuality = .none
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return (context.makeImage()!, Data(bytes: context.data!, count: width * height * 4))
  }
  var results: [[String: Any]] = []
  for (name, space) in [
    ("rec709", CGColorSpace(name: CGColorSpace.itur_709)!),
    ("display-p3", CGColorSpace(name: CGColorSpace.displayP3)!), ("srgb", srgb),
  ] {
    let source = CGImage(
      width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
      space: space,
      bitmapInfo: CGBitmapInfo(
        rawValue: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
      ), provider: CGDataProvider(data: data as CFData)!, decode: nil, shouldInterpolate: false,
      intent: .defaultIntent)!
    let sourcePath = out + "/" + name + ".png"
    encode(source, sourcePath)
    let read = CGImageSourceCreateWithURL(URL(fileURLWithPath: sourcePath) as CFURL, nil)!
    let loaded = CGImageSourceCreateImageAtIndex(read, 0, nil)!
    let image = CIImage(cgImage: loaded)
    let identity = image.applyingFilter(
      "CITemperatureAndTint",
      parameters: [
        "inputNeutral": CIVector(x: 6500, y: 0), "inputTargetNeutral": CIVector(x: 6500, y: 0),
      ]
    ).applyingFilter("CIExposureAdjust", parameters: [kCIInputEVKey: 0]).applyingFilter(
      "CIColorControls",
      parameters: [kCIInputContrastKey: 1, kCIInputSaturationKey: 1, kCIInputBrightnessKey: 0])
    var plain = [UInt8](repeating: 0, count: values.count)
    var graded = plain
    ci.render(
      image, toBitmap: &plain, rowBytes: width * 4, bounds: image.extent, format: .RGBA8,
      colorSpace: srgb)
    ci.render(
      identity, toBitmap: &graded, rowBytes: width * 4, bounds: image.extent, format: .RGBA8,
      colorSpace: srgb)
    precondition(plain == graded, "identity changed \(name)")
    let (reference, ref) = cg(loaded)
    encode(reference, out + "/" + name + "-reference.png")
    encode(
      ci.createCGImage(identity, from: image.extent, format: .RGBA8, colorSpace: srgb)!,
      out + "/" + name + "-identity.png")
    let difference = zip(plain, ref).map { abs(Int($0) - Int($1)) }
    let maxError = difference.max()!
    let mae = Double(difference.reduce(0, +)) / Double(difference.count)
    precondition(maxError <= 2, "\(name) independent color reference delta\(maxError)")
    results.append([
      "name": name, "decodedProfile": loaded.colorSpace!.name! as String, "identityExact": true,
      "cgReferenceMax": maxError, "cgReferenceMAE": mae,
    ])
  }
  let tagged = try Data(contentsOf: URL(fileURLWithPath: out + "/rec709.png"))
  var untagged = Data(tagged[0..<8])
  var offset = 8
  while offset < tagged.count {
    let n = (0..<4).reduce(0) { ($0 << 8) + Int(tagged[offset + $1]) }
    let type = String(data: tagged[(offset + 4)..<(offset + 8)], encoding: .ascii)!
    if !["iCCP", "sRGB", "gAMA", "cHRM", "cICP", "eXIf"].contains(type) {
      untagged.append(tagged[offset..<(offset + n + 12)])
    }
    offset += n + 12
  }
  try untagged.write(to: URL(fileURLWithPath: out + "/untagged.png"))
  let unknown = CGImageSourceCreateImageAtIndex(
    CGImageSourceCreateWithURL(URL(fileURLWithPath: out + "/untagged.png") as CFURL, nil)!, 0, nil)!
  let untagImage = CIImage(cgImage: unknown)
  let untagIdentity = untagImage.applyingFilter(
    "CIColorControls",
    parameters: [kCIInputContrastKey: 1, kCIInputSaturationKey: 1, kCIInputBrightnessKey: 0])
  var before = [UInt8](repeating: 0, count: values.count)
  var after = before
  ci.render(
    untagImage, toBitmap: &before, rowBytes: width * 4, bounds: untagImage.extent, format: .RGBA8,
    colorSpace: srgb)
  ci.render(
    untagIdentity, toBitmap: &after, rowBytes: width * 4, bounds: untagImage.extent, format: .RGBA8,
    colorSpace: srgb)
  precondition(before == after)
  encode(
    ci.createCGImage(untagImage, from: untagImage.extent, format: .RGBA8, colorSpace: srgb)!,
    out + "/untagged-control.png")
  encode(
    ci.createCGImage(untagIdentity, from: untagImage.extent, format: .RGBA8, colorSpace: srgb)!,
    out + "/untagged-identity.png")
  results.append([
    "name": "untagged", "decodedProfile": unknown.colorSpace!.name! as String,
    "identityExact": true, "interpretation": "ImageIO existing default; creator intent unknown",
  ])
  try JSONSerialization.data(
    withJSONObject: ["passed": true, "results": results], options: [.prettyPrinted, .sortedKeys]
  ).write(to: URL(fileURLWithPath: out + "/report.json"))
}
func importedPicture() throws {
  let input = CommandLine.arguments[2]
  let output = CommandLine.arguments[1] + "/imported"
  try FileManager.default.createDirectory(atPath: output, withIntermediateDirectories: false)
  let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: input) as CFURL, nil)!
  let loaded = CGImageSourceCreateImageAtIndex(source, 0, nil)!
  let linear = CGColorSpace(name: CGColorSpace.extendedLinearSRGB)!
  let srgb = CGColorSpace(name: CGColorSpace.sRGB)!
  let context = CIContext(options: [
    .cacheIntermediates: false, .workingColorSpace: linear, .workingFormat: CIFormat.RGBAh.rawValue,
  ])
  let image = CIImage(cgImage: loaded)
  let width = loaded.width
  let height = loaded.height
  func pixels(_ value: CIImage) -> [UInt8] {
    var bytes = [UInt8](repeating: 0, count: width * height * 4)
    context.render(
      value, toBitmap: &bytes, rowBytes: width * 4, bounds: image.extent, format: .RGBA8,
      colorSpace: srgb)
    return bytes
  }
  let before = pixels(image)
  let identity = image.applyingFilter(
    "CITemperatureAndTint",
    parameters: [
      "inputNeutral": CIVector(x: 6500, y: 0), "inputTargetNeutral": CIVector(x: 6500, y: 0),
    ]
  ).applyingFilter("CIExposureAdjust", parameters: [kCIInputEVKey: 0]).applyingFilter(
    "CIColorControls",
    parameters: [kCIInputContrastKey: 1, kCIInputSaturationKey: 1, kCIInputBrightnessKey: 0])
  precondition(before == pixels(identity))
  let exposure = image.applyingFilter("CIExposureAdjust", parameters: [kCIInputEVKey: 1])
  let saturation = image.applyingFilter(
    "CIColorControls",
    parameters: [kCIInputContrastKey: 1, kCIInputSaturationKey: 0, kCIInputBrightnessKey: 0])
  precondition(before != pixels(exposure))
  precondition(before != pixels(saturation))
  for (name, value) in [
    ("control", image), ("identity", identity), ("exposure", exposure), ("saturation", saturation),
  ] {
    let cg = context.createCGImage(value, from: image.extent, format: .RGBA8, colorSpace: srgb)!
    let url = URL(fileURLWithPath: output + "/" + name + ".png")
    let dest = CGImageDestinationCreateWithURL(
      url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, cg, nil)
    precondition(CGImageDestinationFinalize(dest))
  }
  try JSONSerialization.data(
    withJSONObject: [
      "source": input,
      "decodedProfile": loaded.colorSpace?.name.map { $0 as String }
        ?? "unnamed or unspecified ICC",
      "width": width,
      "height": height, "identityExact": true, "changedControls": ["exposure", "saturation"],
    ], options: [.prettyPrinted, .sortedKeys]
  ).write(to: URL(fileURLWithPath: output + "/report.json"))
}
try numerical()
try profiles()
try importedPicture()
