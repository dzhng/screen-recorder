// Packs the app icon from its artwork: the illustrated body is cropped from its plain background,
// fitted to the macOS icon grid, clipped to the icon shape, shadowed and drawn at every iconset size.
// Run `swift scripts/render-app-icon.swift apps/macos/AppIcon-artwork.png apps/macos/AppIcon.icns`
// and check in the result; the build only copies it.
import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
    FileHandle.standardError.write(
        Data("usage: swift scripts/render-app-icon.swift ARTWORK.png OUTPUT.icns\n".utf8))
    exit(2)
}
let output = URL(fileURLWithPath: CommandLine.arguments[2])
guard let artwork = NSImage(contentsOfFile: CommandLine.arguments[1])?
    .cgImage(forProposedRect: nil, context: nil, hints: nil)
else {
    FileHandle.standardError.write(Data("cannot read artwork\n".utf8))
    exit(1)
}

/// The artwork's body: the bounds of everything that differs from its near-white background.
func bodyBounds(_ image: CGImage) -> CGRect {
    let width = image.width, height = image.height
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let context = CGContext(
        data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    var minX = width, minY = height, maxX = 0, maxY = 0
    for y in 0..<height {
        for x in 0..<width {
            let i = (y * width + x) * 4
            if min(pixels[i], pixels[i + 1], pixels[i + 2]) < 235 {
                minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
            }
        }
    }
    // Rows are top-down in memory; the returned rect is in CGImage cropping coordinates.
    return CGRect(x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1)
}

// The artwork's own shadow sits below its body; crop to the body's width as a square from the top.
let found = bodyBounds(artwork)
let side = found.width
let body = artwork.cropping(to: CGRect(x: found.minX, y: found.minY, width: side, height: side))!

/// Draws on Apple's 1024-point macOS icon grid: an 824-point body centred with room for its shadow.
func render(pixels: Int) -> Data {
    let space = CGColorSpace(name: CGColorSpace.sRGB)!
    let context = CGContext(
        data: nil, width: pixels, height: pixels, bitsPerComponent: 8, bytesPerRow: 0, space: space,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    let scale = CGFloat(pixels) / 1024
    context.scaleBy(x: scale, y: scale)
    context.interpolationQuality = .high

    let frame = CGRect(x: 100, y: 100, width: 824, height: 824)
    let outline = CGPath(roundedRect: frame, cornerWidth: 185, cornerHeight: 185, transform: nil)

    // The body's drop shadow, as the macOS icon template places it.
    context.saveGState()
    context.setShadow(
        offset: CGSize(width: 0, height: -10), blur: 28,
        color: CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 0.35))
    context.addPath(outline)
    context.setFillColor(CGColor(srgbRed: 0.98, green: 0.96, blue: 0.93, alpha: 1))
    context.fillPath()
    context.restoreGState()

    // The artwork, slightly overscanned so its own rounded edge never shows inside the clip.
    context.saveGState()
    context.addPath(outline)
    context.clip()
    context.draw(body, in: frame.insetBy(dx: -6, dy: -6))
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
