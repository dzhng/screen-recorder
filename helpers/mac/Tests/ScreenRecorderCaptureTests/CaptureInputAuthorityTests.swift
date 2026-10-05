@preconcurrency import AVFoundation
import Foundation
import Darwin
import ScreenRecorderCapture

func runCaptureInputAuthorityTests() async throws {
    let directory = RecoveryFixture.directory("capture-input-authority")
    defer { try? FileManager.default.removeItem(at: directory) }
    let source = directory.appendingPathComponent("source.mov")
    try await RecoveryFixture.writeVariableDurationVideo(to: source, timesUs: [0, 100_000, 200_000])
    let original = try Data(contentsOf: source)
    var data = original
    func uint(_ at: Int) -> Int {
        data[at..<at + 4].reduce(0) { ($0 << 8) | Int($1) }
    }
    func setUInt(_ value: Int, at: Int) {
        for index in 0..<4 { data[at + index] = UInt8((value >> (24 - index * 8)) & 255) }
    }
    var entry: (at: Int, size: Int, ancestors: [Int])?
    func walk(_ start: Int, _ end: Int, _ ancestors: [Int]) {
        var at = start
        while at < end {
            let size = uint(at)
            precondition(size >= 8 && at + size <= end)
            let type = String(decoding: data[at + 4..<at + 8], as: UTF8.self)
            if ["url ", "alis"].contains(type) && entry == nil { entry = (at, size, ancestors) }
            if ["moov", "trak", "mdia", "minf", "dinf"].contains(type) {
                walk(at + 8, at + size, ancestors + [at])
            } else if type == "dref" { walk(at + 16, at + size, ancestors + [at]) }
            at += size
        }
    }
    walk(0, data.count, [])
    let found = entry!
    let address = Array((source.absoluteString + "\0").utf8)
    var replacement = Data(repeating: 0, count: 12 + address.count)
    for index in 0..<4 { replacement[index] = UInt8((replacement.count >> (24 - index * 8)) & 255) }
    replacement.replaceSubrange(4..<8, with: Array("url ".utf8))
    replacement.replaceSubrange(12..<replacement.count, with: address)
    for ancestor in found.ancestors {
        setUInt(uint(ancestor) + replacement.count - found.size, at: ancestor)
    }
    data.replaceSubrange(found.at..<found.at + found.size, with: replacement)
    let reference = directory.appendingPathComponent("reference.mov")
    try data.write(to: reference)
    let baseline = await CaptureMediaInspection.inspect(role: "video", url: source, acquired: nil, requested: true)
    let refused = await CaptureMediaInspection.inspect(role: "video", url: reference, acquired: nil, requested: true)
    try JSONEncoder().encode([baseline, refused]).write(to: directory.appendingPathComponent("results.json"))
    precondition(baseline.decodeReachedEnd && baseline.decodedSamples == 3 && baseline.failure == nil,
        "Ordinary recovery must still decode original source samples")
    precondition(!refused.decodeReachedEnd && refused.decodedSamples == 0 && refused.failure != nil,
        "Recovery must refuse external sample storage before decoding foreign bytes")
    precondition(chmod(source.path, 0) == 0)
    defer { chmod(source.path, 0o600) }
    let unavailable = await CaptureMediaInspection.inspect(role: "video", url: source, acquired: nil, requested: true)
    precondition(unavailable.failure?.code == "MEDIA_UNAVAILABLE" && !unavailable.decodeReachedEnd,
        "A permission denial is unavailable media, never corrupt media")
    precondition(chmod(source.path, 0o600) == 0)
    let oversized = directory.appendingPathComponent("oversized.mov")
    let headerSize = 65 * 1024 * 1024
    var prefix = Data(repeating: 0, count: 12)
    for index in 0..<4 { prefix[index] = UInt8((headerSize >> (24 - index * 8)) & 255) }
    prefix.replaceSubrange(4..<12, with: Data("ftypqt  ".utf8))
    try prefix.write(to: oversized)
    let large = try FileHandle(forWritingTo: oversized)
    try large.truncate(atOffset: UInt64(headerSize))
    try large.close()
    let budget = await CaptureMediaInspection.inspect(role: "video", url: oversized, acquired: nil, requested: true)
    precondition(budget.failure?.code == "LIMIT_EXCEEDED" && !budget.decodeReachedEnd,
        "Deterministic loader refusal must not be translated as unavailable or corrupt media")
    let unchanged = try Data(contentsOf: source)
    precondition(unchanged == original, "Recovery must preserve source bytes")
    print("PASS capture recovery preserves ordinary source decoding and refuses external references before reading samples")
}
