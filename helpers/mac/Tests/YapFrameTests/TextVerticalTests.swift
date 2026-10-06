import CryptoKit
import CoreImage
import Foundation
@testable import YapFrames
import YapMedia

func verifyTextVerticalPlacement() throws {
    let fontURL = URL(fileURLWithPath: "/System/Library/Fonts/Supplemental/Arial.ttf")
    let digest = SHA256.hash(data: try Data(contentsOf: fontURL)).map { String(format: "%02x", $0) }.joined()
    let binding = try JSONDecoder().decode(
        FontAssetBinding.self,
        from: JSONEncoder().encode(["assetId": digest, "path": fontURL.path]),
    )
    func layout(_ alignment: String?) throws -> TextLayout {
        try TextRaster(TextSource(
            kind: "text", text: "Tall caption\nSecond line", font: .init(assetId: digest, postScriptName: "ArialMT"),
            width: 420, height: 200, size: 32, color: "#ffffffff", alignment: "left",
            verticalAlignment: alignment, stroke: nil, shadow: nil, background: nil, wrap: true), binding: binding).layout
    }
    let top = try layout(nil)
    let center = try layout("center")
    let bottom = try layout("bottom")
    precondition(top.verticalOffset == 0, "Omitted vertical alignment must retain top placement")
    precondition(top.inkBounds[1] < center.inkBounds[1] && center.inkBounds[1] < bottom.inkBounds[1],
        "Glyph bounds must move down from top to center to bottom")
    precondition(abs(center.inkBounds[1] + center.inkBounds[3] / 2 - 100) < 1,
        "Centered glyph bounds must center in the requested box")
    precondition(abs(bottom.inkBounds[1] + bottom.inkBounds[3] - 200) < 1,
        "Bottom glyph bounds must end at the requested box edge")
    precondition(center.visibleBounds.count == 4 && bottom.visibleBounds.count == 4)
    let empty = try TextRaster(TextSource(
        kind: "text", text: "", font: .init(assetId: digest, postScriptName: "ArialMT"),
        width: 420, height: 200, size: 32, color: "#ffffffff", alignment: "left",
        verticalAlignment: nil, stroke: nil, shadow: nil, background: nil, wrap: true), binding: binding).layout
    precondition(empty.inkBounds == [0, 0, 0, 0] && empty.visibleBounds.isEmpty,
        "Empty text must render as a transparent zero-bounds layout")
    print("PASS native text glyph bounds honor top/center/bottom alignment")
}

func verifyTextDecorations() throws {
    let fontURL = URL(fileURLWithPath: "/System/Library/Fonts/Supplemental/Arial.ttf")
    let digest = SHA256.hash(data: try Data(contentsOf: fontURL)).map { String(format: "%02x", $0) }.joined()
    let binding = try JSONDecoder().decode(
        FontAssetBinding.self,
        from: JSONEncoder().encode(["assetId": digest, "path": fontURL.path]),
    )
    let font = TextSource.Font(assetId: digest, postScriptName: "ArialMT")
    let plainRequest = TextSource(
        kind: "text", text: "Decorated", font: font, width: 420, height: 200, size: 32,
        color: "#ffffffff", alignment: "left", verticalAlignment: "center", stroke: nil,
        shadow: nil, background: nil, wrap: true)
    let decoratedRequest = TextSource(
        kind: "text", text: "Decorated", font: font, width: 420, height: 200, size: 32,
        color: "#ffffffff", alignment: "left", verticalAlignment: "center",
        stroke: .init(color: "#ff0000ff", width: 4),
        shadow: .init(color: "#000000aa", offsetX: 6, offsetY: 8, blur: 5),
        background: .init(color: "#112233dd", padding: 12, cornerRadius: 8), wrap: true)
    let plain = try TextRaster(plainRequest, binding: binding)
    let decorated = try TextRaster(decoratedRequest, binding: binding)
    precondition(decorated.layout.stroke == decoratedRequest.stroke)
    precondition(decorated.layout.shadow == decoratedRequest.shadow)
    precondition(decorated.layout.background == decoratedRequest.background)
    precondition(decorated.layout.decorationBounds[2] > plain.layout.inkBounds[2])
    precondition(decorated.layout.decorationBounds[3] > plain.layout.inkBounds[3])

    guard let image = CIContext().createCGImage(decorated.image, from: decorated.image.extent),
          let provider = image.dataProvider, let cfData = provider.data else {
        throw NativeFailure.decodeFailed("Cannot inspect decorated text raster.")
    }
    let data = cfData as Data
    let alphaBytes = data.withUnsafeBytes { raw in
        stride(from: 3, to: raw.count, by: 4).reduce(into: 0) { count, index in
            if raw[index] != 0 { count += 1 }
        }
    }
    precondition(alphaBytes > 0, "Decorated text must produce visible pixels")
    print("PASS native text stroke, shadow and background decorations are rendered and receipted")
}
