import AppKit

let args = CommandLine.arguments
if args.count != 3 { fatalError("usage: TokenImage output.png token") }
let image = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: 720, pixelsHigh: 200,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: image)
NSColor.white.setFill()
NSRect(x: 0, y: 0, width: 720, height: 200).fill()
let attributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.monospacedDigitSystemFont(ofSize: 84, weight: .bold),
    .foregroundColor: NSColor.black
]
let text = args[2] as NSString
let size = text.size(withAttributes: attributes)
text.draw(at: NSPoint(x: (720 - size.width) / 2, y: (200 - size.height) / 2), withAttributes: attributes)
NSGraphicsContext.restoreGraphicsState()
try image.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[1]))
