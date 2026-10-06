import CryptoKit
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
            verticalAlignment: alignment, wrap: true), binding: binding).layout
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
        verticalAlignment: nil, wrap: true), binding: binding).layout
    precondition(empty.inkBounds == [0, 0, 0, 0] && empty.visibleBounds.isEmpty,
        "Empty text must render as a transparent zero-bounds layout")
    print("PASS native text glyph bounds honor top/center/bottom alignment")
}
