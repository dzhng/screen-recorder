import Foundation
import YapMedia
@testable import YapWire

// Generated ISO headers isolate finalization arithmetic and ownership; they are not decode fixtures.
func checkMovieAudioTail(at directory: URL) async throws {
    func word(_ value: UInt64, _ width: Int = 4) -> Data {
        Data((0..<width).reversed().map { UInt8(truncatingIfNeeded: value >> ($0 * 8)) })
    }
    func atom(_ type: String, _ body: Data) -> Data {
        word(UInt64(body.count + 8)) + Data(type.utf8) + body
    }
    let mvhd = Data(repeating: 0, count: 12) + word(6_000_000) + word(600_120)
    let tkhd = Data(repeating: 0, count: 20) + word(600_000)
    let elst = Data(repeating: 0, count: 4) + word(1) + word(600_000) + word(2112) + word(0x10000)
    let media = atom("hdlr", Data(repeating: 0, count: 8) + Data("soun".utf8))
        + atom("minf", Data("sample tables must survive".utf8))
    let track = atom("trak", atom("tkhd", tkhd) + atom("edts", atom("elst", elst)) + atom("mdia", media))
    let movie = atom("moov", atom("mvhd", mvhd) + track + atom("udta", Data("unknown metadata".utf8)))
    let prefix = atom("mdat", Data("unchanged encoded packets".utf8))
    let original = prefix + movie
    let manager = FileManager.default
    try manager.createDirectory(at: directory, withIntermediateDirectories: true)
    func attempt(_ name: String, bytes: Data, frames: Int64 = 4800, cancel: Bool = false) async throws {
        let destination = directory.appendingPathComponent(name + ".mp4")
        let output = try NewFile(at: destination.path, assembledAs: "movie.mp4")
        defer { output.discard() }
        try bytes.write(to: directory.appendingPathComponent(name + "-before.iso"))
        try output.write(bytes)
        let file = try FileHandle(forUpdating: output.url)
        defer { try? file.close() }
        let work = Task {
            if cancel { withUnsafeCurrentTask { $0?.cancel() } }
            try MovieAudioTail.extend(file, at: output.url, durationUs: 100020, pcmFrames: frames, rate: 48000)
        }
        do { try await work.value; preconditionFailure("Malformed or canceled finalization succeeded") }
        catch is CancellationError { precondition(cancel) }
        catch let failure as NativeFailure {
            precondition(!cancel && failure.code == "INVALID_RESPONSE", "Unexpected refusal: \(failure)")
        }
        let unchanged = try Data(contentsOf: output.url)
        try unchanged.write(to: directory.appendingPathComponent(name + "-after.iso"))
        precondition(unchanged == bytes, "Refusal mutated staged bytes")
        precondition(!manager.fileExists(atPath: destination.path), "Refusal published output")
    }
    var eof = movie
    eof.replaceSubrange(0..<4, with: word(0))
    try await attempt("eof-sized-moov", bytes: prefix + eof)
    try await attempt("duplicate-moov", bytes: original + movie)
    try await attempt("missing-pcm", bytes: original, frames: 4799)
    try await attempt("canceled", bytes: original, cancel: true)

    // Version-one clocks must retain their 64-bit fields and append a 64-bit empty edit.
    let v1 = Data([1, 0, 0, 0])
    let wideHeader = v1 + Data(repeating: 0, count: 16) + word(6_000_000) + word(600_120, 8)
    let wideTrack = v1 + Data(repeating: 0, count: 24) + word(600_000, 8)
    let wideList = v1 + word(1) + word(600_000, 8) + word(2112, 8) + word(0x10000)
    let wideMovie = atom("moov", atom("mvhd", wideHeader) + atom("trak",
        atom("tkhd", wideTrack) + atom("edts", atom("elst", wideList)) + atom("mdia", media)))
    let wide = try NewFile(at: directory.appendingPathComponent("wide.mp4").path, assembledAs: "movie.mp4")
    defer { wide.discard() }
    try wide.write(prefix + wideMovie)
    let wideFile = try FileHandle(forUpdating: wide.url)
    defer { try? wideFile.close() }
    try MovieAudioTail.extend(wideFile, at: wide.url, durationUs: 100020, pcmFrames: 4800, rate: 48000)
    let completed = try Data(contentsOf: wide.url)
    precondition(completed.prefix(prefix.count) == prefix, "Finalization changed encoded payload")
    let emptyEdit = word(120, 8) + Data(repeating: 0xff, count: 8) + word(0x10000)
    precondition(completed.range(of: emptyEdit) != nil, "Missing version-one fractional empty edit")
    precondition(completed.range(of: atom("minf", Data("sample tables must survive".utf8))) != nil)
    _ = try wide.publish()

    let destination = directory.appendingPathComponent("replaced.mp4")
    let output = try NewFile(at: destination.path, assembledAs: "movie.mp4")
    let stage = output.url.deletingLastPathComponent()
    let held = directory.appendingPathComponent("held-original-stage")
    defer { output.discard(); try? manager.removeItem(at: held) }
    try output.write(original)
    let file = try FileHandle(forUpdating: output.url)
    defer { try? file.close() }
    try manager.moveItem(at: stage, to: held)
    let sentinel = directory.appendingPathComponent("replacement-sentinel")
    try manager.createDirectory(at: sentinel, withIntermediateDirectories: false)
    try original.write(to: sentinel.appendingPathComponent("movie.mp4"))
    try manager.createSymbolicLink(at: stage, withDestinationURL: sentinel)
    // A valid external header would be changed by a URL-reopening finalizer.
    do {
        try MovieAudioTail.extend(file, at: output.url, durationUs: 100020, pcmFrames: 4800, rate: 48000)
        preconditionFailure("Replacement staging was accepted")
    } catch let failure as NativeFailure {
        precondition(failure.code == "INVALID_OUTPUT")
        precondition(failure.message == "Movie staging locator changed before finalization.")
    }
    let external = try Data(contentsOf: output.url)
    let kept = try Data(contentsOf: held.appendingPathComponent("movie.mp4"))
    precondition(external == original, "Replacement sentinel was modified")
    precondition(kept == original, "Held original was modified on refusal")
    precondition(!manager.fileExists(atPath: destination.path))
    // The real NewFile cleanup is checked after both failed attempts leave scope.
    output.discard()
    let replacement = try manager.destinationOfSymbolicLink(atPath: stage.path)
    precondition(replacement == sentinel.path, "Cleanup removed or changed the replacement symlink")
    precondition(!manager.fileExists(atPath: held.path), "Cleanup retained the owned staging entry")
    let surviving = try Data(contentsOf: sentinel.appendingPathComponent("movie.mp4"))
    precondition(surviving == original, "Cleanup removed or changed external sentinel")
    print("PASS fractional-tail header refusal, cancellation, replacement sentinel and staging cleanup")
}
