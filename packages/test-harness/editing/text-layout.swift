import Foundation
import CoreText
import CoreGraphics
import ImageIO
import CryptoKit
import UniformTypeIdentifiers

// Standalone mechanism reproduction; composition still owns caption placement and timing.
struct Request: Decodable {
    let text: String
    let fontPath: String
    let fontSHA256: String
    let size: Double
    let width: Int
    let height: Int
    let alignment: String
    let wrap: Bool
    let rgba: [Double]
}
struct Failure: Error { let reason: String }
func require(_ condition: Bool, _ reason: String) throws {
    if !condition { throw Failure(reason: reason) }
}
func sha(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
func render(_ request: Request, _ output: String) throws -> [String: Any] {
    try require(request.width > 0 && request.width <= 4096 && request.height > 0 && request.height <= 4096,
                "Invalid reproduction box")
    try require(request.size.isFinite && request.size > 0 && request.size <= 512 && request.text.utf16.count <= 8192,
                "Invalid reproduction text or size")
    try require(request.rgba.count == 4 && request.rgba.allSatisfy { $0.isFinite && $0 >= 0 && $0 <= 1 }, "Invalid color")
    let data = try Data(contentsOf: URL(fileURLWithPath: request.fontPath))
    try require(sha(data) == request.fontSHA256, "FONT_CHANGED")
    guard let provider = CGDataProvider(data: data as CFData), let graphicsFont = CGFont(provider) else {
        throw Failure(reason: "FONT_UNAVAILABLE")
    }
    let font = CTFontCreateWithGraphicsFont(graphicsFont, request.size, nil, nil)
    var alignment: CTTextAlignment
    switch request.alignment {
    case "left": alignment = .left
    case "center": alignment = .center
    case "right": alignment = .right
    default: throw Failure(reason: "Invalid alignment")
    }
    var lineBreak: CTLineBreakMode = request.wrap ? .byWordWrapping : .byClipping
    let paragraph = withUnsafePointer(to: &alignment) { alignmentPointer in
        withUnsafePointer(to: &lineBreak) { breakPointer in
            let settings = [
                CTParagraphStyleSetting(spec: .alignment, valueSize: MemoryLayout<CTTextAlignment>.size, value: alignmentPointer),
                CTParagraphStyleSetting(spec: .lineBreakMode, valueSize: MemoryLayout<CTLineBreakMode>.size, value: breakPointer),
            ]
            return CTParagraphStyleCreate(settings, settings.count)
        }
    }
    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
    let color = CGColor(colorSpace: colorSpace, components: request.rgba.map { CGFloat($0) })!
    let attributed = NSAttributedString(string: request.text, attributes: [
        NSAttributedString.Key(kCTFontAttributeName as String): font,
        NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
        NSAttributedString.Key(kCTParagraphStyleAttributeName as String): paragraph,
    ])
    let framesetter = CTFramesetterCreateWithAttributedString(attributed)
    let box = CGRect(x: 0, y: 0, width: request.width, height: request.height)
    let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: 0, length: 0), CGPath(rect: box, transform: nil), nil)
    let lines = CTFrameGetLines(frame) as! [CTLine]
    var origins = [CGPoint](repeating: .zero, count: lines.count)
    CTFrameGetLineOrigins(frame, CFRange(location: 0, length: 0), &origins)
    var lineReports: [[String: Any]] = []
    for (index, line) in lines.enumerated() {
        let range = CTLineGetStringRange(line)
        let runs = CTLineGetGlyphRuns(line) as! [CTRun]
        var usedFonts: [String] = []
        for run in runs {
            let attributes = CTRunGetAttributes(run) as NSDictionary
            let used = attributes[kCTFontAttributeName] as! CTFont
            let actual = CTFontCopyGraphicsFont(used, nil)
            try require(CFEqual(actual, graphicsFont), "FONT_SUBSTITUTED: \(CTFontCopyPostScriptName(used))")
            usedFonts.append(CTFontCopyPostScriptName(used) as String)
        }
        lineReports.append([
            "range": [range.location, range.length],
            "text": (request.text as NSString).substring(with: NSRange(location: range.location, length: range.length)),
            "origin": [origins[index].x, Double(request.height) - origins[index].y],
            "width": CTLineGetTypographicBounds(line, nil, nil, nil),
            "fonts": usedFonts,
        ])
    }
    guard let context = CGContext(data: nil, width: request.width, height: request.height,
                                  bitsPerComponent: 8, bytesPerRow: request.width * 4, space: colorSpace,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
        throw Failure(reason: "Cannot allocate bitmap")
    }
    context.textMatrix = .identity
    context.clip(to: box)
    CTFrameDraw(frame, context)
    guard let image = context.makeImage(), let destination = CGImageDestinationCreateWithURL(
        URL(fileURLWithPath: output) as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        throw Failure(reason: "Cannot write PNG")
    }
    CGImageDestinationAddImage(destination, image, nil)
    try require(CGImageDestinationFinalize(destination), "Cannot finalize PNG")
    let visible = CTFrameGetVisibleStringRange(frame)
    return ["fontSHA256": sha(data), "font": CTFontCopyPostScriptName(font),
            "visibleRange": [visible.location, visible.length], "utf16Length": request.text.utf16.count,
            "lines": lineReports, "pngSHA256": sha(try Data(contentsOf: URL(fileURLWithPath: output)))]
}
do {
    try require(CommandLine.arguments.count == 3, "Usage: text-layout request.json output.png")
    let request = try JSONDecoder().decode(Request.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
    let report = try render(request, CommandLine.arguments[2])
    FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]))
} catch {
    FileHandle.standardError.write(Data("\(error)\n".utf8))
    exit(1)
}
