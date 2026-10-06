import CoreGraphics
import CoreImage
import CoreText
import Foundation
import YapMedia

struct TextSource: Codable, Hashable {
    struct Font: Codable, Hashable { let assetId: String; let postScriptName: String }
    let kind: String
    let text: String
    let font: Font
    let width: Int
    let height: Int
    let size: Double
    let color: String
    let alignment: String
    let wrap: Bool

    // Swift String equality normalizes Unicode; receipts retain exact UTF-16 literals.
    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.kind == rhs.kind && lhs.text.utf16.elementsEqual(rhs.text.utf16)
            && lhs.font == rhs.font && lhs.width == rhs.width && lhs.height == rhs.height
            && lhs.size == rhs.size && lhs.color == rhs.color
            && lhs.alignment == rhs.alignment && lhs.wrap == rhs.wrap
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(kind)
        hasher.combine(Array(text.utf16))
        hasher.combine(font)
        hasher.combine(width)
        hasher.combine(height)
        hasher.combine(size)
        hasher.combine(color)
        hasher.combine(alignment)
        hasher.combine(wrap)
    }
}

struct TextLayout: Encodable {
    struct Line: Encodable {
        let range: [Int]
        let text: String
        let origin: [Double]
        let width: Double
        let fonts: [String]
    }
    let font: TextSource.Font
    let text: String
    let visibleRange: [Int]
    let lines: [Line]
}

struct TextRaster {
    let image: CIImage
    let layout: TextLayout
    let pixels: Int64

    init(_ request: TextSource, binding: FontAssetBinding) throws {
        guard request.kind == "text", request.width > 0, request.width <= 4096,
            request.height > 0, request.height <= 4096,
            request.size.isFinite, request.size > 0, request.size <= 512,
            request.text.utf16.count <= 8192, request.color.count == 9, request.color.first == "#",
            let rgba = UInt32(request.color.dropFirst(), radix: 16) else {
            throw NativeFailure("INVALID_REQUEST", "Invalid text layout request.")
        }
        let font = try FontFile.load(binding, postScriptName: request.font.postScriptName, size: request.size)
        let graphicsFont = CTFontCopyGraphicsFont(font, nil)
        var alignment: CTTextAlignment
        switch request.alignment {
        case "left": alignment = .left
        case "center": alignment = .center
        case "right": alignment = .right
        default: throw NativeFailure("INVALID_REQUEST", "Invalid text alignment.")
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
        let color = CGColor(colorSpace: colorSpace, components: [24,16,8,0].map { CGFloat((rgba >> $0) & 255) / 255 })!
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
        var reports: [TextLayout.Line] = []
        for (index, line) in lines.enumerated() {
            try Task.checkCancellation()
            let range = CTLineGetStringRange(line)
            var usedFonts: [String] = []
            for run in CTLineGetGlyphRuns(line) as! [CTRun] {
                let attributes = CTRunGetAttributes(run) as NSDictionary
                let used = attributes[kCTFontAttributeName] as! CTFont
                guard CFEqual(CTFontCopyGraphicsFont(used, nil), graphicsFont) else {
                    throw NativeFailure("UNSUPPORTED_MEDIA", "FONT_SUBSTITUTED: \(CTFontCopyPostScriptName(used))")
                }
                var glyphs = [CGGlyph](repeating: 0, count: CTRunGetGlyphCount(run))
                CTRunGetGlyphs(run, CFRange(location: 0, length: 0), &glyphs)
                guard !glyphs.contains(0) else { throw NativeFailure("UNSUPPORTED_MEDIA", "FONT_GLYPH_MISSING") }
                usedFonts.append(CTFontCopyPostScriptName(used) as String)
            }
            reports.append(.init(range: [range.location, range.length],
                text: (request.text as NSString).substring(with: NSRange(location: range.location, length: range.length)),
                origin: [origins[index].x, Double(request.height) - origins[index].y],
                width: CTLineGetTypographicBounds(line, nil, nil, nil), fonts: usedFonts))
        }
        guard let context = CGContext(data: nil, width: request.width, height: request.height,
            bitsPerComponent: 8, bytesPerRow: request.width * 4, space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
            throw NativeFailure("LIMIT_EXCEEDED", "Cannot allocate text raster.")
        }
        context.textMatrix = .identity
        context.clip(to: box)
        CTFrameDraw(frame, context)
        guard let image = context.makeImage() else { throw NativeFailure.decodeFailed("Cannot create text raster.") }
        let visible = CTFrameGetVisibleStringRange(frame)
        self.image = CIImage(cgImage: image)
        self.layout = .init(font: request.font, text: request.text, visibleRange: [visible.location, visible.length], lines: reports)
        self.pixels = Int64(request.width) * Int64(request.height)
    }
}
