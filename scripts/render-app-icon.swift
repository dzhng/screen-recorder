// Renders the app icon: a record glyph on a rounded-square body, drawn at every iconset size and
// packed with iconutil. Run `swift scripts/render-app-icon.swift apps/macos/AppIcon.icns` and
// check in the result; the build only copies it.
import AppKit
import Foundation

guard CommandLine.arguments.count == 2 else {
    FileHandle.standardError.write(Data("usage: swift scripts/render-app-icon.swift OUTPUT.icns\n".utf8))
    exit(2)
}
let output = URL(fileURLWithPath: CommandLine.arguments[1])

func color(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(
        srgbRed: CGFloat(hex >> 16 & 0xFF) / 255, green: CGFloat(hex >> 8 & 0xFF) / 255,
        blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
}

/// Draws on Apple's 1024-point macOS icon grid: an 824-point body centred with room for its shadow.
func render(pixels: Int) -> Data {
    let space = CGColorSpace(name: CGColorSpace.sRGB)!
    let context = CGContext(
        data: nil, width: pixels, height: pixels, bitsPerComponent: 8, bytesPerRow: 0, space: space,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    let scale = CGFloat(pixels) / 1024
    context.scaleBy(x: scale, y: scale)
    context.interpolationQuality = .high

    let body = CGRect(x: 100, y: 100, width: 824, height: 824)
    let outline = CGPath(roundedRect: body, cornerWidth: 185, cornerHeight: 185, transform: nil)

    // The body's drop shadow, as the macOS icon template places it.
    context.saveGState()
    context.setShadow(offset: CGSize(width: 0, height: -10), blur: 28, color: color(0x000000, 0.35))
    context.addPath(outline)
    context.setFillColor(color(0x1C1C1E))
    context.fillPath()
    context.restoreGState()

    // A graphite body, lighter at the top like light falling on it.
    context.saveGState()
    context.addPath(outline)
    context.clip()
    let graphite = CGGradient(
        colorsSpace: space, colors: [color(0x48484C), color(0x1F1F22)] as CFArray, locations: [0, 1])!
    context.drawLinearGradient(
        graphite, start: CGPoint(x: 512, y: 924), end: CGPoint(x: 512, y: 100), options: [])
    context.restoreGState()

    // A hairline edge keeps the dark body distinct on a dark Dock or Finder background.
    context.saveGState()
    context.addPath(CGPath(
        roundedRect: body.insetBy(dx: 3, dy: 3), cornerWidth: 182, cornerHeight: 182, transform: nil))
    context.setStrokeColor(color(0xFFFFFF, 0.14))
    context.setLineWidth(6)
    context.strokePath()
    context.restoreGState()

    let centre = CGPoint(x: 512, y: 512)
    // Small sizes get a heavier ring so the glyph still reads at 16 pixels.
    let ringWidth: CGFloat = pixels <= 32 ? 64 : 40
    context.setStrokeColor(color(0xF2F2F7))
    context.setLineWidth(ringWidth)
    context.strokeEllipse(in: CGRect(x: centre.x - 270, y: centre.y - 270, width: 540, height: 540))

    // The record dot, lit from above.
    let dot = CGRect(x: centre.x - 190, y: centre.y - 190, width: 380, height: 380)
    context.saveGState()
    context.addEllipse(in: dot)
    context.clip()
    let red = CGGradient(
        colorsSpace: space, colors: [color(0xFF6259), color(0xE5241A)] as CFArray, locations: [0, 1])!
    context.drawLinearGradient(
        red, start: CGPoint(x: 512, y: dot.maxY), end: CGPoint(x: 512, y: dot.minY), options: [])
    context.restoreGState()

    let image = context.makeImage()!
    return NSBitmapImageRep(cgImage: image).representation(using: .png, properties: [:])!
}

let iconset = FileManager.default.temporaryDirectory
    .appendingPathComponent("AppIcon-\(ProcessInfo.processInfo.processIdentifier).iconset")
try? FileManager.default.removeItem(at: iconset)
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: iconset) }
for points in [16, 32, 128, 256, 512] {
    try render(pixels: points).write(to: iconset.appendingPathComponent("icon_\(points)x\(points).png"))
    try render(pixels: points * 2).write(to: iconset.appendingPathComponent("icon_\(points)x\(points)@2x.png"))
}
let iconutil = Process()
iconutil.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
iconutil.arguments = ["-c", "icns", iconset.path, "-o", output.path]
try iconutil.run()
iconutil.waitUntilExit()
guard iconutil.terminationStatus == 0 else { exit(iconutil.terminationStatus) }
print("Wrote \(output.path)")
