@preconcurrency import AVFoundation
import CryptoKit
import Foundation
@testable import YapFrames
import YapMedia

func verifyCompositionPointerReadability(in parent: URL) async throws {
    let directory = parent.appendingPathComponent("pointer-readability")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    let source = directory.appendingPathComponent("source.mp4")
    try await FixtureWriter.write(to: source,
        times: (0..<26).map { CMTime(value: Int64($0), timescale: 10) })
    let track = try await AVURLAsset(url: source).loadTracks(withMediaType: .video)[0]
    let streamId = "track:\(track.trackID)"
    let atUs: Int64 = 2_500_000
    func render(_ name: String, overlay: FrameOverlay?, edge: Int = 160, placement: String = "delivery", atUs: Int64 = 2_500_000) async throws -> FixtureImage {
        let clip: [String: Any] = ["kind": "clip", "id": "c"]
        let half: [String: Any] = ["kind": "affine", "matrix": [0.5, 0, 0, 0.5, 0, 0]]
        var operations: [[String: Any]] = placement == "authored" ? [half] : []
        if placement == "crop" {
            operations = [["kind": "clamp", "x": 80.5, "y": 10.5, "width": 63, "height": 63],
                          ["kind": "affine", "matrix": [0.5, 0, 0, 0.5, -40, -5]]]
        }
        if placement == "coverage" {
            let c = sqrt(0.5)
            let tx = 60 - c * 80 + c * 10, ty = 20 - c * 80 - c * 10
            let corners = [(80.0, 10.0), (144.0, 10.0), (144.0, 74.0), (80.0, 74.0)]
            let points = corners.map { x, y in ["x": c * x - c * y + tx, "y": c * x + c * y + ty] }
            operations = [
                ["kind": "affine", "matrix": [c, c, -c, c, tx, ty]],
                ["kind": "coverage", "width": 160, "height": 160, "points": points],
                ["kind": "affine", "matrix": [c / 2, -c / 2, c / 2, c / 2,
                    -(c * tx + c * ty) / 2 - 40, (c * tx - c * ty) / 2 - 5]],
            ]
        }
        if let overlay {
            operations.append(["kind": "pointer", "stepId": "pointer", "trailUs": overlay.trailUs,
                               "geometryPrefix": Array(operations.indices)])
        }
        var visual: [[String: Any]] = [["target": clip, "inputs": [], "operations": operations]]
        var input = clip
        if placement == "ancestor" {
            input = ["kind": "group", "id": "g"]
            visual.append(["target": input, "inputs": [clip], "operations": [half]])
        }
        visual.append(["target": ["kind": "output"], "inputs": [input], "operations": []])
        let output = directory.appendingPathComponent(name + ".png")
        var body: [String: Any] = [
            "output": output.path, "profile": "h264-rec709", "processing": [], "maxLongEdge": edge,
            "canvas": ["width": placement == "crop" ? 32 : (placement == "authored" || placement == "coverage") ? 160 : 320,
                       "height": placement == "crop" ? 32 : placement == "coverage" ? 160 : placement == "authored" ? 120 : 240, "fps": ["numerator": 10, "denominator": 1],
                       "background": "#000000ff"],
            "frame": ["index": atUs / 100_000, "sampleAtUs": atUs,
                      "visibleRange": ["startUs": atUs, "endUs": atUs + 100_000],
                      "layers": [["kind": "video", "clipId": "c", "trackId": "t", "assetId": "a",
                                  "streamId": streamId, "sourceUs": atUs, "availability": "available",
                                  "width": 320, "height": 240]],
                      "visual": visual],
            "assets": [["assetId": "a", "streamId": streamId, "path": source.path, "originUs": 0]],
        ]
        if let overlay {
            let row: [String: Any] = [
                "frameIndex": atUs / 100_000, "sampleAtUs": atUs, "clipId": "c", "stepId": "pointer",
                "trailUs": overlay.trailUs, "status": "picture", "assetId": "a", "streamId": streamId,
                "requestedSourceUs": atUs, "captureUs": atUs, "clockOffsetUs": 0,
                "sourceToAssetOffsetUs": 0, "width": 320, "height": 240,
                "start": ["value": String(atUs / 100_000), "timescale": 10], "end": ["value": String(atUs / 100_000 + 1), "timescale": 10],
                "sampleTime": ["value": String(atUs / 100_000), "timescale": 10],
                "overlay": try JSONSerialization.jsonObject(with: JSONEncoder().encode(overlay)),
            ]
            var data = try JSONSerialization.data(withJSONObject: row, options: .sortedKeys)
            data.append(10)
            let file = directory.appendingPathComponent(name + ".pointers.jsonl")
            try data.write(to: file)
            body["pointers"] = ["file": file.path, "bytes": data.count, "records": 1,
                "sha256": SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()]
        }
        let data = try JSONSerialization.data(withJSONObject: body, options: .sortedKeys)
        try data.write(to: directory.appendingPathComponent(name + ".request.json"))
        let request = try JSONDecoder().decode(CompositionFrameRenderer.Request.self, from: data)
        let result = try await CompositionFrameRenderer.write(request)
        try JSONEncoder().encode(result).write(to: directory.appendingPathComponent(name + ".result.json"))
        return try FixtureImage(contentsOf: output)
    }
    // A mark must remain recognizable without obscuring the source content it identifies.
    // Exercise shape, age, evidence gaps and content coverage through compiled delivery.
    func ink(_ image: FixtureImage, x: Int, y: Int, size: Int = 3) -> Double {
        let color = image.color(x: x, y: y, width: size, height: size)
        return max(abs(color.red - 0.12), abs(color.green - 0.12), abs(color.blue - 0.12))
    }
    func changedShare(_ image: FixtureImage, _ clean: FixtureImage,
        x: Int, y: Int, width: Int, height: Int) -> Double {
        var changed = 0
        for row in y..<(y + height) {
            for column in x..<(x + width) {
                let a = image.color(x: column, y: row, width: 1, height: 1)
                let b = clean.color(x: column, y: row, width: 1, height: 1)
                if max(abs(a.red - b.red), abs(a.green - b.green), abs(a.blue - b.blue)) > 0.1 {
                    changed += 1
                }
            }
        }
        return Double(changed) / Double(width * height)
    }
    func row(_ first: Int, _ last: Int, end: Int64) -> [CursorPoint] {
        let columns = Array(stride(from: first, through: last, by: 10))
        return columns.enumerated().map { index, x in
            CursorPoint(atSourceUs: end - Int64(columns.count - index - 1) * 100_000,
                x: Double(x), y: 210)
        }
    }
    let semanticClean = try await render("marks-clean", overlay: nil, edge: 320)
    let hotspotClean = try await render("marks-hotspot-clean", overlay: nil, edge: 320, atUs: 300_000)
    let semanticPointer = try await render("marks-pointer",
        overlay: FrameOverlay(pointer: CursorPoint(atSourceUs: 300_000, x: 180, y: 150)), edge: 320, atUs: 300_000)
    let semanticTrail = try await render("marks-trail",
        overlay: FrameOverlay(trail: [row(150, 270, end: atUs)], trailUs: 2_000_000), edge: 320)
    let semanticGap = try await render("marks-gap", overlay: FrameOverlay(trail: [
        row(150, 180, end: 1_700_000), row(240, 270, end: atUs),
    ], trailUs: 2_000_000), edge: 320)
    let circle = (0..<48).map { step -> CursorPoint in
        let angle = Double(step) / 48 * 2 * Double.pi
        return CursorPoint(atSourceUs: atUs - Int64(47 - step) * 34_000,
            x: 70 + 24 * cos(angle), y: 212 + 24 * sin(angle))
    }
    let wave = (0..<40).map { step -> CursorPoint in
        let progress = Double(step) / 39
        return CursorPoint(atSourceUs: atUs - Int64(39 - step) * 31_000,
            x: 12 + progress * 188, y: 155 + 13 * sin(progress * 3 * Double.pi))
    }
    let circleOverlay = FrameOverlay(trail: [circle], trailUs: 2_000_000, pointer: circle.last!)
    var cover: [String: Double] = [:]
    for edge in [320, 160] {
        let clean = edge == 320 ? semanticClean : try await render("marks-clean-160", overlay: nil, edge: edge)
        let circled = try await render("marks-circle-\(edge)", overlay: circleOverlay, edge: edge)
        let waved = try await render("marks-wave-\(edge)",
            overlay: FrameOverlay(trail: [wave], trailUs: 2_000_000, pointer: wave.last!), edge: edge)
        let divisor = 320 / edge
        cover["button-\(edge)"] = changedShare(circled, clean,
            x: FixtureFrame.buttonLeft / divisor, y: FixtureFrame.buttonTop / divisor,
            width: FixtureFrame.buttonWidth / divisor, height: FixtureFrame.buttonHeight / divisor)
        var label = 0.0, covered = 0.0
        let rows = edge == 320 ? 145..<180 : 72..<90
        let columns = edge == 320 ? 12..<187 : 6..<94
        for y in rows {
            for x in columns {
                let pixel = clean.color(x: x, y: y, width: 1, height: 1)
                guard pixel.green > 0.5, pixel.green - pixel.red > 0.25 else { continue }
                label += 1
                covered += changedShare(waved, clean, x: x, y: y, width: 1, height: 1)
            }
        }
        cover["label-\(edge)"] = label == 0 ? 0 : covered / label
        if edge == 320 {
            cover["circle-far-side"] = changedShare(circled, clean, x: 44, y: 210, width: 5, height: 5)
            let pointer = try await render("marks-circle-pointer", overlay: FrameOverlay(pointer: circle.last!), edge: edge)
            cover["pointer-far-side"] = changedShare(pointer, clean, x: 44, y: 210, width: 5, height: 5)
        }
    }
    _ = try await render("marks-repeat", overlay: circleOverlay, edge: 320)
    let thumbnailClean = try await render("marks-thumbnail-clean", overlay: nil, edge: 48)
    let thumbnail = try await render("marks-thumbnail", overlay: FrameOverlay(pointer: circle.last!), edge: 48)
    let thumbX = Int(circle.last!.x * 48 / 320), thumbY = Int(circle.last!.y * 48 / 320)
    let thumbWidth = min(24, thumbnail.width - thumbX), thumbHeight = min(24, thumbnail.height - thumbY)
    let thumbRows = (thumbY..<(thumbY + thumbHeight)).filter {
        changedShare(thumbnail, thumbnailClean, x: thumbX, y: $0, width: thumbWidth, height: 1) > 0
    }.count
    let thumbColumns = (thumbX..<(thumbX + thumbWidth)).filter {
        changedShare(thumbnail, thumbnailClean, x: $0, y: thumbY, width: 1, height: thumbHeight) > 0
    }.count
    cover["thumbnail-rows"] = Double(thumbRows)
    cover["thumbnail-columns"] = Double(thumbColumns)
    cover["oldest-trail-ink"] = ink(semanticTrail, x: 149, y: 209)
    cover["newest-trail-ink"] = ink(semanticTrail, x: 239, y: 209)
    try JSONSerialization.data(withJSONObject: cover, options: [.prettyPrinted, .sortedKeys])
        .write(to: directory.appendingPathComponent("marks-metrics.json"))
    precondition(ink(semanticPointer, x: 181, y: 154) > 0.4 && ink(hotspotClean, x: 181, y: 154) < 0.1,
        "The pointer marks its supplied hot spot while the clean frame stays clean")
    precondition(ink(semanticPointer, x: 172, y: 148, size: 4) < 0.1 &&
        ink(semanticPointer, x: 177, y: 141, size: 4) < 0.1,
        "The asymmetric glyph sits below and right of its hot spot")
    precondition(cover["oldest-trail-ink"]! > 0.15 &&
        cover["newest-trail-ink"]! > cover["oldest-trail-ink"]! + 0.1 && ink(semanticTrail, x: 200, y: 180) < 0.1,
        "Every supplied trail point remains visible with age fade and no off-path ink")
    precondition(ink(semanticGap, x: 149, y: 209) > 0.15 && ink(semanticGap, x: 269, y: 209) > 0.15 &&
        ink(semanticGap, x: 209, y: 209, size: 6) < 0.1, "No path bridges missing pointer evidence")
    for edge in [320, 160] {
        precondition(cover["button-\(edge)"]! > 0.02 && cover["button-\(edge)"]! < 0.35,
            "The circled button stays readable at \(edge) pixels: \(cover)")
        precondition(cover["label-\(edge)"]! > 0.05 && cover["label-\(edge)"]! < 0.4,
            "The crossed label stays readable at \(edge) pixels: \(cover)")
    }
    precondition(cover["pointer-far-side"] == 0 && cover["circle-far-side"]! > 0.5)
    precondition(thumbRows > 0 && thumbColumns > 0 && thumbRows <= 8 && thumbColumns <= 8)
    let originalBytes = try Data(contentsOf: directory.appendingPathComponent("marks-circle-320.png"))
    let repeatedBytes = try Data(contentsOf: directory.appendingPathComponent("marks-repeat.png"))
    precondition(originalBytes == repeatedBytes, "Repeating a compiled pointer request preserves PNG bytes")
    let angle = Double(47) / 48 * 2 * Double.pi
    let pointer = CursorPoint(atSourceUs: atUs, x: 70 + 24 * cos(angle), y: 212 + 24 * sin(angle))
    let trail: [CursorPoint] = (0..<13).map { index in
        let timestamp = atUs - Int64(12 - index) * 100_000
        let x = Double(150 + index * 10)
        return CursorPoint(atSourceUs: timestamp, x: x, y: 210)
    }
    var measurements: [String: [String: Int]] = [:]
    for placement in ["delivery", "authored", "ancestor", "full", "crop", "coverage"] {
        let edge = placement == "delivery" ? 160 : 320
        let clean = try await render("clean-" + placement, overlay: nil, edge: edge, placement: placement)
        let pointed = try await render("pointer-" + placement, overlay: FrameOverlay(pointer: pointer), edge: edge, placement: placement)
        let trailed = try await render("trail-" + placement, overlay: FrameOverlay(trail: [trail], trailUs: 2_000_000), edge: edge, placement: placement)
        let scale = placement == "full" ? 1.0 : 0.5
        let offset = placement == "ancestor" ? 120 : placement == "coverage" ? 128 : 0
        func changed(_ x: Int, _ y: Int) -> Bool {
            let drawn = pointed.color(x: x, y: y, width: 1, height: 1)
            let original = clean.color(x: x, y: y, width: 1, height: 1)
            return max(abs(drawn.red - original.red), abs(drawn.green - original.green),
                       abs(drawn.blue - original.blue)) > 0.1
        }
        let x = Int(pointer.x * scale) - ((placement == "crop" || placement == "coverage") ? 40 : 0)
        let y = Int(pointer.y * scale) + offset - ((placement == "crop" || placement == "coverage") ? 83 : 0)
        let columns = x..<min(x + 24, pointed.width)
        let rows = y..<min(y + 24, pointed.height)
        let pointerRows = rows.filter { row in columns.contains { changed($0, row) } }.count
        let pointerColumns = columns.filter { column in rows.contains { changed(column, $0) } }.count
        var core = 0, halo = 0
        if placement == "crop" || placement == "coverage" {
            measurements[placement] = ["pointerRows": pointerRows, "pointerColumns": pointerColumns]
            continue
        }
        let crossSection = Int(210 * scale) + offset
        for row in (crossSection - 9)..<min(crossSection + 11, trailed.height) {
            let sample = trailed.color(x: Int(240 * scale), y: row, width: 1, height: 1)
            if sample.red - sample.green > 0.5 { core += 1 }
            let luma = (sample.red + sample.green + sample.blue) / 3.0
            if luma < 0.12 { halo += 1 }
        }
        measurements[placement] = ["pointerRows": pointerRows, "pointerColumns": pointerColumns,
                                  "trailCoreRows": core, "trailHaloRows": halo]
    }
    try JSONSerialization.data(withJSONObject: measurements, options: [.prettyPrinted, .sortedKeys])
        .write(to: directory.appendingPathComponent("metrics.json"))
    for (placement, metrics) in measurements {
        if placement == "crop" || placement == "coverage" {
            precondition(metrics["pointerRows"]! > 0 && metrics["pointerRows"]! <= 8 &&
                         metrics["pointerColumns"]! > 0 && metrics["pointerColumns"]! <= 8,
                "A cropped thumbnail must cap the pointer against visible content: \(metrics)")
            continue
        }
        precondition(metrics["pointerRows"]! >= 12 && metrics["pointerColumns"]! >= 8 &&
                     metrics["trailCoreRows"]! >= 2 && metrics["trailHaloRows"]! >= 2,
            "Compiled \(placement) pictures must retain readable pointer/core/halo delivered-pixel floors: \(metrics)")
    }
    for kind in ["clean", "pointer", "trail"] {
        let delivered = try Data(contentsOf: directory.appendingPathComponent(kind + "-delivery.png"))
        let authored = try Data(contentsOf: directory.appendingPathComponent(kind + "-authored.png"))
        precondition(delivered == authored, "Equivalent delivery and authored reductions must publish identical \(kind) pixels")
    }
    print("PASS compiled pointer delivery floors: \(measurements)")
}
