// Independent provider reference. No Yap module or production correction helper is imported.
import CoreImage
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers
let args = CommandLine.arguments
precondition(args.count == 5, "Usage: swift tone-reference.swift INPUT_OR_CHART OUTPUT RECIPE_JSON REVERSE_BOOL")
let linear = CGColorSpace(name: CGColorSpace.extendedLinearSRGB)!
let sRGB = CGColorSpace(name: CGColorSpace.sRGB)!
let context = CIContext(options: [.workingColorSpace: linear, .workingFormat: CIFormat.RGBAh.rawValue])
let recipe = try JSONSerialization.jsonObject(with: Data(args[3].utf8)) as! [String: Double]
var image: CIImage
if args[1] == "chart" {
  let width = 320, height = 180
  var pixels = [Float](repeating: 0, count: width * height * 4)
  for y in 0..<height { for x in 0..<width {
    let i = (y * width + x) * 4
    let value = Float(x) / Float(width - 1)
    let rgb: [Float] = y < 90 ? [value, value, value] :
      (x < 160 ? [0.06, 0.035, 0.025] : [0.85, 0.85, 0.85])
    for c in 0..<3 { pixels[i + c] = rgb[c] }
    pixels[i + 3] = 1
  }}
  image = CIImage(bitmapData: pixels.withUnsafeBytes { Data($0) }, bytesPerRow: width * 16,
    size: CGSize(width: width, height: height), format: .RGBAf, colorSpace: linear)
} else {
  image = CIImage(contentsOf: URL(fileURLWithPath: args[1]))!
}
func first(_ image: CIImage) -> CIImage {
  var result = image
  if recipe["neutralKelvin", default: 6500] != 6500 || recipe["neutralTint", default: 0] != 0 {
    result = result.applyingFilter("CITemperatureAndTint", parameters: [
      "inputNeutral": CIVector(x: recipe["neutralKelvin", default: 6500], y: recipe["neutralTint", default: 0]),
      "inputTargetNeutral": CIVector(x: 6500, y: 0)])
  }
  if recipe["exposureEV", default: 0] != 0 {
    result = result.applyingFilter("CIExposureAdjust", parameters: [kCIInputEVKey: recipe["exposureEV"]!])
  }
  if recipe["contrast", default: 1] != 1 || recipe["saturation", default: 1] != 1 {
    result = result.applyingFilter("CIColorControls", parameters: [kCIInputContrastKey: recipe["contrast", default: 1],
      kCIInputSaturationKey: recipe["saturation", default: 1], kCIInputBrightnessKey: 0])
  }
  return result
}
func tone(_ image: CIImage) -> CIImage {
  if recipe["shadows", default: 0] == 0 && recipe["highlights", default: 0] == 0 { return image }
  return image.applyingFilter("CIHighlightShadowAdjust", parameters: [
    "inputShadowAmount": recipe["shadows", default: 0],
    "inputHighlightAmount": 1 - recipe["highlights", default: 0]])
}
image = args[4] == "true" ? first(tone(image)) : tone(first(image))
try context.writePNGRepresentation(of: image, to: URL(fileURLWithPath: args[2]), format: .RGBA8,
  colorSpace: sRGB, options: [:])
