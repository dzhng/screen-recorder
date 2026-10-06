@preconcurrency import AVFoundation
import Foundation
import CryptoKit
import YapFrames
import YapMedia

func verifyExactPresentation(in directory: URL) async throws {
    let source = directory.appendingPathComponent("exact-30fps.mp4")
    try await FixtureWriter.write(to: source, times: (0..<33).map { CMTime(value: Int64($0), timescale: 30) })
    let clip: [String: Any] = ["kind": "clip", "id": "c"]
    let visual: [[String: Any]] = [
        ["target": clip, "inputs": [], "operations": []],
        ["target": ["kind": "output"], "inputs": [clip], "operations": []],
    ]
    func render(_ name: String, numerator: Int64, denominator: Int64, expected: Int, origin: Any = 0,
                expectedActual: Int64? = nil,
                pointerCutoff: Int64? = nil, pointerSource: [String: Int64]? = nil) async throws {
        let origin = try JSONDecoder().decode(ExactTime.self,
            from: JSONSerialization.data(withJSONObject: origin, options: .fragmentsAllowed))
        let output = directory.appendingPathComponent("exact-\(name).png")
        func wire(_ value: ExactTime) throws -> Any {
            try JSONSerialization.jsonObject(with: JSONEncoder().encode(value), options: .fragmentsAllowed)
        }
        let selected = try wire(ExactTime(Int128(numerator), Int128(denominator)))
        var frameVisual = visual
        if pointerCutoff != nil {
            frameVisual[0]["operations"] = [["kind": "pointer", "stepId": "p", "trailUs": 0, "geometryPrefix": []]]
        }
        var body: [String: Any] = [
            "output": output.path, "profile": "h264-rec709", "processing": [],
            "canvas": ["width": 320, "height": 240, "fps": ["numerator": 30, "denominator": 1], "background": "#000000ff"],
            "frame": ["index": 29, "sampleAtUs": 966666,
                "visibleRange": ["startUs": 999999, "endUs": 1000000], "visual": frameVisual,
                "layers": [["kind": "video", "clipId": "c", "trackId": "t", "assetId": "a",
                    "streamId": "track:1", "sourceUs": selected, "availability": "available", "width": 320, "height": 240]]],
            "assets": [["assetId": "a", "streamId": "track:1", "path": source.path, "originUs": try wire(origin)]],
        ]
        if let pointerCutoff {
            let row: [String: Any] = [
                "frameIndex": 29, "sampleAtUs": 966666, "clipId": "c", "stepId": "p", "trailUs": 0,
                "status": "picture", "assetId": "a", "streamId": "track:1",
                "requestedSourceUs": pointerSource.map { $0 as Any } ?? selected, "captureUs": pointerCutoff,
                "clockOffsetUs": 0, "sourceToAssetOffsetUs": try wire(ExactTime(0).subtract(origin)), "width": 320, "height": 240,
                "start": ["value": "29", "timescale": 30], "end": ["value": "30", "timescale": 30],
                "sampleTime": ["value": "29", "timescale": 30], "overlay": ["trail": [], "trailUs": 0],
            ]
            var bytes = try JSONSerialization.data(withJSONObject: row)
            bytes.append(10)
            let path = directory.appendingPathComponent("exact-\(name)-pointers.jsonl")
            try bytes.write(to: path)
            body["pointers"] = ["file": path.path, "bytes": bytes.count, "records": 1,
                "sha256": SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()]
        }
        let request = try JSONDecoder().decode(CompositionFrameRenderer.Request.self,
            from: JSONSerialization.data(withJSONObject: body))
        let result = try await CompositionFrameRenderer.write(request)
        let receipt = try JSONSerialization.jsonObject(with: JSONEncoder().encode(result)) as! [String: Any]
        let picture = (receipt["pictures"] as! [[String: Any]])[0]
        if let expectedActual { precondition(picture["actualSourceUs"] as? Int64 == expectedActual) }
        let time = picture["sample"] as! [String: Any]
        let physical = CMTime(value: Int64(time["value"] as! String)!, timescale: Int32(time["timescale"] as! Int))
        precondition(physical == CMTime(value: Int64(expected), timescale: 30), "\(name): wrong exact presentation support")
        let returned = try JSONDecoder().decode(ExactTime.self,
            from: JSONSerialization.data(withJSONObject: picture["requestedSourceUs"]!, options: .fragmentsAllowed))
        precondition(returned == ExactTime(Int128(numerator), Int128(denominator)), "Requested time lost precision")
        let image = try FixtureImage(contentsOf: output)
        precondition(image.statedFrameIndex() == expected, "\(name): image states \(image.statedFrameIndex()), expected \(expected)")
    }
    // Matching CFR identity cannot duplicate or skip pictures through integer-us rounding.
    for index in 0..<30 {
        try await render("frame-\(index)", numerator: Int64(index) * 1000000, denominator: 30, expected: index)
    }
    try await render("before-29", numerator: 2899999, denominator: 3, expected: 28)
    try await render("large-denominator-before", numerator: 3866666667633333, denominator: 4000000001, expected: 28)
    try await render("large-denominator-after", numerator: 3866666667633334, denominator: 4000000001, expected: 29)
    try await render("positive-origin", numerator: 2897000, denominator: 3, expected: 29, origin: 1000)
    try await render("negative-origin", numerator: 2903000, denominator: 3, expected: 29, origin: -1000)
    try await render("positive-fractional-origin", numerator: 2899999, denominator: 3,
        expected: 29, origin: ["numerator": 1, "denominator": 3], expectedActual: 966666)
    try await render("negative-fractional-origin", numerator: 2900001, denominator: 3,
        expected: 29, origin: ["numerator": -1, "denominator": 3], expectedActual: 966667)
    try await render("pointer-exact-support", numerator: 2897000, denominator: 3, expected: 29,
        origin: 1000, pointerCutoff: 966666)
    for (name, cutoff, source) in [
        ("pointer-wrong-cutoff", Int64(966667), ["numerator": Int64(2900000), "denominator": Int64(3)]),
        ("pointer-wrong-exact-source", Int64(966666), ["numerator": Int64(5800001), "denominator": Int64(6)]),
    ] {
        do {
            try await render(name, numerator: 2900000, denominator: 3, expected: 29,
                pointerCutoff: cutoff, pointerSource: source)
            preconditionFailure("\(name) was accepted")
        } catch let error as NativeFailure { precondition(error.code == "INVALID_REQUEST", "\(error)") }
        precondition(!FileManager.default.fileExists(atPath: directory.appendingPathComponent("exact-\(name).png").path))
    }
    let sequential = try await PresentationSource(source: source, streamId: "track:1", startUs: 0)
    for index in 0..<30 {
        let at = ExactTime(Int128(index) * 1000000, 30)
        let selected = try sequential.selection(at: at, end: .positiveInfinity)
        precondition(selected.sampleTime == CMTime(value: Int64(index), timescale: 30))
    }
    print("PASS exact compiled pictures: all 30 CFR frames, rational boundaries, large denominators, origins, pointer membership/cutoffs and sequential reuse")
}
