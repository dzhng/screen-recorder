@preconcurrency import AVFoundation
import CryptoKit
import Foundation
@testable import ScreenRecorderFrames
import ScreenRecorderMedia

func verifyCompositionPointerReadability(in parent: URL) async throws {
    let directory = parent.appendingPathComponent("pointer-readability")
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
    let source = directory.appendingPathComponent("source.mp4")
    try await FixtureWriter.write(to: source,
        times: (0..<26).map { CMTime(value: Int64($0), timescale: 10) })
    let track = try await AVURLAsset(url: source).loadTracks(withMediaType: .video)[0]
    let streamId = "track:\(track.trackID)"
    let atUs: Int64 = 2_500_000
    func render(_ name: String, overlay: FrameOverlay?, edge: Int = 160, placement: String = "delivery") async throws -> FixtureImage {
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
            "frame": ["index": 25, "sampleAtUs": atUs,
                      "visibleRange": ["startUs": atUs, "endUs": 2_600_000],
                      "layers": [["kind": "video", "clipId": "c", "trackId": "t", "assetId": "a",
                                  "streamId": streamId, "sourceUs": atUs, "availability": "available",
                                  "width": 320, "height": 240]],
                      "visual": visual],
            "assets": [["assetId": "a", "streamId": streamId, "path": source.path, "originUs": 0]],
        ]
        if let overlay {
            let row: [String: Any] = [
                "frameIndex": 25, "sampleAtUs": atUs, "clipId": "c", "stepId": "pointer",
                "trailUs": overlay.trailUs, "status": "picture", "assetId": "a", "streamId": streamId,
                "requestedSourceUs": atUs, "captureUs": atUs, "clockOffsetUs": 0,
                "sourceToAssetOffsetUs": 0, "width": 320, "height": 240,
                "start": ["value": "25", "timescale": 10], "end": ["value": "26", "timescale": 10],
                "sampleTime": ["value": "25", "timescale": 10],
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
